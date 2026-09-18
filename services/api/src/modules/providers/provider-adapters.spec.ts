import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { PixCreateChargeInput } from "./provider-adapter";
import { MisticPayAdapter } from "./misticpay.adapter";
import { PixGoAdapter } from "./pixgo.adapter";

const input: PixCreateChargeInput = {
  paymentIntentId: "pi_internal_001",
  externalReference: "ORDER-001",
  amount: "100.00",
  currency: "BRL",
  payer: {
    name: "Cliente Teste",
    taxId: "52998224725",
    email: "cliente@example.test",
    phone: "11999999999",
  },
  description: "Teste unitario",
  webhookUrl: "https://api.example.test/webhooks/pix",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("PixGo creates charge with expected auth and stable external id", async () => {
  let seenUrl = "";
  let seenHeaders: Headers | undefined;
  let seenBody: Record<string, unknown> = {};

  const mockFetch = (async (resource: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(resource);
    seenHeaders = new Headers(init?.headers);
    seenBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return jsonResponse(
      {
        data: {
          payment_id: "pixgo-payment-1",
          external_id: input.paymentIntentId,
          qr_code: "000201PIXGO",
          status: "pending",
        },
      },
      201,
    );
  }) as typeof fetch;

  const adapter = new PixGoAdapter(mockFetch);
  const result = await adapter.createCharge(input, {
    apiKey: "test-key",
    baseUrl: "https://pixgo.test/api/v1",
  });

  assert.equal(result.kind, "CREATED");
  if (result.kind === "CREATED") {
    assert.equal(result.providerPaymentId, "pixgo-payment-1");
  }
  assert.equal(seenUrl, "https://pixgo.test/api/v1/payment/create");
  assert.equal(seenHeaders?.get("X-API-Key"), "test-key");
  assert.equal(seenBody.external_id, input.paymentIntentId);
});

test("PixGo network failure is ambiguous and requires recovery", async () => {
  const mockFetch = (async () => {
    throw new Error("socket reset");
  }) as typeof fetch;

  const adapter = new PixGoAdapter(mockFetch);
  const result = await adapter.createCharge(input, { apiKey: "test-key" });

  assert.equal(result.kind, "AMBIGUOUS");
  if (result.kind === "AMBIGUOUS") {
    assert.equal(result.requiresRecovery, true);
  }
});

test("PixGo recovers create by external_id", async () => {
  const mockFetch = (async () =>
    jsonResponse({
      data: [
        {
          payment_id: "pixgo-payment-existing",
          external_id: input.paymentIntentId,
          status: "pending",
        },
      ],
    })) as typeof fetch;

  const adapter = new PixGoAdapter(mockFetch);
  const result = await adapter.recoverCreate(input.paymentIntentId, {
    apiKey: "test-key",
  });

  assert.equal(result.kind, "FOUND");
  if (result.kind === "FOUND") {
    assert.equal(result.providerPaymentId, "pixgo-payment-existing");
  }
});

test("MisticPay creates charge using CI/CS and PiXBrasil paymentIntentId", async () => {
  let seenHeaders: Headers | undefined;
  let seenBody: Record<string, unknown> = {};

  const mockFetch = (async (_resource: string | URL | Request, init?: RequestInit) => {
    seenHeaders = new Headers(init?.headers);
    seenBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return jsonResponse({
      data: {
        transactionId: "mistic-transaction-1",
        copyPaste: "000201MISTIC",
        transactionState: "PENDENTE",
      },
    });
  }) as typeof fetch;

  const adapter = new MisticPayAdapter(mockFetch);
  const result = await adapter.createCharge(input, {
    ci: "ci-test",
    cs: "cs-test",
    baseUrl: "https://mistic.test/api",
  });

  assert.equal(result.kind, "CREATED");
  assert.equal(seenHeaders?.get("ci"), "ci-test");
  assert.equal(seenHeaders?.get("cs"), "cs-test");
  assert.equal(seenBody.transactionId, input.paymentIntentId);
});

test("MisticPay network failure is ambiguous and not safe for blind failover", async () => {
  const mockFetch = (async () => {
    throw new Error("timeout");
  }) as typeof fetch;

  const adapter = new MisticPayAdapter(mockFetch);
  const result = await adapter.createCharge(input, {
    ci: "ci-test",
    cs: "cs-test",
  });

  assert.equal(result.kind, "AMBIGUOUS");
});

test("MisticPay webhook verification rechecks transaction S2S", async () => {
  let seenPath = "";
  let seenBody: Record<string, unknown> = {};

  const mockFetch = (async (resource: string | URL | Request, init?: RequestInit) => {
    seenPath = String(resource);
    seenBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return jsonResponse({
      transaction: {
        transactionId: "mistic-transaction-1",
        transactionState: "COMPLETO",
        transactionType: "DEPOSITO",
        transactionMethod: "PIX",
      },
    });
  }) as typeof fetch;

  const adapter = new MisticPayAdapter(mockFetch);
  const verified = await adapter.verifyWebhook(
    { transactionId: "mistic-transaction-1" },
    {},
    { ci: "ci-test", cs: "cs-test", baseUrl: "https://mistic.test/api" },
  );

  assert.equal(seenPath, "https://mistic.test/api/transactions/check");
  assert.equal(seenBody.transactionId, "mistic-transaction-1");
  assert.equal(adapter.mapProviderStatus(verified), "SUCCEEDED");
});
