import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ClientContext } from "../client-auth/client-auth.types";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ClientService {
  constructor(private readonly database: DatabaseService) {}

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
        const [stores, payments, settlements, gateways, payouts, cashflow] =
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
                rel.code as release_profile,
                rel.release_class,
                rcp.code as route_cost_profile,
                rp.activation_mode as routing_mode,
                coalesce(gc.metadata->>'lastConnectionHealth','UNKNOWN') as provider_health,
                nullif(gc.metadata->>'lastConnectionLatencyMs','')::int as latency_ms
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
                join pixbrasil.gateway_connections gc0
                  on gc0.id=rr0.gateway_connection_id
                where rr0.policy_id=rp.id and rr0.enabled=true
                order by rr0.priority asc
                limit 1
              ) gc on true
              left join public.providers p on p.id=gc.provider_id
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
                select pa0.*
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
                st.id,
                pi.id as payment_intent_id,
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
              select distinct on (gc.id)
                gc.id,
                gc.alias,
                p.code as provider_code,
                gc.status,
                coalesce(gc.metadata->>'lastConnectionHealth','UNKNOWN') as health,
                nullif(gc.metadata->>'lastConnectionLatencyMs','')::int as latency_ms,
                coalesce((gc.metadata->>'routingEligible')::boolean,false) as routing_eligible
              from pixbrasil.stores s
              join pixbrasil.routing_policies rp
                on rp.store_id=s.id and rp.status='ACTIVE'
              join pixbrasil.routing_routes rr
                on rr.policy_id=rp.id and rr.enabled=true
              join pixbrasil.gateway_connections gc
                on gc.id=rr.gateway_connection_id
              join public.providers p on p.id=gc.provider_id
              where s.merchant_id=$1::uuid
              order by gc.id,p.code
              `,
              [merchant.merchant_id],
            ),
            this.database.query(
              `
              select
                pr.id,
                pr.external_reference,
                pr.amount::text,
                pr.destination_type,
                pr.status,
                pr.created_at::text,
                pr.approved_at::text,
                pr.paid_at::text,
                pr.confirmed_at::text
              from controlplane.payout_requests pr
              where pr.account_id=$1::uuid
              order by pr.created_at desc
              limit 25
              `,
              [accountId],
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
                  st.created_at::date as day,
                  sum(st.net_brl)::numeric as amount
                from pixbrasil.settlements st
                join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
                where pi.merchant_id=$1::uuid
                  and st.created_at >= current_date - interval '29 days'
                group by st.created_at::date
              ),
              outgoing as (
                select
                  pr.created_at::date as day,
                  sum(pr.amount)::numeric as amount
                from controlplane.payout_requests pr
                where pr.account_id=$2::uuid
                  and pr.status in ('PAID','CONFIRMED')
                  and pr.created_at >= current_date - interval '29 days'
                group by pr.created_at::date
              )
              select
                d.day::text,
                coalesce(i.amount,0)::text as incoming,
                coalesce(o.amount,0)::text as outgoing
              from days d
              left join incoming i on i.day=d.day
              left join outgoing o on o.day=d.day
              order by d.day
              `,
              [merchant.merchant_id, accountId],
            ),
          ]);

        const summaryResult = await this.database.query<{
          available: string;
          pending: string;
          reserved: string;
          blocked: string;
          gross_30d: string;
          net_30d: string;
          succeeded_30d: number;
        }>(
          `
          select
            coalesce((
              select wb.available
              from public.wallets w
              join public.assets ass on ass.id=w.asset_id and ass.code='BRL'
              left join public.wallet_balances wb on wb.wallet_id=w.id
              where w.account_id=$1::uuid
              limit 1
            ),0)::text as available,
            coalesce((
              select wb.pending
              from public.wallets w
              join public.assets ass on ass.id=w.asset_id and ass.code='BRL'
              left join public.wallet_balances wb on wb.wallet_id=w.id
              where w.account_id=$1::uuid
              limit 1
            ),0)::text as pending,
            coalesce((
              select wb.reserved
              from public.wallets w
              join public.assets ass on ass.id=w.asset_id and ass.code='BRL'
              left join public.wallet_balances wb on wb.wallet_id=w.id
              where w.account_id=$1::uuid
              limit 1
            ),0)::text as reserved,
            coalesce((
              select wb.blocked
              from public.wallets w
              join public.assets ass on ass.id=w.asset_id and ass.code='BRL'
              left join public.wallet_balances wb on wb.wallet_id=w.id
              where w.account_id=$1::uuid
              limit 1
            ),0)::text as blocked,
            coalesce(sum(st.gross_brl) filter (
              where st.created_at >= now()-interval '30 days'
            ),0)::text as gross_30d,
            coalesce(sum(st.net_brl) filter (
              where st.created_at >= now()-interval '30 days'
            ),0)::text as net_30d,
            count(*) filter (
              where st.created_at >= now()-interval '30 days'
            )::int as succeeded_30d
          from pixbrasil.settlements st
          join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
          where pi.merchant_id=$2::uuid
          `,
          [accountId, merchant.merchant_id],
        );

        business = {
          merchant,
          summary: summaryResult.rows[0] ?? {
            available: "0",
            pending: "0",
            reserved: "0",
            blocked: "0",
            gross_30d: "0",
            net_30d: "0",
            succeeded_30d: 0,
          },
          stores: stores.rows,
          payments: payments.rows,
          settlements: settlements.rows,
          gateways: gateways.rows,
          payouts: payouts.rows,
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
          payoutMode: account.type === "BUSINESS" ? "MANUAL_TICKET" : null,
          note:
            account.type === "BUSINESS"
              ? "Recebimentos PIX em produção. Payouts são processados por ticket manual nesta fase."
              : "Conta Personal disponível para consulta; novas operações serão habilitadas por produto.",
        },
      },
    };
  }

  async requestPayoutTicket(
    context: ClientContext,
    accountId: string,
    input: Record<string, unknown>,
  ) {
    const access = context.accounts.find(
      (account) => account.accountId === accountId,
    );
    if (!access) {
      throw new ForbiddenException("Account access is not granted.");
    }
    if (!["OWNER", "ADMIN", "FINANCE"].includes(access.role)) {
      throw new ForbiddenException(
        "This account role cannot request payouts.",
      );
    }

    const amount = Math.round(Number(input.amount ?? 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be a positive BRL value.");
    }

    const destinationType = String(
      input.destinationType ?? "PIX",
    ).trim().toUpperCase();
    if (!["PIX", "CRYPTO"].includes(destinationType)) {
      throw new BadRequestException(
        "destinationType must be PIX or CRYPTO.",
      );
    }

    const destination =
      input.destination &&
      typeof input.destination === "object" &&
      !Array.isArray(input.destination)
        ? (input.destination as Record<string, unknown>)
        : {};

    const ticket = await this.database.withTransaction(async (client) => {
      const wallet = await client.query<{
        wallet_id: string;
        asset_id: string;
        available: string;
      }>(
        `
        select
          w.id as wallet_id,
          ass.id as asset_id,
          coalesce(wb.available,0)::text as available
        from public.wallets w
        join public.assets ass on ass.id=w.asset_id
        join public.wallet_balances wb on wb.wallet_id=w.id
        where w.account_id=$1::uuid
          and ass.code='BRL'
          and w.status='ACTIVE'
        limit 1
        for update of wb
        `,
        [accountId],
      );

      const walletRow = wallet.rows[0];
      if (!walletRow) {
        throw new BadRequestException("BRL wallet is not available.");
      }
      if (Number(walletRow.available) < amount) {
        throw new BadRequestException("Insufficient available BRL balance.");
      }

      const result = await client.query<{
        id: string;
        external_reference: string;
        status: string;
        created_at: string;
      }>(
        `
        insert into controlplane.payout_requests(
          account_id,wallet_id,asset_id,amount,destination_type,
          destination_snapshot,status,external_reference,
          proof_metadata,requested_by,created_at,updated_at
        )
        values(
          $1::uuid,$2::uuid,$3::uuid,$4::numeric,$5::varchar,
          $6::jsonb,'DRAFT',
          ('PAYOUT-' || to_char(now(),'YYYYMMDD') || '-' ||
            upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
          jsonb_build_object(
            'channel','TELEGRAM_MANUAL_TICKET',
            'automation','PENDING'
          ),
          $7::uuid,now(),now()
        )
        returning id,external_reference,status,created_at::text
        `,
        [
          accountId,
          walletRow.wallet_id,
          walletRow.asset_id,
          amount,
          destinationType,
          JSON.stringify(destination),
          context.authUserId,
        ],
      );

      await client.query(
        `
        update public.wallet_balances
        set
          available=available-$2::numeric,
          reserved=reserved+$2::numeric,
          updated_at=now()
        where wallet_id=$1::uuid
        `,
        [walletRow.wallet_id, amount],
      );

      return result.rows[0];
    });

    const message = [
      "PiXBrasil payout ticket",
      `Reference: ${ticket.external_reference}`,
      `Amount: R$ ${amount.toFixed(2)}`,
      `Destination: ${destinationType}`,
      "Status: aguardando operação manual",
    ].join("\n");

    return {
      success: true,
      data: {
        ticketId: ticket.id,
        reference: ticket.external_reference,
        status: ticket.status,
        amount,
        currency: "BRL",
        destinationType,
        createdAt: ticket.created_at,
        telegram: {
          mode: "MANUAL_TICKET",
          shareUrl:
            "https://t.me/share/url?url=" +
            encodeURIComponent("https://pixbrasil.org/app") +
            "&text=" +
            encodeURIComponent(message),
          message,
        },
      },
    };
  }

}
