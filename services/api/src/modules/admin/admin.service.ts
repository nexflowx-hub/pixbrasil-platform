import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AdminContext } from "../auth/admin-auth.types";
import { DatabaseService } from "../database/database.service";
import { ProviderAdapterRegistry } from "../providers/provider-adapter.registry";

interface GatewayConnectionRow {
  connection_id: string;
  alias: string;
  provider_id: string;
  provider_code: string;
  provider_account_id: string;
  decrypted_secret?: string | null;
}

function requiredString(
  value: unknown,
  label: string,
  prefix?: string,
): string {
  const result = String(value ?? "").trim();
  if (!result) {
    throw new BadRequestException(`${label} is required.`);
  }
  if (prefix && !result.startsWith(prefix)) {
    throw new BadRequestException(
      `${label} must start with ${prefix}.`,
    );
  }
  return result;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly providers: ProviderAdapterRegistry,
  ) {}

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

  async providerControlPlane() {
    const result = await this.database.query(
      `
      select
        p.id as provider_id,
        p.code as provider_code,
        p.name as provider_name,
        p.status::text as provider_status,
        pa.id as provider_account_id,
        pa.label as provider_account_label,
        pa.status as provider_account_status,
        gc.id as gateway_connection_id,
        gc.alias as gateway_alias,
        gc.environment,
        gc.status as connection_status,
        gc.capabilities,
        gc.limits,
        gc.metadata as connection_metadata,
        exists(
          select 1
          from controlplane.provider_credential_versions pcv
          where pcv.gateway_connection_id = gc.id
            and pcv.status = 'ACTIVE'
        ) as has_credentials,
        (
          select pcv.fingerprint
          from controlplane.provider_credential_versions pcv
          where pcv.gateway_connection_id = gc.id
            and pcv.status = 'ACTIVE'
          order by pcv.created_at desc
          limit 1
        ) as credential_fingerprint,
        (
          select pcv.created_at
          from controlplane.provider_credential_versions pcv
          where pcv.gateway_connection_id = gc.id
            and pcv.status = 'ACTIVE'
          order by pcv.created_at desc
          limit 1
        ) as credential_created_at,
        rr.id as routing_route_id,
        rr.enabled as route_enabled,
        rr.priority as route_priority,
        rp.id as routing_policy_id,
        rp.name as routing_policy_name,
        rp.activation_mode,
        rp.status as routing_policy_status
      from public.providers p
      left join public.provider_accounts pa
        on pa.provider_id = p.id
       and coalesce(pa.metadata->>'product','') = 'PIXBRASIL'
      left join pixbrasil.gateway_connections gc
        on gc.provider_account_id = pa.id
      left join pixbrasil.routing_routes rr
        on rr.gateway_connection_id = gc.id
      left join pixbrasil.routing_policies rp
        on rp.id = rr.policy_id
      where p.code in ('PIXGO','MISTICPAY')
      order by p.code, pa.created_at, gc.alias
      `,
    );

    const flag = await this.database.query(
      `
      select enabled
      from controlplane.feature_flags
      where key='routing_enforcement'
      `,
    );

    return {
      success: true,
      data: {
        connections: result.rows,
        routingEnforcement: Boolean(flag.rows[0]?.enabled),
      },
    };
  }

  async saveProviderCredentials(
    connectionId: string,
    body: Record<string, unknown>,
    admin: AdminContext,
  ) {
    const connection = await this.loadConnection(connectionId);
    const credentials = this.normalizeCredentials(
      connection.provider_code,
      body,
    );
    const serialized = JSON.stringify(credentials);
    const fingerprint = createHash("sha256")
      .update(`${connection.provider_code}:${serialized}`)
      .digest("hex");
    const secretName =
      `pixbrasil_${connection.alias}_` +
      `${Date.now()}_${randomUUID().slice(0, 8)}`;

    const result = await this.database.query(
      `
      with created_secret as (
        select vault.create_secret(
          $1::text,
          $2::text,
          $3::text
        ) as vault_secret_id
      ),
      superseded as (
        update controlplane.provider_credential_versions
        set status='SUPERSEDED',
            revoked_at=now()
        where gateway_connection_id=$4::uuid
          and status='ACTIVE'
        returning id
      ),
      updated_connection as (
        update pixbrasil.gateway_connections
        set vault_secret_id=(select vault_secret_id from created_secret),
            metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
              'credentialState','STORED',
              'lifecycleState','CREDENTIALS_STORED',
              'routingEligible',false,
              'credentialsUpdatedAt',now()
            ),
            status='DISABLED',
            updated_at=now()
        where id=$4::uuid
        returning id
      ),
      updated_account as (
        update public.provider_accounts
        set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
              'credentialState','STORED',
              'lifecycleState','CREDENTIALS_STORED'
            ),
            updated_at=now()
        where id=$5::uuid
        returning id
      )
      insert into controlplane.provider_credential_versions(
        provider_account_id,
        gateway_connection_id,
        vault_secret_id,
        fingerprint,
        status,
        created_by,
        rotated_from_id,
        metadata
      )
      select
        $5::uuid,
        $4::uuid,
        cs.vault_secret_id,
        $6::varchar,
        'ACTIVE',
        $7::uuid,
        (select id from superseded limit 1),
        jsonb_build_object(
          'providerCode',$8::text,
          'gatewayAlias',$9::text,
          'storage','SUPABASE_VAULT',
          'secretReturnedToClient',false
        )
      from created_secret cs
      returning id, fingerprint, created_at
      `,
      [
        serialized,
        secretName,
        `PiXBrasil provider credentials for ${connection.alias}`,
        connection.connection_id,
        connection.provider_account_id,
        fingerprint,
        admin.authUserId,
        connection.provider_code,
        connection.alias,
      ],
    );

    return {
      success: true,
      data: {
        gatewayConnectionId: connection.connection_id,
        alias: connection.alias,
        providerCode: connection.provider_code,
        credentialVersionId: result.rows[0]?.id,
        fingerprint,
        state: "STORED",
      },
    };
  }

  async testGatewayConnection(connectionId: string) {
    const connection = await this.loadConnection(connectionId, true);
    if (!connection.decrypted_secret) {
      throw new BadRequestException(
        "Provider credentials have not been stored in Vault.",
      );
    }

    let credentials: unknown;
    try {
      credentials = JSON.parse(connection.decrypted_secret);
    } catch {
      throw new BadRequestException(
        "Stored provider credentials are not valid JSON.",
      );
    }

    const adapter = this.providers.get(connection.provider_code);
    const health = await adapter.healthCheck(credentials);
    const validated = health.status === "HEALTHY";

    await this.database.query(
      `
      with updated_connection as (
        update pixbrasil.gateway_connections
        set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
              'credentialState',$2::text,
              'lifecycleState',$3::text,
              'routingEligible',false,
              'lastConnectionTestAt',now(),
              'lastConnectionHealth',$4::text,
              'lastConnectionLatencyMs',$5::int,
              'lastConnectionDetail',$6::text
            ),
            status='DISABLED',
            updated_at=now()
        where id=$1::uuid
        returning id
      ),
      updated_account as (
        update public.provider_accounts
        set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
              'credentialState',$2::text,
              'lifecycleState',$3::text,
              'lastConnectionTestAt',now()
            ),
            updated_at=now()
        where id=$7::uuid
        returning id
      )
      select
        (select count(*) from updated_connection)::int as connections_updated,
        (select count(*) from updated_account)::int as accounts_updated
      `,
      [
        connection.connection_id,
        validated ? "VALIDATED" : "INVALID",
        validated ? "READY_FOR_SHADOW" : "CREDENTIAL_TEST_FAILED",
        health.status,
        health.latencyMs,
        health.detail ?? null,
        connection.provider_account_id,
      ],
    );

    return {
      success: true,
      data: {
        gatewayConnectionId: connection.connection_id,
        alias: connection.alias,
        providerCode: connection.provider_code,
        health,
        credentialState: validated ? "VALIDATED" : "INVALID",
        readyForShadow: validated,
      },
    };
  }

  async promoteGatewayToShadow(connectionId: string) {
    const connection = await this.database.query<{
      connection_id: string;
      provider_id: string;
      provider_account_id: string;
      alias: string;
      provider_code: string;
      credential_state: string | null;
      vault_secret_id: string | null;
    }>(
      `
      select
        gc.id as connection_id,
        gc.provider_id,
        gc.provider_account_id,
        gc.alias,
        p.code as provider_code,
        gc.metadata->>'credentialState' as credential_state,
        gc.vault_secret_id
      from pixbrasil.gateway_connections gc
      join public.providers p on p.id=gc.provider_id
      where gc.id=$1::uuid
      `,
      [connectionId],
    );

    const row = connection.rows[0];
    if (!row) throw new NotFoundException("Gateway connection not found.");
    if (!row.vault_secret_id || row.credential_state !== "VALIDATED") {
      throw new ConflictException(
        "Gateway must have validated Vault credentials before SHADOW promotion.",
      );
    }

    const enforcement = await this.database.query<{ enabled: boolean }>(
      `
      select enabled
      from controlplane.feature_flags
      where key='routing_enforcement'
      `,
    );
    if (enforcement.rows[0]?.enabled) {
      throw new ConflictException(
        "Global routing enforcement must remain disabled during SHADOW promotion.",
      );
    }

    await this.database.query(
      `
      with updated_connection as (
        update pixbrasil.gateway_connections
        set status='ACTIVE',
            metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
              'activationMode','SHADOW',
              'lifecycleState','SHADOW',
              'routingEligible',true,
              'shadowActivatedAt',now()
            ),
            updated_at=now()
        where id=$1::uuid
        returning id
      ),
      updated_account as (
        update public.provider_accounts
        set metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
              'lifecycleState','SHADOW'
            ),
            updated_at=now()
        where id=$2::uuid
        returning id
      ),
      updated_provider as (
        update public.providers
        set status='ACTIVE',
            updated_at=now()
        where id=$3::uuid
        returning id
      ),
      updated_routes as (
        update pixbrasil.routing_routes rr
        set enabled=true,
            updated_at=now()
        from pixbrasil.routing_policies rp
        where rr.policy_id=rp.id
          and rr.gateway_connection_id=$1::uuid
          and rp.activation_mode='SHADOW'
          and rp.status='ACTIVE'
        returning rr.id
      )
      select
        (select count(*) from updated_connection)::int as connections_updated,
        (select count(*) from updated_account)::int as accounts_updated,
        (select count(*) from updated_provider)::int as providers_updated,
        (select count(*) from updated_routes)::int as routes_updated
      `,
      [
        row.connection_id,
        row.provider_account_id,
        row.provider_id,
      ],
    );

    return {
      success: true,
      data: {
        gatewayConnectionId: row.connection_id,
        alias: row.alias,
        providerCode: row.provider_code,
        connectionStatus: "ACTIVE",
        activationMode: "SHADOW",
        routingEnforcement: false,
      },
    };
  }

  async listMerchants() {
    const result = await this.database.query(
      `
      select
        m.id,
        m.account_id,
        m.status,
        m.tier_code,
        m.legal_name,
        m.trade_name,
        m.metadata,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', s.id,
              'code', s.code,
              'name', s.name,
              'status', s.status,
              'currency', s.currency,
              'routeCostProfile', rcp.code,
              'releaseProfile', rel.code,
              'releaseClass', rel.release_class,
              'platformFeeProfile', fp.code,
              'crossReleaseClassFailover', sfp.allow_cross_release_class_failover,
              'routingPolicy', rp.name,
              'routingMode', rp.activation_mode,
              'gatewayAlias', gc.alias
            )
            order by s.code
          ) filter (where s.id is not null),
          '[]'::jsonb
        ) as stores
      from pixbrasil.merchants m
      left join pixbrasil.stores s on s.merchant_id=m.id
      left join pixbrasil.store_financial_profiles sfp on sfp.store_id=s.id
      left join pixbrasil.route_cost_profiles rcp on rcp.id=sfp.route_cost_profile_id
      left join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
      left join pixbrasil.fee_profiles fp on fp.id=sfp.fee_profile_id
      left join lateral (
        select rp0.*
        from pixbrasil.routing_policies rp0
        where rp0.store_id=s.id
          and rp0.status='ACTIVE'
        order by rp0.priority asc, rp0.version desc
        limit 1
      ) rp on true
      left join lateral (
        select gc0.*
        from pixbrasil.routing_routes rr0
        join pixbrasil.gateway_connections gc0 on gc0.id=rr0.gateway_connection_id
        where rr0.policy_id=rp.id
          and rr0.enabled=true
        order by rr0.priority asc
        limit 1
      ) gc on true
      group by m.id
      order by m.created_at desc
      `,
    );

    return { success: true, data: result.rows };
  }

  async listMerchantApiKeys(merchantId: string) {
    const result = await this.database.query(
      `
      select
        k.id,
        k.name,
        k.key_prefix,
        k.scopes,
        k.status,
        k.expires_at,
        k.last_used_at,
        k.created_at,
        coalesce(
          array_agg(s.code order by s.code)
            filter (where s.id is not null),
          '{}'::varchar[]
        )::text[] as store_codes
      from pixbrasil.merchant_api_keys k
      left join pixbrasil.merchant_api_key_store_grants g on g.api_key_id=k.id
      left join pixbrasil.stores s on s.id=g.store_id
      where k.merchant_id=$1::uuid
      group by k.id
      order by k.created_at desc
      `,
      [merchantId],
    );

    return { success: true, data: result.rows };
  }

  async createMerchantApiKey(
    merchantId: string,
    body: Record<string, unknown>,
    admin: AdminContext,
  ) {
    const merchantResult = await this.database.query<{
      id: string;
      trade_name: string | null;
    }>(
      `
      select id,trade_name
      from pixbrasil.merchants
      where id=$1::uuid and status='ACTIVE'
      `,
      [merchantId],
    );
    const merchant = merchantResult.rows[0];
    if (!merchant) {
      throw new NotFoundException("Active merchant not found.");
    }

    const storesResult = await this.database.query<{
      id: string;
      code: string;
    }>(
      `
      select id,code
      from pixbrasil.stores
      where merchant_id=$1::uuid and status='ACTIVE'
      order by code
      `,
      [merchantId],
    );

    const requestedCodes = Array.isArray(body.storeCodes)
      ? body.storeCodes.map((value) => String(value).trim().toUpperCase()).filter(Boolean)
      : [];

    const grantedStores = requestedCodes.length
      ? storesResult.rows.filter((store) => requestedCodes.includes(store.code.toUpperCase()))
      : storesResult.rows;

    if (!grantedStores.length) {
      throw new BadRequestException("At least one active store grant is required.");
    }
    if (
      requestedCodes.length &&
      new Set(grantedStores.map((store) => store.code.toUpperCase())).size !==
        new Set(requestedCodes).size
    ) {
      throw new BadRequestException(
        "One or more requested stores do not belong to this merchant.",
      );
    }

    const name =
      String(body.name ?? "").trim().slice(0, 120) ||
      `${merchant.trade_name ?? "Merchant"} S2S`;
    const plaintext = `pix_live_${randomBytes(32).toString("base64url")}`;
    const keyHash = createHash("sha256").update(plaintext).digest("hex");
    const keyPrefix = plaintext.slice(0, 20);

    const inserted = await this.database.query<{ id: string }>(
      `
      insert into pixbrasil.merchant_api_keys(
        merchant_id,name,key_prefix,key_hash,scopes,status,created_by,metadata
      )
      values(
        $1::uuid,$2::varchar,$3::varchar,$4::char(64),
        ARRAY['payments:create','webhooks:manage']::text[],'ACTIVE',$5::uuid,
        jsonb_build_object(
          'secretReturnedOnce',true,
          'createdFrom','PIXBRASIL_ADMIN',
          'mode','LIVE_PILOT_CAPABLE'
        )
      )
      returning id
      `,
      [merchantId, name, keyPrefix, keyHash, admin.authUserId],
    );

    const apiKeyId = inserted.rows[0]?.id;
    if (!apiKeyId) {
      throw new ConflictException("Unable to create merchant API key.");
    }

    for (const store of grantedStores) {
      await this.database.query(
        `
        insert into pixbrasil.merchant_api_key_store_grants(api_key_id,store_id)
        values($1::uuid,$2::uuid)
        on conflict do nothing
        `,
        [apiKeyId, store.id],
      );
    }

    await this.database.query(
      `
      insert into public.audit_logs(
        id,actor_type,actor_user_id,action,resource_type,resource_id,
        before,after,metadata,created_at
      )
      values(
        gen_random_uuid(),'ADMIN',$1::uuid,'MERCHANT_API_KEY_CREATED',
        'merchant_api_key',$2::text,null,
        jsonb_build_object(
          'merchantId',$3::text,
          'keyPrefix',$4::text,
          'storeCodes',$5::jsonb,
          'secretPersisted',false
        ),
        '{}'::jsonb,now()
      )
      `,
      [
        admin.authUserId,
        apiKeyId,
        merchantId,
        keyPrefix,
        JSON.stringify(grantedStores.map((store) => store.code)),
      ],
    );

    return {
      success: true,
      data: {
        apiKeyId,
        name,
        keyPrefix,
        secret: plaintext,
        scopes: ["payments:create", "webhooks:manage"],
        storeCodes: grantedStores.map((store) => store.code),
        warning: "This secret is shown once and is not recoverable.",
      },
    };
  }

  async revokeMerchantApiKey(
    merchantId: string,
    apiKeyId: string,
    admin: AdminContext,
  ) {
    const existing = await this.database.query<{
      id: string;
      name: string;
      key_prefix: string;
      status: string;
    }>(
      `
      select id,name,key_prefix,status
      from pixbrasil.merchant_api_keys
      where id=$1::uuid
        and merchant_id=$2::uuid
      limit 1
      `,
      [apiKeyId, merchantId],
    );

    const key = existing.rows[0];
    if (!key) {
      throw new NotFoundException("Merchant API key not found.");
    }

    if (key.status !== "REVOKED") {
      await this.database.query(
        `
        update pixbrasil.merchant_api_keys
        set status='REVOKED',
            revoked_at=coalesce(revoked_at,now())
        where id=$1::uuid
          and merchant_id=$2::uuid
        `,
        [apiKeyId, merchantId],
      );

      await this.database.query(
        `
        insert into public.audit_logs(
          id,actor_type,actor_user_id,action,resource_type,resource_id,
          before,after,metadata,created_at
        )
        values(
          gen_random_uuid(),'ADMIN',$1::uuid,'MERCHANT_API_KEY_REVOKED',
          'merchant_api_key',$2::text,
          jsonb_build_object(
            'merchantId',$3::text,
            'status',$4::text,
            'keyPrefix',$5::text
          ),
          jsonb_build_object(
            'merchantId',$3::text,
            'status','REVOKED',
            'keyPrefix',$5::text
          ),
          '{}'::jsonb,
          now()
        )
        `,
        [
          admin.authUserId,
          apiKeyId,
          merchantId,
          key.status,
          key.key_prefix,
        ],
      );
    }

    return {
      success: true,
      data: {
        apiKeyId,
        name: key.name,
        keyPrefix: key.key_prefix,
        status: "REVOKED",
      },
    };
  }

  async onboardingOverview() {
    const result = await this.database.query(
      `
      select
        a.id,
        a.type::text as account_type,
        a.status::text as account_status,
        a.kyc_status::text as kyc_status,
        a.identity_level::text as identity_level,
        a.country_code,
        a.base_currency,
        u.email,
        u.status::text as user_status,
        coalesce(
          array_agg(distinct ap.product_code order by ap.product_code)
            filter (where ap.product_code is not null),
          '{}'::varchar[]
        )::text[] as products,
        (
          select count(*)::int
          from public.account_memberships am
          where am.account_id=a.id and am.status='ACTIVE'
        ) as active_members,
        a.created_at
      from public.accounts a
      join public.users u on u.id=a.user_id
      left join public.account_products ap on ap.account_id=a.id
      group by a.id,u.id
      order by a.created_at desc
      limit 250
      `,
    );
    return { success: true, data: result.rows };
  }

  async storesOverview() {
    const result = await this.database.query(
      `
      select
        s.id,
        s.code,
        s.name,
        s.status,
        s.currency,
        m.trade_name as merchant,
        m.tier_code,
        rp.name as routing_policy,
        rp.strategy,
        rp.activation_mode,
        gc.alias as gateway_alias,
        p.code as provider_code,
        gc.metadata->>'lastConnectionHealth' as provider_health,
        rcp.code as route_cost_profile,
        rel.code as release_profile,
        rel.release_class,
        sfp.allow_cross_release_class_failover,
        s.updated_at
      from pixbrasil.stores s
      join pixbrasil.merchants m on m.id=s.merchant_id
      left join pixbrasil.store_financial_profiles sfp on sfp.store_id=s.id
      left join pixbrasil.route_cost_profiles rcp on rcp.id=sfp.route_cost_profile_id
      left join pixbrasil.release_profiles rel on rel.id=sfp.release_profile_id
      left join lateral (
        select rp0.*
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
      order by m.trade_name,s.code
      limit 500
      `,
    );
    return { success: true, data: result.rows };
  }

  async transactionsOverview() {
    const result = await this.database.query(
      `
      select
        pi.id,
        pi.external_reference,
        pi.payment_method,
        pi.amount::text,
        pi.currency,
        pi.status,
        m.trade_name as merchant,
        s.code as store_code,
        p.code as provider_code,
        gc.alias as gateway_alias,
        pa.provider_payment_id,
        pa.status as provider_attempt_status,
        pa.ambiguous,
        pi.created_at,
        pi.completed_at
      from pixbrasil.payment_intents pi
      left join pixbrasil.merchants m on m.id=pi.merchant_id
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
      order by pi.created_at desc
      limit 300
      `,
    );
    return { success: true, data: result.rows };
  }

  async ledgerOverview() {
    const [transactions, balances] = await Promise.all([
      this.database.query(
        `
        select
          lt.id,
          lt.reference,
          lt.type::text as type,
          lt.status::text as status,
          lt.external_reference,
          (
            select count(*)::int
            from public.ledger_entries le
            where le.ledger_transaction_id=lt.id
          ) as entry_count,
          lt.created_at,
          lt.posted_at,
          lt.reversed_at
        from public.ledger_transactions lt
        order by lt.created_at desc
        limit 200
        `,
      ),
      this.database.query(
        `
        select
          a.id as account_id,
          a.type::text as account_type,
          ass.code as asset_code,
          ass.symbol,
          ass.network::text as network,
          wb.available::text,
          wb.pending::text,
          wb.reserved::text,
          wb.blocked::text,
          w.status::text as wallet_status,
          wb.updated_at
        from public.wallet_balances wb
        join public.wallets w on w.id=wb.wallet_id
        join public.accounts a on a.id=w.account_id
        join public.assets ass on ass.id=w.asset_id
        order by a.type::text,ass.code
        limit 500
        `,
      ),
    ]);

    return {
      success: true,
      data: {
        transactions: transactions.rows,
        balances: balances.rows,
      },
    };
  }

  async settlementsOverview() {
    const result = await this.database.query(
      `
      select
        st.id,
        st.payment_intent_id,
        pi.external_reference,
        m.trade_name as merchant,
        s.code as store_code,
        st.gross_brl::text,
        st.provider_fee_brl::text,
        st.platform_fee_brl::text,
        st.net_brl::text,
        st.settlement_asset,
        st.settlement_network,
        st.settlement_amount::text,
        st.status,
        st.available_at,
        st.created_at
      from pixbrasil.settlements st
      join pixbrasil.payment_intents pi on pi.id=st.payment_intent_id
      left join pixbrasil.merchants m on m.id=pi.merchant_id
      left join pixbrasil.stores s on s.id=pi.store_id
      order by st.created_at desc
      limit 300
      `,
    );
    return { success: true, data: result.rows };
  }

  async payoutsOverview() {
    const result = await this.database.query(
      `
      select
        pr.id,
        pr.account_id,
        a.type::text as account_type,
        ass.code as asset_code,
        ass.symbol,
        pr.amount::text,
        pr.destination_type,
        pr.destination_snapshot,
        pr.status,
        pr.external_reference,
        pr.proof_metadata,
        pr.approval_request_id,
        pr.approved_at,
        pr.paid_at,
        pr.confirmed_at,
        pr.created_at
      from controlplane.payout_requests pr
      join public.accounts a on a.id=pr.account_id
      join public.assets ass on ass.id=pr.asset_id
      order by pr.created_at desc
      limit 300
      `,
    );
    return { success: true, data: result.rows };
  }

  async updatePayoutStatus(
    payoutId: string,
    body: Record<string, unknown>,
    admin: AdminContext,
  ) {
    const target = String(body.status ?? "").trim().toUpperCase();
    const allowedTargets = [
      "APPROVED",
      "PROCESSING",
      "PAID",
      "CONFIRMED",
      "REJECTED",
      "CANCELED",
      "FAILED",
    ];
    if (!allowedTargets.includes(target)) {
      throw new BadRequestException("Unsupported payout status.");
    }

    const externalReference = String(
      body.externalReference ?? "",
    ).trim().slice(0, 160);
    const proof =
      body.proof && typeof body.proof === "object" && !Array.isArray(body.proof)
        ? (body.proof as Record<string, unknown>)
        : {};

    return this.database.transaction(async (client) => {
      const result = await client.query<{
        id: string;
        account_id: string;
        wallet_id: string | null;
        asset_id: string;
        asset_code: string;
        amount: string;
        status: string;
        external_reference: string | null;
      }>(
        `
        select
          pr.id,
          pr.account_id,
          pr.wallet_id,
          pr.asset_id,
          a.code as asset_code,
          pr.amount::text,
          pr.status,
          pr.external_reference
        from controlplane.payout_requests pr
        join public.assets a on a.id=pr.asset_id
        where pr.id=$1::uuid
        for update of pr
        `,
        [payoutId],
      );

      const row = result.rows[0];
      if (!row) throw new NotFoundException("Payout ticket not found.");
      if (!row.wallet_id) {
        throw new ConflictException("Payout ticket has no reserved wallet.");
      }

      const transitions: Record<string, string[]> = {
        APPROVAL_REQUIRED: ["APPROVED", "REJECTED", "CANCELED"],
        APPROVED: ["PROCESSING", "PAID", "REJECTED", "CANCELED"],
        PROCESSING: ["PAID", "FAILED"],
        PAID: ["CONFIRMED"],
        CONFIRMED: [],
        REJECTED: [],
        CANCELED: [],
        FAILED: [],
      };

      if (!(transitions[row.status] ?? []).includes(target)) {
        throw new ConflictException(
          `Invalid payout transition ${row.status} -> ${target}.`,
        );
      }

      const amount = Number(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ConflictException("Payout amount is invalid.");
      }

      if (["REJECTED", "CANCELED", "FAILED"].includes(target)) {
        const released = await client.query(
          `
          update public.wallet_balances
          set
            reserved=reserved-$2::numeric,
            available=available+$2::numeric,
            updated_at=now()
          where wallet_id=$1::uuid
            and reserved >= $2::numeric
          returning id
          `,
          [row.wallet_id, amount],
        );
        if (released.rowCount !== 1) {
          throw new ConflictException(
            "Reserved balance is insufficient to release this payout.",
          );
        }
      }

      if (target === "PAID") {
        const consumed = await client.query(
          `
          update public.wallet_balances
          set reserved=reserved-$2::numeric,updated_at=now()
          where wallet_id=$1::uuid
            and reserved >= $2::numeric
          returning id
          `,
          [row.wallet_id, amount],
        );
        if (consumed.rowCount !== 1) {
          throw new ConflictException(
            "Reserved balance is insufficient to settle this payout.",
          );
        }

        const customerCode =
          `CUSTOMER:${row.account_id}:${row.asset_code}`;
        const clearingCode = `CLEARING:PAYOUT:${row.asset_code}`;

        const customer = await client.query<{ id: string }>(
          `
          insert into public.ledger_accounts(
            id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
          )
          values(
            gen_random_uuid(),$1::varchar,'CUSTOMER',$2::uuid,$3::uuid,
            $4::varchar,true,now(),now()
          )
          on conflict (code)
          do update set active=true,updated_at=excluded.updated_at
          returning id
          `,
          [
            customerCode,
            row.account_id,
            row.asset_id,
            `Customer ${row.asset_code}`,
          ],
        );

        const clearing = await client.query<{ id: string }>(
          `
          insert into public.ledger_accounts(
            id,code,type,owner_account_id,asset_id,name,active,created_at,updated_at
          )
          values(
            gen_random_uuid(),$1::varchar,'CLEARING',null,$2::uuid,
            $3::varchar,true,now(),now()
          )
          on conflict (code)
          do update set active=true,updated_at=excluded.updated_at
          returning id
          `,
          [
            clearingCode,
            row.asset_id,
            `Payout Clearing ${row.asset_code}`,
          ],
        );

        const ledgerKey = `payout:${row.id}`;
        const ledger = await client.query<{ id: string }>(
          `
          insert into public.ledger_transactions(
            id,reference,type,status,idempotency_key,external_reference,
            metadata,created_at,posted_at
          )
          values(
            gen_random_uuid(),$1::varchar,'FIAT_WITHDRAWAL','POSTED',
            $2::varchar,$3::varchar,$4::jsonb,now(),now()
          )
          on conflict (idempotency_key)
          do update set external_reference=excluded.external_reference
          returning id
          `,
          [
            `PAYOUT:${row.id}`,
            ledgerKey,
            externalReference || row.external_reference,
            JSON.stringify({
              payoutRequestId: row.id,
              channel: "TELEGRAM_MANUAL",
              proof,
            }),
          ],
        );

        const entryCount = await client.query<{ count: string }>(
          `
          select count(*)::text as count
          from public.ledger_entries
          where ledger_transaction_id=$1::uuid
          `,
          [ledger.rows[0].id],
        );

        if (Number(entryCount.rows[0]?.count ?? 0) === 0) {
          await client.query(
            `
            insert into public.ledger_entries(
              id,ledger_transaction_id,ledger_account_id,asset_id,
              direction,amount,created_at
            )
            values
              (gen_random_uuid(),$1::uuid,$2::uuid,$4::uuid,'DEBIT',$5::numeric,now()),
              (gen_random_uuid(),$1::uuid,$3::uuid,$4::uuid,'CREDIT',$5::numeric,now())
            `,
            [
              ledger.rows[0].id,
              customer.rows[0].id,
              clearing.rows[0].id,
              row.asset_id,
              amount,
            ],
          );
        }

        await client.query(
          `
          insert into public.transactions(
            id,account_id,wallet_id,ledger_transaction_id,
            type,status,asset_id,amount,provider_reference,
            idempotency_key,metadata,created_at,updated_at,completed_at
          )
          values(
            gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,
            'FIAT_WITHDRAWAL','COMPLETED',$4::uuid,$5::numeric,$6::varchar,
            $7::varchar,$8::jsonb,now(),now(),now()
          )
          on conflict (idempotency_key) do nothing
          `,
          [
            row.account_id,
            row.wallet_id,
            ledger.rows[0].id,
            row.asset_id,
            amount,
            externalReference || row.external_reference,
            ledgerKey,
            JSON.stringify({
              payoutRequestId: row.id,
              channel: "TELEGRAM_MANUAL",
            }),
          ],
        );
      }

      const updated = await client.query<{
        id: string;
        status: string;
        external_reference: string | null;
        approved_at: string | null;
        paid_at: string | null;
        confirmed_at: string | null;
      }>(
        `
        update controlplane.payout_requests
        set
          status=$2::varchar,
          external_reference=coalesce(nullif($3::varchar,''),external_reference),
          proof_metadata=coalesce(proof_metadata,'{}'::jsonb) || $4::jsonb,
          approved_at=case
            when $2::text='APPROVED' then coalesce(approved_at,now())
            else approved_at
          end,
          paid_at=case
            when $2::text='PAID' then coalesce(paid_at,now())
            else paid_at
          end,
          confirmed_at=case
            when $2::text='CONFIRMED' then coalesce(confirmed_at,now())
            else confirmed_at
          end,
          updated_at=now()
        where id=$1::uuid
        returning
          id,status,external_reference,
          approved_at::text,paid_at::text,confirmed_at::text
        `,
        [
          payoutId,
          target,
          externalReference,
          JSON.stringify({
            ...proof,
            lastAdminAction: target,
            lastAdminActor: admin.authUserId,
            lastAdminActionAt: new Date().toISOString(),
          }),
        ],
      );

      await client.query(
        `
        insert into public.audit_logs(
          id,actor_type,actor_user_id,action,resource_type,resource_id,
          before,after,metadata,created_at
        )
        values(
          gen_random_uuid(),'ADMIN',$1::uuid,'PAYOUT_STATUS_CHANGED',
          'payout_request',$2::text,
          jsonb_build_object('status',$3::text),
          jsonb_build_object('status',$4::text),
          jsonb_build_object('channel','TELEGRAM_MANUAL'),
          now()
        )
        `,
        [admin.authUserId, payoutId, row.status, target],
      );

      return {
        success: true,
        data: updated.rows[0],
      };
    });
  }

  async usersOverview() {
    const result = await this.database.query(
      `
      select
        au.id,
        u.email,
        au.display_name,
        au.status,
        au.require_mfa,
        au.last_seen_at,
        coalesce(
          array_agg(distinct r.code order by r.code)
            filter (where r.code is not null),
          '{}'::varchar[]
        )::text[] as roles,
        au.created_at
      from controlplane.admin_users au
      join auth.users u on u.id=au.auth_user_id
      left join controlplane.admin_user_roles aur
        on aur.admin_user_id=au.id
       and (aur.expires_at is null or aur.expires_at > now())
      left join controlplane.roles r on r.id=aur.role_id
      group by au.id,u.email
      order by au.created_at
      `,
    );
    return { success: true, data: result.rows };
  }

  async auditOverview() {
    const result = await this.database.query(
      `
      select
        al.id,
        al.actor_type::text,
        au.display_name as actor_name,
        auth_user.email as actor_email,
        al.action,
        al.resource_type,
        al.resource_id,
        al.request_id,
        al.created_at
      from public.audit_logs al
      left join auth.users auth_user on auth_user.id=al.actor_user_id
      left join controlplane.admin_users au on au.auth_user_id=al.actor_user_id
      order by al.created_at desc
      limit 500
      `,
    );
    return { success: true, data: result.rows };
  }

  async systemOverview() {
    const [flags, settings, migrations] = await Promise.all([
      this.database.query(
        `
        select key,enabled,config,description,updated_at
        from controlplane.feature_flags
        order by key
        `,
      ),
      this.database.query(
        `
        select key,value,description,updated_at
        from controlplane.system_settings
        order by key
        `,
      ),
      this.database.query(
        `
        select version,name
        from supabase_migrations.schema_migrations
        order by version desc
        limit 20
        `,
      ).catch(() => ({ rows: [] })),
    ]);

    return {
      success: true,
      data: {
        featureFlags: flags.rows,
        settings: settings.rows,
        migrations: migrations.rows,
      },
    };
  }

  async riskOverview() {
    const [accounts, webhooks, intents] = await Promise.all([
      this.database.query(
        `
        select
          a.status::text as account_status,
          a.kyc_status::text as kyc_status,
          count(*)::int as total
        from public.accounts a
        group by a.status,a.kyc_status
        order by a.status,a.kyc_status
        `,
      ),
      this.database.query(
        `
        select status,count(*)::int as total
        from pixbrasil.provider_webhook_events
        group by status
        order by status
        `,
      ),
      this.database.query(
        `
        select status,count(*)::int as total
        from pixbrasil.payment_intents
        group by status
        order by status
        `,
      ),
    ]);

    return {
      success: true,
      data: {
        accountPosture: accounts.rows,
        webhookPosture: webhooks.rows,
        paymentPosture: intents.rows,
        controls: {
          liveExecution: false,
          automaticPayouts: false,
          manualLedgerAdjustments: false,
          note: "No dedicated risk scoring engine is active in the MVP.",
        },
      },
    };
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

  private normalizeCredentials(
    providerCode: string,
    body: Record<string, unknown>,
  ): Record<string, string> {
    if (providerCode === "PIXGO") {
      const apiKey = requiredString(body.apiKey, "PixGo API key", "pk_");
      const webhookSecret = String(body.webhookSecret ?? "").trim();
      if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
        throw new BadRequestException(
          "PixGo webhook secret must start with whsec_.",
        );
      }

      return {
        apiKey,
        ...(webhookSecret ? { webhookSecret } : {}),
      };
    }

    if (providerCode === "MISTICPAY") {
      return {
        clientId: requiredString(
          body.clientId,
          "MisticPay access key ID",
          "pk_",
        ),
        clientSecret: requiredString(
          body.clientSecret,
          "MisticPay access key secret",
          "sk_",
        ),
      };
    }

    throw new BadRequestException(
      `Credential schema is not defined for provider ${providerCode}.`,
    );
  }

  private async loadConnection(
    connectionId: string,
    includeSecret = false,
  ): Promise<GatewayConnectionRow> {
    const result = await this.database.query<GatewayConnectionRow>(
      includeSecret
        ? `
          select
            gc.id as connection_id,
            gc.alias,
            gc.provider_id,
            p.code as provider_code,
            gc.provider_account_id,
            v.decrypted_secret
          from pixbrasil.gateway_connections gc
          join public.providers p on p.id=gc.provider_id
          left join vault.decrypted_secrets v on v.id=gc.vault_secret_id
          where gc.id=$1::uuid
          `
        : `
          select
            gc.id as connection_id,
            gc.alias,
            gc.provider_id,
            p.code as provider_code,
            gc.provider_account_id
          from pixbrasil.gateway_connections gc
          join public.providers p on p.id=gc.provider_id
          where gc.id=$1::uuid
          `,
      [connectionId],
    );

    const connection = result.rows[0];
    if (!connection) {
      throw new NotFoundException("Gateway connection not found.");
    }
    if (!connection.provider_account_id) {
      throw new ConflictException(
        "Gateway connection is not bound to a provider account.",
      );
    }

    return connection;
  }
}
