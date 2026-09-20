# PiXBrasil.org

PiXBrasil is a production financial orchestration platform for PIX, merchant routing, settlements, Wallet BRL and operational payouts.

## Product surfaces
- Public website and Merchant Documentation
- Authenticated Client Portal for Personal and Business accounts
- Business financial dashboard with Wallet BRL, Stores, releases and payouts
- Admin Control Plane at `admin.pixbrasil.org`
- Merchant/API runtime at `api.pixbrasil.org`
- Atlas Financial Core on Supabase/PostgreSQL

## Production operating mode
- Business API: live PIX execution on ENFORCED routing policies
- Payment lifecycle: create → provider → verified webhook → settlement → ledger → Wallet BRL
- Merchant webhooks: signed HMAC deliveries
- MisticPay: D0 route
- PixGo: D1 route
- Payouts: manual operational ticket workflow, with Telegram notification when configured
- Automatic payouts: planned next-stage automation

## Stack
- Next.js 16 / React 19 / TypeScript
- NestJS 12 / Node.js 22
- PostgreSQL 17 / Supabase
- Redis
- Vercel for public/admin frontends
- Docker + Caddy for API runtime

## Security model
- Admin: Supabase Auth + AAL2 MFA + database RBAC
- Client Portal: Supabase identity with HttpOnly same-origin session cookies
- Merchant S2S: SHA-256 API-key hashes + per-Store grants
- Financial/admin tables: backend-only, RLS enabled, no direct anon/authenticated grants
- Provider credentials: Supabase Vault
- Provider webhooks: verified before payment state transitions
- Merchant webhooks: HMAC signed
- Idempotent payments, payouts and accounting writes
- Immutable ledger entries and materialized wallet balances

## Quality gates

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e

cd services/api
npm run typecheck
npm run build
npm test

cd ../../apps/admin
npm run typecheck
npm run lint
npm run build
```

## Release discipline
All changes pass CI before merging to `main`. Vercel deploys the public and Admin applications. API changes are rebuilt on the production VPS. Provider execution is enabled only for active ENFORCED Store policies with healthy configured gateways.
