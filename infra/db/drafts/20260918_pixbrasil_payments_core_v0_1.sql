-- PiXBrasil Payments Core V0.1
-- STATUS: DRAFT ONLY. DO NOT APPLY TO PRODUCTION WITHOUT REVIEW.
-- Target: existing shared AtlasWallet PostgreSQL/Supabase project.
-- Existing public schema is treated as the Financial Core for now.

BEGIN;

CREATE SCHEMA IF NOT EXISTS pixbrasil;

-- Liquid is a required canonical network for PiXBrasil treasury.
-- PostgreSQL ALTER TYPE cannot be rolled back trivially; keep this in controlled migration review.
ALTER TYPE "AssetNetwork" ADD VALUE IF NOT EXISTS 'LIQUID';

CREATE TABLE IF NOT EXISTS public.account_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  product_code varchar(32) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, product_code)
);

CREATE INDEX IF NOT EXISTS account_products_product_status_idx
  ON public.account_products(product_code, status);

CREATE TABLE IF NOT EXISTS pixbrasil.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE RESTRICT,
  code varchar(64) NOT NULL UNIQUE,
  legal_name varchar(180),
  trade_name varchar(180),
  status varchar(24) NOT NULL DEFAULT 'DRAFT',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pixbrasil.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES pixbrasil.merchants(id) ON DELETE RESTRICT,
  code varchar(64) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'DRAFT',
  default_currency varchar(3) NOT NULL DEFAULT 'BRL',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stores_merchant_status_idx
  ON pixbrasil.stores(merchant_id, status);

CREATE TABLE IF NOT EXISTS pixbrasil.customer_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  label varchar(120) NOT NULL,
  account_type "AccountType",
  priority integer NOT NULL DEFAULT 100,
  min_monthly_volume_minor bigint,
  max_monthly_volume_minor bigint,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pixbrasil.account_tier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  tier_id uuid NOT NULL REFERENCES pixbrasil.customer_tiers(id) ON DELETE RESTRICT,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_tier_active_idx
  ON pixbrasil.account_tier_assignments(account_id, effective_from, effective_to);

CREATE TABLE IF NOT EXISTS pixbrasil.provider_credential_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id uuid NOT NULL REFERENCES public.provider_accounts(id) ON DELETE RESTRICT,
  environment varchar(16) NOT NULL,
  backend varchar(32) NOT NULL,
  secret_ref varchar(255) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  rotated_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_account_id, environment, secret_ref)
);

COMMENT ON COLUMN pixbrasil.provider_credential_refs.secret_ref IS
  'Opaque secret identifier only. Never store provider API keys/secrets in this column.';

CREATE TABLE IF NOT EXISTS pixbrasil.provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  provider_account_id uuid NOT NULL REFERENCES public.provider_accounts(id) ON DELETE RESTRICT,
  credential_ref_id uuid REFERENCES pixbrasil.provider_credential_refs(id) ON DELETE RESTRICT,
  account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT,
  merchant_id uuid REFERENCES pixbrasil.merchants(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES pixbrasil.stores(id) ON DELETE RESTRICT,
  alias varchar(96) NOT NULL,
  environment varchar(16) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  default_currency varchar(3) NOT NULL DEFAULT 'BRL',
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  quarantine_reason varchar(255),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alias, environment)
);

CREATE INDEX IF NOT EXISTS provider_connections_scope_idx
  ON pixbrasil.provider_connections(account_id, merchant_id, store_id, status);
CREATE INDEX IF NOT EXISTS provider_connections_provider_idx
  ON pixbrasil.provider_connections(provider_id, provider_account_id, status);

CREATE TABLE IF NOT EXISTS pixbrasil.routing_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL,
  scope_type varchar(24) NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE RESTRICT,
  merchant_id uuid REFERENCES pixbrasil.merchants(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES pixbrasil.stores(id) ON DELETE RESTRICT,
  method varchar(32) NOT NULL DEFAULT 'pix',
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  environment varchar(16) NOT NULL,
  strategy varchar(32) NOT NULL DEFAULT 'priority_failover',
  activation_mode varchar(16) NOT NULL DEFAULT 'shadow',
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routing_policies_resolution_idx
  ON pixbrasil.routing_policies(method, currency, environment, status, priority);
CREATE INDEX IF NOT EXISTS routing_policies_scope_idx
  ON pixbrasil.routing_policies(store_id, merchant_id, account_id);

CREATE TABLE IF NOT EXISTS pixbrasil.routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES pixbrasil.routing_policies(id) ON DELETE CASCADE,
  name varchar(160) NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '{"all":[]}'::jsonb,
  action varchar(32) NOT NULL DEFAULT 'ROUTE',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS routing_rules_policy_priority_idx
  ON pixbrasil.routing_rules(policy_id, enabled, priority);

CREATE TABLE IF NOT EXISTS pixbrasil.routing_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES pixbrasil.routing_rules(id) ON DELETE CASCADE,
  provider_connection_id uuid NOT NULL REFERENCES pixbrasil.provider_connections(id) ON DELETE RESTRICT,
  priority integer NOT NULL DEFAULT 100,
  weight integer NOT NULL DEFAULT 100,
  min_amount_minor bigint,
  max_amount_minor bigint,
  daily_volume_cap_minor bigint,
  monthly_volume_cap_minor bigint,
  fixed_cost_minor bigint,
  variable_cost_bps integer,
  min_success_rate numeric(6,3),
  max_p95_latency_ms integer,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, provider_connection_id)
);

CREATE INDEX IF NOT EXISTS routing_targets_rule_idx
  ON pixbrasil.routing_targets(rule_id, enabled, priority);

CREATE TABLE IF NOT EXISTS pixbrasil.provider_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_connection_id uuid NOT NULL REFERENCES pixbrasil.provider_connections(id) ON DELETE CASCADE,
  state varchar(16) NOT NULL,
  success_rate_5m numeric(6,3),
  success_rate_1h numeric(6,3),
  p95_latency_ms integer,
  timeout_rate_5m numeric(6,3),
  provider_error_rate_5m numeric(6,3),
  last_success_at timestamptz,
  last_webhook_at timestamptz,
  source varchar(32),
  metadata jsonb,
  observed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_health_latest_idx
  ON pixbrasil.provider_health_snapshots(provider_connection_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS pixbrasil.provider_volume_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_connection_id uuid NOT NULL REFERENCES pixbrasil.provider_connections(id) ON DELETE CASCADE,
  window_type varchar(16) NOT NULL,
  window_start timestamptz NOT NULL,
  amount_minor bigint NOT NULL DEFAULT 0,
  transaction_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_connection_id, window_type, window_start)
);

CREATE TABLE IF NOT EXISTS pixbrasil.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  merchant_id uuid REFERENCES pixbrasil.merchants(id) ON DELETE RESTRICT,
  store_id uuid REFERENCES pixbrasil.stores(id) ON DELETE RESTRICT,
  tier_id uuid REFERENCES pixbrasil.customer_tiers(id) ON DELETE RESTRICT,
  reference varchar(128) NOT NULL,
  idempotency_key varchar(160) NOT NULL,
  method varchar(32) NOT NULL DEFAULT 'pix',
  currency varchar(3) NOT NULL DEFAULT 'BRL',
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  status varchar(32) NOT NULL DEFAULT 'CREATED',
  selected_provider_connection_id uuid REFERENCES pixbrasil.provider_connections(id) ON DELETE RESTRICT,
  provider_reference varchar(255),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(account_id, idempotency_key),
  UNIQUE(account_id, reference)
);

CREATE INDEX IF NOT EXISTS payment_intents_store_created_idx
  ON pixbrasil.payment_intents(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_status_created_idx
  ON pixbrasil.payment_intents(status, created_at DESC);

CREATE TABLE IF NOT EXISTS pixbrasil.routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES pixbrasil.payment_intents(id) ON DELETE RESTRICT,
  policy_id uuid REFERENCES pixbrasil.routing_policies(id) ON DELETE RESTRICT,
  rule_id uuid REFERENCES pixbrasil.routing_rules(id) ON DELETE RESTRICT,
  selected_provider_connection_id uuid REFERENCES pixbrasil.provider_connections(id) ON DELETE RESTRICT,
  strategy varchar(32),
  activation_mode varchar(16) NOT NULL DEFAULT 'shadow',
  status varchar(24) NOT NULL DEFAULT 'DECIDED',
  reason varchar(255),
  input_context jsonb NOT NULL,
  candidates_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payment_intent_id)
);

CREATE INDEX IF NOT EXISTS routing_decisions_selected_idx
  ON pixbrasil.routing_decisions(selected_provider_connection_id, created_at DESC);

-- Initial provider library records only. Credentials are deliberately absent.
INSERT INTO public.providers(code, name, type, environment, status, priority)
VALUES
  ('PIXGO', 'PixGo', 'FIAT', 'SANDBOX', 'DISABLED', 100),
  ('MISTICPAY', 'MisticPay', 'FIAT', 'SANDBOX', 'DISABLED', 110)
ON CONFLICT (code) DO NOTHING;

-- Provider capability seed is deferred until BRL asset id and provider ids
-- are validated in the target database.

-- RLS baseline: backend-only until explicit policies are defined.
ALTER TABLE pixbrasil.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.customer_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.account_tier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.provider_credential_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.routing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.routing_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.provider_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.provider_volume_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.routing_decisions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA pixbrasil FROM anon, authenticated;
GRANT USAGE ON SCHEMA pixbrasil TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pixbrasil TO service_role;

COMMIT;
