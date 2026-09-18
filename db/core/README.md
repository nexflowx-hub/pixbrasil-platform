# Atlas Financial Core — applied schema

Physical Supabase project ref: `aakdyumavlzgyklbrsrw`.

The Supabase project may still display the historical name **AtlasWallet** in
Studio. The logical platform name used by the database and PiXBrasil runtime is
**Atlas Financial Core**. AtlasWallet is treated as a future product on top of
this shared core, not as the owner of the database.

## Logical boundaries

- `auth.*` — Supabase Auth
- `public.*` — shared Atlas Financial Core
- `pixbrasil.*` — PiXBrasil product domain
- `controlplane.*` — private operational Admin Control Plane

## Applied migrations

- `20260915093413 financial_schema_security_hardening`
- `20260918053600 pixbrasil_foundation_v1`
- `20260918053604 pixbrasil_initial_providers`
- `20260918231006 controlplane_admin_core_v1`
- `controlplane_fk_indexes_v1` (applied immediately after V1; see migration history for generated timestamp)

The Control Plane migration creates RBAC, approvals, provider credential
references, webhook configuration, payout/manual-adjustment workflows,
account-product membership, PiXBrasil account tiers and fee profiles.

All financial/admin product tables remain backend-only: RLS is enabled and
`anon`/`authenticated` have no direct table privileges. Provider plaintext
credentials are never stored in these tables; only Supabase Vault references
and non-secret fingerprints are persisted.

Initial feature flags deliberately keep enforced routing, manual payouts,
manual ledger adjustments and automatic provider-webhook registration disabled.
