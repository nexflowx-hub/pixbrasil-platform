import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import type { MerchantApiContext } from "../merchant-auth/merchant-auth.types";
import { ProviderAdapterRegistry } from "../providers/provider-adapter.registry";
import { RoutingEngineService } from "../routing/routing-engine.service";
import type {
  RouteCandidate,
  RoutingStrategy,
} from "../routing/routing-engine";
import { executeProviderAttempt } from "./provider-execution";

interface ChargeInput {
  store?: unknown;
  amount?: unknown;
  currency?: unknown;
  reference?: unknown;
  description?: unknown;
  payer?: {
    name?: unknown;
    taxId?: unknown;
    email?: unknown;
    phone?: unknown;
  };
  metadata?: unknown;
}

interface StoreConfigRow {
  store_id: string;
  store_code: string;
  store_name: string;
  merchant_id: string;
  account_id: string;
  merchant_tier: string;
  route_cost_profile_id: string;
  route_cost_profile_code: string;
  release_profile_id: string;
  release_profile_code: string;
  release_class: string;
  fee_profile_id: string | null;
  fee_profile_code: string | null;
  policy_id: string;
  policy_name: string;
  policy_version: number;
  strategy: RoutingStrategy;
  activation_mode: "SHADOW" | "ENFORCED";
}

interface CandidateRow {
  connection_id: string;
  provider_code: string;
  gateway_alias: string;
  priority: number;
  weight: string;
  min_amount: string | null;
  max_amount: string | null;
  allowed_account_tiers: string[];
  daily_volume_cap: string | null;
  monthly_volume_cap: string | null;
  health: RouteCandidate["health"];
  enabled: boolean;
  cost_bps: string | null;
}

interface FeeRuleRow {
  fee_bps: string;
  fixed_fee_brl: string;
}

export function calculateFeeBrl(
  amount: number,
  feeBps: number,
  fixedFeeBrl: number,
): number {
  return Math.round((amount * (feeBps / 10_000) + fixedFeeBrl) * 100) / 100;
}

function requiredString(value: unknown, label: string): string {
  const parsed = String(value ?? "").trim();
  if (!parsed) throw new BadRequestException(`${label} is required.`);
  return parsed;
}

function normalizeTaxId(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function validateCpf(value: string): boolean {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(value[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function validateCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;

  const calculate = (length: 12 | 13) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = value
      .slice(0, length)
      .split("")
      .reduce((total, char, index) => total + Number(char) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return (
    calculate(12) === Number(value[12]) &&
    calculate(13) === Number(value[13])
  );
}

function validateTaxId(value: string): boolean {
  return value.length === 11 ? validateCpf(value) : validateCnpj(value);
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("metadata must be a JSON object.");
  }

  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 16_384) {
    throw new BadRequestException("metadata exceeds the 16 KB limit.");
  }

  return value as Record<string, unknown>;
}


function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeProviderAction(providerCode: string, payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root.data);

  if (providerCode === "MISTICPAY") {
    const copyPaste = String(data.copyPaste ?? "").trim();
    return copyPaste
      ? {
          type: "PIX_QR",
          copyPaste,
          qrImage: String(data.qrCodeBase64 ?? data.qrcodeUrl ?? "").trim() || null,
          expiresAt: null,
        }
      : null;
  }

  if (providerCode === "PIXGO") {
    const copyPaste = String(data.qr_code ?? "").trim();
    return copyPaste
      ? {
          type: "PIX_QR",
          copyPaste,
          qrImage: String(data.qr_image_url ?? "").trim() || null,
          expiresAt: String(data.expires_at ?? "").trim() || null,
        }
      : null;
  }

  return null;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly routing: RoutingEngineService,
    private readonly providers: ProviderAdapterRegistry,
  ) {}

  async getPayment(
    merchant: MerchantApiContext,
    paymentIntentId: string,
  ) {
    const result = await this.database.query<{
      id: string;
      external_reference: string | null;
      amount: string;
      currency: string;
      status: string;
      payment_method: string;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
      store_code: string;
      store_name: string;
      provider_code: string | null;
      gateway_alias: string | null;
      provider_payment_id: string | null;
      provider_attempt_status: string | null;
      ambiguous: boolean | null;
      response_metadata: Record<string, unknown> | null;
      metadata: Record<string, unknown>;
    }>(
      `
      select
        pi.id,
        pi.external_reference,
        pi.amount::text,
        pi.currency,
        pi.status,
        pi.payment_method,
        pi.created_at::text,
        pi.updated_at::text,
        pi.completed_at::text,
        s.code as store_code,
        s.name as store_name,
        p.code as provider_code,
        gc.alias as gateway_alias,
        pa.provider_payment_id,
        pa.status as provider_attempt_status,
        pa.ambiguous,
        pa.response_metadata,
        pi.metadata
      from pixbrasil.payment_intents pi
      join pixbrasil.stores s on s.id=pi.store_id
      join pixbrasil.merchant_api_key_store_grants g
        on g.store_id=s.id
       and g.api_key_id=$1::uuid
      left join lateral (
        select pa0.*
        from pixbrasil.provider_attempts pa0
        where pa0.payment_intent_id=pi.id
        order by pa0.attempt_no desc
        limit 1
      ) pa on true
      left join pixbrasil.gateway_connections gc
        on gc.id=coalesce(pa.gateway_connection_id,pi.selected_connection_id)
      left join public.providers p on p.id=gc.provider_id
      where pi.id=$2::uuid
        and pi.merchant_id=$3::uuid
      limit 1
      `,
      [merchant.apiKeyId, paymentIntentId, merchant.merchantId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException(
        "PaymentIntent not found or not granted to this API key.",
      );
    }

    return {
      success: true,
      data: {
        paymentIntentId: row.id,
        reference: row.external_reference,
        amount: Number(row.amount),
        currency: row.currency,
        paymentMethod: row.payment_method,
        status: row.status,
        store: {
          code: row.store_code,
          name: row.store_name,
        },
        routing: {
          providerCode: row.provider_code,
          gatewayAlias: row.gateway_alias,
          mode: row.metadata?.routingMode ?? null,
          releaseClass: row.metadata?.releaseClass ?? null,
        },
        provider: row.provider_payment_id
          ? {
              paymentId: row.provider_payment_id,
              attemptStatus: row.provider_attempt_status,
              ambiguous: Boolean(row.ambiguous),
              action:
                row.response_metadata &&
                typeof row.response_metadata.action === "object"
                  ? row.response_metadata.action
                  : row.metadata?.providerAction ?? null,
            }
          : null,
        economics: row.metadata?.shadowQuote ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      },
    };
  }

  async createCharge(
    merchant: MerchantApiContext,
    idempotencyKeyValue: string | undefined,
    input: ChargeInput,
  ) {
    const idempotencyKey = requiredString(
      idempotencyKeyValue,
      "Idempotency-Key",
    ).slice(0, 200);
    const storeCode = requiredString(input.store, "store").toUpperCase();
    const reference = requiredString(input.reference, "reference").slice(0, 160);
    const currency = String(input.currency ?? "BRL").toUpperCase();

    if (currency !== "BRL") {
      throw new BadRequestException("PiXBrasil V1 accepts BRL only.");
    }

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be a positive number.");
    }
    const normalizedAmount = Math.round(amount * 100) / 100;

    const payerName = requiredString(input.payer?.name, "payer.name").slice(0, 100);
    const payerTaxId = normalizeTaxId(input.payer?.taxId);
    if (
      (!/^\d{11}$/.test(payerTaxId) && !/^\d{14}$/.test(payerTaxId)) ||
      !validateTaxId(payerTaxId)
    ) {
      throw new BadRequestException("payer.taxId must be a valid CPF/CNPJ.");
    }

    const merchantMetadata = normalizeMetadata(input.metadata);

    const configResult = await this.database.query<StoreConfigRow>(
      `
      select
        s.id as store_id,
        s.code as store_code,
        s.name as store_name,
        m.id as merchant_id,
        m.account_id,
        m.tier_code as merchant_tier,
        sfp.route_cost_profile_id,
        rcp.code as route_cost_profile_code,
        sfp.release_profile_id,
        rel.code as release_profile_code,
        rel.release_class,
        sfp.fee_profile_id,
        fp.code as fee_profile_code,
        rp.id as policy_id,
        rp.name as policy_name,
        rp.version as policy_version,
        rp.strategy,
        rp.activation_mode
      from pixbrasil.stores s
      join pixbrasil.merchants m on m.id=s.merchant_id
      join pixbrasil.merchant_api_key_store_grants grant_row
        on grant_row.store_id=s.id
       and grant_row.api_key_id=$1::uuid
      join pixbrasil.store_financial_profiles sfp on sfp.store_id=s.id
      join pixbrasil.route_cost_profiles rcp on rcp.id=sfp.route_cost_profile_id
      join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
      left join pixbrasil.fee_profiles fp on fp.id=sfp.fee_profile_id
      join lateral (
        select rp0.*
        from pixbrasil.routing_policies rp0
        where rp0.store_id=s.id
          and rp0.payment_method='PIX'
          and rp0.currency='BRL'
          and rp0.status='ACTIVE'
        order by rp0.priority asc, rp0.version desc
        limit 1
      ) rp on true
      where s.merchant_id=$2::uuid
        and upper(s.code)=upper($3::text)
        and s.status='ACTIVE'
      limit 1
      `,
      [merchant.apiKeyId, merchant.merchantId, storeCode],
    );

    const config = configResult.rows[0];
    if (!config) {
      if (!merchant.allowedStoreIds.length) {
        throw new ForbiddenException("API key has no store grants.");
      }
      throw new NotFoundException(
        "Store not found, inactive, or not granted to this API key.",
      );
    }

    const requestFingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          merchantId: merchant.merchantId,
          storeId: config.store_id,
          amount: normalizedAmount,
          currency,
          reference,
          payerTaxId,
        }),
      )
      .digest("hex");

    const existing = await this.database.query<{
      id: string;
      metadata: Record<string, unknown>;
      status: string;
      attempt_status: string | null;
      provider_payment_id: string | null;
    }>(
      `
      select
        pi.id,
        pi.metadata,
        pi.status,
        pa.status as attempt_status,
        pa.provider_payment_id
      from pixbrasil.payment_intents pi
      left join lateral (
        select pa0.status,pa0.provider_payment_id
        from pixbrasil.provider_attempts pa0
        where pa0.payment_intent_id=pi.id
        order by pa0.attempt_no desc
        limit 1
      ) pa on true
      where pi.account_id=$1::uuid
        and pi.idempotency_key=$2::varchar
      limit 1
      `,
      [merchant.accountId, idempotencyKey],
    );

    let resumablePaymentIntentId: string | null = null;

    if (existing.rows[0]) {
      const row = existing.rows[0];
      const storedFingerprint = String(
        row.metadata?.requestFingerprint ?? "",
      );
      if (storedFingerprint && storedFingerprint !== requestFingerprint) {
        throw new ConflictException(
          "Idempotency-Key was already used with a different payment payload.",
        );
      }

      if (
        row.attempt_status &&
        !row.provider_payment_id &&
        ["STARTED", "AMBIGUOUS"].includes(row.attempt_status)
      ) {
        await this.database.query(
          `
          update pixbrasil.payment_intents
          set status='RECONCILIATION_REQUIRED',updated_at=now()
          where id=$1::uuid
            and status not in ('SUCCEEDED','FAILED','CANCELED')
          `,
          [row.id],
        );
        return this.loadChargeResult(row.id, true);
      }

      if (
        !row.attempt_status &&
        ["ROUTING", "CREATED", "PROVIDER_PENDING"].includes(row.status)
      ) {
        resumablePaymentIntentId = row.id;
      } else {
        return this.loadChargeResult(row.id, true);
      }
    }

    const routeCostRule = await this.database.query<FeeRuleRow>(
      `
      select fee_bps::text,fixed_fee_brl::text
      from pixbrasil.route_cost_rules
      where route_cost_profile_id=$1::uuid
        and direction='INBOUND'
        and rail='PIX'
        and enabled=true
        and effective_from <= now()
        and (effective_to is null or effective_to > now())
        and (min_amount_brl is null or min_amount_brl <= $2::numeric)
        and (max_amount_brl is null or max_amount_brl >= $2::numeric)
      order by coalesce(min_amount_brl,0) desc
      limit 1
      `,
      [config.route_cost_profile_id, normalizedAmount],
    );

    if (!routeCostRule.rows[0]) {
      throw new ConflictException("No active inbound route-cost rule matches this store.");
    }

    const platformFeeRule = config.fee_profile_id
      ? await this.database.query<FeeRuleRow>(
          `
          select fee_bps::text,fixed_fee_brl::text
          from pixbrasil.fee_rules
          where fee_profile_id=$1::uuid
            and payment_method='PIX'
            and transaction_type='PAYMENT'
            and enabled=true
            and effective_from <= now()
            and (effective_to is null or effective_to > now())
          order by effective_from desc
          limit 1
          `,
          [config.fee_profile_id],
        )
      : { rows: [] as FeeRuleRow[] };

    const releaseRules = await this.database.query<{
      rail: string;
      asset_code: string | null;
      network_code: string | null;
      availability_mode: string;
      available_after_minutes: number | null;
      max_release_minutes: number | null;
      payout_mode: string;
      ticket_required: boolean;
    }>(
      `
      select
        rail,asset_code,network_code,availability_mode,
        available_after_minutes,max_release_minutes,payout_mode,ticket_required
      from pixbrasil.release_rules
      where release_profile_id=$1::uuid
        and enabled=true
      order by rail,asset_code nulls first,network_code nulls first
      `,
      [config.release_profile_id],
    );

    const costRule = routeCostRule.rows[0];
    const platformRule = platformFeeRule.rows[0] ?? {
      fee_bps: "0",
      fixed_fee_brl: "0",
    };
    const routeCostBrl = calculateFeeBrl(
      normalizedAmount,
      Number(costRule.fee_bps),
      Number(costRule.fixed_fee_brl),
    );
    const platformFeeBrl = calculateFeeBrl(
      normalizedAmount,
      Number(platformRule.fee_bps),
      Number(platformRule.fixed_fee_brl),
    );
    const estimatedNetBrl =
      Math.round(
        Math.max(0, normalizedAmount - routeCostBrl - platformFeeBrl) * 100,
      ) / 100;

    const taxIdHash = createHash("sha256").update(payerTaxId).digest("hex");
    const customerSnapshot = {
      name: payerName,
      taxIdHash,
      taxIdLast4: payerTaxId.slice(-4),
      taxIdType: payerTaxId.length === 11 ? "CPF" : "CNPJ",
      ...(String(input.payer?.email ?? "").trim()
        ? { email: String(input.payer?.email).trim().slice(0, 255) }
        : {}),
      ...(String(input.payer?.phone ?? "").trim()
        ? { phone: String(input.payer?.phone).trim().slice(0, 32) }
        : {}),
    };

    let paymentIntentId = resumablePaymentIntentId;

    if (!paymentIntentId) {
      const inserted = await this.database.query<{ id: string }>(
        `
        insert into pixbrasil.payment_intents(
          account_id,merchant_id,store_id,external_reference,idempotency_key,
          payment_method,amount,currency,status,customer_snapshot,metadata
        )
        values(
          $1::uuid,$2::uuid,$3::uuid,$4::varchar,$5::varchar,
          'PIX',$6::numeric,'BRL','ROUTING',$7::jsonb,$8::jsonb
        )
        on conflict (account_id,idempotency_key) do nothing
        returning id
        `,
        [
          merchant.accountId,
          merchant.merchantId,
          config.store_id,
          reference,
          idempotencyKey,
          normalizedAmount,
          JSON.stringify(customerSnapshot),
          JSON.stringify({
            requestFingerprint,
            description: String(input.description ?? "").slice(0, 200),
            merchantMetadata,
          }),
        ],
      );

      if (!inserted.rows[0]) {
        const duplicate = await this.database.query<{ id: string }>(
          `
          select id from pixbrasil.payment_intents
          where account_id=$1::uuid and idempotency_key=$2::varchar
          limit 1
          `,
          [merchant.accountId, idempotencyKey],
        );
        if (!duplicate.rows[0]) {
          throw new ConflictException("Unable to resolve idempotent payment.");
        }
        return this.loadChargeResult(duplicate.rows[0].id, true);
      }

      paymentIntentId = inserted.rows[0].id;
    }

    const candidatesResult = await this.database.query<CandidateRow>(
      `
      select
        gc.id as connection_id,
        p.code as provider_code,
        gc.alias as gateway_alias,
        rr.priority,
        rr.weight::text,
        rr.min_amount::text,
        rr.max_amount::text,
        rr.allowed_account_tiers::text[],
        rr.daily_volume_cap::text,
        rr.monthly_volume_cap::text,
        coalesce(gc.metadata->>'lastConnectionHealth','UNKNOWN') as health,
        (
          rr.enabled
          and gc.status='ACTIVE'
          and coalesce((gc.metadata->>'routingEligible')::boolean,false)
        ) as enabled,
        rr.cost_bps::text
      from pixbrasil.routing_routes rr
      join pixbrasil.gateway_connections gc on gc.id=rr.gateway_connection_id
      join public.providers p on p.id=gc.provider_id
      where rr.policy_id=$1::uuid
      order by rr.priority asc
      `,
      [config.policy_id],
    );

    const candidates: RouteCandidate[] = candidatesResult.rows.map((row) => ({
      connectionId: row.connection_id,
      providerCode: row.provider_code,
      priority: row.priority,
      weight: Number(row.weight),
      minAmount: row.min_amount == null ? undefined : Number(row.min_amount),
      maxAmount: row.max_amount == null ? undefined : Number(row.max_amount),
      allowedTiers: row.allowed_account_tiers ?? [],
      dailyVolumeCap:
        row.daily_volume_cap == null ? undefined : Number(row.daily_volume_cap),
      monthlyVolumeCap:
        row.monthly_volume_cap == null
          ? undefined
          : Number(row.monthly_volume_cap),
      health: row.health,
      costBps: row.cost_bps == null ? undefined : Number(row.cost_bps),
      enabled: row.enabled,
    }));

    const draft = this.routing.evaluate(
      {
        paymentIntentId,
        accountId: merchant.accountId,
        accountType: "BUSINESS",
        merchantId: merchant.merchantId,
        storeId: config.store_id,
        accountTier: config.merchant_tier,
        amount: normalizedAmount,
        currency: "BRL",
        paymentMethod: "PIX",
        policyId: config.policy_id,
        policyVersion: config.policy_version,
      },
      candidates,
      config.strategy,
    );

    const selected = draft.selected;
    const selectedRow = selected
      ? candidatesResult.rows.find(
          (row) => row.connection_id === selected.connectionId,
        )
      : undefined;

    const quote = {
      grossBrl: normalizedAmount,
      providerRouteCostBrl: routeCostBrl,
      platformFeeBrl,
      estimatedMerchantNetBrl: estimatedNetBrl,
      routeCostProfile: config.route_cost_profile_code,
      platformFeeProfile: config.fee_profile_code,
    };

    if (!selected || !selectedRow) {
      await this.database.query(
        `
        insert into pixbrasil.routing_decisions(
          payment_intent_id,policy_id,policy_version,strategy,
          selected_connection_id,sticky_key,eligible_candidates,
          rejected_candidates,evidence,outcome
        )
        values(
          $1::uuid,$2::uuid,$3::int,$4::text,null,$5::varchar,
          $6::jsonb,$7::jsonb,$8::jsonb,'NO_ROUTE'
        )
        `,
        [
          paymentIntentId,
          config.policy_id,
          config.policy_version,
          config.strategy,
          `${paymentIntentId}:${config.policy_id}:${config.policy_version}`,
          JSON.stringify(draft.eligible),
          JSON.stringify(draft.rejected),
          JSON.stringify({
            mode: config.activation_mode,
            routeCostProfile: config.route_cost_profile_code,
            releaseProfile: config.release_profile_code,
            releaseClass: config.release_class,
          }),
        ],
      );
      await this.database.query(
        `update pixbrasil.payment_intents set status='FAILED',updated_at=now() where id=$1::uuid`,
        [paymentIntentId],
      );
      throw new ConflictException("No healthy PIX route is available for this Store.");
    }

    const enforcementFlag = await this.database.query<{ enabled: boolean }>(
      `select enabled from controlplane.feature_flags where key='routing_enforcement' limit 1`,
    );
    const enforced =
      Boolean(enforcementFlag.rows[0]?.enabled) &&
      config.activation_mode === "ENFORCED";
    const routingMode = enforced ? "ENFORCED" : "SHADOW";
    const outcome = enforced ? "SELECTED" : "SHADOW_ONLY";

    const decision = await this.database.query<{ id: string }>(
      `
      insert into pixbrasil.routing_decisions(
        payment_intent_id,policy_id,policy_version,strategy,
        selected_connection_id,sticky_key,eligible_candidates,
        rejected_candidates,evidence,outcome
      )
      values(
        $1::uuid,$2::uuid,$3::int,$4::text,$5::uuid,$6::varchar,
        $7::jsonb,$8::jsonb,$9::jsonb,$10::text
      )
      returning id
      `,
      [
        paymentIntentId,
        config.policy_id,
        config.policy_version,
        config.strategy,
        selected.connectionId,
        `${paymentIntentId}:${config.policy_id}:${config.policy_version}`,
        JSON.stringify(
          draft.eligible.map((candidate) => ({
            connectionId: candidate.connectionId,
            providerCode: candidate.providerCode,
            priority: candidate.priority,
            health: candidate.health,
          })),
        ),
        JSON.stringify(draft.rejected),
        JSON.stringify({
          mode: routingMode,
          routeCostProfile: config.route_cost_profile_code,
          releaseProfile: config.release_profile_code,
          releaseClass: config.release_class,
          platformFeeProfile: config.fee_profile_code,
          crossReleaseClassFailover: false,
        }),
        outcome,
      ],
    );

    await this.database.query(
      `
      update pixbrasil.payment_intents
      set selected_connection_id=$2::uuid,
          status=$3::text,
          metadata=metadata || jsonb_build_object(
            'routingMode',$4::text,
            'routingDecisionId',$5::text,
            'pricingQuote',$6::jsonb,
            'releaseProfile',$7::text,
            'releaseClass',$8::text
          ),
          updated_at=now()
      where id=$1::uuid
      `,
      [
        paymentIntentId,
        selected.connectionId,
        enforced ? "PROVIDER_PENDING" : "CREATED",
        routingMode,
        decision.rows[0]?.id ?? null,
        JSON.stringify(quote),
        config.release_profile_code,
        config.release_class,
      ],
    );

    if (!enforced) {
      return {
        success: true,
        data: {
          paymentIntentId,
          idempotentReplay: false,
          status: "SHADOW_ONLY",
          amount: normalizedAmount,
          currency: "BRL",
          reference,
          store: { code: config.store_code, name: config.store_name },
          routing: {
            mode: "SHADOW",
            policy: config.policy_name,
            policyVersion: config.policy_version,
            providerCode: selectedRow.provider_code,
            gatewayAlias: selectedRow.gateway_alias,
            releaseClass: config.release_class,
            crossReleaseClassFailover: false,
          },
          economics: quote,
          release: { profile: config.release_profile_code, rules: releaseRules.rows },
        },
      };
    }

    const connection = await this.database.query<{
      provider_code: string;
      decrypted_secret: string | null;
    }>(
      `
      select p.code provider_code,v.decrypted_secret
      from pixbrasil.gateway_connections gc
      join public.providers p on p.id=gc.provider_id
      left join vault.decrypted_secrets v on v.id=gc.vault_secret_id
      where gc.id=$1::uuid and gc.status='ACTIVE'
      limit 1
      `,
      [selected.connectionId],
    );
    const connectionRow = connection.rows[0];
    if (!connectionRow?.decrypted_secret) {
      await this.database.query(
        `update pixbrasil.payment_intents set status='FAILED',updated_at=now() where id=$1::uuid`,
        [paymentIntentId],
      );
      throw new ServiceUnavailableException("Selected provider credentials are unavailable.");
    }

    let credentials: unknown;
    try {
      credentials = JSON.parse(connectionRow.decrypted_secret);
    } catch {
      throw new ServiceUnavailableException("Selected provider credentials are malformed.");
    }

    const attempt = await this.database.query<{ id: string }>(
      `
      insert into pixbrasil.provider_attempts(
        payment_intent_id,routing_decision_id,gateway_connection_id,attempt_no,
        status,provider_reference,request_fingerprint,response_metadata,started_at
      )
      values(
        $1::uuid,$2::uuid,$3::uuid,1,'STARTED',$4::text,$5::text,'{}'::jsonb,now()
      )
      on conflict (payment_intent_id,attempt_no) do nothing
      returning id
      `,
      [
        paymentIntentId,
        decision.rows[0]?.id ?? null,
        selected.connectionId,
        reference,
        requestFingerprint,
      ],
    );

    if (!attempt.rows[0]) {
      return this.loadChargeResult(paymentIntentId, true);
    }

    const providerCode = connectionRow.provider_code.toUpperCase();
    const adapter = this.providers.get(providerCode);
    const webhookUrl =
      providerCode === "PIXGO"
        ? "https://api.pixbrasil.org/api/v1/webhooks/pixgo"
        : "https://api.pixbrasil.org/api/v1/webhooks/misticpay";

    const execution = await executeProviderAttempt({
      adapter,
      credentials,
      recoveryReference: paymentIntentId,
      input: {
        paymentIntentId,
        externalReference: reference,
        amount: normalizedAmount.toFixed(2),
        currency: "BRL",
        payer: {
          name: payerName,
          taxId: payerTaxId,
          ...(String(input.payer?.email ?? "").trim()
            ? { email: String(input.payer?.email).trim() }
            : {}),
          ...(String(input.payer?.phone ?? "").trim()
            ? { phone: String(input.payer?.phone).trim() }
            : {}),
        },
        description: String(input.description ?? "").slice(0, 200),
        webhookUrl,
      },
    });

    if (execution.kind === "CREATED") {
      const action = normalizeProviderAction(providerCode, execution.payload);
      if (!action) {
        await this.database.query(
          `
          with updated_attempt as (
            update pixbrasil.provider_attempts
            set status='AMBIGUOUS',ambiguous=true,
                error_category='INCOMPLETE_PROVIDER_RESPONSE',
                completed_at=now()
            where id=$1::uuid
            returning id
          )
          update pixbrasil.payment_intents
          set status='RECONCILIATION_REQUIRED',updated_at=now()
          where id=$2::uuid
          `,
          [attempt.rows[0].id, paymentIntentId],
        );
        return {
          success: true,
          data: {
            paymentIntentId,
            status: "RECONCILIATION_REQUIRED",
            reference,
            store: { code: config.store_code, name: config.store_name },
          },
        };
      }

      await this.database.query(
        `
        with updated_attempt as (
          update pixbrasil.provider_attempts
          set status=$2::text,
              provider_payment_id=$3::text,
              response_metadata=jsonb_build_object(
                'action',$4::jsonb,
                'recovered',$5::boolean
              ),
              completed_at=now()
          where id=$1::uuid
          returning id
        )
        update pixbrasil.payment_intents
        set status='PENDING_PAYMENT',
            metadata=metadata || jsonb_build_object(
              'providerPaymentId',$3::text,
              'providerAction',$4::jsonb
            ),
            updated_at=now()
        where id=$6::uuid
        `,
        [
          attempt.rows[0].id,
          execution.recovered ? "RECOVERED" : "CREATED",
          execution.providerPaymentId,
          JSON.stringify(action),
          execution.recovered,
          paymentIntentId,
        ],
      );

      return {
        success: true,
        data: {
          paymentIntentId,
          idempotentReplay: false,
          status: "PENDING_PAYMENT",
          amount: normalizedAmount,
          currency: "BRL",
          reference,
          store: { code: config.store_code, name: config.store_name },
          routing: {
            mode: "ENFORCED",
            policy: config.policy_name,
            policyVersion: config.policy_version,
            providerCode,
            gatewayAlias: selectedRow.gateway_alias,
            releaseClass: config.release_class,
            crossReleaseClassFailover: false,
          },
          economics: quote,
          release: { profile: config.release_profile_code, rules: releaseRules.rows },
          provider: {
            paymentId: execution.providerPaymentId,
            action,
          },
        },
      };
    }

    if (execution.kind === "FINAL_REJECTION") {
      await this.database.query(
        `
        with updated_attempt as (
          update pixbrasil.provider_attempts
          set status='REJECTED',error_category=$2::text,
              retriable=false,completed_at=now()
          where id=$1::uuid
          returning id
        )
        update pixbrasil.payment_intents
        set status='FAILED',updated_at=now()
        where id=$3::uuid
        `,
        [
          attempt.rows[0].id,
          execution.code ?? "PROVIDER_REJECTED",
          paymentIntentId,
        ],
      );
      throw new UnprocessableEntityException({
        message: execution.message ?? "Provider rejected the PIX charge.",
        code: execution.code ?? "PROVIDER_REJECTED",
        paymentIntentId,
      });
    }

    if (execution.kind === "SAFE_FAILOVER_ALLOWED") {
      await this.database.query(
        `
        with updated_attempt as (
          update pixbrasil.provider_attempts
          set status='UNAVAILABLE',error_category=$2::text,
              retriable=true,completed_at=now()
          where id=$1::uuid
          returning id
        )
        update pixbrasil.payment_intents
        set status='FAILED',updated_at=now()
        where id=$3::uuid
        `,
        [attempt.rows[0].id, execution.reason, paymentIntentId],
      );
      throw new ServiceUnavailableException({
        message: "Selected PIX provider is temporarily unavailable.",
        paymentIntentId,
      });
    }

    await this.database.query(
      `
      with updated_attempt as (
        update pixbrasil.provider_attempts
        set status='AMBIGUOUS',ambiguous=true,
            error_category=$2::text,completed_at=now()
        where id=$1::uuid
        returning id
      )
      update pixbrasil.payment_intents
      set status='RECONCILIATION_REQUIRED',updated_at=now()
      where id=$3::uuid
      `,
      [attempt.rows[0].id, execution.reason, paymentIntentId],
    );

    return {
      success: true,
      data: {
        paymentIntentId,
        idempotentReplay: false,
        status: "RECONCILIATION_REQUIRED",
        amount: normalizedAmount,
        currency: "BRL",
        reference,
        store: { code: config.store_code, name: config.store_name },
        routing: {
          mode: "ENFORCED",
          providerCode,
          gatewayAlias: selectedRow.gateway_alias,
          releaseClass: config.release_class,
        },
        economics: quote,
      },
    };
  }

  private async loadChargeResult(
    paymentIntentId: string,
    idempotentReplay: boolean,
  ) {
    const result = await this.database.query<{
      id: string;
      external_reference: string | null;
      amount: string;
      currency: string;
      status: string;
      metadata: Record<string, unknown>;
      store_code: string | null;
      store_name: string | null;
      policy_name: string | null;
      provider_code: string | null;
      gateway_alias: string | null;
      outcome: string | null;
      provider_payment_id: string | null;
      provider_attempt_status: string | null;
      response_metadata: Record<string, unknown> | null;
    }>(
      `
      select
        pi.id,
        pi.external_reference,
        pi.amount::text,
        pi.currency,
        pi.status,
        pi.metadata,
        s.code as store_code,
        s.name as store_name,
        rp.name as policy_name,
        p.code as provider_code,
        gc.alias as gateway_alias,
        rd.outcome,
        pa.provider_payment_id,
        pa.status as provider_attempt_status,
        pa.response_metadata
      from pixbrasil.payment_intents pi
      left join pixbrasil.stores s on s.id=pi.store_id
      left join lateral (
        select *
        from pixbrasil.routing_decisions rd0
        where rd0.payment_intent_id=pi.id
        order by rd0.created_at desc
        limit 1
      ) rd on true
      left join pixbrasil.routing_policies rp on rp.id=rd.policy_id
      left join pixbrasil.gateway_connections gc on gc.id=rd.selected_connection_id
      left join public.providers p on p.id=gc.provider_id
      left join lateral (
        select pa0.*
        from pixbrasil.provider_attempts pa0
        where pa0.payment_intent_id=pi.id
        order by pa0.attempt_no desc
        limit 1
      ) pa on true
      where pi.id=$1::uuid
      `,
      [paymentIntentId],
    );

    const row = result.rows[0];
    if (!row) throw new NotFoundException("PaymentIntent not found.");

    return {
      success: true,
      data: {
        paymentIntentId: row.id,
        idempotentReplay,
        status:
          row.outcome === "SHADOW_ONLY"
            ? "SHADOW_ONLY"
            : row.status,
        amount: Number(row.amount),
        currency: row.currency,
        reference: row.external_reference,
        store: {
          code: row.store_code,
          name: row.store_name,
        },
        routing: {
          mode: String(row.metadata?.routingMode ?? "SHADOW"),
          policy: row.policy_name,
          providerCode: row.provider_code,
          gatewayAlias: row.gateway_alias,
          releaseClass: row.metadata?.releaseClass ?? null,
        },
        economics:
          row.metadata?.pricingQuote ??
          row.metadata?.shadowQuote ??
          null,
        provider: row.provider_payment_id
          ? {
              paymentId: row.provider_payment_id,
              attemptStatus: row.provider_attempt_status,
              action:
                row.response_metadata &&
                typeof row.response_metadata.action === "object"
                  ? row.response_metadata.action
                  : row.metadata?.providerAction ?? null,
            }
          : null,
      },
    };
  }
}
