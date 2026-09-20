# PiXBrasil.org

PiXBrasil is a production PIX orchestration and merchant financial-control platform.

## Product surfaces
- Public marketing, onboarding and merchant documentation
- Authenticated Client Portal at `/app` for Personal and Business accounts
- Admin Control Plane at `admin.pixbrasil.org`
- Merchant API at `api.pixbrasil.org`
- Atlas Financial Core on Supabase/PostgreSQL

## Production operating mode
- Business Client Portal: Wallet BRL, Stores, PIX activity, settlements, gateway health and payouts
- Business Merchant API: live PIX creation through enforced Store routing
- Provider credentials: encrypted in Supabase Vault
- MisticPay D0 and PixGo D1 routes supported
- Provider callbacks are verified before payment status and settlement posting
- Successful PIX posts immutable ledger entries and materialized Wallet BRL balances
- Payouts: manual operational tickets with BRL reservation; automated payout execution is the next phase

## Stack
- Next.js 16 / React 19 / TypeScript
- NestJS 12 / Node.js 22
- PostgreSQL 17 / Supabase
- Redis
- Vercel for public/client/admin frontends
- Docker + Caddy for API runtime

## Security model
- Admin: Supabase Auth + AAL2 MFA + database RBAC
- Client Portal: Supabase identity with HttpOnly same-origin session cookies
- Merchant S2S: SHA-256 API-key hashes + per-Store grants
- Financial/admin tables: backend-only with RLS defense in depth
- Provider secrets and merchant webhook signing secrets: Supabase Vault
- Provider webhooks: signature/S2S verification before state transitions
- Merchant webhooks: signed HMAC deliveries with replay protection
- Payout tickets atomically reserve available BRL before entering the manual queue

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

## Deployment
Frontend merges deploy through Vercel after CI. API releases require the VPS Docker runtime to rebuild and restart. The API runtime version is sourced from `services/api/package.json`.
