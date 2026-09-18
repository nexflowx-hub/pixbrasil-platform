# PiXBrasil Core — Architecture V1

## Product boundary

PiXBrasil is the Brazil-facing product for both Personal and Business accounts.

The shared Atlas Financial Core remains the source of truth for identity/account linkage, assets, wallets, balances, double-entry ledger, generic transactions and the shared provider registry.

PiXBrasil owns merchants/stores, PIX payment intents, product routing policies, gateway connections, payment links/checkout/API keys, provider attempts/webhook inbox and PiXBrasil settlement orchestration.

## Physical topology

pixbrasil.org / app.pixbrasil.org → PiXBrasil API (NestJS) → Postgres/Supabase + Redis/BullMQ → Provider Library → PixGo / MisticPay.

Database boundary: auth.* = Supabase Auth; public.* = Atlas Financial Core; pixbrasil.* = PiXBrasil product schema.

## Ownership rules

- public core tables remain owned by Atlas Financial Core.
- pixbrasil schema migrations are owned by the PiXBrasil backend.
- PiXBrasil never creates a second authoritative wallet balance.
- Provider credentials are never stored in product tables as plaintext.
- Frontend never receives provider credentials or secret/service-role keys.

## Runtime rule

A payment controller never chooses a provider by name. It asks the Routing Engine for a persisted RoutingDecision, then resolves the selected ProviderAdapter through an adapter registry.

This allows PixGo, MisticPay and future providers to be added without rewriting payment controllers.