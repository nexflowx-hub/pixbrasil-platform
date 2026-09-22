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
        const [stores, payments, payouts, settlements, operations, cashflow] =
          await Promise.all([
            this.database.query(
              `
              select
                s.id,
                s.code,
                s.name,
                s.status,
                s.currency,
                rel.code as release_profile,
                rel.release_class,
                coalesce(agg.available_brl,0)::text as available_brl,
                coalesce(agg.pending_brl,0)::text as pending_brl,
                coalesce(agg.total_net_brl,0)::text as total_net_brl,
                agg.next_available_at::text as next_available_at
              from pixbrasil.stores s
              left join pixbrasil.store_financial_profiles sfp on sfp.store_id=s.id
              left join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
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
                pi.created_at::text,
                pi.updated_at::text,
                pi.completed_at::text
              from pixbrasil.payment_intents pi
              left join pixbrasil.stores s on s.id=pi.store_id
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
              with payment_stats as (
                select
                  count(*) filter (
                    where created_at >= now() - interval '30 days'
                  )::int as payments_30d,
                  count(*) filter (
                    where created_at >= now() - interval '30 days'
                      and status='SUCCEEDED'
                  )::int as successful_30d
                from pixbrasil.payment_intents
                where merchant_id=$1::uuid
              ),
              route_stats as (
                select
                  count(*)::int as routes_total,
                  count(*) filter (
                    where upper(coalesce(gc.metadata->>'lastConnectionHealth','UNKNOWN'))
                      in ('HEALTHY','ACTIVE','ONLINE')
                  )::int as routes_healthy
                from pixbrasil.stores s
                join pixbrasil.routing_policies rp
                  on rp.store_id=s.id
                 and rp.status='ACTIVE'
                 and rp.activation_mode='ENFORCED'
                join pixbrasil.routing_routes rr
                  on rr.policy_id=rp.id
                 and rr.enabled=true
                join pixbrasil.gateway_connections gc
                  on gc.id=rr.gateway_connection_id
                where s.merchant_id=$1::uuid
              )
              select
                ps.payments_30d,
                ps.successful_30d,
                case
                  when ps.payments_30d = 0 then null
                  else round(
                    (ps.successful_30d::numeric / ps.payments_30d::numeric) * 100,
                    2
                  )::text
                end as success_rate_30d,
                case
                  when rs.routes_total = 0 then 'UNKNOWN'
                  when rs.routes_healthy = rs.routes_total then 'OPERATIONAL'
                  when rs.routes_healthy > 0 then 'DEGRADED'
                  else 'UNAVAILABLE'
                end as pix_status
              from payment_stats ps
              cross join route_stats rs
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
          operations: {
            pixStatus: operations.rows[0]?.pix_status ?? "UNKNOWN",
            payments30d: Number(operations.rows[0]?.payments_30d ?? 0),
            successful30d: Number(operations.rows[0]?.successful_30d ?? 0),
            successRate30d: operations.rows[0]?.success_rate_30d ?? null,
          },
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
          payoutsEnabled: account.type === "BUSINESS",
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
