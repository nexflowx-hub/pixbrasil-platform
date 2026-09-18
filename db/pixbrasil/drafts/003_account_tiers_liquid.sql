-- PiXBrasil additive Core gaps — DRAFT ONLY
-- DO NOT APPLY TO PRODUCTION WITHOUT staging/backup/review.
-- This draft extends the existing db/pixbrasil/001_foundation.sql model.
-- It deliberately does NOT recreate merchants, stores, gateway_connections,
-- routing_policies, routing_routes, decisions, attempts, health or settlements.

BEGIN;

-- Financial Core currently lacks Liquid as a canonical network.
ALTER TYPE "AssetNetwork" ADD VALUE IF NOT EXISTS 'LIQUID';

-- Product membership allows one Financial Core account to be enabled for
-- AtlasWallet, PiXBrasil or future products without duplicating identity.
CREATE TABLE IF NOT EXISTS public.account_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  product_code varchar(32) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, product_code)
);

CREATE INDEX IF NOT EXISTS account_products_product_status_idx
  ON public.account_products(product_code, status);

-- Formal tier library supports PF and PJ routing policy without relying only
-- on free-form merchant.tier_code strings.
CREATE TABLE IF NOT EXISTS pixbrasil.account_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  label varchar(120) NOT NULL,
  account_type "AccountType",
  priority integer NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  routing_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  commercial_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pixbrasil.account_tier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  tier_id uuid NOT NULL REFERENCES pixbrasil.account_tiers(id) ON DELETE RESTRICT,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX IF NOT EXISTS account_tier_assignment_lookup_idx
  ON pixbrasil.account_tier_assignments(account_id, effective_from DESC, effective_to);

ALTER TABLE public.account_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.account_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.account_tier_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_products FROM anon, authenticated;
REVOKE ALL ON pixbrasil.account_tiers FROM anon, authenticated;
REVOKE ALL ON pixbrasil.account_tier_assignments FROM anon, authenticated;

COMMIT;
