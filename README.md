# PiXBrasil.org

PiXBrasil is a production financial orchestration platform for PIX, account visibility, multi-provider routing, settlement and merchant operations.

## Product surfaces
- Public marketing site and merchant documentation
- Authenticated Client Portal at `/app` for Personal and Business accounts
- Admin Control Plane at `admin.pixbrasil.org`
- NestJS API at `api.pixbrasil.org`
- Atlas Financial Core on Supabase/PostgreSQL

## Production operating model
- Business PIX API: live execution by Store when routing policy is `ENFORCED`
- Provider routing: MisticPay D0 and PixGo D1 according to Store policy
- Verified provider webhooks before financial state transitions
- Settlement → ledger → Wallet BRL posting after verified success
- D0 availability can be immediate according to release policy
- D1 availability is released by the settlement release worker
- Business payouts: manual operational ticket with balance reservation
- Automatic payout rails: intentionally disabled until the next treasury release
- Provider credentials: encrypted in Supabase Vault

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
- Idempotent settlement and payout primitives
- Ambiguous provider create never triggers blind cross-provider retry
- Audit and maker/checker foundations for critical operations

## Financial invariants
- Wallet balances are never adjusted manually by application code.
- Verified payments are posted through an idempotent settlement function.
- Ledger transactions use immutable double-entry postings.
- Payout tickets reserve available balance before operator processing.
- Rejected/canceled payout tickets return the reservation to available balance.
- Marking a manual payout as paid posts the withdrawal to ledger and consumes the reservation.
- Cross-release-class failover is disabled unless explicitly designed for the Store.

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
Frontend merges deploy through Vercel. API releases require the VPS Docker runtime to be rebuilt and restarted after the corresponding `main` commit is available.
