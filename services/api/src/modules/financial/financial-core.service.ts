import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

interface PaymentFinancialRow {
  id: string;
  account_id: string;
  store_id: string | null;
  amount: string;
  status: string;
  metadata: Record<string, unknown>;
  selected_connection_id: string | null;
  provider_id: string | null;
  release_profile_code: string | null;
  release_class: string | null;
  availability_mode: string | null;
  available_after_minutes: number | null;
  max_release_minutes: number | null;
}

interface Foundation {
  assetId: string;
  walletId: string;
  customerLedgerId: string;
  clearingLedgerId: string;
  revenueLedgerId: string;
}

function money(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class FinancialCoreService {
  constructor(private readonly database: DatabaseService) {}

  async ensureAccountFoundation(accountId: string) {
    return this.database.transaction((client) =>
      this.ensureFoundation(client, accountId),
    );
  }

  async recordSuccessfulPayment(input: {
    paymentIntentId: string;
    providerPaymentId: string;
    providerCode: string;
  }) {
    return this.database.transaction(async (client) => {
      const payment = await client.query<PaymentFinancialRow>(
        `
        select
          pi.id,
          pi.account_id,
          pi.store_id,
          pi.amount::text,
          pi.status,
          pi.metadata,
          pi.selected_connection_id,
          p.id as provider_id,
          rel.code as release_profile_code,
          rel.release_class,
          rr.availability_mode,
          rr.available_after_minutes,
          rr.max_release_minutes
        from pixbrasil.payment_intents pi
        left join pixbrasil.store_financial_profiles sfp on sfp.store_id=pi.store_id
        left join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
        left join lateral (
          select rr0.*
          from pixbrasil.release_rules rr0
          where rr0.release_profile_id=rel.id
            and rr0.rail='PIX'
            and rr0.enabled=true
          order by
            case when rr0.asset_code is null then 0 else 1 end,
            rr0.created_at asc
          limit 1
        ) rr on true
        left join pixbrasil.gateway_connections gc
          on gc.id=pi.selected_connection_id
        left join public.providers p on p.id=gc.provider_id
        where pi.id=$1::uuid
        for update of pi
        `,
        [input.paymentIntentId],
      );

      const row = payment.rows[0];
      if (!row || row.status !== "SUCCEEDED") {
        return { posted: false, reason: "PAYMENT_NOT_SUCCEEDED" as const };
      }

      const existing = await client.query<{ id: string; status: string }>(
        `
        select id,status
        from pixbrasil.settlements
        where payment_intent_id=$1::uuid
        limit 1
        `,
        [row.id],
      );

      if (existing.rows[0]) {
        return {
          posted: false,
          reason: "ALREADY_POSTED" as const,
          settlementId: existing.rows[0].id,
          settlementStatus: existing.rows[0].status,
        };
      }

      const quote = objectValue(row.metadata?.shadowQuote);
      const gross = money(row.amount);
      const providerFee = money(quote.providerRouteCostBrl);
      const platformFee = money(quote.platformFeeBrl);
      const quotedNet = money(quote.estimatedMerchantNetBrl);
      const net = quotedNet > 0
        ? quotedNet
        : money(Math.max(0, gross - providerFee - platformFee));

      if (net <= 0) {
        throw new Error("Settlement net amount must be positive.");
      }

      const foundation = await this.ensureFoundation(client, row.account_id);
      const releaseMinutes = this.releaseMinutes(row);
      const releaseNow = releaseMinutes <= 0;

      const settlement = await client.query<{ id: string; status: string }>(
        `
        insert into pixbrasil.settlements(
          payment_intent_id,
          gross_brl,
          provider_fee_brl,
          platform_fee_brl,
          net_brl,
          settlement_asset,
          settlement_amount,
          status,
          available_at,
          metadata,
          created_at,
          updated_at
        )
        values(
          $1::uuid,$2::numeric,$3::numeric,$4::numeric,$5::numeric,
          'BRL',$5::numeric,$6::text,
          now() + ($7::int * interval '1 minute'),
          $8::jsonb,
          now(),now()
        )
        on conflict (payment_intent_id) do nothing
        returning id,status
        `,
        [
          row.id,
          gross,
          providerFee,
          platformFee,
          net,
          releaseNow ? "AVAILABLE" : "PENDING",
          releaseMinutes,
          JSON.stringify({
            releaseProfile: row.release_profile_code,
            releaseClass: row.release_class,
            availabilityMode: row.availability_mode,
            providerCode: input.providerCode,
            providerPaymentId: input.providerPaymentId,
          }),
        ],
      );

      const settlementRow = settlement.rows[0];
      if (!settlementRow) {
        return { posted: false, reason: "ALREADY_POSTED" as const };
      }

      const ledgerKey = `pix:payment:${row.id}`;
      let ledgerTransactionId: string | null = null;
      const existingLedger = await client.query<{ id: string }>(
        `
        select id
        from public.ledger_transactions
        where idempotency_key=$1::varchar
        limit 1
        `,
        [ledgerKey],
      );

      if (existingLedger.rows[0]) {
        ledgerTransactionId = existingLedger.rows[0].id;
      } else {
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
            `PIX:${row.id}`,
            ledgerKey,
            input.providerPaymentId,
            JSON.stringify({
              paymentIntentId: row.id,
              settlementId: settlementRow.id,
              providerCode: input.providerCode,
              grossBrl: gross,
              providerFeeBrl: providerFee,
              platformFeeBrl: platformFee,
              merchantNetBrl: net,
            }),
          ],
        );

        ledgerTransactionId = ledger.rows[0].id;
        const providerSettlementNet = money(net + platformFee);

        await client.query(
          `
          insert into public.ledger_entries(
            id,ledger_transaction_id,ledger_account_id,asset_id,
            direction,amount,created_at
          )
          values
            (gen_random_uuid(),$1::uuid,$2::uuid,$5::uuid,'DEBIT',$6::numeric,now()),
            (gen_random_uuid(),$1::uuid,$3::uuid,$5::uuid,'CREDIT',$7::numeric,now())
          `,
          [
            ledgerTransactionId,
            foundation.clearingLedgerId,
            foundation.customerLedgerId,
            foundation.revenueLedgerId,
            foundation.assetId,
            providerSettlementNet,
            net,
          ],
        );

        if (platformFee > 0) {
          await client.query(
            `
            insert into public.ledger_entries(
              id,ledger_transaction_id,ledger_account_id,asset_id,
              direction,amount,created_at
            )
            values(
              gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,
              'CREDIT',$4::numeric,now()
            )
            `,
            [
              ledgerTransactionId,
              foundation.revenueLedgerId,
              foundation.assetId,
              platformFee,
            ],
          );
        }
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
          row.account_id,
          foundation.walletId,
          ledgerTransactionId,
          row.provider_id,
          foundation.assetId,
          net,
          money(providerFee + platformFee),
          input.providerPaymentId,
          ledgerKey,
          JSON.stringify({
            paymentIntentId: row.id,
            settlementId: settlementRow.id,
            grossBrl: gross,
            releaseClass: row.release_class,
            availability: releaseNow ? "AVAILABLE" : "PENDING",
          }),
        ],
      );

      await client.query(
        `
        update public.wallet_balances
        set
          available=available + $2::numeric,
          pending=pending + $3::numeric,
          updated_at=now()
        where wallet_id=$1::uuid
        `,
        [
          foundation.walletId,
          releaseNow ? net : 0,
          releaseNow ? 0 : net,
        ],
      );

      await client.query(
        `
        update pixbrasil.payment_intents
        set metadata=metadata || jsonb_build_object(
          'settlementId',$2::text,
          'financialPostedAt',now(),
          'merchantNetBrl',$3::numeric,
          'walletAvailability',$4::text
        ),
        updated_at=now()
        where id=$1::uuid
        `,
        [
          row.id,
          settlementRow.id,
          net,
          releaseNow ? "AVAILABLE" : "PENDING",
        ],
      );

      return {
        posted: true,
        settlementId: settlementRow.id,
        settlementStatus: settlementRow.status,
        netBrl: net,
        availableAtMinutes: releaseMinutes,
      };
    });
  }

  async releaseDueSettlements(limit = 50) {
    const due = await this.database.query<{ id: string }>(
      `
      select id
      from pixbrasil.settlements
      where status='PENDING'
        and available_at is not null
        and available_at <= now()
      order by available_at asc
      limit $1::int
      `,
      [limit],
    );

    let released = 0;
    for (const row of due.rows) {
      const didRelease = await this.releaseSettlement(row.id);
      if (didRelease) released += 1;
    }
    return released;
  }

  private async releaseSettlement(settlementId: string) {
    return this.database.transaction(async (client) => {
      const settlement = await client.query<{
        id: string;
        account_id: string;
        net_brl: string;
        status: string;
        available_at: string | null;
      }>(
        `
        select
          st.id,
          pi.account_id,
          st.net_brl::text,
          st.status,
          st.available_at::text
        from pixbrasil.settlements st
        join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
        where st.id=$1::uuid
        for update of st
        `,
        [settlementId],
      );

      const row = settlement.rows[0];
      if (!row || row.status !== "PENDING") return false;
      if (row.available_at && new Date(row.available_at).getTime() > Date.now()) {
        return false;
      }

      const foundation = await this.ensureFoundation(client, row.account_id);
      const amount = money(row.net_brl);

      const moved = await client.query(
        `
        update public.wallet_balances
        set
          pending=pending-$2::numeric,
          available=available+$2::numeric,
          updated_at=now()
        where wallet_id=$1::uuid
          and pending >= $2::numeric
        returning id
        `,
        [foundation.walletId, amount],
      );

      if (moved.rowCount !== 1) {
        return false;
      }

      await client.query(
        `
        update pixbrasil.settlements
        set status='AVAILABLE',updated_at=now()
        where id=$1::uuid
        `,
        [row.id],
      );

      return true;
    });
  }

  private releaseMinutes(row: PaymentFinancialRow) {
    if (row.availability_mode === "IMMEDIATE") return 0;
    if (
      row.available_after_minutes != null &&
      Number.isFinite(row.available_after_minutes)
    ) {
      return Math.max(0, row.available_after_minutes);
    }
    if (
      row.max_release_minutes != null &&
      Number.isFinite(row.max_release_minutes)
    ) {
      return Math.max(0, row.max_release_minutes);
    }
    return 0;
  }

  private async ensureFoundation(
    client: PoolClient,
    accountId: string,
  ): Promise<Foundation> {
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
      values(gen_random_uuid(),$1::uuid,$2::uuid,'ACTIVE',now(),now())
      on conflict (account_id,asset_id)
      do update set updated_at=excluded.updated_at
      returning id
      `,
      [accountId, assetId],
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

    const customerLedger = await client.query<{ id: string }>(
      `
      insert into public.ledger_accounts(
        id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
      )
      values(
        gen_random_uuid(),$1::varchar,'CUSTOMER',$2::uuid,$3::uuid,
        'Customer BRL',true,now(),now()
      )
      on conflict (code)
      do update set active=true,updated_at=excluded.updated_at
      returning id
      `,
      [`CUSTOMER:${accountId}:BRL`, accountId, assetId],
    );

    const clearingLedger = await client.query<{ id: string }>(
      `
      insert into public.ledger_accounts(
        id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
      )
      values(
        gen_random_uuid(),'CLEARING:PIX:BRL','CLEARING',null,$1::uuid,
        'PIX Clearing BRL',true,now(),now()
      )
      on conflict (code)
      do update set active=true,updated_at=excluded.updated_at
      returning id
      `,
      [assetId],
    );

    const revenueLedger = await client.query<{ id: string }>(
      `
      insert into public.ledger_accounts(
        id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
      )
      values(
        gen_random_uuid(),'REVENUE:PIXBRASIL:BRL','REVENUE',null,$1::uuid,
        'PiXBrasil Revenue BRL',true,now(),now()
      )
      on conflict (code)
      do update set active=true,updated_at=excluded.updated_at
      returning id
      `,
      [assetId],
    );

    return {
      assetId,
      walletId,
      customerLedgerId: customerLedger.rows[0].id,
      clearingLedgerId: clearingLedger.rows[0].id,
      revenueLedgerId: revenueLedger.rows[0].id,
    };
  }
}
