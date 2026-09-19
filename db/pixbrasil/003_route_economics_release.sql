-- Route economics and release-policy separation.
-- Internal provider costs remain distinct from merchant-facing platform pricing.

create table if not exists pixbrasil.route_cost_profiles (
  id uuid primary key default gen_random_uuid(),
  code varchar(100) not null unique,
  name text not null,
  gateway_connection_id uuid not null references pixbrasil.gateway_connections(id) on delete restrict,
  release_class varchar(32) not null check (release_class in ('D0','D1','CUSTOM')),
  currency char(3) not null default 'BRL',
  status varchar(20) not null default 'DRAFT'
    check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pixbrasil.route_cost_rules (
  id uuid primary key default gen_random_uuid(),
  route_cost_profile_id uuid not null references pixbrasil.route_cost_profiles(id) on delete cascade,
  direction varchar(16) not null check (direction in ('INBOUND','OUTBOUND')),
  rail varchar(24) not null check (rail in ('PIX','CRYPTO')),
  asset_code varchar(32),
  network_code varchar(32),
  fee_bps numeric(12,4) not null default 0 check (fee_bps >= 0),
  fixed_fee_brl numeric(18,2) not null default 0 check (fixed_fee_brl >= 0),
  min_amount_brl numeric(18,2),
  max_amount_brl numeric(18,2),
  enabled boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_amount_brl is null or min_amount_brl >= 0),
  check (max_amount_brl is null or max_amount_brl >= 0),
  check (min_amount_brl is null or max_amount_brl is null or min_amount_brl <= max_amount_brl),
  check (effective_to is null or effective_to > effective_from)
);

create index if not exists route_cost_rules_lookup_idx
  on pixbrasil.route_cost_rules(route_cost_profile_id, direction, rail, enabled, effective_from);

create table if not exists pixbrasil.release_profiles (
  id uuid primary key default gen_random_uuid(),
  code varchar(100) not null unique,
  name text not null,
  release_class varchar(32) not null check (release_class in ('D0','D1','CUSTOM')),
  status varchar(20) not null default 'DRAFT'
    check (status in ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pixbrasil.release_rules (
  id uuid primary key default gen_random_uuid(),
  release_profile_id uuid not null references pixbrasil.release_profiles(id) on delete cascade,
  rail varchar(24) not null check (rail in ('PIX','CRYPTO')),
  asset_code varchar(32),
  network_code varchar(32),
  availability_mode varchar(32) not null
    check (availability_mode in ('IMMEDIATE','PROVIDER_RELEASE','FIXED_DELAY')),
  available_after_minutes integer,
  max_release_minutes integer,
  payout_mode varchar(32) not null
    check (payout_mode in ('AUTOMATIC','CONTROLLED','MANUAL_TICKET')),
  ticket_required boolean not null default false,
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_after_minutes is null or available_after_minutes >= 0),
  check (max_release_minutes is null or max_release_minutes > 0)
);

create index if not exists release_rules_lookup_idx
  on pixbrasil.release_rules(release_profile_id, rail, enabled);

create table if not exists pixbrasil.store_financial_profiles (
  store_id uuid primary key references pixbrasil.stores(id) on delete cascade,
  route_cost_profile_id uuid not null references pixbrasil.route_cost_profiles(id) on delete restrict,
  release_profile_id uuid not null references pixbrasil.release_profiles(id) on delete restrict,
  fee_profile_id uuid references pixbrasil.fee_profiles(id) on delete restrict,
  allow_cross_release_class_failover boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_financial_profiles_route_idx
  on pixbrasil.store_financial_profiles(route_cost_profile_id);
create index if not exists store_financial_profiles_release_idx
  on pixbrasil.store_financial_profiles(release_profile_id);

alter table pixbrasil.route_cost_profiles enable row level security;
alter table pixbrasil.route_cost_rules enable row level security;
alter table pixbrasil.release_profiles enable row level security;
alter table pixbrasil.release_rules enable row level security;
alter table pixbrasil.store_financial_profiles enable row level security;

revoke all on pixbrasil.route_cost_profiles from anon, authenticated;
revoke all on pixbrasil.route_cost_rules from anon, authenticated;
revoke all on pixbrasil.release_profiles from anon, authenticated;
revoke all on pixbrasil.release_rules from anon, authenticated;
revoke all on pixbrasil.store_financial_profiles from anon, authenticated;

comment on table pixbrasil.route_cost_profiles is
  'Internal provider/route economics. Never use as merchant-facing commercial pricing.';
comment on table pixbrasil.release_profiles is
  'Funds availability and payout fulfillment policy, independent from provider routing.';
comment on table pixbrasil.store_financial_profiles is
  'Explicitly binds each store to route economics, release policy and optional commercial fee profile.';
