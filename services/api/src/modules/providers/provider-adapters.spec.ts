import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
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

test("MisticPay creates charge using access-key Basic auth and PiXBrasil paymentIntentId", async () => {
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
    clientId: "pk_test",
    clientSecret: "sk_test",
    baseUrl: "https://mistic.test/api",
  });

  assert.equal(result.kind, "CREATED");
  assert.equal(
    seenHeaders?.get("Authorization"),
    "Basic " + Buffer.from("pk_test:sk_test").toString("base64"),
  );
  assert.equal(seenHeaders?.get("ci"), null);
  assert.equal(seenHeaders?.get("cs"), null);
  assert.equal(seenBody.transactionId, input.paymentIntentId);
});

test("MisticPay network failure is ambiguous and not safe for blind failover", async () => {
  const mockFetch = (async () => {
    throw new Error("timeout");
  }) as typeof fetch;

  const adapter = new MisticPayAdapter(mockFetch);
  const result = await adapter.createCharge(input, {
    clientId: "pk_test",
    clientSecret: "sk_test",
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
    {
      clientId: "pk_test",
      clientSecret: "sk_test",
      baseUrl: "https://mistic.test/api",
    },
  );

  assert.equal(seenPath, "https://mistic.test/api/transactions/check");
  assert.equal(seenBody.transactionId, "mistic-transaction-1");
  assert.equal(adapter.mapProviderStatus(verified), "SUCCEEDED");
});


test("MisticPay health check uses harmless account info endpoint", async () => {
  let seenUrl = "";
  let seenAuthorization = "";

  const mockFetch = (async (
    resource: string | URL | Request,
    init?: RequestInit,
  ) => {
    seenUrl = String(resource);
    seenAuthorization = new Headers(init?.headers).get("Authorization") ?? "";
    return jsonResponse({
      name: "PiXBrasil",
      accountVerified: true,
    });
  }) as typeof fetch;

  const adapter = new MisticPayAdapter(mockFetch);
  const result = await adapter.healthCheck({
    clientId: "pk_test",
    clientSecret: "sk_test",
    baseUrl: "https://mistic.test/api",
  });

  assert.equal(result.status, "HEALTHY");
  assert.equal(seenUrl, "https://mistic.test/api/users/info");
  assert.equal(
    seenAuthorization,
    "Basic " + Buffer.from("pk_test:sk_test").toString("base64"),
  );
});

test("PixGo health check performs a non-creating external_id search", async () => {
  let seenUrl = "";

  const mockFetch = (async (resource: string | URL | Request) => {
    seenUrl = String(resource);
    return jsonResponse({ success: true, data: [], total: 0 });
  }) as typeof fetch;

  const adapter = new PixGoAdapter(mockFetch);
  const result = await adapter.healthCheck({
    apiKey: "pk_test",
    baseUrl: "https://pixgo.test/api/v1",
  });

  assert.equal(result.status, "HEALTHY");
  assert.match(seenUrl, /external_id=__pixbrasil_healthcheck__/);
});


test("PixGo webhook requires a valid raw-body HMAC before S2S confirmation", async () => {
  const payload = {
    event: "payment.completed",
    data: { payment_id: "pixgo-payment-1" },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const webhookSecret = "whsec_test";
  const signature = createHmac("sha256", webhookSecret)
    .update(timestamp + "." + rawBody.toString("utf8"))
    .digest("hex");

  const mockFetch = (async () =>
    jsonResponse({
      data: {
        payment_id: "pixgo-payment-1",
        status: "completed",
      },
    })) as typeof fetch;

  const adapter = new PixGoAdapter(mockFetch);
  const verified = await adapter.verifyWebhook(
    payload,
    {
      "x-webhook-timestamp": timestamp,
      "x-webhook-signature": signature,
    },
    {
      apiKey: "pk_test",
      webhookSecret,
      baseUrl: "https://pixgo.test/api/v1",
    },
    rawBody,
  );

  assert.equal(adapter.mapProviderStatus(verified), "SUCCEEDED");
});

test("PixGo webhook rejects a bad HMAC", async () => {
  const payload = {
    event: "payment.completed",
    data: { payment_id: "pixgo-payment-1" },
  };
  const rawBody = Buffer.from(JSON.stringify(payload));

  const adapter = new PixGoAdapter(
    (async () => jsonResponse({})) as typeof fetch,
  );

  await assert.rejects(
    () =>
      adapter.verifyWebhook(
        payload,
        {
          "x-webhook-timestamp": String(Math.floor(Date.now() / 1000)),
          "x-webhook-signature": "00".repeat(32),
        },
        {
          apiKey: "pk_test",
          webhookSecret: "whsec_test",
        },
        rawBody,
      ),
    /PIXGO_WEBHOOK_SIGNATURE_INVALID/,
  );
});
