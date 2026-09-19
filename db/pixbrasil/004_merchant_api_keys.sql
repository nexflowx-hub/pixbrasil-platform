-- Server-to-server merchant API key foundation.
-- Plaintext API keys are never persisted.

create table if not exists pixbrasil.merchant_api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references pixbrasil.merchants(id) on delete cascade,
  name varchar(120) not null,
  key_prefix varchar(40) not null,
  key_hash char(64) not null unique,
  scopes text[] not null default '{}'::text[],
  status varchar(16) not null default 'ACTIVE'
    check (status in ('ACTIVE','REVOKED','EXPIRED')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists merchant_api_keys_lookup_idx
  on pixbrasil.merchant_api_keys(key_prefix, status);
create index if not exists merchant_api_keys_merchant_idx
  on pixbrasil.merchant_api_keys(merchant_id, status, created_at desc);

create table if not exists pixbrasil.merchant_api_key_store_grants (
  api_key_id uuid not null references pixbrasil.merchant_api_keys(id) on delete cascade,
  store_id uuid not null references pixbrasil.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(api_key_id, store_id)
);

alter table pixbrasil.merchant_api_keys enable row level security;
alter table pixbrasil.merchant_api_key_store_grants enable row level security;

revoke all on pixbrasil.merchant_api_keys from anon, authenticated;
revoke all on pixbrasil.merchant_api_key_store_grants from anon, authenticated;

insert into controlplane.feature_flags(key,enabled,config,description)
values(
  'pilot_live_execution',
  false,
  '{"merchantCodes":["NOVIDADES_STORE"]}'::jsonb,
  'Allows explicitly scoped PiXBrasil live-pilot payment execution while global routing_enforcement remains disabled.'
)
on conflict (key) do nothing;

comment on table pixbrasil.merchant_api_keys is
  'Server-to-server merchant API keys. Only SHA-256 hashes are persisted; plaintext is returned once at creation.';
