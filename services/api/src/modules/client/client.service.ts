import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ClientContext } from "../client-auth/client-auth.types";
import { DatabaseService } from "../database/database.service";

function maskDestination(value: string) {
  if (value.length <= 6) return "***";
  return value.slice(0, 3) + "***" + value.slice(-3);
}

function normalizePixKeyType(value: unknown) {
  const parsed = String(value ?? "").trim().toUpperCase();
  const allowed = ["CPF", "CNPJ", "EMAIL", "TELEFONE", "CHAVE_ALEATORIA"];
  if (!allowed.includes(parsed)) {
    throw new BadRequestException("pixKeyType is invalid.");
  }
  return parsed;
}

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

        const settlements = await this.database.query(
          `
          select
            s.code as store_code,
            s.name as store_name,
            rel.release_class,
            coalesce(sum(st.net_brl) filter (where st.status='AVAILABLE'),0)::text as available_brl,
            coalesce(sum(st.net_brl) filter (where st.status='PENDING'),0)::text as pending_brl,
            coalesce(sum(st.net_brl) filter (where st.status='RESERVED'),0)::text as reserved_brl,
            min(st.available_at) filter (where st.status='PENDING')::text as next_available_at,
            count(st.id)::int as settlement_count
          from pixbrasil.stores s
          left join pixbrasil.store_financial_profiles sfp on sfp.store_id=s.id
          left join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
          left join pixbrasil.payment_intents pi on pi.store_id=s.id
          left join pixbrasil.settlements st on st.payment_intent_id=pi.id
          where s.merchant_id=$1::uuid
          group by s.id,rel.release_class
          order by s.code
          `,
          [merchant.merchant_id],
        );

        const gateways = await this.database.query(
          `
          select distinct
            p.code as provider_code,
            gc.alias as gateway_alias,
            gc.status,
            gc.metadata->>'lastConnectionHealth' as health,
            nullif(gc.metadata->>'lastConnectionLatencyMs','')::int as latency_ms,
            gc.metadata->>'credentialState' as credential_state,
            rp.activation_mode
          from pixbrasil.stores s
          join pixbrasil.routing_policies rp
            on rp.store_id=s.id and rp.status='ACTIVE'
          join pixbrasil.routing_routes rr
            on rr.policy_id=rp.id and rr.enabled=true
          join pixbrasil.gateway_connections gc on gc.id=rr.gateway_connection_id
          join public.providers p on p.id=gc.provider_id
          where s.merchant_id=$1::uuid
          order by p.code,gc.alias
          `,
          [merchant.merchant_id],
        );

        const cashFlow = await this.database.query(
          `
          with days as (
            select generate_series(
              current_date - interval '29 days',
              current_date,
              interval '1 day'
            )::date day
          ),
          incoming as (
            select st.created_at::date day,sum(st.net_brl) amount
            from pixbrasil.settlements st
            join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
            where pi.merchant_id=$1::uuid
              and st.status in ('AVAILABLE','PENDING','RESERVED')
              and st.created_at>=current_date - interval '29 days'
            group by st.created_at::date
          ),
          outgoing as (
            select pr.created_at::date day,sum(pr.amount) amount
            from controlplane.payout_requests pr
            where pr.account_id=$2::uuid
              and pr.status in ('PROCESSING','PAID','CONFIRMED')
              and pr.created_at>=current_date - interval '29 days'
            group by pr.created_at::date
          )
          select
            d.day::text,
            coalesce(i.amount,0)::text incoming_brl,
            coalesce(o.amount,0)::text outgoing_brl
          from days d
          left join incoming i on i.day=d.day
          left join outgoing o on o.day=d.day
          order by d.day
          `,
          [merchant.merchant_id, accountId],
        );

        const payouts = await this.database.query(
          `
          select id,amount::text,status,destination_type,destination_snapshot,
                 created_at::text,paid_at::text,confirmed_at::text
          from controlplane.payout_requests
          where account_id=$1::uuid
          order by created_at desc
          limit 20
          `,
          [accountId],
        );

        business = {
          merchant,
          stores: stores.rows,
          payments: payments.rows,
          settlements: settlements.rows,
          gateways: gateways.rows,
          cashFlow: cashFlow.rows,
          payouts: payouts.rows,
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
          financialWritesEnabled: true,
          depositsEnabled: true,
          withdrawalsEnabled: true,
          exchangeEnabled: false,
          payoutMode: "MANUAL_TICKET",
          note:
            "PIX production is active. Payouts are processed through the manual operations ticket queue.",
        },
      },
    };
  }

  async listPayouts(context: ClientContext, accountId: string) {
    const access = context.accounts.find((item) => item.accountId === accountId);
    if (!access) throw new ForbiddenException("Account access is not granted.");

    const result = await this.database.query(
      `
      select
        pr.id,
        pr.amount::text,
        ass.code asset_code,
        pr.destination_type,
        pr.destination_snapshot,
        pr.status,
        pr.external_reference,
        pr.created_at::text,
        pr.approved_at::text,
        pr.paid_at::text,
        pr.confirmed_at::text
      from controlplane.payout_requests pr
      join public.assets ass on ass.id=pr.asset_id
      where pr.account_id=$1::uuid
      order by pr.created_at desc
      limit 100
      `,
      [accountId],
    );

    return { success: true, data: result.rows };
  }

  async requestPayout(
    context: ClientContext,
    accountId: string,
    body: Record<string, unknown>,
  ) {
    const access = context.accounts.find((item) => item.accountId === accountId);
    if (!access) throw new ForbiddenException("Account access is not granted.");
    if (!["OWNER", "ADMIN", "FINANCE"].includes(access.role)) {
      throw new ForbiddenException("This role cannot request payouts.");
    }

    const flag = await this.database.query<{ enabled: boolean }>(
      `select enabled from controlplane.feature_flags where key='manual_payouts' limit 1`,
    );
    if (!flag.rows[0]?.enabled) {
      throw new ConflictException("Payout requests are temporarily unavailable.");
    }

    const amount = Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("amount must be a positive BRL value.");
    }

    const pixKey = String(body.pixKey ?? "").trim();
    if (!pixKey || pixKey.length > 180) {
      throw new BadRequestException("pixKey is required.");
    }
    const pixKeyType = normalizePixKeyType(body.pixKeyType);
    const maskedKey = maskDestination(pixKey);

    const result = await this.database.query<{
      id: string;
      amount: string;
      status: string;
      created_at: string;
    }>(
      `
      with asset as (
        select id from public.assets where code='BRL' limit 1
      ),
      wallet as (
        select w.id,w.account_id,w.asset_id
        from public.wallets w
        join asset a on a.id=w.asset_id
        where w.account_id=$1::uuid and w.status='ACTIVE'
        limit 1
      ),
      reserved as (
        update public.wallet_balances wb
        set available=wb.available-$2::numeric,
            reserved=wb.reserved+$2::numeric,
            updated_at=current_timestamp
        from wallet w
        where wb.wallet_id=w.id
          and wb.available >= $2::numeric
        returning wb.wallet_id
      ),
      secret as (
        select vault.create_secret(
          jsonb_build_object(
            'pixKey',$3::text,
            'pixKeyType',$4::text
          )::text,
          'pixbrasil-payout-' || gen_random_uuid()::text,
          'PiXBrasil payout destination'
        )::uuid id
        where exists(select 1 from reserved)
      ),
      inserted as (
        insert into controlplane.payout_requests(
          id,account_id,wallet_id,asset_id,amount,destination_type,
          destination_snapshot,destination_vault_secret_id,status,
          proof_metadata,requested_by,created_at,updated_at
        )
        select
          gen_random_uuid(),$1::uuid,w.id,w.asset_id,$2::numeric,'PIX',
          jsonb_build_object(
            'pixKeyType',$4::text,
            'pixKeyMasked',$5::text
          ),
          s.id,
          'APPROVAL_REQUIRED',
          jsonb_build_object(
            'channel','TELEGRAM_MANUAL',
            'mode','MANUAL_TICKET',
            'requestedFrom','CLIENT_PORTAL'
          ),
          $6::uuid,now(),now()
        from wallet w,secret s
        where exists(select 1 from reserved)
        returning id,amount,status,created_at
      )
      select id,amount::text,status,created_at::text from inserted
      `,
      [
        accountId,
        amount,
        pixKey,
        pixKeyType,
        maskedKey,
        context.authUserId,
      ],
    );

    const payout = result.rows[0];
    if (!payout) {
      throw new ConflictException("Insufficient available BRL balance.");
    }

    const telegram = await this.notifyPayoutTelegram({
      payoutId: payout.id,
      amount,
      accountId,
      email: context.email ?? null,
      pixKeyType,
      maskedKey,
    });

    return {
      success: true,
      data: {
        payoutId: payout.id,
        amount,
        currency: "BRL",
        status: payout.status,
        destination: { type: pixKeyType, masked: maskedKey },
        ticket: {
          channel: "TELEGRAM_MANUAL",
          notificationDelivered: telegram,
        },
        createdAt: payout.created_at,
      },
    };
  }

  private async notifyPayoutTelegram(input: {
    payoutId: string;
    amount: number;
    accountId: string;
    email: string | null;
    pixKeyType: string;
    maskedKey: string;
  }) {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_PAYOUT_CHAT_ID?.trim();
    if (!token || !chatId) return false;

    const amount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(input.amount);

    const text = [
      "💸 PiXBrasil · Novo payout manual",
      "",
      "Ticket: " + input.payoutId,
      "Conta: " + input.accountId,
      "Utilizador: " + (input.email ?? "—"),
      "Valor: " + amount,
      "Destino: " + input.pixKeyType + " · " + input.maskedKey,
      "",
      "Abrir Control Plane:",
      "https://admin.pixbrasil.org/payouts",
    ].join("\n");

    try {
      const response = await fetch(
        "https://api.telegram.org/bot" + token + "/sendMessage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

}
