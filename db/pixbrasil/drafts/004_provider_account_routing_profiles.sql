-- PiXBrasil Routing Management V2 — DRAFT ONLY
-- Purpose: add provider-account-level routing controls shared across multiple
-- gateway connections/policies. Do not apply until staging review.

BEGIN;

CREATE TABLE IF NOT EXISTS pixbrasil.provider_account_routing_profiles (
  provider_account_id uuid PRIMARY KEY REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  operational_status varchar(24) NOT NULL DEFAULT 'ACTIVE'
    CHECK (operational_status IN ('ACTIVE','DEGRADED','DISABLED')),
  environment varchar(24) NOT NULL DEFAULT 'PRODUCTION'
    CHECK (environment IN ('SANDBOX','PRODUCTION')),
  min_amount numeric(18,2),
  max_amount numeric(18,2),
  daily_volume_cap numeric(18,2),
  monthly_volume_cap numeric(18,2),
  cost_bps numeric(10,4),
  fixed_cost numeric(18,6),
  allowed_account_types text[] NOT NULL DEFAULT '{}'::text[],
  allowed_tiers text[] NOT NULL DEFAULT '{}'::text[],
  allowed_risk_levels text[] NOT NULL DEFAULT '{}'::text[],
  tags text[] NOT NULL DEFAULT '{}'::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_amount IS NULL OR min_amount >= 0),
  CHECK (max_amount IS NULL OR max_amount >= 0),
  CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount),
  CHECK (daily_volume_cap IS NULL OR daily_volume_cap >= 0),
  CHECK (monthly_volume_cap IS NULL OR monthly_volume_cap >= 0),
  CHECK (cost_bps IS NULL OR cost_bps >= 0),
  CHECK (fixed_cost IS NULL OR fixed_cost >= 0)
);

CREATE TABLE IF NOT EXISTS pixbrasil.provider_account_volume_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id uuid NOT NULL REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  period_type varchar(16) NOT NULL CHECK (period_type IN ('DAILY','MONTHLY')),
  period_start date NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BRL',
  assigned_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (assigned_amount >= 0),
  successful_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (successful_amount >= 0),
  assigned_count bigint NOT NULL DEFAULT 0 CHECK (assigned_count >= 0),
  successful_count bigint NOT NULL DEFAULT 0 CHECK (successful_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_account_id, period_type, period_start, currency)
);

CREATE INDEX IF NOT EXISTS provider_account_volume_lookup_idx
  ON pixbrasil.provider_account_volume_buckets(provider_account_id, period_type, period_start, currency);

ALTER TABLE pixbrasil.provider_account_routing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.provider_account_volume_buckets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON pixbrasil.provider_account_routing_profiles FROM anon, authenticated;
REVOKE ALL ON pixbrasil.provider_account_volume_buckets FROM anon, authenticated;

COMMIT;
