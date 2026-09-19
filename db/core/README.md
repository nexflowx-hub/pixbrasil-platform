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
- `20260918231040 controlplane_fk_indexes_v1`
- `20260919070831 pixbrasil_route_economics_release_v1`
- `20260919071256 pixbrasil_merchant_api_keys_v1`
- `20260919071907 pixbrasil_route_economics_indexes_v1`
- `20260919145422 account_memberships_client_portal_v1`

The Control Plane migration creates RBAC, approvals, provider credential
references, webhook configuration, payout/manual-adjustment workflows,
account-product membership, PiXBrasil account tiers and fee profiles.

All financial/admin product tables remain backend-only: RLS is enabled and
`anon`/`authenticated` have no direct table privileges. Provider plaintext
credentials are never stored in these tables; only Supabase Vault references
and non-secret fingerprints are persisted.

Initial feature flags deliberately keep enforced routing, manual payouts,
manual ledger adjustments and automatic provider-webhook registration disabled.


## Client Portal boundary

`public.account_memberships` provides account-level access for Personal and Business users with roles `OWNER`, `ADMIN`, `FINANCE` and `VIEWER`. It does not grant browser access to financial tables. The client frontend authenticates through the API layer and all Core reads remain backend-mediated.
