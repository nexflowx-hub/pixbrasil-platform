# PiXBrasil.org

PiXBrasil is a production financial infrastructure for PIX orchestration, multi-provider routing, settlement, Business Wallets and merchant integrations.

## Product surfaces
- Public marketing site and legal/support pages
- Authenticated Client Portal at `/app` for Personal and Business accounts
- Admin Control Plane at `admin.pixbrasil.org`
- Merchant API at `api.pixbrasil.org/api/v1`
- Developer documentation at `pixbrasil.org/docs`
- Atlas Financial Core on Supabase/PostgreSQL

## Production operating model
- Business PIX API: enforced routing per active Store
- MisticPay: D0 route for configured Stores
- PixGo: D1 route for configured Stores
- Provider callbacks: verified before financial state transitions
- Settlement: creates immutable ledger postings and Wallet BRL movements
- D0: available immediately after verified success
- D1: internal 24-hour release window
- Payouts: requested in the Client Portal and processed through the manual operations ticket queue
- Merchant webhooks: HMAC-SHA256 signed delivery
- Cross-release-class failover: disabled

## Stack
- Next.js 16.3.5 / React 19 / TypeScript
- NestJS 12 / Node.js 22
- PostgreSQL 17 / Supabase
- Redis
- Vercel for public/admin frontends
- Docker + Caddy for the API runtime

## Security model
- Admin: Supabase Auth + AAL2 MFA + database RBAC
- Client Portal: Supabase identity with HttpOnly same-origin session cookies
- Merchant S2S: SHA-256 API-key hashes + per-Store grants
- Financial/admin tables: backend-only, RLS enabled, no direct anon/authenticated grants
- Provider and payout secrets: Supabase Vault
- Webhooks: provider verification before state transitions
- Ledger postings: immutable double-entry records with idempotency keys
- Ambiguous provider creates: reconciliation required; never blind cross-provider retry
- Audit and maker/checker foundations for critical operations

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
Frontend merges deploy through Vercel after CI. API releases require the VPS Docker runtime to be rebuilt and restarted. Routing is enabled only after provider health, Store policies, migrations and the matching API runtime are confirmed.
