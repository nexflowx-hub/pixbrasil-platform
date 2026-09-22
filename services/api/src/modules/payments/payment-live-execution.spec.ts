import { strict as assert } from "node:assert";
import { test } from "node:test";
import type {
  PixProviderAdapter,
  ProviderCapabilities,
} from "../providers/provider-adapter";
import { PaymentLiveExecutionService } from "./payment-live-execution.service";

const capabilities: ProviderCapabilities = {
  pixBrl: true,
  supportsIdempotencyKey: true,
  supportsRecoveryByExternalId: false,
  supportsWebhookSignature: true,
  supportsS2SVerification: true,
  supportsRefund: false,
};

const adapter: PixProviderAdapter = {
  code: "MISTICPAY",
  capabilities,
  createCharge: async () => ({
    kind: "CREATED",
    providerPaymentId: "provider-secret-payment-id",
    payload: {
      copyPaste: "000201010212...",
      qrCode: "data:image/png;base64,abc",
      expiresAt: "2026-09-22T04:00:00Z",
    },
  }),
  recoverCreate: async () => ({ kind: "UNKNOWN" }),
  getCharge: async () => ({}),
  verifyWebhook: async () => ({}),
  mapProviderStatus: () => "PENDING",
  healthCheck: async () => ({ status: "HEALTHY", latencyMs: 40 }),
};

test("merchant live charge response never exposes provider or routing internals", async () => {
  const database = {
    async query(sql: string) {
      if (sql.includes("select v.decrypted_secret")) {
        return { rows: [{ decrypted_secret: "{}" }] };
      }
      if (sql.includes("insert into pixbrasil.provider_attempts")) {
        return { rows: [{ id: "11111111-1111-1111-1111-111111111111" }] };
      }
      return { rows: [] };
    },
  };

  const registry = {
    get() {
      return adapter;
    },
  };

  const service = new PaymentLiveExecutionService(
    database as never,
    registry as never,
  );

  const result = await service.execute({
    paymentIntentId: "22222222-2222-2222-2222-222222222222",
    routingDecisionId: "33333333-3333-3333-3333-333333333333",
    connectionId: "44444444-4444-4444-4444-444444444444",
    providerCode: "MISTICPAY",
    gatewayAlias: "misticpay-primary",
    requestFingerprint: "fingerprint",
    reference: "ORDER-123",
    amount: 149.9,
    description: "Pedido",
    payer: {
      name: "Cliente",
      taxId: "52998224725",
    },
    store: {
      code: "SIGNUM",
      name: "Signum",
    },
    routing: {
      policy: "INTERNAL-POLICY",
      policyVersion: 7,
      releaseClass: "D0",
    },
    economics: {
      grossBrl: 149.9,
      providerRouteCostBrl: 8.99,
      platformFeeBrl: 0,
      estimatedMerchantNetBrl: 140.91,
      routeCostProfile: "INTERNAL-COST",
    },
    release: {
      profile: "INTERNAL-RELEASE",
      rules: [],
    },
  });

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("MISTICPAY"), false);
  assert.equal(serialized.includes("misticpay-primary"), false);
  assert.equal(serialized.includes("provider-secret-payment-id"), false);
  assert.equal(serialized.includes("INTERNAL-POLICY"), false);
  assert.equal(serialized.includes("INTERNAL-COST"), false);
  assert.equal(serialized.includes("providerRouteCostBrl"), false);

  assert.equal("routing" in result.data, false);
  assert.equal("provider" in result.data, false);
  assert.deepEqual(result.data.economics, {
    grossBrl: 149.9,
    processingFeeBrl: 8.99,
    estimatedMerchantNetBrl: 140.91,
  });
  assert.deepEqual(result.data.release, { class: "D0" });
});
