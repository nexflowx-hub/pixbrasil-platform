import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ClientContext } from "../client-auth/client-auth.types";
import { DatabaseService } from "../database/database.service";
import { FinancialCoreService } from "../financial/financial-core.service";

@Injectable()
export class ClientService {
  constructor(
    private readonly database: DatabaseService,
    private readonly financial: FinancialCoreService,
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

  async createPayoutTicket(
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
    if (
      access.accountStatus !== "ACTIVE" ||
      access.kycStatus !== "APPROVED"
    ) {
      throw new ForbiddenException(
        "Active account with approved KYC is required for payouts.",
      );
    }

    const payoutFlag = await this.database.query<{ enabled: boolean }>(
      `
      select enabled
      from controlplane.feature_flags
      where key='manual_payouts'
      limit 1
      `,
    );
    if (!payoutFlag.rows[0]?.enabled) {
      throw new ForbiddenException(
        "Manual payout tickets are not enabled for production.",
      );
    }

    const amount = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be a positive number.");
    }

    const assetCode = String(input.assetCode ?? "BRL")
      .trim()
      .toUpperCase();
    const rail = String(input.rail ?? "PIX").trim().toUpperCase();
    if (!["PIX", "CRYPTO"].includes(rail)) {
      throw new BadRequestException("rail must be PIX or CRYPTO.");
    }

    const destination =
      input.destination &&
      typeof input.destination === "object" &&
      !Array.isArray(input.destination)
        ? (input.destination as Record<string, unknown>)
        : {};

    if (!Object.keys(destination).length) {
      throw new BadRequestException("destination is required.");
    }

    await this.financial.ensureAccountFoundation(accountId);

    return this.database.transaction(async (client) => {
      const wallet = await client.query<{
        wallet_id: string;
        asset_id: string;
        available: string;
        reserved: string;
      }>(
        `
        select
          w.id as wallet_id,
          a.id as asset_id,
          wb.available::text,
          wb.reserved::text
        from public.wallets w
        join public.assets a on a.id=w.asset_id
        join public.wallet_balances wb on wb.wallet_id=w.id
        where w.account_id=$1::uuid
          and a.code=$2::varchar
          and w.status='ACTIVE'
        limit 1
        for update of wb
        `,
        [accountId, assetCode],
      );

      const row = wallet.rows[0];
      if (!row) {
        throw new BadRequestException(
          "No active wallet exists for this asset.",
        );
      }

      const available = Number(row.available);
      if (!Number.isFinite(available) || available < amount) {
        throw new BadRequestException("Insufficient available balance.");
      }

      const externalReference =
        "PB-OUT-" + randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();

      const ticket = await client.query<{
        id: string;
        status: string;
        created_at: string;
      }>(
        `
        insert into controlplane.payout_requests(
          id,account_id,wallet_id,asset_id,amount,destination_type,
          destination_snapshot,status,external_reference,proof_metadata,
          requested_by,created_at,updated_at
        )
        values(
          gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,$4::numeric,$5::varchar,
          $6::jsonb,'APPROVAL_REQUIRED',$7::varchar,$8::jsonb,
          $9::uuid,now(),now()
        )
        returning id,status,created_at::text
        `,
        [
          accountId,
          row.wallet_id,
          row.asset_id,
          amount,
          rail === "PIX" ? "PIX_MANUAL" : "CRYPTO_MANUAL",
          JSON.stringify({
            rail,
            assetCode,
            ...destination,
          }),
          externalReference,
          JSON.stringify({
            channel: "TELEGRAM_MANUAL",
            automation: "PENDING",
            requestedFrom: "CLIENT_PORTAL",
          }),
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
        [row.wallet_id, amount],
      );

      return {
        success: true,
        data: {
          ticketId: ticket.rows[0].id,
          reference: externalReference,
          status: ticket.rows[0].status,
          amount,
          assetCode,
          rail,
          channel: "TELEGRAM_MANUAL",
          createdAt: ticket.rows[0].created_at,
          message:
            "Payout reserved and queued for manual treasury processing.",
        },
      };
    });
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

    if (account.status === "ACTIVE") {
      await this.financial.ensureAccountFoundation(accountId);
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
    let capabilities = {
      financialWritesEnabled: false,
      pixCollectionEnabled: false,
      payoutTicketsEnabled: false,
      exchangeEnabled: false,
      note: "Account operational state is determined by product and routing configuration.",
    };

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
        const [
          stores,
          payments,
          payouts,
          flow,
          flags,
        ] = await Promise.all([
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
              nullif(gc.metadata->>'lastConnectionLatencyMs','')::int as provider_latency_ms,
              rel.code as release_profile,
              rel.release_class,
              rcp.code as route_cost_profile,
              rp.activation_mode as routing_mode,
              coalesce(sum(st.net_brl) filter (where st.status='AVAILABLE'),0)::text as available_brl,
              coalesce(sum(st.net_brl) filter (where st.status='PENDING'),0)::text as pending_brl,
              coalesce(sum(st.net_brl) filter (where st.status='RESERVED'),0)::text as reserved_brl,
              min(st.available_at) filter (where st.status='PENDING')::text as next_available_at,
              count(distinct pi.id)::int as payment_count,
              count(distinct pi.id) filter (where pi.status='SUCCEEDED')::int as succeeded_count
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
            left join pixbrasil.payment_intents pi on pi.store_id=s.id
            left join pixbrasil.settlements st on st.payment_intent_id=pi.id
            where s.merchant_id=$1::uuid
            group by
              s.id,s.code,s.name,s.status,s.currency,
              gc.alias,p.code,gc.metadata,
              rel.code,rel.release_class,rcp.code,rp.activation_mode
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
              gc.alias as gateway_alias,
              pa.provider_payment_id,
              st.net_brl::text as net_brl,
              st.status as settlement_status,
              st.available_at::text,
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
            left join pixbrasil.settlements st on st.payment_intent_id=pi.id
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
              pr.external_reference,
              pr.amount::text,
              a.code as asset_code,
              pr.destination_type,
              pr.status,
              pr.created_at::text,
              pr.approved_at::text,
              pr.paid_at::text,
              pr.confirmed_at::text
            from controlplane.payout_requests pr
            join public.assets a on a.id=pr.asset_id
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
                coalesce(pi.completed_at::date,pi.created_at::date) as day,
                sum(st.net_brl)::numeric as amount
              from pixbrasil.settlements st
              join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
              where pi.merchant_id=$1::uuid
                and pi.status='SUCCEEDED'
                and coalesce(pi.completed_at,pi.created_at) >= current_date - interval '29 days'
              group by 1
            ),
            outgoing as (
              select
                coalesce(pr.paid_at::date,pr.confirmed_at::date,pr.created_at::date) as day,
                sum(pr.amount)::numeric as amount
              from controlplane.payout_requests pr
              where pr.account_id=$2::uuid
                and pr.status in ('PAID','CONFIRMED')
                and coalesce(pr.paid_at,pr.confirmed_at,pr.created_at) >= current_date - interval '29 days'
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
          this.database.query<{
            key: string;
            enabled: boolean;
          }>(
            `
            select key,enabled
            from controlplane.feature_flags
            where key in (
              'routing_enforcement',
              'live_payment_execution',
              'manual_payouts'
            )
            `,
          ),
        ]);

        const brlWallet = walletResult.rows.find(
          (wallet) => wallet.asset_code === "BRL",
        );
        const routingEnabled = Boolean(
          flags.rows.find((flag) => flag.key === "routing_enforcement")?.enabled,
        );
        const liveEnabled = Boolean(
          flags.rows.find((flag) => flag.key === "live_payment_execution")?.enabled,
        );
        const manualPayoutsEnabled = Boolean(
          flags.rows.find((flag) => flag.key === "manual_payouts")?.enabled,
        );

        const paymentRows = payments.rows as Array<Record<string, unknown>>;
        const total = paymentRows.length;
        const succeeded = paymentRows.filter(
          (row) => row.status === "SUCCEEDED",
        ).length;

        const complianceReady =
          account.status === "ACTIVE" && account.kyc_status === "APPROVED";

        capabilities = {
          financialWritesEnabled: routingEnabled && liveEnabled && complianceReady,
          pixCollectionEnabled: routingEnabled && liveEnabled && complianceReady,
          payoutTicketsEnabled: complianceReady && manualPayoutsEnabled,
          exchangeEnabled: false,
          note:
            "PIX collections operate through configured Stores. Payouts are processed by manual treasury ticket.",
        };

        business = {
          merchant,
          wallet: brlWallet ?? null,
          finance: {
            availableBrl: Number(brlWallet?.available ?? 0),
            pendingBrl: Number(brlWallet?.pending ?? 0),
            reservedBrl: Number(brlWallet?.reserved ?? 0),
            blockedBrl: Number(brlWallet?.blocked ?? 0),
            paymentCount: total,
            succeededCount: succeeded,
            successRate: total > 0 ? Math.round((succeeded / total) * 10000) / 100 : 0,
          },
          stores: stores.rows,
          payments: paymentRows,
          payouts: payouts.rows,
          flow30d: flow.rows,
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
        capabilities,
      },
    };
  }
}
