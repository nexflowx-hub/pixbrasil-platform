import { strict as assert } from "node:assert";
import { test } from "node:test";
import type {
  PixCreateChargeInput,
  PixProviderAdapter,
  ProviderCapabilities,
} from "../providers/provider-adapter";
import { executeProviderAttempt } from "./provider-execution";

const input: PixCreateChargeInput = {
  paymentIntentId: "pi_001",
  externalReference: "ORDER-001",
  amount: "100.00",
  currency: "BRL",
  payer: { name: "Cliente", taxId: "52998224725" },
  webhookUrl: "https://api.example.test/webhooks/pix",
};

const baseCapabilities: ProviderCapabilities = {
  pixBrl: true,
  supportsIdempotencyKey: false,
  supportsRecoveryByExternalId: false,
  supportsWebhookSignature: false,
  supportsS2SVerification: true,
  supportsRefund: false,
};

function adapter(
  patch: Partial<PixProviderAdapter>,
  capabilities: Partial<ProviderCapabilities> = {},
): PixProviderAdapter {
  return {
    code: "TEST",
    capabilities: { ...baseCapabilities, ...capabilities },
    createCharge: async () => ({
      kind: "CREATED",
      providerPaymentId: "provider-1",
      payload: {},
    }),
    recoverCreate: async () => ({ kind: "UNKNOWN" }),
    getCharge: async () => ({}),
    verifyWebhook: async () => ({}),
    mapProviderStatus: () => "PENDING",
    healthCheck: async () => ({ status: "HEALTHY", latencyMs: 1 }),
    ...patch,
  };
}

test("created provider attempt completes without failover", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter({}),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "CREATED");
  if (result.kind === "CREATED") {
    assert.equal(result.recovered, false);
  }
});

test("explicit provider unavailable allows safe failover", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter({
      createCharge: async () => ({
        kind: "UNAVAILABLE",
        message: "provider maintenance",
        retriable: true,
      }),
    }),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "SAFE_FAILOVER_ALLOWED");
});

test("final rejection does not become cross-provider retry", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter({
      createCharge: async () => ({
        kind: "REJECTED",
        code: "INVALID_PAYER",
        message: "invalid payer",
        retriable: false,
      }),
    }),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "FINAL_REJECTION");
});

test("ambiguous create without recovery capability requires reconciliation", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter({
      createCharge: async () => ({
        kind: "AMBIGUOUS",
        message: "timeout after send",
        requiresRecovery: true,
      }),
    }),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "RECONCILIATION_REQUIRED");
});

test("ambiguous create recovered as found is treated as created", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter(
      {
        createCharge: async () => ({
          kind: "AMBIGUOUS",
          requiresRecovery: true,
        }),
        recoverCreate: async () => ({
          kind: "FOUND",
          providerPaymentId: "recovered-1",
          payload: { status: "pending" },
        }),
      },
      { supportsRecoveryByExternalId: true },
    ),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "CREATED");
  if (result.kind === "CREATED") {
    assert.equal(result.recovered, true);
    assert.equal(result.providerPaymentId, "recovered-1");
  }
});

test("ambiguous create recovered as not found allows failover", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter(
      {
        createCharge: async () => ({
          kind: "AMBIGUOUS",
          requiresRecovery: true,
        }),
        recoverCreate: async () => ({ kind: "NOT_FOUND" }),
      },
      { supportsRecoveryByExternalId: true },
    ),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "SAFE_FAILOVER_ALLOWED");
});

test("ambiguous create with unknown recovery remains reconciliation", async () => {
  const result = await executeProviderAttempt({
    adapter: adapter(
      {
        createCharge: async () => ({
          kind: "AMBIGUOUS",
          requiresRecovery: true,
        }),
        recoverCreate: async () => ({
          kind: "UNKNOWN",
          message: "provider lookup unavailable",
        }),
      },
      { supportsRecoveryByExternalId: true },
    ),
    input,
    credentials: {},
    recoveryReference: input.paymentIntentId,
  });

  assert.equal(result.kind, "RECONCILIATION_REQUIRED");
});
