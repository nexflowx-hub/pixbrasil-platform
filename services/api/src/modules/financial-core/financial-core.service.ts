import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class FinancialCoreService {
  constructor(private readonly database: DatabaseService) {}

  async postPaymentSuccess(
    paymentIntentId: string,
    providerCode: string,
    providerPaymentId: string,
    providerEvidence: Record<string, unknown> = {},
  ) {
    const result = await this.database.query<{
      settlement_id: string;
      status: string;
      net_brl: string;
      available_at: string | null;
    }>(
      `
      with source as (
        select
          pi.id payment_intent_id,
          pi.account_id,
          pi.store_id,
          pi.amount gross_brl,
          pi.external_reference,
          pi.metadata,
          ass.id asset_id,
          w.id wallet_id,
          p.id provider_id,
          coalesce(
            nullif(pi.metadata#>>'{pricingQuote,providerRouteCostBrl}','')::numeric,
            nullif(pi.metadata#>>'{shadowQuote,providerRouteCostBrl}','')::numeric,
            0
          ) provider_fee_brl,
          coalesce(
            nullif(pi.metadata#>>'{pricingQuote,platformFeeBrl}','')::numeric,
            nullif(pi.metadata#>>'{shadowQuote,platformFeeBrl}','')::numeric,
            0
          ) platform_fee_brl,
          rr.availability_mode,
          coalesce(rr.available_after_minutes,rr.max_release_minutes,0) release_minutes,
          customer_la.id customer_ledger_id,
          clearing_la.id clearing_ledger_id,
          revenue_la.id revenue_ledger_id,
          expense_la.id expense_ledger_id
        from pixbrasil.payment_intents pi
        join pixbrasil.store_financial_profiles sfp on sfp.store_id=pi.store_id
        join pixbrasil.release_rules rr
          on rr.release_profile_id=sfp.release_profile_id
         and rr.rail='PIX' and rr.enabled=true
        join public.assets ass on ass.code='BRL'
        join public.wallets w on w.account_id=pi.account_id and w.asset_id=ass.id
        join public.providers p on p.code=$2::varchar
        join public.ledger_accounts customer_la
          on customer_la.code='CUSTOMER:' || pi.account_id::text || ':BRL'
        join public.ledger_accounts clearing_la on clearing_la.code='CLEARING:PIX:BRL'
        join public.ledger_accounts revenue_la on revenue_la.code='REVENUE:PIXBRASIL:BRL'
        join public.ledger_accounts expense_la on expense_la.code='EXPENSE:PIX_PROVIDER:BRL'
        where pi.id=$1::uuid
        limit 1
      ),
      priced as (
        select *,
          greatest(0,gross_brl-provider_fee_brl-platform_fee_brl) net_brl,
          greatest(0,gross_brl-provider_fee_brl) cash_received_brl,
          case
            when availability_mode='IMMEDIATE' or release_minutes=0 then 'AVAILABLE'
            else 'PENDING'
          end settlement_status,
          case
            when availability_mode='IMMEDIATE' or release_minutes=0 then now()
            else now() + (release_minutes::text || ' minutes')::interval
          end available_at
        from source
      ),
      new_settlement as (
        insert into pixbrasil.settlements(
          payment_intent_id,gross_brl,provider_fee_brl,platform_fee_brl,net_brl,
          settlement_asset,settlement_network,settlement_amount,status,available_at,
          metadata,created_at,updated_at
        )
        select
          payment_intent_id,gross_brl,provider_fee_brl,platform_fee_brl,net_brl,
          'BRL','NONE',net_brl,settlement_status,available_at,
          jsonb_build_object(
            'providerCode',$2::text,
            'providerPaymentId',$3::text,
            'providerEvidence',$4::jsonb,
            'releaseMode',availability_mode
          ),
          now(),now()
        from priced
        on conflict (payment_intent_id) do nothing
        returning id,payment_intent_id,status,net_brl,available_at
      ),
      new_ledger_tx as (
        insert into public.ledger_transactions(
          id,reference,type,status,idempotency_key,external_reference,metadata,
          created_at,posted_at
        )
        select
          gen_random_uuid(),
          'PIX-' || left(p.payment_intent_id::text,18),
          'FIAT_DEPOSIT'::"LedgerTransactionType",
          'POSTED'::"LedgerTransactionStatus",
          'pixbrasil:deposit:' || p.payment_intent_id::text,
          p.external_reference,
          jsonb_build_object(
            'paymentIntentId',p.payment_intent_id,
            'providerCode',$2::text,
            'providerPaymentId',$3::text
          ),
          current_timestamp,current_timestamp
        from priced p
        join new_settlement ns on ns.payment_intent_id=p.payment_intent_id
        on conflict (idempotency_key) do nothing
        returning id,idempotency_key
      ),
      ledger_entries_insert as (
        insert into public.ledger_entries(
          id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
        )
        select gen_random_uuid(),lt.id,p.clearing_ledger_id,p.asset_id,
               'DEBIT'::"LedgerEntryDirection",p.cash_received_brl,current_timestamp
        from priced p join new_settlement ns on true join new_ledger_tx lt on true
        where p.cash_received_brl>0
        union all
        select gen_random_uuid(),lt.id,p.expense_ledger_id,p.asset_id,
               'DEBIT'::"LedgerEntryDirection",p.provider_fee_brl,current_timestamp
        from priced p join new_settlement ns on true join new_ledger_tx lt on true
        where p.provider_fee_brl>0
        union all
        select gen_random_uuid(),lt.id,p.customer_ledger_id,p.asset_id,
               'CREDIT'::"LedgerEntryDirection",p.net_brl,current_timestamp
        from priced p join new_settlement ns on true join new_ledger_tx lt on true
        where p.net_brl>0
        union all
        select gen_random_uuid(),lt.id,p.revenue_ledger_id,p.asset_id,
               'CREDIT'::"LedgerEntryDirection",p.platform_fee_brl,current_timestamp
        from priced p join new_settlement ns on true join new_ledger_tx lt on true
        where p.platform_fee_brl>0
        returning id
      ),
      wallet_update as (
        update public.wallet_balances wb
        set
          available=wb.available + case when p.settlement_status='AVAILABLE' then p.net_brl else 0 end,
          pending=wb.pending + case when p.settlement_status='PENDING' then p.net_brl else 0 end,
          updated_at=current_timestamp
        from priced p,new_settlement ns
        where wb.wallet_id=p.wallet_id
        returning wb.id
      ),
      tx_insert as (
        insert into public.transactions(
          id,account_id,wallet_id,ledger_transaction_id,provider_id,type,status,
          asset_id,amount,fee_asset_id,fee_amount,provider_reference,idempotency_key,
          metadata,created_at,updated_at,completed_at
        )
        select
          gen_random_uuid(),p.account_id,p.wallet_id,lt.id,p.provider_id,
          'FIAT_DEPOSIT'::"TransactionType",'COMPLETED'::"TransactionStatus",
          p.asset_id,p.net_brl,p.asset_id,p.provider_fee_brl+p.platform_fee_brl,
          $3::varchar,'pixbrasil:tx:' || p.payment_intent_id::text,
          jsonb_build_object(
            'paymentIntentId',p.payment_intent_id,
            'grossBrl',p.gross_brl,
            'providerFeeBrl',p.provider_fee_brl,
            'platformFeeBrl',p.platform_fee_brl,
            'storeId',p.store_id
          ),
          current_timestamp,current_timestamp,current_timestamp
        from priced p
        join new_settlement ns on true
        join new_ledger_tx lt on true
        on conflict (idempotency_key) do nothing
        returning id
      )
      select ns.id settlement_id,ns.status,ns.net_brl::text,ns.available_at::text
      from new_settlement ns
      union all
      select st.id,st.status,st.net_brl::text,st.available_at::text
      from pixbrasil.settlements st
      where st.payment_intent_id=$1::uuid
        and not exists(select 1 from new_settlement)
      limit 1
      `,
      [
        paymentIntentId,
        providerCode,
        providerPaymentId,
        JSON.stringify(providerEvidence),
      ],
    );

    return result.rows[0] ?? null;
  }

  async reversePayment(paymentIntentId: string, reason: string) {
    await this.database.query(
      `
      with source as (
        select
          st.id settlement_id,st.net_brl,st.status settlement_status,
          pi.account_id,ass.id asset_id,w.id wallet_id,
          lt.id original_ledger_tx_id
        from pixbrasil.settlements st
        join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
        join public.assets ass on ass.code='BRL'
        join public.wallets w on w.account_id=pi.account_id and w.asset_id=ass.id
        left join public.ledger_transactions lt
          on lt.idempotency_key='pixbrasil:deposit:' || pi.id::text
        where st.payment_intent_id=$1::uuid
          and st.status<>'REVERSED'
        limit 1
      ),
      reversal_tx as (
        insert into public.ledger_transactions(
          id,reference,type,status,idempotency_key,external_reference,metadata,
          created_at,posted_at
        )
        select
          gen_random_uuid(),'REV-' || left($1::text,18),
          'REVERSAL'::"LedgerTransactionType",'POSTED'::"LedgerTransactionStatus",
          'pixbrasil:reversal:' || $1::text,$1::text,
          jsonb_build_object('paymentIntentId',$1::text,'reason',$2::text),
          current_timestamp,current_timestamp
        from source
        where original_ledger_tx_id is not null
        on conflict (idempotency_key) do nothing
        returning id
      ),
      reversal_entries as (
        insert into public.ledger_entries(
          id,ledger_transaction_id,ledger_account_id,asset_id,direction,amount,created_at
        )
        select
          gen_random_uuid(),rt.id,le.ledger_account_id,le.asset_id,
          case le.direction
            when 'DEBIT'::"LedgerEntryDirection" then 'CREDIT'::"LedgerEntryDirection"
            else 'DEBIT'::"LedgerEntryDirection"
          end,
          le.amount,current_timestamp
        from source s
        join reversal_tx rt on true
        join public.ledger_entries le on le.ledger_transaction_id=s.original_ledger_tx_id
        returning id
      ),
      wallet_update as (
        update public.wallet_balances wb
        set
          pending = case
            when s.settlement_status='PENDING' then greatest(0,wb.pending-s.net_brl)
            else wb.pending
          end,
          available = case
            when s.settlement_status='AVAILABLE' then greatest(0,wb.available-s.net_brl)
            else wb.available
          end,
          reserved = case
            when s.settlement_status='AVAILABLE' and wb.available<s.net_brl
              then greatest(0,wb.reserved-(s.net_brl-wb.available))
            else wb.reserved
          end,
          blocked = wb.blocked + case
            when s.settlement_status='AVAILABLE'
              then greatest(0,s.net_brl-wb.available-wb.reserved)
            when s.settlement_status='PENDING'
              then greatest(0,s.net_brl-wb.pending)
            else 0
          end,
          updated_at=current_timestamp
        from source s
        where wb.wallet_id=s.wallet_id
        returning wb.id
      )
      update pixbrasil.settlements st
      set status='REVERSED',
          metadata=coalesce(st.metadata,'{}'::jsonb) ||
            jsonb_build_object('reversedAt',now(),'reversalReason',$2::text),
          updated_at=now()
      where st.id=(select settlement_id from source)
      `,
      [paymentIntentId, reason.slice(0, 300)],
    );
  }

  async releaseDueSettlements() {
    const result = await this.database.query<{ released_count: number }>(
      `
      with due as (
        select st.id,st.net_brl,w.id wallet_id
        from pixbrasil.settlements st
        join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
        join public.assets ass on ass.code='BRL'
        join public.wallets w on w.account_id=pi.account_id and w.asset_id=ass.id
        where st.status='PENDING'
          and st.available_at is not null
          and st.available_at<=now()
        for update of st skip locked
      ),
      totals as (
        select wallet_id,sum(net_brl) amount
        from due group by wallet_id
      ),
      wallet_update as (
        update public.wallet_balances wb
        set pending=wb.pending-t.amount,
            available=wb.available+t.amount,
            updated_at=current_timestamp
        from totals t
        where wb.wallet_id=t.wallet_id
          and wb.pending>=t.amount
        returning wb.wallet_id
      ),
      released as (
        update pixbrasil.settlements st
        set status='AVAILABLE',
            metadata=coalesce(st.metadata,'{}'::jsonb) ||
              jsonb_build_object('releasedAt',now(),'releaseSource','SCHEDULED'),
            updated_at=now()
        where st.id in (select d.id from due d)
          and exists(
            select 1 from due d2
            join wallet_update wu on wu.wallet_id=d2.wallet_id
            where d2.id=st.id
          )
        returning st.id
      )
      select count(*)::int released_count from released
      `,
    );
    return result.rows[0]?.released_count ?? 0;
  }
}
