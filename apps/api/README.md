# Backend / Payments Core work

The PiXBrasil backend is not live yet.

Current repository work establishes the contracts and database model before runtime code is connected.

## Current artifacts

- `docs/architecture/payments-routing-v0.1.md`
- `packages/contracts/src/routing.ts`
- `infra/db/drafts/20260918_pixbrasil_payments_core_v0_1.sql`

The SQL file is intentionally stored under `drafts`. It must not be run automatically.

## Initial routing providers

- PixGo
- MisticPay

The provider architecture supports multiple provider accounts and multiple store/merchant connections per provider from day one.

## Next backend implementation

1. NestJS API scaffold
2. auth/account context
3. merchant/store modules
4. provider registry/admin module
5. secret resolver interface
6. PixGo adapter
7. MisticPay adapter
8. payment intent service
9. routing evaluator
10. decision persistence
11. webhook ingestion/idempotency
12. reconciliation worker
13. provider health worker
14. admin simulation endpoints
15. shadow routing pilot
