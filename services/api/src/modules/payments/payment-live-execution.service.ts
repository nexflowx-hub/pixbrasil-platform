import {
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ProviderAdapterRegistry } from "../providers/provider-adapter.registry";
import { executeProviderAttempt } from "./provider-execution";

export interface LivePaymentExecutionInput {
  paymentIntentId: string;
  routingDecisionId: string | null;
  connectionId: string;
  providerCode: string;
  gatewayAlias: string;
  requestFingerprint: string;
  reference: string;
  amount: number;
  description: string;
  payer: {
    name: string;
    taxId: string;
    email?: string;
    phone?: string;
  };
  store: {
    code: string;
    name: string;
  };
  routing: {
    policy: string;
    policyVersion: number;
    releaseClass: string;
  };
  economics: Record<string, unknown>;
  release: {
    profile: string;
    rules: unknown[];
  };
}

@Injectable()
export class PaymentLiveExecutionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly providers: ProviderAdapterRegistry,
  ) {}

  async execute(input: LivePaymentExecutionInput) {
    const credential = await this.database.query<{
      decrypted_secret: string | null;
    }>(
      `
      select v.decrypted_secret
      from pixbrasil.gateway_connections gc
      left join vault.decrypted_secrets v on v.id=gc.vault_secret_id
      where gc.id=$1::uuid
        and gc.status='ACTIVE'
      limit 1
      `,
      [input.connectionId],
    );

    const decrypted = credential.rows[0]?.decrypted_secret;
    if (!decrypted) {
      await this.failIntent(input.paymentIntentId, "CREDENTIALS_UNAVAILABLE");
      throw new ServiceUnavailableException(
        "PIX processing is temporarily unavailable.",
      );
    }

    let credentials: unknown;
    try {
      credentials = JSON.parse(decrypted);
    } catch {
      await this.failIntent(input.paymentIntentId, "CREDENTIALS_MALFORMED");
      throw new ServiceUnavailableException(
        "PIX processing is temporarily unavailable.",
      );
    }

    const attempt = await this.database.query<{ id: string }>(
      `
      insert into pixbrasil.provider_attempts(
        id,payment_intent_id,routing_decision_id,gateway_connection_id,
        attempt_no,status,request_fingerprint,response_metadata,started_at
      )
      values(
        gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,
        1,'STARTED',$4::text,'{}'::jsonb,now()
      )
      on conflict (payment_intent_id,attempt_no) do update
      set started_at=pixbrasil.provider_attempts.started_at
      returning id
      `,
      [
        input.paymentIntentId,
        input.routingDecisionId,
        input.connectionId,
        input.requestFingerprint,
      ],
    );

    const adapter = this.providers.get(input.providerCode);
    const webhookUrl =
      input.providerCode.toUpperCase() === "PIXGO"
        ? "https://api.pixbrasil.org/api/v1/webhooks/pixgo"
        : "https://api.pixbrasil.org/api/v1/webhooks/misticpay";

    const execution = await executeProviderAttempt({
      adapter,
      input: {
        paymentIntentId: input.paymentIntentId,
        externalReference: input.reference,
        amount: input.amount.toFixed(2),
        currency: "BRL",
        payer: input.payer,
        description: input.description,
        webhookUrl,
      },
      credentials,
      recoveryReference: input.paymentIntentId,
    });

    if (execution.kind === "CREATED") {
      const action = normalizeProviderAction(execution.payload);

      await this.database.query(
        `
        update pixbrasil.provider_attempts
        set status=$2::text,
            provider_payment_id=$3::text,
            provider_reference=$4::text,
            ambiguous=false,
            retriable=false,
            response_metadata=$5::jsonb,
            completed_at=now()
        where id=$1::uuid
        `,
        [
          attempt.rows[0].id,
          execution.recovered ? "RECOVERED" : "CREATED",
          execution.providerPaymentId,
          input.reference,
          JSON.stringify({
            providerCode: input.providerCode,
            gatewayAlias: input.gatewayAlias,
            recovered: execution.recovered,
            action,
          }),
        ],
      );

      await this.database.query(
        `
        update pixbrasil.payment_intents
        set status='PENDING_PAYMENT',
            metadata=metadata || jsonb_build_object(
              'routingMode','LIVE',
              'providerAction',$2::jsonb,
              'providerPaymentId',$3::text
            ),
            updated_at=now()
        where id=$1::uuid
        `,
        [
          input.paymentIntentId,
          JSON.stringify(action),
          execution.providerPaymentId,
        ],
      );

      return {
        success: true,
        data: {
          paymentIntentId: input.paymentIntentId,
          idempotentReplay: false,
          status: "PENDING_PAYMENT",
          amount: input.amount,
          currency: "BRL",
          reference: input.reference,
          store: input.store,
          action,
          economics: merchantEconomics(input.economics),
          release: {
            class: input.routing.releaseClass,
          },
        },
      };
    }

    if (execution.kind === "FINAL_REJECTION") {
      await this.database.query(
        `
        update pixbrasil.provider_attempts
        set status='REJECTED',
            error_category=$2::text,
            retriable=false,
            ambiguous=false,
            response_metadata=jsonb_build_object('message',$3::text),
            completed_at=now()
        where id=$1::uuid
        `,
        [
          attempt.rows[0].id,
          execution.code ?? "PAYMENT_REJECTED",
          execution.message ?? "PIX payment was rejected.",
        ],
      );
      await this.failIntent(
        input.paymentIntentId,
        execution.code ?? "PROVIDER_REJECTED",
      );
      throw new UnprocessableEntityException(
        "PIX payment was rejected.",
      );
    }

    if (execution.kind === "SAFE_FAILOVER_ALLOWED") {
      await this.database.query(
        `
        update pixbrasil.provider_attempts
        set status='UNAVAILABLE',
            error_category='PROVIDER_UNAVAILABLE',
            retriable=true,
            ambiguous=false,
            response_metadata=jsonb_build_object('reason',$2::text),
            completed_at=now()
        where id=$1::uuid
        `,
        [attempt.rows[0].id, execution.reason],
      );
      await this.failIntent(input.paymentIntentId, execution.reason);
      throw new ServiceUnavailableException(
        "PIX processing is temporarily unavailable.",
      );
    }

    await this.database.query(
      `
      update pixbrasil.provider_attempts
      set status='AMBIGUOUS',
          error_category='AMBIGUOUS_CREATE',
          retriable=false,
          ambiguous=true,
          response_metadata=jsonb_build_object('reason',$2::text),
          completed_at=now()
      where id=$1::uuid
      `,
      [attempt.rows[0].id, execution.reason],
    );
    await this.database.query(
      `
      update pixbrasil.payment_intents
      set status='RECONCILIATION_REQUIRED',
          metadata=metadata || jsonb_build_object(
            'reconciliationReason',$2::text
          ),
          updated_at=now()
      where id=$1::uuid
      `,
      [input.paymentIntentId, execution.reason],
    );

    return {
      success: true,
      data: {
        paymentIntentId: input.paymentIntentId,
        idempotentReplay: false,
        status: "RECONCILIATION_REQUIRED",
        amount: input.amount,
        currency: "BRL",
        reference: input.reference,
        store: input.store,
        economics: merchantEconomics(input.economics),
        release: {
          class: input.routing.releaseClass,
        },
      },
    };
  }

  private async failIntent(paymentIntentId: string, reason: string) {
    await this.database.query(
      `
      update pixbrasil.payment_intents
      set status='FAILED',
          metadata=metadata || jsonb_build_object('providerError',$2::text),
          updated_at=now()
      where id=$1::uuid
      `,
      [paymentIntentId, reason],
    );
  }
}

function normalizeProviderAction(payload: unknown) {
  const root =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  const data =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {};

  const copyPaste = String(
    data.copyPaste ??
      data.qr_code ??
      data.pixCopiaECola ??
      root.copyPaste ??
      root.qr_code ??
      "",
  ).trim();
  const qrCodeImage = String(
    data.qrCode ??
      data.qr_code_base64 ??
      data.qrcode ??
      root.qrCode ??
      root.qr_code_base64 ??
      "",
  ).trim();
  const expiresAt = String(
    data.expiresAt ??
      data.expires_at ??
      root.expiresAt ??
      root.expires_at ??
      "",
  ).trim();

  return {
    type: "PIX",
    ...(copyPaste ? { copyPaste } : {}),
    ...(qrCodeImage ? { qrCodeImage } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
}


function merchantEconomics(value: Record<string, unknown>) {
  return {
    grossBrl: Number(value.grossBrl ?? 0),
    platformFeeBrl: Number(value.platformFeeBrl ?? 0),
    estimatedMerchantNetBrl: Number(value.estimatedMerchantNetBrl ?? 0),
  };
}
