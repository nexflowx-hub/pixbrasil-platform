-- Applied to Supabase migration history as controlplane_admin_core_v1.
-- Private backend-only Control Plane + PiXBrasil commercial/tier foundation.

CREATE SCHEMA IF NOT EXISTS controlplane;
REVOKE ALL ON SCHEMA controlplane FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.account_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  product_code varchar(32) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(account_id, product_code)
);
CREATE INDEX IF NOT EXISTS account_products_product_status_idx
  ON public.account_products(product_code, status);

CREATE TABLE IF NOT EXISTS pixbrasil.account_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  label varchar(120) NOT NULL,
  account_type public."AccountType",
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
CREATE INDEX IF NOT EXISTS account_tier_assignment_tier_idx
  ON pixbrasil.account_tier_assignments(tier_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS pixbrasil.fee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  scope_type varchar(24) NOT NULL DEFAULT 'GLOBAL'
    CHECK (scope_type IN ('GLOBAL','ACCOUNT_TIER','ACCOUNT','MERCHANT','STORE')),
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES pixbrasil.merchants(id) ON DELETE CASCADE,
  store_id uuid REFERENCES pixbrasil.stores(id) ON DELETE CASCADE,
  account_tier_code varchar(64),
  currency char(3) NOT NULL DEFAULT 'BRL',
  priority integer NOT NULL DEFAULT 100,
  status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (store_id IS NULL OR merchant_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS fee_profiles_scope_idx
  ON pixbrasil.fee_profiles(scope_type, status, priority);
CREATE INDEX IF NOT EXISTS fee_profiles_account_idx
  ON pixbrasil.fee_profiles(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fee_profiles_merchant_idx
  ON pixbrasil.fee_profiles(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fee_profiles_store_idx
  ON pixbrasil.fee_profiles(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fee_profiles_tier_idx
  ON pixbrasil.fee_profiles(account_tier_code) WHERE account_tier_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS pixbrasil.fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_profile_id uuid NOT NULL REFERENCES pixbrasil.fee_profiles(id) ON DELETE CASCADE,
  payment_method varchar(32) NOT NULL DEFAULT 'PIX',
  transaction_type varchar(32) NOT NULL DEFAULT 'PAYMENT',
  fee_bps numeric(10,4) NOT NULL DEFAULT 0 CHECK (fee_bps >= 0),
  fixed_fee_brl numeric(18,2) NOT NULL DEFAULT 0 CHECK (fixed_fee_brl >= 0),
  min_fee_brl numeric(18,2) CHECK (min_fee_brl IS NULL OR min_fee_brl >= 0),
  max_fee_brl numeric(18,2) CHECK (max_fee_brl IS NULL OR max_fee_brl >= 0),
  settlement_delay_days integer NOT NULL DEFAULT 0 CHECK (settlement_delay_days >= 0),
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to > effective_from),
  CHECK (min_fee_brl IS NULL OR max_fee_brl IS NULL OR min_fee_brl <= max_fee_brl)
);
CREATE INDEX IF NOT EXISTS fee_rules_profile_active_idx
  ON pixbrasil.fee_rules(fee_profile_id, enabled, effective_from DESC);

CREATE TABLE IF NOT EXISTS controlplane.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name varchar(160),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','DISABLED')),
  require_mfa boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlplane.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  description text,
  builtin boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlplane.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(96) NOT NULL UNIQUE,
  domain varchar(48) NOT NULL,
  description text,
  sensitivity varchar(16) NOT NULL DEFAULT 'NORMAL'
    CHECK (sensitivity IN ('NORMAL','SENSITIVE','CRITICAL')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS controlplane.admin_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES controlplane.admin_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES controlplane.roles(id) ON DELETE RESTRICT,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(admin_user_id, role_id),
  CHECK (expires_at IS NULL OR expires_at > granted_at)
);
CREATE INDEX IF NOT EXISTS admin_user_roles_role_idx
  ON controlplane.admin_user_roles(role_id, expires_at);

CREATE TABLE IF NOT EXISTS controlplane.role_permissions (
  role_id uuid NOT NULL REFERENCES controlplane.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES controlplane.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx
  ON controlplane.role_permissions(permission_id);

CREATE TABLE IF NOT EXISTS controlplane.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_code varchar(96) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id varchar(160),
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status varchar(24) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELED','EXPIRED','EXECUTED','FAILED')),
  required_approvals smallint NOT NULL DEFAULT 1 CHECK (required_approvals > 0),
  min_aal varchar(8) NOT NULL DEFAULT 'aal2' CHECK (min_aal IN ('aal1','aal2')),
  maker_checker_required boolean NOT NULL DEFAULT true,
  reason text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approval_requests_status_created_idx
  ON controlplane.approval_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS approval_requests_requester_idx
  ON controlplane.approval_requests(requested_by, created_at DESC);

CREATE TABLE IF NOT EXISTS controlplane.approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES controlplane.approval_requests(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action varchar(16) NOT NULL CHECK (action IN ('APPROVE','REJECT','CANCEL')),
  aal varchar(8) NOT NULL CHECK (aal IN ('aal1','aal2')),
  session_id uuid,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approval_actions_request_idx
  ON controlplane.approval_actions(approval_request_id, created_at);
CREATE INDEX IF NOT EXISTS approval_actions_actor_idx
  ON controlplane.approval_actions(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS controlplane.provider_credential_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_account_id uuid NOT NULL REFERENCES public.provider_accounts(id) ON DELETE CASCADE,
  gateway_connection_id uuid REFERENCES pixbrasil.gateway_connections(id) ON DELETE SET NULL,
  vault_secret_id uuid NOT NULL,
  fingerprint varchar(128),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUPERSEDED','REVOKED','INVALID')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rotated_from_id uuid REFERENCES controlplane.provider_credential_versions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS provider_credential_versions_account_idx
  ON controlplane.provider_credential_versions(provider_account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS provider_credential_versions_connection_idx
  ON controlplane.provider_credential_versions(gateway_connection_id)
  WHERE gateway_connection_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS controlplane.provider_webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_connection_id uuid NOT NULL REFERENCES pixbrasil.gateway_connections(id) ON DELETE CASCADE,
  endpoint_url text NOT NULL,
  provider_webhook_id text,
  signing_secret_vault_id uuid,
  status varchar(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','ERROR','DISABLED')),
  events text[] NOT NULL DEFAULT '{}'::text[],
  auto_managed boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gateway_connection_id, endpoint_url)
);

CREATE TABLE IF NOT EXISTS controlplane.manual_adjustment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  original_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  adjustment_ledger_transaction_id uuid REFERENCES public.ledger_transactions(id) ON DELETE RESTRICT,
  direction varchar(16) NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  amount numeric(36,18) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','APPROVAL_REQUIRED','APPROVED','POSTED','REJECTED','CANCELED','FAILED')),
  approval_request_id uuid REFERENCES controlplane.approval_requests(id) ON DELETE RESTRICT,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manual_adjustments_account_status_idx
  ON controlplane.manual_adjustment_requests(account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS manual_adjustments_approval_idx
  ON controlplane.manual_adjustment_requests(approval_request_id)
  WHERE approval_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS controlplane.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE RESTRICT,
  amount numeric(36,18) NOT NULL CHECK (amount > 0),
  destination_type varchar(32),
  destination_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(24) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','APPROVAL_REQUIRED','APPROVED','PROCESSING','PAID','CONFIRMED','REJECTED','CANCELED','FAILED')),
  approval_request_id uuid REFERENCES controlplane.approval_requests(id) ON DELETE RESTRICT,
  external_reference varchar(200),
  proof_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payout_requests_account_status_idx
  ON controlplane.payout_requests(account_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS payout_requests_approval_idx
  ON controlplane.payout_requests(approval_request_id)
  WHERE approval_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS controlplane.system_settings (
  key varchar(120) PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (key !~* '(secret|password|private[_-]?key|api[_-]?key|token|credential)')
);

CREATE TABLE IF NOT EXISTS controlplane.feature_flags (
  key varchar(120) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gateway_connections_merchant_id_idx
  ON pixbrasil.gateway_connections(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gateway_connections_provider_account_id_idx
  ON pixbrasil.gateway_connections(provider_account_id) WHERE provider_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_intents_selected_connection_id_idx
  ON pixbrasil.payment_intents(selected_connection_id) WHERE selected_connection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS provider_attempts_routing_decision_id_idx
  ON pixbrasil.provider_attempts(routing_decision_id) WHERE routing_decision_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routing_decisions_policy_id_idx
  ON pixbrasil.routing_decisions(policy_id) WHERE policy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routing_policies_account_id_idx
  ON pixbrasil.routing_policies(account_id) WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routing_policies_merchant_id_idx
  ON pixbrasil.routing_policies(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS routing_routes_gateway_connection_id_idx
  ON pixbrasil.routing_routes(gateway_connection_id);

ALTER TABLE public.account_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.account_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.account_tier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.fee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pixbrasil.fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.admin_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.provider_credential_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.provider_webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.manual_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE controlplane.feature_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_products FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA pixbrasil FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA controlplane FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA controlplane FROM anon, authenticated;

INSERT INTO pixbrasil.account_tiers(code,label,account_type,priority,routing_metadata,commercial_metadata)
VALUES
 ('PERSONAL_STANDARD','Personal Standard','INDIVIDUAL',100,'{}','{}'),
 ('PERSONAL_PLUS','Personal Plus','INDIVIDUAL',90,'{}','{}'),
 ('BUSINESS_START','Business Start','BUSINESS',100,'{}','{}'),
 ('BUSINESS_GROWTH','Business Growth','BUSINESS',80,'{}','{}'),
 ('BUSINESS_ENTERPRISE','Business Enterprise','BUSINESS',50,'{}','{}')
ON CONFLICT (code) DO NOTHING;

INSERT INTO controlplane.roles(code,name,description,builtin)
VALUES
 ('SUPER_ADMIN','Super Admin','Full control plane administration.',true),
 ('OPERATIONS_ADMIN','Operations Admin','Operational merchants, stores, providers and routing management.',true),
 ('FINANCE_ADMIN','Finance Admin','Ledger, settlements, payouts and financial approvals.',true),
 ('RISK_ADMIN','Risk Admin','Risk, compliance, limits and restrictions.',true),
 ('SUPPORT_ADMIN','Support Admin','Support and read-oriented operational access.',true),
 ('AUDITOR','Auditor','Read-only audit, financial and configuration visibility.',true),
 ('VIEWER','Viewer','Basic read-only control plane access.',true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO controlplane.permissions(code,domain,description,sensitivity)
VALUES
 ('dashboard.read','dashboard','View operational overview.','NORMAL'),
 ('onboarding.read','onboarding','View onboarding cases.','NORMAL'),
 ('onboarding.approve','onboarding','Approve or reject onboarding.','SENSITIVE'),
 ('merchants.read','merchants','View merchants and stores.','NORMAL'),
 ('merchants.manage','merchants','Create or modify merchants/stores and limits.','SENSITIVE'),
 ('providers.read','providers','View provider library/accounts/health.','NORMAL'),
 ('providers.manage','providers','Create or modify provider accounts/connections.','SENSITIVE'),
 ('providers.credentials.rotate','providers','Create or rotate provider credentials in Vault.','CRITICAL'),
 ('routing.read','routing','View routing policies and decisions.','NORMAL'),
 ('routing.manage','routing','Create and modify routing policies/routes.','SENSITIVE'),
 ('routing.enforce','routing','Promote routing policy to ENFORCED.','CRITICAL'),
 ('transactions.read','transactions','View transactions and provider attempts.','NORMAL'),
 ('transactions.reconcile','transactions','Perform controlled reconciliation actions.','SENSITIVE'),
 ('ledger.read','ledger','View ledger and balances.','SENSITIVE'),
 ('ledger.adjust.request','ledger','Request compensating ledger adjustment.','CRITICAL'),
 ('ledger.adjust.approve','ledger','Approve compensating ledger adjustment.','CRITICAL'),
 ('settlements.read','settlements','View settlements and availability.','SENSITIVE'),
 ('payouts.read','payouts','View payout requests/history.','SENSITIVE'),
 ('payouts.request','payouts','Create manual payout request.','CRITICAL'),
 ('payouts.confirm','payouts','Approve/confirm manual payout.','CRITICAL'),
 ('risk.read','risk','View risk/compliance state.','SENSITIVE'),
 ('risk.manage','risk','Modify risk controls or account restrictions.','CRITICAL'),
 ('users.read','users','View control plane users/roles.','SENSITIVE'),
 ('users.manage','users','Manage control plane users and roles.','CRITICAL'),
 ('audit.read','audit','View immutable audit and approvals.','SENSITIVE'),
 ('system.read','system','View system settings and health.','NORMAL'),
 ('system.manage','system','Modify non-secret system configuration/feature flags.','CRITICAL')
ON CONFLICT (code) DO NOTHING;

INSERT INTO controlplane.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM controlplane.roles r
CROSS JOIN controlplane.permissions p
WHERE r.code='SUPER_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO controlplane.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM controlplane.roles r
JOIN controlplane.permissions p ON p.code = ANY(
  CASE r.code
    WHEN 'VIEWER' THEN ARRAY['dashboard.read','merchants.read','providers.read','routing.read','transactions.read','system.read']::text[]
    WHEN 'AUDITOR' THEN ARRAY['dashboard.read','merchants.read','providers.read','routing.read','transactions.read','ledger.read','settlements.read','payouts.read','risk.read','users.read','audit.read','system.read']::text[]
    ELSE ARRAY[]::text[]
  END
)
WHERE r.code IN ('VIEWER','AUDITOR')
ON CONFLICT DO NOTHING;

INSERT INTO controlplane.role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM controlplane.roles r
JOIN controlplane.permissions p ON
  (r.code='OPERATIONS_ADMIN' AND p.code = ANY(ARRAY[
    'dashboard.read','onboarding.read','onboarding.approve','merchants.read','merchants.manage',
    'providers.read','providers.manage','routing.read','routing.manage','transactions.read',
    'transactions.reconcile','settlements.read','system.read'
  ]::text[]))
  OR
  (r.code='FINANCE_ADMIN' AND p.code = ANY(ARRAY[
    'dashboard.read','merchants.read','transactions.read','transactions.reconcile','ledger.read',
    'ledger.adjust.request','ledger.adjust.approve','settlements.read','payouts.read',
    'payouts.request','payouts.confirm','audit.read','system.read'
  ]::text[]))
  OR
  (r.code='RISK_ADMIN' AND p.code = ANY(ARRAY[
    'dashboard.read','onboarding.read','onboarding.approve','merchants.read','providers.read',
    'routing.read','transactions.read','ledger.read','settlements.read','risk.read','risk.manage',
    'audit.read','system.read'
  ]::text[]))
  OR
  (r.code='SUPPORT_ADMIN' AND p.code = ANY(ARRAY[
    'dashboard.read','onboarding.read','merchants.read','providers.read','routing.read',
    'transactions.read','settlements.read','system.read'
  ]::text[]))
WHERE r.code IN ('OPERATIONS_ADMIN','FINANCE_ADMIN','RISK_ADMIN','SUPPORT_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO controlplane.system_settings(key,value,description)
VALUES
 ('core.display_name','"Atlas Financial Core"'::jsonb,'Logical name of the shared financial core.'),
 ('core.primary_product','"PIXBRASIL"'::jsonb,'Current primary product using the core.'),
 ('routing.default_activation_mode','"SHADOW"'::jsonb,'New routing policies default to SHADOW.'),
 ('security.critical_action_aal','"aal2"'::jsonb,'Minimum AAL for critical admin actions.'),
 ('security.maker_checker_default','true'::jsonb,'Critical financial actions default to maker/checker.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO controlplane.feature_flags(key,enabled,config,description)
VALUES
 ('provider_auto_webhook_registration',false,'{}','Allow adapters to register provider webhooks automatically after explicit admin action.'),
 ('routing_enforcement',false,'{}','Global kill switch for ENFORCED routing.'),
 ('manual_payouts',false,'{}','Enable manual payout workflow after runtime validation.'),
 ('manual_ledger_adjustments',false,'{}','Enable compensating adjustment workflow after runtime validation.')
ON CONFLICT (key) DO NOTHING;

COMMENT ON SCHEMA controlplane IS
  'Private operational control plane for Atlas Financial Core products. Backend-only; no browser direct table access.';
COMMENT ON TABLE controlplane.provider_credential_versions IS
  'Stores only Vault references/fingerprints, never plaintext provider credentials.';
COMMENT ON TABLE controlplane.manual_adjustment_requests IS
  'Requests compensating ledger entries; existing ledger entries must never be edited in place.';
COMMENT ON TABLE controlplane.system_settings IS
  'Non-secret settings only. Provider/API secrets must be stored in Supabase Vault.';
