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
        const stores = await this.database.query(
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
            rp.activation_mode as routing_mode
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
            select gc0.*,p0.code as provider_code
            from pixbrasil.routing_routes rr0
            join pixbrasil.gateway_connections gc0 on gc0.id=rr0.gateway_connection_id
            join public.providers p0 on p0.id=gc0.provider_id
            where rr0.policy_id=rp.id and rr0.enabled=true
            order by rr0.priority asc
            limit 1
          ) route on true
          left join pixbrasil.gateway_connections gc on gc.id=route.id
          left join public.providers p on p.id=gc.provider_id
          where s.merchant_id=$1::uuid
          order by s.code
          `,
          [merchant.merchant_id],
        );

        const payments = await this.database.query(
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
            pi.updated_at::text
          from pixbrasil.payment_intents pi
          left join pixbrasil.stores s on s.id=pi.store_id
          where pi.merchant_id=$1::uuid
          order by pi.created_at desc
          limit 25
          `,
          [merchant.merchant_id],
        );

        business = {
          merchant,
          stores: stores.rows,
          payments: payments.rows,
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
          financialWritesEnabled: false,
          depositsEnabled: false,
          withdrawalsEnabled: false,
          exchangeEnabled: false,
          note:
            "MVP client portal is read-only while payment execution, settlement and payout guardrails are validated.",
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

    const wallet = await this.database.query<{
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
      left join public.wallet_balances wb on wb.wallet_id=w.id
      where w.account_id=$1::uuid
        and ass.code='BRL'
        and w.status='ACTIVE'
      limit 1
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

    const result = await this.database.query<{
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

    const ticket = result.rows[0];
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
