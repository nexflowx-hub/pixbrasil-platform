# PiXBrasil Database Foundation V1

Physical database: shared AtlasWallet Supabase project `aakdyumavlzgyklbrsrw`.

Logical boundaries:

- `auth.*` — Supabase Auth
- `public.*` — Atlas Financial Core
- `pixbrasil.*` — PiXBrasil product domain

## Applied migrations

- `20260918053600 pixbrasil_foundation_v1`
- `20260918053604 pixbrasil_initial_providers`
- `20260919070831 pixbrasil_route_economics_release_v1`
- `20260919071256 pixbrasil_merchant_api_keys_v1`

Applied on 18 September 2026 after validating the exact schema + seed inside `BEGIN/ROLLBACK`.

## Security posture

- `pixbrasil` is a private backend schema.
- all PiXBrasil tables have RLS enabled.
- `anon` and `authenticated` have no table privileges in the schema.
- no browser client is expected to read/write these tables directly.
- provider credentials are not present in these migrations.
- `gateway_connections.vault_secret_id` is a reference for future encrypted Supabase Vault secrets.
- the security linter reports `RLS Enabled No Policy` as INFO; this is intentional while the schema is backend-only and has no browser grants.
- Supabase Auth leaked-password protection remains a separate pre-onboarding hardening item.

## Providers

The initial shared provider library contains:

- `PIXGO` — DISABLED
- `MISTICPAY` — DISABLED

No provider account, Vault credential, gateway connection or enforced routing policy was created by the seed.

## Activation sequence

A provider becomes executable only after:

1. provider account
2. encrypted Vault secret
3. PiXBrasil gateway connection
4. routing policy in SHADOW
5. observed health + routing decisions
6. explicit transition to ENFORCED

## Routing capabilities in V1 schema

- global / account / tier / merchant / store scoping
- priority failover
- weighted routing
- volume split
- health-aware routing
- cost-aware routing
- amount limits
- daily/monthly volume caps
- provider attempts and ambiguous-state reconciliation
- health snapshots
- webhook inbox
- settlement state


## Novidades.Store pilot

The controlled pilot uses five store-scoped routing policies:

- SIGNUM -> MisticPay D0
- AUTOHUB360 -> MisticPay D0
- MYPETS-LOJA -> MisticPay D0
- MYPETS-ONG -> PixGo D1
- SAUDAVEL-LOJA -> MisticPay D0

Cross-release-class failover is disabled. D0 and D1 are separate commercial/release products.

Route economics are stored in `route_cost_profiles/rules`. Merchant-facing PiXBrasil fees remain in `fee_profiles/rules`. The initial pilot platform markup is zero until commercial pricing is explicitly configured.
