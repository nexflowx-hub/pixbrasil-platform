import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class AdminService {
  constructor(private readonly database: DatabaseService) {}

  async listProviders() {
    const result = await this.database.query(
      `
      select
        p.id,
        p.code,
        p.name,
        p.type::text as type,
        p.environment::text as environment,
        p.status::text as status,
        p.priority,
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'code', pc.code,
                'enabled', pc.enabled,
                'metadata', pc.metadata
              )
              order by pc.code
            )
            from public.provider_capabilities pc
            where pc.provider_id = p.id
          ),
          '[]'::jsonb
        ) as capabilities,
        (
          select count(*)::int
          from public.provider_accounts pa
          where pa.provider_id = p.id
        ) as provider_account_count,
        (
          select count(*)::int
          from pixbrasil.gateway_connections gc
          where gc.provider_id = p.id
        ) as gateway_connection_count
      from public.providers p
      order by p.priority asc, p.code asc
      `,
    );

    return { success: true, data: result.rows };
  }

  async routingOverview() {
    const [policies, flags] = await Promise.all([
      this.database.query(
        `
        select
          rp.id,
          rp.name,
          rp.payment_method,
          rp.currency,
          rp.strategy,
          rp.activation_mode,
          rp.status,
          rp.account_tiers,
          rp.priority,
          rp.version,
          (
            select count(*)::int
            from pixbrasil.routing_routes rr
            where rr.policy_id = rp.id
          ) as route_count,
          rp.created_at,
          rp.updated_at
        from pixbrasil.routing_policies rp
        order by rp.priority asc, rp.updated_at desc
        limit 200
        `,
      ),
      this.database.query(
        `
        select key, enabled, config, description, updated_at
        from controlplane.feature_flags
        where key in (
          'routing_enforcement',
          'provider_auto_webhook_registration',
          'manual_payouts',
          'manual_ledger_adjustments'
        )
        order by key
        `,
      ),
    ]);

    return {
      success: true,
      data: {
        policies: policies.rows,
        featureFlags: flags.rows,
      },
    };
  }

  async approvalQueue() {
    const result = await this.database.query(
      `
      select
        ar.id,
        ar.action_code,
        ar.resource_type,
        ar.resource_id,
        ar.status,
        ar.required_approvals,
        ar.min_aal,
        ar.maker_checker_required,
        ar.reason,
        ar.expires_at,
        ar.approved_at,
        ar.executed_at,
        ar.created_at,
        (
          select count(*)::int
          from controlplane.approval_actions aa
          where aa.approval_request_id = ar.id
            and aa.action = 'APPROVE'
        ) as approval_count
      from controlplane.approval_requests ar
      where ar.status in ('PENDING', 'APPROVED')
      order by ar.created_at asc
      limit 200
      `,
    );

    return { success: true, data: result.rows };
  }
}
