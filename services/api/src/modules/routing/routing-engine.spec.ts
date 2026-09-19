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
  accountType: "BUSINESS",
  accountTier: "STANDARD",
  amount: 100,
  currency: "BRL",
  paymentMethod: "PIX",
  policyId: "policy-1",
  policyVersion: 3,
  environment: "PRODUCTION",
  riskLevel: "LOW",
};

function route(
  patch: Partial<RouteCandidate> &
    Pick<RouteCandidate, "connectionId" | "providerCode">,
): RouteCandidate {
  return {
    priority: 100,
    weight: 1,
    health: "HEALTHY",
    enabled: true,
    ...patch,
  };
}

test("filters amount, tier, account type, health and volume constraints", () => {
  const result = evaluateRouting(
    context,
    [
      route({ connectionId: "ok", providerCode: "PIXGO" }),
      route({ connectionId: "down", providerCode: "MISTICPAY", health: "DOWN" }),
      route({
        connectionId: "tier",
        providerCode: "MISTICPAY",
        allowedTiers: ["ENTERPRISE"],
      }),
      route({
        connectionId: "type",
        providerCode: "PIXGO",
        allowedAccountTypes: ["INDIVIDUAL"],
      }),
      route({ connectionId: "min", providerCode: "PIXGO", minAmount: 200 }),
      route({
        connectionId: "daily-cap",
        providerCode: "PIXGO",
        dailyVolumeCap: 1000,
        dailyVolumeAssigned: 950,
      }),
      route({
        connectionId: "monthly-cap",
        providerCode: "MISTICPAY",
        monthlyVolumeCap: 5000,
        monthlyVolumeAssigned: 4950,
      }),
    ],
    "PRIORITY_FAILOVER",
  );

  assert.equal(result.eligible.length, 1);
  assert.equal(result.selected?.connectionId, "ok");
  assert.deepEqual(
    new Set(result.rejected.map((entry) => entry.reason)),
    new Set([
      "PROVIDER_DOWN",
      "TIER_NOT_ALLOWED",
      "ACCOUNT_TYPE_NOT_ALLOWED",
      "BELOW_MIN_AMOUNT",
      "DAILY_VOLUME_CAP",
      "MONTHLY_VOLUME_CAP",
    ]),
  );
});


test("filters provider/account state, capability, environment, risk and telemetry thresholds", () => {
  const result = evaluateRouting(
    context,
    [
      route({ connectionId: "ok", providerCode: "PIXGO", environment: "PRODUCTION", supportsPixBrl: true }),
      route({ connectionId: "provider-disabled", providerCode: "PIXGO", providerStatus: "DISABLED" }),
      route({ connectionId: "account-disabled", providerCode: "MISTICPAY", providerAccountStatus: "DISABLED" }),
      route({ connectionId: "capability", providerCode: "PIXGO", supportsPixBrl: false }),
      route({ connectionId: "environment", providerCode: "PIXGO", environment: "SANDBOX" }),
      route({ connectionId: "risk", providerCode: "MISTICPAY", allowedRiskLevels: ["MEDIUM"] }),
      route({ connectionId: "error-rate", providerCode: "PIXGO", errorRate: 0.12, maxErrorRate: 0.05 }),
      route({ connectionId: "latency", providerCode: "MISTICPAY", p95LatencyMs: 1800, maxP95LatencyMs: 1200 }),
      route({ connectionId: "tags", providerCode: "PIXGO", tags: ["business"], requiredTags: ["enterprise"] }),
    ],
    "RULES",
  );

  assert.equal(result.selected?.connectionId, "ok");
  assert.deepEqual(
    new Set(result.rejected.map((entry) => entry.reason)),
    new Set([
      "PROVIDER_DISABLED",
      "PROVIDER_ACCOUNT_DISABLED",
      "CAPABILITY_NOT_SUPPORTED",
      "ENVIRONMENT_MISMATCH",
      "RISK_LEVEL_NOT_ALLOWED",
      "ERROR_RATE_LIMIT",
      "LATENCY_LIMIT",
      "REQUIRED_TAG_MISSING",
    ]),
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

test("weighted routing is sticky for the same payment and policy version", () => {
  const candidates = [
    route({ connectionId: "a", providerCode: "PIXGO", weight: 80 }),
    route({ connectionId: "b", providerCode: "MISTICPAY", weight: 20 }),
  ];

  const first = evaluateRouting(context, candidates, "WEIGHTED");
  const second = evaluateRouting(context, candidates, "WEIGHTED");

  assert.equal(first.selected?.connectionId, second.selected?.connectionId);
});

test("volume split chooses the least filled weighted route", () => {
  const result = evaluateRouting(
    context,
    [
      route({
        connectionId: "pixgo",
        providerCode: "PIXGO",
        weight: 70,
        dailyVolumeAssigned: 7000,
      }),
      route({
        connectionId: "mistic",
        providerCode: "MISTICPAY",
        weight: 30,
        dailyVolumeAssigned: 1500,
      }),
    ],
    "VOLUME_SPLIT",
  );

  assert.equal(result.selected?.connectionId, "mistic");
});

test("health-aware prefers healthy route over degraded route", () => {
  const result = evaluateRouting(
    context,
    [
      route({
        connectionId: "degraded",
        providerCode: "PIXGO",
        health: "DEGRADED",
        priority: 1,
        successRate: 0.99,
      }),
      route({
        connectionId: "healthy",
        providerCode: "MISTICPAY",
        health: "HEALTHY",
        priority: 50,
        successRate: 0.95,
      }),
    ],
    "HEALTH_AWARE",
  );

  assert.equal(result.selected?.connectionId, "healthy");
});

test("cost-aware combines fixed and bps cost", () => {
  const result = evaluateRouting(
    { ...context, amount: 1000 },
    [
      route({
        connectionId: "low-bps-high-fixed",
        providerCode: "PIXGO",
        costBps: 10,
        fixedCost: 10,
      }),
      route({
        connectionId: "higher-bps-low-fixed",
        providerCode: "MISTICPAY",
        costBps: 35,
        fixedCost: 0,
      }),
    ],
    "COST_AWARE",
  );

  assert.equal(result.selected?.connectionId, "higher-bps-low-fixed");
});
