# PiXBrasil.org

PiXBrasil is a production financial infrastructure layer for PIX orchestration, merchant wallets, provider routing, settlement and treasury operations.

## Product surfaces
- Public site, merchant documentation and OpenAPI
- Authenticated Client Portal for Personal and Business accounts
- Admin Control Plane at `admin.pixbrasil.org`
- NestJS API at `api.pixbrasil.org`
- Atlas Financial Core on Supabase/PostgreSQL

## Production financial flow
```
Merchant checkout
  -> PiXBrasil API
  -> Store routing policy
  -> Provider attempt
  -> PIX QR / copy-paste
  -> verified provider webhook
  -> PaymentIntent SUCCEEDED
  -> settlement
  -> immutable ledger
  -> Wallet BRL
  -> release policy D0/D1
  -> payout ticket / treasury
```

Provider create outcomes are persisted in `pixbrasil.provider_attempts`. Ambiguous create responses never trigger blind failover. Verified payment success is posted idempotently into settlement, ledger and wallet.

## Treasury
Payout requests reserve Wallet funds immediately. During the current treasury phase, payouts are processed manually from the Admin Control Plane and recorded with an external reference/proof. Automatic payout execution can be added without changing the accounting model.

## Security model
- Admin: Supabase Auth + AAL2 MFA + database RBAC
- Client Portal: HttpOnly same-origin session cookies
- Merchant S2S: SHA-256 API-key hashes + per-Store grants
- Provider credentials: Supabase Vault
- Provider callbacks: S2S verification / signed raw body when supported
- Merchant webhooks: HMAC signing secrets stored in Vault
- Financial writes: transactional, idempotent and ledger-backed
- Live collections: require ACTIVE account, APPROVED KYC, ENFORCED Store policy and production feature switches

## Stack
- Next.js 16 / React 19 / TypeScript
- NestJS 12 / Node.js 22
- PostgreSQL 17 / Supabase
- Redis
- Vercel for public/admin frontends
- Docker + Caddy for API runtime

## Runtime controls
- `routing_enforcement`
- `live_payment_execution`
- `manual_payouts`
- `manual_ledger_adjustments`
- `provider_auto_webhook_registration`

Feature switches are operational controls, not substitutes for account status, KYC or Store policy.

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
Frontend merges deploy through Vercel after CI. API releases require rebuilding the VPS Docker runtime. Financial feature switches are enabled only after the matching API version is ONLINE/READY and production smoke tests pass.
