# Routing Engine V1

## Goals

Support provider priority/failover, weighted routing, volume distribution, customer/account tiers, merchant/store overrides, amount ranges, provider health, success rate, latency, cost basis points, daily/monthly caps, shadow routing and full decision evidence.

## Scope resolution

Policies resolve from most specific to least specific: Store → Merchant → Account tier → PiXBrasil global default.

## Strategies

- PRIORITY_FAILOVER: ordered candidates; fail over only after safely retryable failures.
- WEIGHTED: deterministic weighted selection using a stable routing key such as paymentIntentId.
- VOLUME_SPLIT: weighted selection plus provider volume caps/current assigned volume.
- HEALTH_AWARE: removes or penalizes unhealthy connections.
- COST_AWARE: chooses among eligible healthy providers using configured cost.
- RULES: combines amount, tier, store, risk, time-window and custom conditions.

## Candidate filtering

A route is eligible only when the connection is active, provider status is allowed, PIX/BRL capability exists, scope matches, amount and tier are allowed, caps are not exceeded, health requirements pass and custom conditions match.

## Decision persistence

Persist the routing decision before provider execution. Store policy/version, strategy, selected connection, eligible/rejected candidates and reasons, health/volume evidence, tier, amount, sticky key and timestamp.

Retries reuse the same decision unless an explicit failover transition is created.

## Safe failover rule

A timeout/network failure after a create request is AMBIGUOUS, not automatically failed.

Move to a second provider only if the original provider guarantees idempotent creation, adapter recovery confirms no charge exists, or the request provably never reached the provider.

Otherwise the payment enters RECONCILIATION_REQUIRED. No second charge is created until ambiguity is resolved.

PixGo already demonstrates why this matters: the current XPAYMENTS integration attempts recovery by external_id after uncertain create failures.

## Shadow mode

SHADOW calculates and records routing without controlling execution. ENFORCED lets the decision control execution. New strategies/providers should run in SHADOW first.