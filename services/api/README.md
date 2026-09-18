# PiXBrasil API

NestJS/TypeScript backend for PiXBrasil, hosted independently from the public Vercel landing.

## Runtime V0.2

The API has explicit runtime dependencies:

- Atlas Financial Core PostgreSQL / Supabase
- dedicated PiXBrasil Redis
- provider adapters and routing engine already present in this repository

Liveness:

```text
GET /api/health
```

Readiness:

```text
GET /api/health/ready
```

Readiness is only `READY` when PostgreSQL is reachable, the private
`pixbrasil` and `controlplane` schemas exist, and Redis answers `PONG`.
When `RUNTIME_STRICT=true`, startup fails immediately if `DATABASE_URL` or
`REDIS_URL` is missing.

No provider is activated by this runtime work. PixGo and MisticPay remain
disabled until provider accounts, Vault credentials, gateway connections and
SHADOW routing are explicitly configured.

## Public API direction

- POST /api/v1/payment-intents
- GET /api/v1/payment-intents/:id
- POST /api/v1/pix/charges
- GET /api/v1/pix/charges/:id
- POST /api/v1/payment-links
- POST /api/v1/webhooks/pixgo
- POST /api/v1/webhooks/misticpay

## Admin direction

- GET/POST /api/v1/admin/providers
- GET/POST /api/v1/admin/provider-accounts
- GET/POST /api/v1/admin/gateway-connections
- GET/POST /api/v1/admin/routing-policies
- GET /api/v1/admin/routing-decisions
- GET/POST /api/v1/admin/approvals
- GET/POST /api/v1/admin/payouts
- GET/POST /api/v1/admin/ledger-adjustments

Provider credentials never travel through ordinary GET responses. Plaintext
provider secrets belong only in Supabase Vault and are referenced by opaque
Vault IDs from the control plane.
