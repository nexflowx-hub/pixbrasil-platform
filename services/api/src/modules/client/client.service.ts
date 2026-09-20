import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ClientContext } from "../client-auth/client-auth.types";
import { DatabaseService } from "../database/database.service";
import { FinancialCoreService } from "../finance/financial-core.service";

@Injectable()
export class ClientService {
  constructor(
    private readonly database: DatabaseService,
    private readonly financialCore: FinancialCoreService,
  ) {}

  async session(context: ClientContext) {
    const accounts = await Promise.all(
      context.accounts.map(async (access) => {
        const merchant =
          access.accountType === "BUSINESS"
            ? await this.database.query<{
                merchant_id: string;
                trade_name: string | null;
                tier_code: string;
                merchant_status: string;
              }>(
                `
                select
                  m.id as merchant_id,
                  m.trade_name,
                  m.tier_code,
                  m.status as merchant_status
                from pixbrasil.merchants m
                where m.account_id=$1::uuid
                limit 1
                `,
                [access.accountId],
              )
            : { rows: [] as Array<{
                merchant_id: string;
                trade_name: string | null;
                tier_code: string;
                merchant_status: string;
              }> };

        return {
          ...access,
          merchant: merchant.rows[0] ?? null,
        };
      }),
    );

    return {
      success: true,
      data: {
        email: context.email,
        userStatus: context.userStatus,
        aal: context.aal,
        accounts,
      },
    };
  }

  async accountOverview(context: ClientContext, accountId: string) {
    const access = context.accounts.find(
      (account) => account.accountId === accountId,
    );

    if (!access) {
      throw new ForbiddenException("Account access is not granted.");
    }

    const accountResult = await this.database.query<{
      id: string;
      type: string;
      status: string;
      kyc_status: string;
      identity_level: string;
      base_currency: string;
      pricing_plan_code: string | null;
      policy_profile_code: string | null;
    }>(
      `
      select
        a.id,
        a.type::text,
        a.status::text,
        a.kyc_status::text,
        a.identity_level::text,
        a.base_currency,
        pp.code as pricing_plan_code,
        pol.code as policy_profile_code
      from public.accounts a
      left join public.pricing_plans pp on pp.id=a.pricing_plan_id
      left join public.policy_profiles pol on pol.id=a.policy_profile_id
      where a.id=$1::uuid
      limit 1
      `,
      [accountId],
    );

    const account = accountResult.rows[0];
    if (!account) {
      throw new NotFoundException("Account not found.");
    }

    const walletResult = await this.database.query<{
      wallet_id: string;
      wallet_status: string;
      asset_code: string;
      symbol: string;
      asset_name: string;
      asset_type: string;
      network: string;
      decimals: number;
      available: string;
      pending: string;
      reserved: string;
      blocked: string;
      deposit_enabled: boolean;
      withdraw_enabled: boolean;
    }>(
      `
      select
        w.id as wallet_id,
        w.status::text as wallet_status,
        ass.code as asset_code,
        ass.symbol,
        ass.name as asset_name,
        ass.type::text as asset_type,
        ass.network::text as network,
        ass.decimals,
        coalesce(wb.available,0)::text as available,
        coalesce(wb.pending,0)::text as pending,
        coalesce(wb.reserved,0)::text as reserved,
        coalesce(wb.blocked,0)::text as blocked,
        ass.deposit_enabled,
        ass.withdraw_enabled
      from public.wallets w
      join public.assets ass on ass.id=w.asset_id
      left join public.wallet_balances wb on wb.wallet_id=w.id
      where w.account_id=$1::uuid
      order by
        case ass.type::text when 'FIAT' then 0 else 1 end,
        ass.code
      `,
      [accountId],
    );

    const txResult = await this.database.query<{
      id: string;
      type: string;
      status: string;
      amount: string;
      asset_code: string;
      symbol: string;
      fee_amount: string | null;
      provider_reference: string | null;
      created_at: string;
      completed_at: string | null;
    }>(
      `
      select
        t.id,
        t.type::text,
        t.status::text,
        t.amount::text,
        ass.code as asset_code,
        ass.symbol,
        t.fee_amount::text,
        t.provider_reference,
        t.created_at::text,
        t.completed_at::text
      from public.transactions t
      join public.assets ass on ass.id=t.asset_id
      where t.account_id=$1::uuid
      order by t.created_at desc
      limit 25
      `,
      [accountId],
    );

    let business: Record<string, unknown> | null = null;

    if (account.type === "BUSINESS") {
      const merchantResult = await this.database.query<{
        merchant_id: string;
        trade_name: string | null;
        merchant_status: string;
        tier_code: string;
      }>(
        `
        select id as merchant_id,trade_name,status as merchant_status,tier_code
        from pixbrasil.merchants
        where account_id=$1::uuid
        limit 1
        `,
        [accountId],
      );

      const merchant = merchantResult.rows[0];
      if (merchant) {
        const [stores, payments, payouts, settlements, providerHealth, cashflow] =
          await Promise.all([
            this.database.query(
              `
              select
                s.id,
                s.code,
                s.name,
                s.status,
                s.currency,
                gc.alias as gateway_alias,
                p.code as provider_code,
                coalesce(gc.metadata->>'lastConnectionHealth','UNKNOWN') as provider_health,
                nullif(gc.metadata->>'lastConnectionLatencyMs','')::int as latency_ms,
                rel.code as release_profile,
                rel.release_class,
                rcp.code as route_cost_profile,
                rp.activation_mode as routing_mode,
                coalesce(agg.available_brl,0)::text as available_brl,
                coalesce(agg.pending_brl,0)::text as pending_brl,
                coalesce(agg.total_net_brl,0)::text as total_net_brl,
                agg.next_available_at::text as next_available_at
              from pixbrasil.stores s
              left join pixbrasil.store_financial_profiles sfp on sfp.store_id=s.id
              left join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
              left join pixbrasil.route_cost_profiles rcp on rcp.id=sfp.route_cost_profile_id
              left join lateral (
                select *
                from pixbrasil.routing_policies rp0
                where rp0.store_id=s.id and rp0.status='ACTIVE'
                order by rp0.priority asc,rp0.version desc
                limit 1
              ) rp on true
              left join lateral (
                select gc0.*
                from pixbrasil.routing_routes rr0
                join pixbrasil.gateway_connections gc0 on gc0.id=rr0.gateway_connection_id
                where rr0.policy_id=rp.id and rr0.enabled=true
                order by rr0.priority asc
                limit 1
              ) gc on true
              left join public.providers p on p.id=gc.provider_id
              left join lateral (
                select
                  sum(case when st.status='AVAILABLE' then st.net_brl else 0 end) as available_brl,
                  sum(case when st.status='PENDING' then st.net_brl else 0 end) as pending_brl,
                  sum(st.net_brl) as total_net_brl,
                  min(st.available_at) filter (where st.status='PENDING') as next_available_at
                from pixbrasil.payment_intents pi0
                join pixbrasil.settlements st on st.payment_intent_id=pi0.id
                where pi0.store_id=s.id
              ) agg on true
              where s.merchant_id=$1::uuid
              order by s.code
              `,
              [merchant.merchant_id],
            ),
            this.database.query(
              `
              select
                pi.id,
                pi.external_reference,
                pi.amount::text,
                pi.currency,
                pi.status,
                pi.payment_method,
                s.code as store_code,
                p.code as provider_code,
                pa.provider_payment_id,
                pi.created_at::text,
                pi.updated_at::text,
                pi.completed_at::text
              from pixbrasil.payment_intents pi
              left join pixbrasil.stores s on s.id=pi.store_id
              left join lateral (
                select *
                from pixbrasil.provider_attempts pa0
                where pa0.payment_intent_id=pi.id
                order by pa0.attempt_no desc
                limit 1
              ) pa on true
              left join pixbrasil.gateway_connections gc
                on gc.id=coalesce(pa.gateway_connection_id,pi.selected_connection_id)
              left join public.providers p on p.id=gc.provider_id
              where pi.merchant_id=$1::uuid
              order by pi.created_at desc
              limit 50
              `,
              [merchant.merchant_id],
            ),
            this.database.query(
              `
              select
                pr.id,
                pr.amount::text,
                ass.code as asset_code,
                pr.destination_type,
                pr.status,
                pr.external_reference,
                pr.created_at::text,
                pr.approved_at::text,
                pr.paid_at::text,
                pr.confirmed_at::text,
                pr.proof_metadata
              from controlplane.payout_requests pr
              join public.assets ass on ass.id=pr.asset_id
              where pr.account_id=$1::uuid
              order by pr.created_at desc
              limit 25
              `,
              [accountId],
            ),
            this.database.query(
              `
              select
                st.id,
                pi.external_reference,
                s.code as store_code,
                st.gross_brl::text,
                st.provider_fee_brl::text,
                st.platform_fee_brl::text,
                st.net_brl::text,
                st.status,
                st.available_at::text,
                st.created_at::text
              from pixbrasil.settlements st
              join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
              left join pixbrasil.stores s on s.id=pi.store_id
              where pi.merchant_id=$1::uuid
              order by st.created_at desc
              limit 50
              `,
              [merchant.merchant_id],
            ),
            this.database.query(
              `
              select distinct on (p.code)
                p.code as provider_code,
                gc.alias as gateway_alias,
                coalesce(gc.metadata->>'lastConnectionHealth','UNKNOWN') as health,
                nullif(gc.metadata->>'lastConnectionLatencyMs','')::int as latency_ms,
                gc.metadata->>'lastConnectionTestedAt' as tested_at,
                coalesce(stats.attempts_30d,0)::int as attempts_30d,
                coalesce(stats.successes_30d,0)::int as successes_30d,
                case
                  when coalesce(stats.attempts_30d,0) = 0 then null
                  else round(
                    (stats.successes_30d::numeric / stats.attempts_30d::numeric) * 100,
                    2
                  )
                end::text as success_rate_30d
              from pixbrasil.stores s
              join pixbrasil.routing_policies rp
                on rp.store_id=s.id and rp.status='ACTIVE'
              join pixbrasil.routing_routes rr
                on rr.policy_id=rp.id and rr.enabled=true
              join pixbrasil.gateway_connections gc
                on gc.id=rr.gateway_connection_id
              join public.providers p on p.id=gc.provider_id
              left join lateral (
                select
                  count(*)::int as attempts_30d,
                  count(*) filter (where pi.status='SUCCEEDED')::int as successes_30d
                from pixbrasil.provider_attempts pa
                join pixbrasil.payment_intents pi on pi.id=pa.payment_intent_id
                where pa.gateway_connection_id=gc.id
                  and pa.started_at >= now() - interval '30 days'
              ) stats on true
              where s.merchant_id=$1::uuid
              order by p.code,rp.priority asc
              `,
              [merchant.merchant_id],
            ),
            this.database.query(
              `
              with days as (
                select generate_series(
                  current_date - interval '29 days',
                  current_date,
                  interval '1 day'
                )::date as day
              ),
              incoming as (
                select
                  pi.completed_at::date as day,
                  sum(st.net_brl) as amount
                from pixbrasil.payment_intents pi
                join pixbrasil.settlements st on st.payment_intent_id=pi.id
                where pi.merchant_id=$1::uuid
                  and pi.status='SUCCEEDED'
                  and pi.completed_at >= current_date - interval '29 days'
                group by 1
              ),
              outgoing as (
                select
                  coalesce(pr.confirmed_at,pr.paid_at,pr.created_at)::date as day,
                  sum(pr.amount) as amount
                from controlplane.payout_requests pr
                where pr.account_id=$2::uuid
                  and pr.status in ('PAID','CONFIRMED')
                  and coalesce(pr.confirmed_at,pr.paid_at,pr.created_at)
                    >= current_date - interval '29 days'
                group by 1
              )
              select
                d.day::text,
                coalesce(i.amount,0)::text as incoming_brl,
                coalesce(o.amount,0)::text as outgoing_brl
              from days d
              left join incoming i on i.day=d.day
              left join outgoing o on o.day=d.day
              order by d.day
              `,
              [merchant.merchant_id, accountId],
            ),
          ]);

        const brlWallet = walletResult.rows.find(
          (wallet) => wallet.asset_code === "BRL",
        );

        business = {
          merchant,
          summary: {
            availableBrl: Number(brlWallet?.available ?? 0),
            pendingBrl: Number(brlWallet?.pending ?? 0),
            reservedBrl: Number(brlWallet?.reserved ?? 0),
            blockedBrl: Number(brlWallet?.blocked ?? 0),
          },
          stores: stores.rows,
          payments: payments.rows,
          payouts: payouts.rows,
          settlements: settlements.rows,
          providerHealth: providerHealth.rows,
          cashflow: cashflow.rows,
        };
      }
    }

    return {
      success: true,
      data: {
        accessRole: access.role,
        account,
        wallets: walletResult.rows,
        transactions: txResult.rows,
        business,
        capabilities: {
          financialWritesEnabled: account.type === "BUSINESS",
          depositsEnabled: account.type === "BUSINESS",
          withdrawalsEnabled: account.type === "BUSINESS",
          exchangeEnabled: false,
          payoutMode: account.type === "BUSINESS" ? "MANUAL_TICKET" : "DISABLED",
          payoutChannel: account.type === "BUSINESS" ? "TELEGRAM" : null,
          note:
            account.type === "BUSINESS"
              ? "PIX production is active. Payouts are processed manually by ticket during the current rollout."
              : "Personal account operations depend on the enabled asset and account policy.",
        },
      },
    };
  }

  requestPayout(
    context: ClientContext,
    accountId: string,
    idempotencyKey: string | undefined,
    input: Record<string, unknown>,
  ) {
    return this.financialCore.requestManualPayout(
      context,
      accountId,
      idempotencyKey,
      input,
    );
  }

}
