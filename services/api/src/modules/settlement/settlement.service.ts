import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

interface SettlementSourceRow {
  payment_intent_id: string;
  account_id: string;
  merchant_id: string | null;
  store_id: string | null;
  external_reference: string | null;
  gross_brl: string;
  metadata: Record<string, unknown>;
  provider_id: string | null;
  release_profile_code: string | null;
  release_class: string | null;
  availability_mode: string | null;
  available_after_minutes: number | null;
}

interface Quote {
  providerRouteCostBrl?: unknown;
  platformFeeBrl?: unknown;
  estimatedMerchantNetBrl?: unknown;
}

function money(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

@Injectable()
export class SettlementService {
  constructor(private readonly database: DatabaseService) {}

  async settleSucceededPayment(paymentIntentId: string) {
    const sourceResult = await this.database.query<SettlementSourceRow>(
      `
      select
        pi.id as payment_intent_id,
        pi.account_id,
        pi.merchant_id,
        pi.store_id,
        pi.external_reference,
        pi.amount::text as gross_brl,
        pi.metadata,
        p.id as provider_id,
        rel.code as release_profile_code,
        rel.release_class,
        rr.availability_mode,
        rr.available_after_minutes
      from pixbrasil.payment_intents pi
      left join pixbrasil.gateway_connections gc
        on gc.id=pi.selected_connection_id
      left join public.providers p on p.id=gc.provider_id
      left join pixbrasil.store_financial_profiles sfp
        on sfp.store_id=pi.store_id
      left join pixbrasil.release_profiles rel
        on rel.id=sfp.release_profile_id
      left join lateral (
        select rr0.*
        from pixbrasil.release_rules rr0
        where rr0.release_profile_id=sfp.release_profile_id
          and rr0.rail='PIX'
          and rr0.enabled=true
        order by rr0.created_at asc
        limit 1
      ) rr on true
      where pi.id=$1::uuid
        and pi.status='SUCCEEDED'
      limit 1
      `,
      [paymentIntentId],
    );

    const source = sourceResult.rows[0];
    if (!source) return null;

    const quote = (source.metadata?.shadowQuote ?? {}) as Quote;
    const gross = money(source.gross_brl);
    const providerFee = money(quote.providerRouteCostBrl);
    const platformFee = money(quote.platformFeeBrl);
    const quotedNet = money(quote.estimatedMerchantNetBrl);
    const net = quotedNet > 0
      ? quotedNet
      : money(Math.max(0, gross - providerFee - platformFee));

    const immediatelyAvailable =
      source.availability_mode === "IMMEDIATE" &&
      Number(source.available_after_minutes ?? 0) <= 0;

    return this.database.withTransaction(async (client) => {
      const existing = await client.query<{ id: string; status: string }>(
        `
        select id,status
        from pixbrasil.settlements
        where payment_intent_id=$1::uuid
        for update
        `,
        [paymentIntentId],
      );

      if (existing.rows[0]) {
        return {
          settlementId: existing.rows[0].id,
          status: existing.rows[0].status,
          replay: true,
        };
      }

      const asset = await client.query<{ id: string }>(
        `
        select id
        from public.assets
        where code='BRL' and status='ACTIVE'
        limit 1
        `,
      );
      const assetId = asset.rows[0]?.id;
      if (!assetId) throw new Error("BRL asset is not configured.");

      const wallet = await client.query<{ id: string }>(
        `
        insert into public.wallets(
          id,account_id,asset_id,status,created_at,updated_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::uuid,'ACTIVE',now(),now()
        )
        on conflict (account_id,asset_id)
        do update set updated_at=now()
        returning id
        `,
        [source.account_id, assetId],
      );
      const walletId = wallet.rows[0].id;

      await client.query(
        `
        insert into public.wallet_balances(
          id,wallet_id,available,pending,reserved,blocked,updated_at
        )
        values(gen_random_uuid(),$1::uuid,0,0,0,0,now())
        on conflict (wallet_id) do nothing
        `,
        [walletId],
      );

      const customerLedger = await this.ensureLedgerAccount(
        client,
        `CUSTOMER:${source.account_id}:BRL`,
        "CUSTOMER",
        assetId,
        "Customer BRL",
        source.account_id,
      );
      const pixClearing = await this.ensureLedgerAccount(
        client,
        "CLEARING:PIX:BRL",
        "CLEARING",
        assetId,
        "PIX gross clearing",
        null,
      );
      const providerFeeClearing = await this.ensureLedgerAccount(
        client,
        "CLEARING:PROVIDER_FEES:BRL",
        "CLEARING",
        assetId,
        "Provider fee clearing",
        null,
      );
      const platformRevenue = await this.ensureLedgerAccount(
        client,
        "REVENUE:PIXBRASIL:BRL",
        "REVENUE",
        assetId,
        "PiXBrasil payment revenue",
        null,
      );

      const ledger = await client.query<{ id: string }>(
        `
        insert into public.ledger_transactions(
          id,reference,type,status,idempotency_key,external_reference,
          metadata,created_at,posted_at
        )
        values(
          gen_random_uuid(),$1::varchar,'FIAT_DEPOSIT','POSTED',
          $2::varchar,$3::varchar,$4::jsonb,now(),now()
        )
        returning id
        `,
        [
          `PIX-IN:${paymentIntentId}`,
          `pixbrasil:payment:${paymentIntentId}`,
          source.external_reference,
          JSON.stringify({
            source: "PIXBRASIL",
            paymentIntentId,
            merchantId: source.merchant_id,
            storeId: source.store_id,
            providerFeeBrl: providerFee,
            platformFeeBrl: platformFee,
          }),
        ],
      );
      const ledgerId = ledger.rows[0].id;

      await this.entry(client, ledgerId, pixClearing, assetId, "DEBIT", gross);
      await this.entry(client, ledgerId, customerLedger, assetId, "CREDIT", net);
      if (providerFee > 0) {
        await this.entry(
          client,
          ledgerId,
          providerFeeClearing,
          assetId,
          "CREDIT",
          providerFee,
        );
      }
      if (platformFee > 0) {
        await this.entry(
          client,
          ledgerId,
          platformRevenue,
          assetId,
          "CREDIT",
          platformFee,
        );
      }

      const creditTotal = money(net + providerFee + platformFee);
      if (creditTotal !== gross) {
        const rounding = money(gross - creditTotal);
        if (rounding > 0) {
          await this.entry(
            client,
            ledgerId,
            providerFeeClearing,
            assetId,
            "CREDIT",
            rounding,
          );
        }
      }

      await client.query(
        `
        insert into public.transactions(
          id,account_id,wallet_id,ledger_transaction_id,provider_id,
          type,status,asset_id,amount,fee_asset_id,fee_amount,
          provider_reference,idempotency_key,metadata,
          created_at,updated_at,completed_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::uuid,
          'FIAT_DEPOSIT','COMPLETED',$5::uuid,$6::numeric,$5::uuid,$7::numeric,
          $8::varchar,$9::varchar,$10::jsonb,
          now(),now(),now()
        )
        `,
        [
          source.account_id,
          walletId,
          ledgerId,
          source.provider_id,
          assetId,
          net,
          money(providerFee + platformFee),
          source.external_reference,
          `pixbrasil:payment:${paymentIntentId}`,
          JSON.stringify({
            paymentIntentId,
            grossBrl: gross,
            providerFeeBrl: providerFee,
            platformFeeBrl: platformFee,
            releaseProfile: source.release_profile_code,
            releaseClass: source.release_class,
          }),
        ],
      );

      const availableAt = immediatelyAvailable
        ? "now()"
        : source.available_after_minutes != null
          ? `now() + interval '${Math.max(0, source.available_after_minutes)} minutes'`
          : "null";

      const settlement = await client.query<{ id: string; status: string }>(
        `
        insert into pixbrasil.settlements(
          payment_intent_id,gross_brl,provider_fee_brl,platform_fee_brl,
          net_brl,settlement_asset,status,available_at,metadata,created_at,updated_at
        )
        values(
          $1::uuid,$2::numeric,$3::numeric,$4::numeric,$5::numeric,
          'BRL',$6::text,${availableAt},
          $7::jsonb,now(),now()
        )
        returning id,status
        `,
        [
          paymentIntentId,
          gross,
          providerFee,
          platformFee,
          net,
          immediatelyAvailable ? "AVAILABLE" : "PENDING",
          JSON.stringify({
            source: "VERIFIED_PROVIDER_WEBHOOK",
            releaseProfile: source.release_profile_code,
            releaseClass: source.release_class,
          }),
        ],
      );

      await client.query(
        immediatelyAvailable
          ? `
            update public.wallet_balances
            set available=available+$2::numeric,updated_at=now()
            where wallet_id=$1::uuid
            `
          : `
            update public.wallet_balances
            set pending=pending+$2::numeric,updated_at=now()
            where wallet_id=$1::uuid
            `,
        [walletId, net],
      );

      return {
        settlementId: settlement.rows[0].id,
        status: settlement.rows[0].status,
        replay: false,
        walletId,
        netBrl: net,
      };
    });
  }

  private async ensureLedgerAccount(
    client: PoolClient,
    code: string,
    type: "CUSTOMER" | "CLEARING" | "REVENUE",
    assetId: string,
    name: string,
    ownerAccountId: string | null,
  ) {
    const result = await client.query<{ id: string }>(
      `
      insert into public.ledger_accounts(
        id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
      )
      values(
        gen_random_uuid(),$1::varchar,$2::public."LedgerAccountType",
        $3::uuid,$4::uuid,$5::varchar,true,now(),now()
      )
      on conflict (code)
      do update set active=true,updated_at=now()
      returning id
      `,
      [code, type, ownerAccountId, assetId, name],
    );
    return result.rows[0].id;
  }

  private async entry(
    client: PoolClient,
    ledgerTransactionId: string,
    ledgerAccountId: string,
    assetId: string,
    direction: "DEBIT" | "CREDIT",
    amount: number,
  ) {
    if (amount <= 0) return;
    await client.query(
      `
      insert into public.ledger_entries(
        id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
      )
      values(
        gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,
        $4::public."LedgerEntryDirection",$5::numeric,now()
      )
      `,
      [ledgerTransactionId, ledgerAccountId, assetId, direction, amount],
    );
  }
}
