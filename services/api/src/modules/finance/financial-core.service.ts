import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import type { ClientContext } from "../client-auth/client-auth.types";

type ManualPayoutInput = {
  amount?: number | string;
  currency?: string;
  destination?: {
    type?: string;
    pixKey?: string;
    pixKeyType?: string;
    beneficiaryName?: string;
    beneficiaryDocument?: string;
  };
  note?: string;
};

@Injectable()
export class FinancialCoreService implements OnModuleInit, OnModuleDestroy {
  private releaseTimer?: NodeJS.Timeout;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit() {
    this.releaseTimer = setInterval(() => {
      void this.releaseDueSettlements().catch(() => undefined);
    }, 60_000);
    this.releaseTimer.unref();
    void this.releaseDueSettlements().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.releaseTimer) clearInterval(this.releaseTimer);
  }

  async finalizeSuccessfulPayment(
    paymentIntentId: string,
    providerCode: string,
    providerPaymentId: string,
  ) {
    return this.database.transaction(async (client) => {
      const paymentResult = await client.query<{
        id: string;
        account_id: string;
        merchant_id: string | null;
        store_id: string | null;
        external_reference: string | null;
        amount: string;
        currency: string;
        status: string;
        metadata: Record<string, unknown>;
        release_profile_id: string;
        release_profile_code: string;
      }>(
        `
        select
          pi.id,
          pi.account_id,
          pi.merchant_id,
          pi.store_id,
          pi.external_reference,
          pi.amount::text,
          pi.currency,
          pi.status,
          pi.metadata,
          sfp.release_profile_id,
          rp.code as release_profile_code
        from pixbrasil.payment_intents pi
        join pixbrasil.store_financial_profiles sfp on sfp.store_id=pi.store_id
        join pixbrasil.release_profiles rp on rp.id=sfp.release_profile_id
        where pi.id=$1::uuid
        for update of pi
        `,
        [paymentIntentId],
      );

      const payment = paymentResult.rows[0];
      if (!payment) return null;
      if (payment.status !== "SUCCEEDED") return null;

      const existing = await client.query<{
        id: string;
        status: string;
        available_at: string | null;
      }>(
        `
        select id,status,available_at::text
        from pixbrasil.settlements
        where payment_intent_id=$1::uuid
        limit 1
        `,
        [paymentIntentId],
      );

      if (existing.rows[0]) {
        return {
          settlementId: existing.rows[0].id,
          status: existing.rows[0].status,
          availableAt: existing.rows[0].available_at,
          idempotentReplay: true,
        };
      }

      const quote =
        (payment.metadata?.productionQuote as Record<string, unknown> | undefined) ??
        (payment.metadata?.shadowQuote as Record<string, unknown> | undefined) ??
        {};

      const grossBrl = Number(payment.amount);
      const providerFeeBrl = Number(quote.providerRouteCostBrl ?? 0);
      const platformFeeBrl = Number(quote.platformFeeBrl ?? 0);
      const netBrl = Math.max(
        0,
        Math.round((grossBrl - providerFeeBrl - platformFeeBrl) * 100) / 100,
      );

      const releaseRule = await client.query<{
        availability_mode: string;
        available_after_minutes: number | null;
        max_release_minutes: number | null;
        payout_mode: string;
        ticket_required: boolean;
      }>(
        `
        select
          availability_mode,
          available_after_minutes,
          max_release_minutes,
          payout_mode,
          ticket_required
        from pixbrasil.release_rules
        where release_profile_id=$1::uuid
          and rail='PIX'
          and enabled=true
        order by asset_code nulls first,network_code nulls first
        limit 1
        `,
        [payment.release_profile_id],
      );

      const rule = releaseRule.rows[0];
      if (!rule) {
        throw new ConflictException("No PIX release rule configured for settlement.");
      }

      const delayMinutes =
        rule.available_after_minutes ??
        (rule.availability_mode === "PROVIDER_RELEASE"
          ? rule.max_release_minutes ?? 0
          : 0);
      const immediatelyAvailable = delayMinutes <= 0;

      const assetResult = await client.query<{ id: string }>(
        `select id from public.assets where code='BRL' and status='ACTIVE' limit 1`,
      );
      const assetId = assetResult.rows[0]?.id;
      if (!assetId) throw new ServiceUnavailableException("BRL asset is not configured.");

      const providerResult = await client.query<{ id: string }>(
        `select id from public.providers where upper(code)=upper($1::text) limit 1`,
        [providerCode],
      );
      const providerId = providerResult.rows[0]?.id;
      if (!providerId) {
        throw new ServiceUnavailableException("Provider is not registered in Financial Core.");
      }

      const walletId = await this.ensureBrlWallet(client, payment.account_id, assetId);
      const customerLedgerId = await this.ensureLedgerAccount(client, {
        code: `CUSTOMER:${payment.account_id}:BRL`,
        type: "CUSTOMER",
        ownerAccountId: payment.account_id,
        assetId,
        name: "Customer BRL",
      });
      const providerLedgerId = await this.ensureLedgerAccount(client, {
        code: `PROVIDER:${providerCode}:BRL`,
        type: "PROVIDER",
        providerId,
        assetId,
        name: `${providerCode} BRL receivable`,
      });
      const revenueLedgerId = await this.ensureLedgerAccount(client, {
        code: "REVENUE:PIXBRASIL:BRL",
        type: "REVENUE",
        assetId,
        name: "PiXBrasil BRL revenue",
      });

      const ledgerResult = await client.query<{ id: string }>(
        `
        insert into public.ledger_transactions(
          id,reference,type,status,idempotency_key,external_reference,metadata,
          created_at,posted_at
        )
        values(
          gen_random_uuid(),
          $1::varchar,
          'FIAT_DEPOSIT',
          'POSTED',
          $2::varchar,
          $3::varchar,
          $4::jsonb,
          now(),now()
        )
        on conflict (idempotency_key) do update
        set reference=public.ledger_transactions.reference
        returning id
        `,
        [
          `PIXBRASIL:${paymentIntentId}`,
          `pixbrasil:payment:${paymentIntentId}`,
          payment.external_reference,
          JSON.stringify({
            paymentIntentId,
            providerCode,
            providerPaymentId,
            grossBrl,
            providerFeeBrl,
            platformFeeBrl,
            netBrl,
          }),
        ],
      );
      const ledgerTransactionId = ledgerResult.rows[0].id;

      const providerReceivable = Math.max(
        0,
        Math.round((grossBrl - providerFeeBrl) * 100) / 100,
      );

      await client.query(
        `
        insert into public.ledger_entries(
          id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
        )
        select gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'DEBIT',$4::numeric,now()
        where $4::numeric > 0
          and not exists (
            select 1 from public.ledger_entries
            where ledger_transaction_id=$1::uuid and ledger_account_id=$2::uuid
          )
        `,
        [ledgerTransactionId, providerLedgerId, assetId, providerReceivable],
      );

      await client.query(
        `
        insert into public.ledger_entries(
          id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
        )
        select gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'CREDIT',$4::numeric,now()
        where $4::numeric > 0
          and not exists (
            select 1 from public.ledger_entries
            where ledger_transaction_id=$1::uuid and ledger_account_id=$2::uuid
          )
        `,
        [ledgerTransactionId, customerLedgerId, assetId, netBrl],
      );

      if (platformFeeBrl > 0) {
        await client.query(
          `
          insert into public.ledger_entries(
            id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
          )
          select gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'CREDIT',$4::numeric,now()
          where not exists (
            select 1 from public.ledger_entries
            where ledger_transaction_id=$1::uuid and ledger_account_id=$2::uuid
          )
          `,
          [ledgerTransactionId, revenueLedgerId, assetId, platformFeeBrl],
        );
      }

      await client.query(
        `
        insert into public.transactions(
          id,account_id,wallet_id,ledger_transaction_id,provider_id,
          type,status,asset_id,amount,fee_asset_id,fee_amount,
          provider_reference,idempotency_key,metadata,created_at,updated_at,completed_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::uuid,
          'FIAT_DEPOSIT','COMPLETED',$5::uuid,$6::numeric,$5::uuid,$7::numeric,
          $8::varchar,$9::varchar,$10::jsonb,now(),now(),now()
        )
        on conflict (idempotency_key) do nothing
        `,
        [
          payment.account_id,
          walletId,
          ledgerTransactionId,
          providerId,
          assetId,
          netBrl,
          providerFeeBrl + platformFeeBrl,
          providerPaymentId,
          `pixbrasil:payment:${paymentIntentId}`,
          JSON.stringify({
            paymentIntentId,
            storeId: payment.store_id,
            merchantId: payment.merchant_id,
            grossBrl,
            providerFeeBrl,
            platformFeeBrl,
          }),
        ],
      );

      await client.query(
        `
        update public.wallet_balances
        set
          available=available + case when $2::boolean then $1::numeric else 0 end,
          pending=pending + case when $2::boolean then 0 else $1::numeric end,
          updated_at=now()
        where wallet_id=$3::uuid
        `,
        [netBrl, immediatelyAvailable, walletId],
      );

      const settlement = await client.query<{
        id: string;
        status: string;
        available_at: string | null;
      }>(
        `
        insert into pixbrasil.settlements(
          id,payment_intent_id,gross_brl,provider_fee_brl,platform_fee_brl,net_brl,
          settlement_asset,settlement_network,settlement_amount,status,available_at,
          metadata,created_at,updated_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::numeric,$3::numeric,$4::numeric,$5::numeric,
          'BRL','NONE',$5::numeric,$6::text,
          now() + make_interval(mins => $7::int),
          $8::jsonb,now(),now()
        )
        returning id,status,available_at::text
        `,
        [
          paymentIntentId,
          grossBrl,
          providerFeeBrl,
          platformFeeBrl,
          netBrl,
          immediatelyAvailable ? "AVAILABLE" : "PENDING",
          Math.max(0, delayMinutes),
          JSON.stringify({
            providerCode,
            providerPaymentId,
            releaseProfile: payment.release_profile_code,
            availabilityMode: rule.availability_mode,
            payoutMode: rule.payout_mode,
            ticketRequired: rule.ticket_required,
            ledgerTransactionId,
            walletId,
          }),
        ],
      );

      return {
        settlementId: settlement.rows[0].id,
        status: settlement.rows[0].status,
        availableAt: settlement.rows[0].available_at,
        netBrl,
        idempotentReplay: false,
      };
    });
  }

  async releaseDueSettlements() {
    const due = await this.database.query<{ id: string }>(
      `
      select id
      from pixbrasil.settlements
      where status='PENDING'
        and available_at is not null
        and available_at <= now()
      order by available_at asc
      limit 100
      `,
    );

    let released = 0;
    for (const row of due.rows) {
      const didRelease = await this.database.transaction(async (client) => {
        const settlementResult = await client.query<{
          id: string;
          status: string;
          net_brl: string;
          account_id: string;
        }>(
          `
          select s.id,s.status,s.net_brl::text,pi.account_id
          from pixbrasil.settlements s
          join pixbrasil.payment_intents pi on pi.id=s.payment_intent_id
          where s.id=$1::uuid
          for update of s
          `,
          [row.id],
        );
        const settlement = settlementResult.rows[0];
        if (!settlement || settlement.status !== "PENDING") return false;

        const asset = await client.query<{ id: string }>(
          `select id from public.assets where code='BRL' limit 1`,
        );
        const assetId = asset.rows[0]?.id;
        if (!assetId) return false;
        const walletId = await this.ensureBrlWallet(
          client,
          settlement.account_id,
          assetId,
        );
        const net = Number(settlement.net_brl);

        await client.query(
          `
          update public.wallet_balances
          set pending=greatest(0,pending-$1::numeric),
              available=available+$1::numeric,
              updated_at=now()
          where wallet_id=$2::uuid
          `,
          [net, walletId],
        );

        await client.query(
          `
          update pixbrasil.settlements
          set status='AVAILABLE',
              metadata=metadata || jsonb_build_object('releasedAt',now()),
              updated_at=now()
          where id=$1::uuid
          `,
          [settlement.id],
        );
        return true;
      });
      if (didRelease) released += 1;
    }

    return { released };
  }

  async requestManualPayout(
    context: ClientContext,
    accountId: string,
    idempotencyKeyValue: string | undefined,
    input: ManualPayoutInput,
  ) {
    const access = context.accounts.find((item) => item.accountId === accountId);
    if (!access) throw new ForbiddenException("Account access is not granted.");
    if (!["OWNER", "ADMIN", "FINANCE"].includes(access.role)) {
      throw new ForbiddenException("This account role cannot request payouts.");
    }

    const idempotencyKey = String(idempotencyKeyValue ?? "").trim().slice(0, 200);
    if (!idempotencyKey) {
      throw new BadRequestException("Idempotency-Key is required.");
    }

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be a positive number.");
    }

    const currency = String(input.currency ?? "BRL").toUpperCase();
    if (currency !== "BRL") {
      throw new BadRequestException("Manual payouts currently support BRL only.");
    }

    const pixKey = String(input.destination?.pixKey ?? "").trim();
    if (!pixKey || pixKey.length > 180) {
      throw new BadRequestException("A valid PIX key is required.");
    }

    const feature = await this.database.query<{ enabled: boolean }>(
      `select enabled from controlplane.feature_flags where key='manual_payouts' limit 1`,
    );
    if (!feature.rows[0]?.enabled) {
      throw new ServiceUnavailableException("Manual payouts are temporarily unavailable.");
    }

    const payout = await this.database.transaction(async (client) => {
      const existing = await client.query<{
        id: string;
        status: string;
        amount: string;
        created_at: string;
      }>(
        `
        select id,status,amount::text,created_at::text
        from controlplane.payout_requests
        where account_id=$1::uuid and idempotency_key=$2::varchar
        limit 1
        `,
        [accountId, idempotencyKey],
      );
      if (existing.rows[0]) return existing.rows[0];

      const walletResult = await client.query<{
        wallet_id: string;
        asset_id: string;
        available: string;
      }>(
        `
        select w.id as wallet_id,w.asset_id,wb.available::text
        from public.wallets w
        join public.wallet_balances wb on wb.wallet_id=w.id
        join public.assets ass on ass.id=w.asset_id
        where w.account_id=$1::uuid
          and ass.code='BRL'
          and w.status='ACTIVE'
        for update of wb
        `,
        [accountId],
      );
      const wallet = walletResult.rows[0];
      if (!wallet) throw new ConflictException("BRL wallet is not available.");
      if (Number(wallet.available) < amount) {
        throw new ConflictException("Insufficient available balance.");
      }

      await client.query(
        `
        update public.wallet_balances
        set available=available-$1::numeric,
            reserved=reserved+$1::numeric,
            updated_at=now()
        where wallet_id=$2::uuid
        `,
        [amount, wallet.wallet_id],
      );

      const inserted = await client.query<{
        id: string;
        status: string;
        amount: string;
        created_at: string;
      }>(
        `
        insert into controlplane.payout_requests(
          id,account_id,wallet_id,asset_id,amount,destination_type,
          destination_snapshot,status,external_reference,proof_metadata,
          requested_by,idempotency_key,created_at,updated_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::numeric,'PIX',
          $5::jsonb,'APPROVAL_REQUIRED',null,$6::jsonb,
          $7::uuid,$8::varchar,now(),now()
        )
        returning id,status,amount::text,created_at::text
        `,
        [
          accountId,
          wallet.wallet_id,
          wallet.asset_id,
          amount,
          JSON.stringify({
            type: "PIX",
            pixKey,
            pixKeyType: String(input.destination?.pixKeyType ?? "AUTO").slice(0, 40),
            beneficiaryName: String(input.destination?.beneficiaryName ?? "").slice(0, 140),
            beneficiaryDocument: String(
              input.destination?.beneficiaryDocument ?? "",
            )
              .replace(/\D/g, "")
              .slice(0, 14),
          }),
          JSON.stringify({
            channel: "TELEGRAM",
            source: "CLIENT_PORTAL",
            note: String(input.note ?? "").slice(0, 500),
          }),
          context.authUserId,
          idempotencyKey,
        ],
      );

      return inserted.rows[0];
    });

    const telegram = await this.notifyTelegramPayout({
      payoutId: payout.id,
      accountId,
      amount: Number(payout.amount),
      email: context.email ?? "",
      pixKey,
      note: String(input.note ?? ""),
    });

    await this.database.query(
      `
      update controlplane.payout_requests
      set proof_metadata=proof_metadata || $2::jsonb,
          updated_at=now()
      where id=$1::uuid
      `,
      [
        payout.id,
        JSON.stringify({
          telegramDelivery: telegram,
        }),
      ],
    );

    return {
      success: true,
      data: {
        payoutId: payout.id,
        status: payout.status,
        amount: Number(payout.amount),
        currency: "BRL",
        createdAt: payout.created_at,
        ticketChannel: "TELEGRAM",
        notification: telegram.status,
      },
    };
  }

  async confirmManualPayout(
    payoutId: string,
    adminAuthUserId: string,
    input: {
      externalReference?: unknown;
      proof?: unknown;
    },
  ) {
    return this.database.transaction(async (client) => {
      const payoutResult = await client.query<{
        id: string;
        account_id: string;
        wallet_id: string | null;
        asset_id: string;
        amount: string;
        status: string;
      }>(
        `
        select id,account_id,wallet_id,asset_id,amount::text,status
        from controlplane.payout_requests
        where id=$1::uuid
        for update
        `,
        [payoutId],
      );
      const payout = payoutResult.rows[0];
      if (!payout) throw new ConflictException("Payout request not found.");
      if (payout.status === "CONFIRMED") {
        return { success: true, data: { payoutId, status: "CONFIRMED" } };
      }
      if (!["APPROVAL_REQUIRED","APPROVED","PROCESSING","PAID"].includes(payout.status)) {
        throw new ConflictException("Payout cannot be confirmed from its current status.");
      }
      if (!payout.wallet_id) throw new ConflictException("Payout wallet is missing.");

      const customerLedgerId = await this.ensureLedgerAccount(client, {
        code: `CUSTOMER:${payout.account_id}:BRL`,
        type: "CUSTOMER",
        ownerAccountId: payout.account_id,
        assetId: payout.asset_id,
        name: "Customer BRL",
      });
      const treasuryLedgerId = await this.ensureLedgerAccount(client, {
        code: "TREASURY:PIX:PAYOUT:BRL",
        type: "TREASURY",
        assetId: payout.asset_id,
        name: "PIX payout treasury",
      });

      const ledger = await client.query<{ id: string }>(
        `
        insert into public.ledger_transactions(
          id,reference,type,status,idempotency_key,external_reference,metadata,
          created_at,posted_at
        )
        values(
          gen_random_uuid(),$1::varchar,'FIAT_WITHDRAWAL','POSTED',
          $2::varchar,$3::varchar,$4::jsonb,now(),now()
        )
        on conflict (idempotency_key) do update
        set reference=public.ledger_transactions.reference
        returning id
        `,
        [
          `PAYOUT:${payout.id}`,
          `pixbrasil:payout:${payout.id}`,
          String(input.externalReference ?? "").slice(0, 160) || null,
          JSON.stringify({ payoutId: payout.id, confirmedBy: adminAuthUserId }),
        ],
      );

      await client.query(
        `
        insert into public.ledger_entries(
          id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
        )
        select gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'DEBIT',$4::numeric,now()
        where not exists (
          select 1 from public.ledger_entries
          where ledger_transaction_id=$1::uuid and ledger_account_id=$2::uuid
        )
        `,
        [ledger.rows[0].id, customerLedgerId, payout.asset_id, payout.amount],
      );
      await client.query(
        `
        insert into public.ledger_entries(
          id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
        )
        select gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'CREDIT',$4::numeric,now()
        where not exists (
          select 1 from public.ledger_entries
          where ledger_transaction_id=$1::uuid and ledger_account_id=$2::uuid
        )
        `,
        [ledger.rows[0].id, treasuryLedgerId, payout.asset_id, payout.amount],
      );

      await client.query(
        `
        insert into public.transactions(
          id,account_id,wallet_id,ledger_transaction_id,type,status,asset_id,
          amount,provider_reference,idempotency_key,metadata,created_at,updated_at,completed_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'FIAT_WITHDRAWAL','COMPLETED',$4::uuid,
          $5::numeric,$6::varchar,$7::varchar,$8::jsonb,now(),now(),now()
        )
        on conflict (idempotency_key) do nothing
        `,
        [
          payout.account_id,
          payout.wallet_id,
          ledger.rows[0].id,
          payout.asset_id,
          payout.amount,
          String(input.externalReference ?? "").slice(0, 160) || null,
          `pixbrasil:payout:${payout.id}`,
          JSON.stringify({ payoutId: payout.id }),
        ],
      );

      await client.query(
        `
        update public.wallet_balances
        set reserved=greatest(0,reserved-$1::numeric),updated_at=now()
        where wallet_id=$2::uuid
        `,
        [payout.amount, payout.wallet_id],
      );

      await client.query(
        `
        update controlplane.payout_requests
        set status='CONFIRMED',
            external_reference=coalesce(nullif($2::text,''),external_reference),
            proof_metadata=proof_metadata || jsonb_build_object(
              'manualProof',$3::jsonb,
              'confirmedBy',$4::text,
              'confirmedAt',now()
            ),
            approved_at=coalesce(approved_at,now()),
            paid_at=coalesce(paid_at,now()),
            confirmed_at=now(),
            updated_at=now()
        where id=$1::uuid
        `,
        [
          payout.id,
          String(input.externalReference ?? "").slice(0,160),
          JSON.stringify(input.proof ?? {}),
          adminAuthUserId,
        ],
      );

      return { success: true, data: { payoutId: payout.id, status: "CONFIRMED" } };
    });
  }

  async rejectManualPayout(
    payoutId: string,
    adminAuthUserId: string,
    reasonValue: unknown,
  ) {
    return this.database.transaction(async (client) => {
      const payoutResult = await client.query<{
        id: string;
        wallet_id: string | null;
        amount: string;
        status: string;
      }>(
        `
        select id,wallet_id,amount::text,status
        from controlplane.payout_requests
        where id=$1::uuid
        for update
        `,
        [payoutId],
      );
      const payout = payoutResult.rows[0];
      if (!payout) throw new ConflictException("Payout request not found.");
      if (payout.status === "REJECTED") {
        return { success: true, data: { payoutId, status: "REJECTED" } };
      }
      if (!["DRAFT","APPROVAL_REQUIRED","APPROVED","PROCESSING"].includes(payout.status)) {
        throw new ConflictException("Payout cannot be rejected from its current status.");
      }
      if (!payout.wallet_id) throw new ConflictException("Payout wallet is missing.");

      await client.query(
        `
        update public.wallet_balances
        set reserved=greatest(0,reserved-$1::numeric),
            available=available+$1::numeric,
            updated_at=now()
        where wallet_id=$2::uuid
        `,
        [payout.amount, payout.wallet_id],
      );

      await client.query(
        `
        update controlplane.payout_requests
        set status='REJECTED',
            proof_metadata=proof_metadata || jsonb_build_object(
              'rejectionReason',$2::text,
              'rejectedBy',$3::text,
              'rejectedAt',now()
            ),
            updated_at=now()
        where id=$1::uuid
        `,
        [
          payout.id,
          String(reasonValue ?? "Rejected by operations").slice(0,500),
          adminAuthUserId,
        ],
      );

      return { success: true, data: { payoutId: payout.id, status: "REJECTED" } };
    });
  }

  private async ensureBrlWallet(
    client: PoolClient,
    accountId: string,
    assetId: string,
  ) {
    const wallet = await client.query<{ id: string }>(
      `
      insert into public.wallets(
        id,account_id,asset_id,status,created_at,updated_at
      )
      values(gen_random_uuid(),$1::uuid,$2::uuid,'ACTIVE',now(),now())
      on conflict (account_id,asset_id) do update
      set updated_at=now()
      returning id
      `,
      [accountId, assetId],
    );

    await client.query(
      `
      insert into public.wallet_balances(
        id,wallet_id,available,pending,reserved,blocked,updated_at
      )
      values(gen_random_uuid(),$1::uuid,0,0,0,0,now())
      on conflict (wallet_id) do nothing
      `,
      [wallet.rows[0].id],
    );

    return wallet.rows[0].id;
  }

  private async ensureLedgerAccount(
    client: PoolClient,
    input: {
      code: string;
      type: "CUSTOMER" | "PROVIDER" | "REVENUE" | "TREASURY";
      ownerAccountId?: string;
      providerId?: string;
      assetId: string;
      name: string;
    },
  ) {
    const result = await client.query<{ id: string }>(
      `
      insert into public.ledger_accounts(
        id,code,type,owner_account_id,provider_id,asset_id,name,active,created_at,updated_at
      )
      values(
        gen_random_uuid(),$1::varchar,$2,$3::uuid,$4::uuid,$5::uuid,$6::varchar,true,now(),now()
      )
      on conflict (code) do update
      set active=true,updated_at=now()
      returning id
      `,
      [
        input.code,
        input.type,
        input.ownerAccountId ?? null,
        input.providerId ?? null,
        input.assetId,
        input.name,
      ],
    );
    return result.rows[0].id;
  }

  private async notifyTelegramPayout(input: {
    payoutId: string;
    accountId: string;
    amount: number;
    email: string;
    pixKey: string;
    note: string;
  }) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_PAYOUT_CHAT_ID?.trim();

    if (!token || !chatId) {
      return {
        status: "PENDING_CONFIGURATION",
        deliveredAt: null,
      };
    }

    const text = [
      "🏦 PiXBrasil · Novo payout manual",
      `Ticket: ${input.payoutId}`,
      `Conta: ${input.accountId}`,
      `Cliente: ${input.email || "—"}`,
      `Valor: R$ ${input.amount.toFixed(2)}`,
      `PIX: ${input.pixKey}`,
      input.note ? `Nota: ${input.note.slice(0, 500)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            protect_content: true,
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!response.ok) {
        return {
          status: "DELIVERY_FAILED",
          deliveredAt: null,
          httpStatus: response.status,
        };
      }

      const body = (await response.json().catch(() => ({}))) as {
        result?: { message_id?: number };
      };
      return {
        status: "DELIVERED",
        deliveredAt: new Date().toISOString(),
        messageId: body.result?.message_id ?? null,
      };
    } catch {
      return {
        status: "DELIVERY_FAILED",
        deliveredAt: null,
      };
    }
  }
}
