# Database Boundaries

## Shared Supabase

Use the existing AtlasWallet Supabase physical project. Logical ownership: auth.* Supabase Auth, public.* Atlas Financial Core, pixbrasil.* PiXBrasil product domain.

## Existing reusable core

Current core already provides accounts (INDIVIDUAL/BUSINESS/INTERNAL), wallets, wallet_balances, assets, ledger_accounts, ledger_transactions, ledger_entries, transactions, providers, provider_accounts, provider_capabilities, webhook_events, audit_logs, pricing_plans and policy_profiles.

PiXBrasil must reference these rather than duplicate them.

## Security boundary

pixbrasil schema is private to backend services. Revoke access from anon/authenticated, enable RLS as defense in depth, and do not expose product financial tables directly to the browser.

A future explicit API schema can expose carefully designed views/RPCs if needed.