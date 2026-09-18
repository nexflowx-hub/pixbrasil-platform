import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  evaluateRouting,
  type RouteCandidate,
  type RoutingContext,
} from "./routing-engine";

const context: RoutingContext = {
  paymentIntentId: "pi_test_sticky_001",
  accountId: "account-1",
  accountTier: "STANDARD",
  amount: 100,
  currency: "BRL",
  paymentMethod: "PIX",
};

function route(
  patch: Partial<RouteCandidate> & Pick<RouteCandidate, "connectionId" | "providerCode">,
): RouteCandidate {
  return {
    priority: 100,
    weight: 1,
    health: "HEALTHY",
    enabled: true,
    ...patch,
  };
}

test("filters amount, tier, health and volume constraints", () => {
  const result = evaluateRouting(
    context,
    [
      route({ connectionId: "ok", providerCode: "PIXGO" }),
      route({ connectionId: "down", providerCode: "MISTICPAY", health: "DOWN" }),
      route({ connectionId: "tier", providerCode: "MISTICPAY", allowedTiers: ["ENTERPRISE"] }),
      route({ connectionId: "min", providerCode: "PIXGO", minAmount: 200 }),
      route({ connectionId: "cap", providerCode: "PIXGO", dailyVolumeCap: 1000, dailyVolumeAssigned: 950 }),
    ],
    "PRIORITY_FAILOVER",
  );

  assert.equal(result.eligible.length, 1);
  assert.equal(result.selected?.connectionId, "ok");
  assert.deepEqual(
    new Set(result.rejected.map((entry) => entry.reason)),
    new Set(["PROVIDER_DOWN", "TIER_NOT_ALLOWED", "BELOW_MIN_AMOUNT", "DAILY_VOLUME_CAP"]),
  );
});

test("priority failover selects the lowest numeric priority", () => {
  const result = evaluateRouting(
    context,
    [
      route({ connectionId: "second", providerCode: "MISTICPAY", priority: 20 }),
      route({ connectionId: "first", providerCode: "PIXGO", priority: 10 }),
    ],
    "PRIORITY_FAILOVER",
  );

  assert.equal(result.selected?.connectionId, "first");
});

test("weighted routing is sticky for the same payment intent", () => {
  const candidates = [
    route({ connectionId: "a", providerCode: "PIXGO", weight: 80 }),
    route({ connectionId: "b", providerCode: "MISTICPAY", weight: 20 }),
  ];

  const first = evaluateRouting(context, candidates, "WEIGHTED");
  const second = evaluateRouting(context, candidates, "WEIGHTED");

  assert.equal(first.selected?.connectionId, second.selected?.connectionId);
});

test("health-aware prefers healthy route over degraded route", () => {
  const result = evaluateRouting(
    context,
    [
      route({ connectionId: "degraded", providerCode: "PIXGO", health: "DEGRADED", priority: 1, successRate: 0.99 }),
      route({ connectionId: "healthy", providerCode: "MISTICPAY", health: "HEALTHY", priority: 50, successRate: 0.95 }),
    ],
    "HEALTH_AWARE",
  );

  assert.equal(result.selected?.connectionId, "healthy");
});

test("cost-aware chooses lower cost among routes with equal health", () => {
  const result = evaluateRouting(
    context,
    [
      route({ connectionId: "expensive", providerCode: "PIXGO", costBps: 80 }),
      route({ connectionId: "cheap", providerCode: "MISTICPAY", costBps: 35 }),
    ],
    "COST_AWARE",
  );

  assert.equal(result.selected?.connectionId, "cheap");
});
