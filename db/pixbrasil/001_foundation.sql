-- PiXBrasil product schema V1.
-- Atlas Financial Core remains in public.* and is referenced, not duplicated.
-- This schema is private to trusted backend services; no direct browser grants.

create schema if not exists pixbrasil;

revoke all on schema pixbrasil from anon, authenticated;

create table if not exists pixbrasil.merchants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id),
  status text not null default 'PENDING'
    check (status in ('PENDING','ACTIVE','RESTRICTED','SUSPENDED','CLOSED')),
  tier_code varchar(64) not null default 'STANDARD',
  legal_name text,
  trade_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pixbrasil.stores (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references pixbrasil.merchants(id) on delete cascade,
  code varchar(80) not null,
  name text not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT','ACTIVE','SUSPENDED','CLOSED')),
  currency char(3) not null default 'BRL',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, code)
);

create index if not exists stores_merchant_status_idx
  on pixbrasil.stores(merchant_id, status);

create table if not exists pixbrasil.gateway_connections (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id),
  provider_account_id uuid references public.provider_accounts(id),
  merchant_id uuid references pixbrasil.merchants(id) on delete cascade,
  store_id uuid references pixbrasil.stores(id) on delete cascade,
  alias varchar(100) not null unique,
  environment text not null default 'PRODUCTION'
    check (environment in ('SANDBOX','PRODUCTION')),
  status text not null default 'DISABLED'
    check (status in ('ACTIVE','DEGRADED','DISABLED')),
  vault_secret_id uuid,
  capabilities jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (store_id is null or merchant_id is not null)
);

create index if not exists gateway_connections_provider_status_idx
  on pixbrasil.gateway_connections(provider_id, status);

create index if not exists gateway_connections_scope_idx
  on pixbrasil.gateway_connections(store_id, merchant_id, status);

create table if not exists pixbrasil.routing_policies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  merchant_id uuid references pixbrasil.merchants(id) on delete cascade,
  store_id uuid references pixbrasil.stores(id) on delete cascade,
  name text not null,
  payment_method varchar(32) not null default 'PIX',
  currency char(3) not null default 'BRL',
  strategy text not null
    check (strategy in ('PRIORITY_FAILOVER','WEIGHTED','VOLUME_SPLIT','HEALTH_AWARE','COST_AWARE','RULES')),
  activation_mode text not null default 'SHADOW'
    check (activation_mode in ('SHADOW','ENFORCED')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PAUSED','ARCHIVED')),
  account_tiers text[] not null default '{}'::text[],
  priority integer not null default 100,
  version integer not null default 1 check (version > 0),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (store_id is null or merchant_id is not null)
);

create index if not exists routing_policies_scope_idx
  on pixbrasil.routing_policies(
    store_id,
    merchant_id,
    account_id,
    payment_method,
    currency,
    status,
    priority
  );

create table if not exists pixbrasil.routing_routes (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references pixbrasil.routing_policies(id) on delete cascade,
  gateway_connection_id uuid not null references pixbrasil.gateway_connections(id),
  priority integer not null default 100,
  weight numeric(8,4) not null default 1 check (weight > 0),
  min_amount numeric(18,2),
  max_amount numeric(18,2),
  allowed_account_tiers text[] not null default '{}'::text[],
  daily_volume_cap numeric(18,2),
  monthly_volume_cap numeric(18,2),
  health_required boolean not null default true,
  max_error_rate numeric(8,4),
  max_p95_latency_ms integer,
  cost_bps numeric(10,4),
  conditions jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(policy_id, gateway_connection_id),
  check (min_amount is null or min_amount >= 0),
  check (max_amount is null or max_amount >= 0),
  check (min_amount is null or max_amount is null or min_amount <= max_amount),
  check (daily_volume_cap is null or daily_volume_cap >= 0),
  check (monthly_volume_cap is null or monthly_volume_cap >= 0),
  check (max_error_rate is null or (max_error_rate >= 0 and max_error_rate <= 1)),
  check (max_p95_latency_ms is null or max_p95_latency_ms > 0),
  check (cost_bps is null or cost_bps >= 0)
);

create index if not exists routing_routes_policy_enabled_idx
  on pixbrasil.routing_routes(policy_id, enabled, priority);

create table if not exists pixbrasil.routing_volume_buckets (
  id uuid primary key default gen_random_uuid(),
  gateway_connection_id uuid not null references pixbrasil.gateway_connections(id) on delete cascade,
  period_type text not null check (period_type in ('DAILY','MONTHLY')),
  period_start date not null,
  currency char(3) not null default 'BRL',
  assigned_amount numeric(18,2) not null default 0 check (assigned_amount >= 0),
  successful_amount numeric(18,2) not null default 0 check (successful_amount >= 0),
  assigned_count bigint not null default 0 check (assigned_count >= 0),
  successful_count bigint not null default 0 check (successful_count >= 0),
  updated_at timestamptz not null default now(),
  unique(gateway_connection_id, period_type, period_start, currency)
);

create index if not exists routing_volume_period_idx
  on pixbrasil.routing_volume_buckets(period_type, period_start, currency);

create table if not exists pixbrasil.payment_intents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id),
  merchant_id uuid references pixbrasil.merchants(id),
  store_id uuid references pixbrasil.stores(id),
  external_reference varchar(160),
  idempotency_key varchar(200) not null,
  payment_method varchar(32) not null default 'PIX',
  amount numeric(18,2) not null check (amount > 0),
  currency char(3) not null default 'BRL',
  status text not null default 'CREATED'
    check (status in (
      'CREATED','ROUTING','PROVIDER_PENDING','PENDING_PAYMENT',
      'SUCCEEDED','FAILED','CANCELED','RECONCILIATION_REQUIRED'
    )),
  selected_connection_id uuid references pixbrasil.gateway_connections(id),
  customer_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(account_id, idempotency_key)
);

create index if not exists payment_intents_status_created_idx
  on pixbrasil.payment_intents(status, created_at desc);

create index if not exists payment_intents_merchant_created_idx
  on pixbrasil.payment_intents(merchant_id, created_at desc);

create index if not exists payment_intents_store_created_idx
  on pixbrasil.payment_intents(store_id, created_at desc);

create index if not exists payment_intents_external_reference_idx
  on pixbrasil.payment_intents(external_reference)
  where external_reference is not null;

create table if not exists pixbrasil.routing_decisions (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references pixbrasil.payment_intents(id) on delete cascade,
  policy_id uuid references pixbrasil.routing_policies(id),
  policy_version integer,
  strategy text not null,
  selected_connection_id uuid references pixbrasil.gateway_connections(id),
  sticky_key varchar(200) not null,
  eligible_candidates jsonb not null default '[]'::jsonb,
  rejected_candidates jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '{}'::jsonb,
  outcome text not null default 'SELECTED'
    check (outcome in ('SELECTED','NO_ROUTE','SHADOW_ONLY')),
  created_at timestamptz not null default now()
);

create index if not exists routing_decisions_payment_idx
  on pixbrasil.routing_decisions(payment_intent_id, created_at desc);

create index if not exists routing_decisions_connection_idx
  on pixbrasil.routing_decisions(selected_connection_id, created_at desc);

create table if not exists pixbrasil.provider_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references pixbrasil.payment_intents(id) on delete cascade,
  routing_decision_id uuid references pixbrasil.routing_decisions(id),
  gateway_connection_id uuid not null references pixbrasil.gateway_connections(id),
  attempt_no integer not null check (attempt_no > 0),
  status text not null
    check (status in ('STARTED','CREATED','REJECTED','UNAVAILABLE','AMBIGUOUS','RECOVERED','FAILED')),
  provider_payment_id text,
  provider_reference text,
  error_category text,
  retriable boolean not null default false,
  ambiguous boolean not null default false,
  request_fingerprint text,
  response_metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(payment_intent_id, attempt_no)
);

create index if not exists provider_attempts_connection_status_idx
  on pixbrasil.provider_attempts(gateway_connection_id, status, started_at desc);

create index if not exists provider_attempts_provider_payment_idx
  on pixbrasil.provider_attempts(provider_payment_id)
  where provider_payment_id is not null;

create table if not exists pixbrasil.provider_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  gateway_connection_id uuid not null references pixbrasil.gateway_connections(id) on delete cascade,
  status text not null check (status in ('HEALTHY','DEGRADED','DOWN','UNKNOWN')),
  sample_window_seconds integer not null default 300 check (sample_window_seconds > 0),
  attempts integer not null default 0 check (attempts >= 0),
  successes integer not null default 0 check (successes >= 0),
  failures integer not null default 0 check (failures >= 0),
  success_rate numeric(8,4)
    check (success_rate is null or (success_rate >= 0 and success_rate <= 1)),
  p95_latency_ms integer check (p95_latency_ms is null or p95_latency_ms >= 0),
  detail jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists provider_health_connection_time_idx
  on pixbrasil.provider_health_snapshots(gateway_connection_id, captured_at desc);

create table if not exists pixbrasil.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway_connection_id uuid references pixbrasil.gateway_connections(id),
  provider_event_key text not null,
  event_type text,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','PROCESSING','PROCESSED','FAILED','IGNORED')),
  payload_hash text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(gateway_connection_id, provider_event_key)
);

create index if not exists provider_webhook_status_received_idx
  on pixbrasil.provider_webhook_events(status, received_at);

create table if not exists pixbrasil.settlements (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null unique references pixbrasil.payment_intents(id),
  gross_brl numeric(18,2) not null check (gross_brl >= 0),
  provider_fee_brl numeric(18,2) not null default 0 check (provider_fee_brl >= 0),
  platform_fee_brl numeric(18,2) not null default 0 check (platform_fee_brl >= 0),
  net_brl numeric(18,2) not null check (net_brl >= 0),
  settlement_asset varchar(32),
  settlement_network varchar(32),
  settlement_amount numeric(36,18)
    check (settlement_amount is null or settlement_amount >= 0),
  status text not null default 'PENDING'
    check (status in (
      'PENDING','CONVERSION_PENDING','ONCHAIN_PENDING','ONCHAIN_CONFIRMED',
      'RESERVED','AVAILABLE','FAILED','REVERSED'
    )),
  available_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists settlements_status_available_idx
  on pixbrasil.settlements(status, available_at);

alter table pixbrasil.merchants enable row level security;
alter table pixbrasil.stores enable row level security;
alter table pixbrasil.gateway_connections enable row level security;
alter table pixbrasil.routing_policies enable row level security;
alter table pixbrasil.routing_routes enable row level security;
alter table pixbrasil.routing_volume_buckets enable row level security;
alter table pixbrasil.payment_intents enable row level security;
alter table pixbrasil.routing_decisions enable row level security;
alter table pixbrasil.provider_attempts enable row level security;
alter table pixbrasil.provider_health_snapshots enable row level security;
alter table pixbrasil.provider_webhook_events enable row level security;
alter table pixbrasil.settlements enable row level security;

revoke all on all tables in schema pixbrasil from anon, authenticated;

comment on schema pixbrasil is
  'Private PiXBrasil product domain. Not intended for direct browser Data API access.';

comment on column pixbrasil.gateway_connections.vault_secret_id is
  'Reference to encrypted provider credentials in Supabase Vault. Never return decrypted secret through application APIs.';
