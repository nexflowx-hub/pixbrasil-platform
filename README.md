# PiXBrasil.org

PiXBrasil is a controlled financial-infrastructure MVP for PIX orchestration, account visibility and provider routing.

## Product surfaces
- Public marketing site and legal/support pages
- Authenticated Client Portal at `/app` for Personal and Business accounts
- Admin Control Plane at `admin.pixbrasil.org`
- NestJS API at `api.pixbrasil.org`
- Atlas Financial Core on Supabase/PostgreSQL

## Current operating mode
- Client Portal: read-only financial view
- Business API: SHADOW pilot
- Provider credentials: encrypted in Supabase Vault
- MisticPay and PixGo: credential health validated and SHADOW-eligible
- Global routing enforcement: OFF
- Pilot live execution: OFF
- Manual payouts: OFF
- Manual ledger adjustments: OFF

No UI should imply that a guarded financial write is available before its rail is enabled.

## Stack
- Next.js 16.3.5 / React 19 / TypeScript
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
- Provider secrets: Supabase Vault
- Webhooks: provider verification before state transitions
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

## Production discipline
Frontend merges deploy through Vercel after CI. API changes require the VPS Docker runtime to be rebuilt and restarted. Financial kill-switches remain disabled until create → webhook → reconciliation → settlement behavior has been validated with controlled real payments.
