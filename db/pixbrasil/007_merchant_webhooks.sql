-- Merchant outbound webhooks for PiXBrasil API integrations.

create table if not exists pixbrasil.merchant_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references pixbrasil.merchants(id) on delete cascade,
  name varchar(120) not null,
  endpoint_url text not null,
  vault_secret_id uuid not null,
  secret_fingerprint char(64) not null,
  events text[] not null default array[
    'payment.pending','payment.succeeded','payment.failed','payment.canceled'
  ]::text[],
  status varchar(16) not null default 'ACTIVE'
    check (status in ('ACTIVE','PAUSED','REVOKED')),
  failure_count integer not null default 0 check (failure_count >= 0),
  last_delivery_at timestamptz,
  last_error text,
  created_by_api_key_id uuid references pixbrasil.merchant_api_keys(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(merchant_id,endpoint_url)
);

create index if not exists merchant_webhook_endpoints_active_idx
  on pixbrasil.merchant_webhook_endpoints(merchant_id,status)
  where status='ACTIVE';

create table if not exists pixbrasil.merchant_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references pixbrasil.merchant_webhook_endpoints(id) on delete cascade,
  merchant_id uuid not null references pixbrasil.merchants(id) on delete cascade,
  payment_intent_id uuid references pixbrasil.payment_intents(id) on delete set null,
  event_type varchar(80) not null,
  payload jsonb not null,
  status varchar(24) not null default 'PENDING'
    check (status in ('PENDING','DELIVERED','FAILED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  http_status integer,
  response_excerpt text,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists merchant_webhook_deliveries_endpoint_idx
  on pixbrasil.merchant_webhook_deliveries(endpoint_id,created_at desc);

create index if not exists merchant_webhook_deliveries_retry_idx
  on pixbrasil.merchant_webhook_deliveries(status,next_attempt_at)
  where status='FAILED';

alter table pixbrasil.merchant_webhook_endpoints enable row level security;
alter table pixbrasil.merchant_webhook_deliveries enable row level security;

revoke all on pixbrasil.merchant_webhook_endpoints from anon, authenticated;
revoke all on pixbrasil.merchant_webhook_deliveries from anon, authenticated;

comment on table pixbrasil.merchant_webhook_endpoints is
  'Merchant-owned HTTPS webhook endpoints. Signing secrets live only in Supabase Vault.';
comment on table pixbrasil.merchant_webhook_deliveries is
  'Auditable outbound merchant webhook attempts. Failed deliveries are retained for replay tooling.';
