# Routing Engine V1

## Goal

PiXBrasil must support routing between multiple provider accounts and multiple providers without hard-coding a gateway inside a payment controller.

Initial providers:

- PixGo
- MisticPay

The canonical chain is:

```text
Provider
  → Provider Account
  → Gateway Connection
  → Routing Policy
  → Routing Route
  → Routing Decision
  → Provider Attempt
```

## Scope resolution

Policy resolution is most-specific first:

1. Store
2. Merchant
3. Account
4. Account tier
5. PiXBrasil global default

A policy always carries payment method, currency, environment, strategy, activation mode, version and priority.

## Supported routing dimensions

Rules/configuration may evaluate:

- amount min/max
- PF/PJ account type
- customer/account tier
- merchant
- store
- method/currency/environment
- rolling daily/monthly provider volume
- health state
- success rate
- latency
- provider cost
- risk level
- explicit operational metadata/tags

Business routing belongs in policy data. It must not be embedded as `if provider === ...` controller logic.

## Strategies

### PRIORITY_FAILOVER

Candidates are ordered by priority. The first eligible route is selected.

Failover is only allowed after a **provably safe** provider failure.

### WEIGHTED

Traffic is split using configured weights.

Selection must be deterministic from a stable key such as:

```text
paymentIntentId + policyId + policyVersion
```

A retry must not randomly select another provider.

### VOLUME_SPLIT

Uses target weights together with daily/monthly caps and current volume buckets.

Typical use:

- distribute volume across PixGo and MisticPay
- keep one account below an operational/commercial cap
- route overflow to another account/provider

### HEALTH_AWARE

Ranks eligible routes using health evidence, success rate and latency.

### COST_AWARE

Ranks healthy eligible candidates by configured cost basis points/fixed cost.

Cost may never override a hard risk, health, scope or capability constraint.

### RULES

Uses route conditions/config to express tier, amount, volume, time-window and operational rules.

## Candidate eligibility

A candidate is eligible only when:

1. Provider is allowed.
2. Provider account is active.
3. Gateway connection is active.
4. Environment matches.
5. PIX/BRL capability exists.
6. Account/merchant/store scope matches.
7. Amount range matches.
8. Tier is allowed.
9. Daily/monthly caps are available.
10. Health requirements pass.
11. Any custom conditions pass.

Rejected candidates must retain a machine-readable exclusion reason.

## Decision persistence

Persist the routing decision **before provider execution**.

Decision evidence should contain:

- policy id/version
- strategy
- sticky key
- selected connection
- eligible candidates
- rejected candidates and reasons
- tier
- amount
- provider health evidence
- provider volume evidence
- timestamp

Retries reuse the original decision unless an explicit failover transition is recorded.

## Shadow and enforcement

`SHADOW`

Calculates and stores the decision but does not control payment execution.

`ENFORCED`

The persisted decision controls execution.

New providers, strategies or material rule changes should pass through SHADOW first.

## Safe failover rule

A timeout/network failure after a create request is **AMBIGUOUS**, not automatically failed.

A second provider may be called only when at least one condition is true:

- original provider guarantees idempotent create for the same key
- recovery proves that no charge exists
- request provably never reached the provider
- provider returned a documented final rejection before creating a payment

Otherwise:

```text
AMBIGUOUS
→ RECONCILIATION_REQUIRED
→ do not create a second PIX charge
```

PixGo supports recovery by external reference in the current adapter contract.

MisticPay recovery by external client reference is not currently confirmed, therefore ambiguous create failures require stricter reconciliation.

## Provider health

Health is a first-class routing input.

Health can be derived from:

- harmless read-only provider probes
- recent real payment attempts
- S2S status checks
- webhook delivery/verification telemetry

Do not create artificial money movement solely to test provider health.

Expected evidence:

- HEALTHY / DEGRADED / DOWN / UNKNOWN
- sample window
- attempt count
- success rate
- p95 latency
- failure/timeout metrics
- last successful provider interaction

## Tier examples

Tier values are data, not hard-coded commercial policy.

Examples:

- PERSONAL_STANDARD
- PERSONAL_PLUS
- BUSINESS_START
- BUSINESS_GROWTH
- BUSINESS_ENTERPRISE

A tier may influence:

- permitted route set
- amount limits
- volume limits
- provider account selection
- routing strategy
- commercial fee profile

## Initial rollout

1. PixGo and MisticPay library entries remain disabled until account/vault setup.
2. Create provider accounts and gateway connections.
3. Validate credential ownership and S2S contracts.
4. Run routing in SHADOW.
5. Review decision evidence/health/volume behavior.
6. Enable controlled ENFORCED routing for a limited scope.
7. Expand only after reconciliation and idempotency behavior is stable.

## Routing management V2

Routing is managed at two distinct levels.

### Provider-account global profile

Each commercial provider account may have an operational profile independent
of any one merchant/store policy:

- status: ACTIVE / DEGRADED / DISABLED
- environment
- minimum/maximum ticket
- daily/monthly global volume caps
- provider cost (bps + fixed)
- allowed PF/PJ account types
- allowed customer tiers
- allowed risk levels
- operational tags

This prevents the same PixGo/MisticPay account from exceeding a contractual or
risk limit when reused by multiple gateway connections.

### Route-specific policy

A routing route remains the policy-specific overlay:

- priority
- weight
- amount range
- tier/account-type restriction
- connection-level daily/monthly caps
- health/error/latency thresholds
- cost overrides
- custom conditions

Effective eligibility is the intersection of:

```text
Provider
∩ Provider Account Profile
∩ Gateway Connection
∩ Routing Policy
∩ Routing Route
∩ Real-time Health/Volume Evidence
```

### Management library

The admin model should expose four separate libraries:

1. Providers — integration definitions (PixGo, MisticPay, future providers)
2. Provider Accounts — commercial/API accounts opened with each provider
3. Gateway Connections — usable runtime bindings to vault credentials/scopes
4. Routing Policies — rule sets that select among connections

A provider can therefore have many accounts, and an account can support many
scoped connections without duplicating credentials.
