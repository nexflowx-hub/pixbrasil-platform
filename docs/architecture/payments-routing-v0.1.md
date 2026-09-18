# PiXBrasil Payments Core — Routing Architecture V0.1

Status: **PROPOSED / repository draft**  
Database changes: **NOT APPLIED**  
Initial providers: **PixGo** and **MisticPay**

## 1. Principle

PiXBrasil must not hard-code a provider inside a payment controller.

The payment path is split into:

```text
PaymentIntent
   ↓
Routing Context
   ↓
Policy Resolver
   ↓
Eligibility Filters
   ↓
Strategy Engine
   ↓
Routing Decision (persisted)
   ↓
Provider Adapter
   ↓
Provider Payment
   ↓
Webhook/Reconciliation
```

The persisted `routing_decision` is part of the payment audit trail. The same idempotency key must resolve to the same provider decision unless an explicit, auditable failover transition is allowed.

## 2. Financial/Core boundaries

The existing AtlasWallet database remains the physical PostgreSQL/Supabase project for now.

Existing `public` tables continue to act as the Financial Core:

- `accounts`
- `assets`
- `wallets`
- `wallet_balances`
- `ledger_accounts`
- `ledger_transactions`
- `ledger_entries`
- `transactions`
- `providers`
- `provider_accounts`
- `provider_capabilities`
- `webhook_events`
- `audit_logs`

PiXBrasil-specific payment orchestration lives in schema `pixbrasil`.

No second authoritative wallet balance or ledger is created.

## 3. Provider library

### Provider

A provider is the platform-level integration definition.

Examples:

- `PIXGO`
- `MISTICPAY`

Future examples:

- other PSP/acquirer PIX rails
- crypto liquidity providers
- custody providers
- KYC providers

### Provider Account

Represents one commercial/technical account at that provider.

A provider may have several accounts:

```text
PIXGO
 ├─ PixGo Account A
 ├─ PixGo Account B
 └─ PixGo Account C
```

Provider account metadata may describe:

- external account/merchant identifier
- environment
- settlement profile
- capabilities
- commercial pricing profile
- limits

It must NOT contain plaintext credentials.

### Credential / Gateway Vault reference

PiXBrasil keeps a **reference** to a secret, not the secret itself.

```text
provider_credential_refs
  backend = SUPABASE_VAULT | ENV | EXTERNAL_KMS
  secret_ref = opaque identifier
```

The runtime resolves the secret server-side.

Never expose provider credentials to frontend, merchant API responses, routing decision APIs, logs or analytics.

### Provider Connection

A provider account becomes usable through a `provider_connection`.

A connection can be scoped to:

- platform/global
- account
- merchant
- store

Example:

```text
PixGo Account 01
   ↓
connection: pixgo-primary
   ↓
Merchant ABC / Store Loja-1
```

A second connection may use the same provider with another account:

```text
PixGo Account 02
   ↓
connection: pixgo-volume-b
```

This is what allows routing not only between PixGo and MisticPay, but also between multiple accounts of the same provider.

## 4. Routing policy hierarchy

Routing policy is resolved from most specific to least specific:

1. Store
2. Merchant
3. Account
4. Product/PiXBrasil default

A policy specifies:

- method
- currency
- environment
- strategy
- activation mode
- status

Initial method:

- `PIX / BRL`

### Activation modes

`shadow`

The engine calculates and persists what it would select, but the payment executor does not use the decision.

`enforce`

The payment executor uses the selected connection.

All new routing logic should be validated in shadow before enforcement.

## 5. Rules and conditions

A policy contains ordered rules.

Example conditions:

```json
{
  "all": [
    { "field": "amountMinor", "op": "gte", "value": 10000 },
    { "field": "customerTier", "op": "in", "value": ["BUSINESS_GROWTH", "BUSINESS_ENTERPRISE"] },
    { "field": "storeVolume30dMinor", "op": "lt", "value": 500000000 }
  ]
}
```

Supported condition families should include:

- amount min/max
- account type PF/PJ
- customer tier
- merchant
- store
- payment method
- currency
- environment
- rolling 24h/30d volume
- provider connection daily/monthly usage
- provider health
- provider success rate
- provider latency
- time/day window
- explicit metadata tag

Conditions are data, not controller code.

## 6. Routing strategies

### priority_failover

Ordered candidates.

Example:

1. PixGo primary
2. MisticPay fallback

Selection chooses the first eligible and healthy connection.

### weighted

Traffic split by configured weight.

Example:

- PixGo: 70
- MisticPay: 30

The selection must be deterministic using a stable hash of `idempotencyKey + policyId`.

Random selection per retry is prohibited.

### volume_split

Routes by configured volume objectives/caps.

Example:

- PixGo until R$ 300k/day
- MisticPay receives overflow
- optional target percentages per 24h/30d window

Volume counters are derived from persisted payments/decisions and must be reconcilable.

### least_cost

Selects the cheapest eligible connection using:

- fixed fee
- percentage/bps
- optional network/provider cost

Cost never overrides health/risk hard constraints.

### manual

Explicitly pins a policy/rule to one connection for incident response or controlled rollout.

## 7. Eligibility pipeline

Before strategy selection, each configured target passes through hard filters:

1. provider exists and is ACTIVE/allowed
2. provider account is ACTIVE
3. provider connection is ACTIVE
4. environment matches
5. payment method capability matches
6. currency matches
7. credential reference is active
8. account/merchant/store scope matches
9. amount limits match
10. tier rule matches
11. volume caps have not been exceeded
12. health thresholds match
13. provider is not administratively quarantined

Every excluded candidate records exclusion reasons.

## 8. Health

Health must be a first-class input, not an implicit runtime exception.

Snapshots:

- state: healthy / degraded / down / unknown
- success rate 5m
- success rate 1h
- p95 latency
- timeout rate
- provider error rate
- last successful charge
- last webhook
- observed_at

Health may come from:

- active provider probes that do not create money movement
- recent real transaction telemetry
- webhook delivery telemetry

No fake charge should be created only to test routing.

## 9. Failover safety

Failover is permitted only before the system has ambiguous provider-side money movement.

Examples:

Safe:

- provider connection disabled before request
- local configuration missing
- deterministic pre-request health rejection
- provider returns a documented final rejection before creating a charge

Unsafe without reconciliation:

- network timeout after request body was sent
- HTTP 5xx where provider may have created the payment
- client disconnect after provider call
- unknown webhook state

For ambiguous states:

```text
UNKNOWN_PROVIDER_STATE
→ reconciliation
→ no automatic second-provider charge
```

This avoids duplicate PIX charges.

## 10. Initial provider rollout

### Phase A — registry

Register:

- PIXGO
- MISTICPAY

Capabilities:

- PIX_CHARGE
- PIX_STATUS
- PIX_WEBHOOK

### Phase B — connections

Create one or more provider accounts/connections for each provider.

No credentials in migration.

### Phase C — shadow policy

Default:

```text
strategy: priority_failover
activation_mode: shadow

PixGo priority 10
MisticPay priority 20
```

### Phase D — observability

Persist routing decisions for real payment intents while execution remains unchanged.

### Phase E — enforcement

Only after:

- adapter idempotency verified
- webhook correlation verified
- health telemetry valid
- provider credential ownership validated
- reconciliation states implemented
- decision telemetry reviewed

## 11. Volume/tier examples

### Personal Standard

```text
tier = PERSONAL_STANDARD
amount < R$ 5,000
→ PixGo primary
→ MisticPay fallback
```

### Business Growth

```text
tier = BUSINESS_GROWTH
rolling 30d volume >= R$ 100,000
→ weighted 60/40 across approved connections
```

### Enterprise

```text
tier = BUSINESS_ENTERPRISE
store 24h volume > configured threshold
→ volume_split with per-provider caps
```

These are examples only. Values must be data-driven in production.

## 12. Required APIs later

Admin/control plane:

- `GET /admin/providers`
- `POST /admin/providers/:provider/accounts`
- `POST /admin/provider-connections`
- `GET /admin/routing/policies`
- `POST /admin/routing/policies`
- `POST /admin/routing/policies/:id/rules`
- `POST /admin/routing/simulate`
- `GET /admin/routing/decisions`
- `GET /admin/provider-health`

Merchant:

- read-only view of enabled payment capabilities
- optional store-specific configuration within permitted policy boundaries

Public payment API never returns vault/credential information.

## 13. Database deployment rule

The migration draft under `infra/db/drafts` is **not to be executed automatically**.

Before applying to the shared AtlasWallet Supabase project:

1. inspect current schema
2. create database backup/restore point
3. run migration against isolated/staging database
4. inspect constraints/indexes/RLS
5. test AtlasWallet regression
6. apply through controlled migration
7. validate counts and permissions

