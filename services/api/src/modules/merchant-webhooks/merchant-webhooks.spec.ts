import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MerchantWebhooksService } from "./merchant-webhooks.service";

test("merchant payment webhook is deduplicated after successful delivery", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  let deliveryInsertCalls = 0;
  let firstDeliveryBody = "";

  globalThis.fetch = (async (_input, init) => {
    fetchCalls += 1;
    if (!firstDeliveryBody) firstDeliveryBody = String(init?.body ?? "");
    return new Response("", { status: 200 });
  }) as typeof fetch;

  const endpoint = {
    id: "11111111-1111-1111-1111-111111111111",
    merchant_id: "22222222-2222-2222-2222-222222222222",
    name: "Production",
    endpoint_url: "https://8.8.8.8/hook",
    events: ["payment.succeeded"],
    status: "ACTIVE",
    failure_count: 0,
    last_delivery_at: null,
    last_error: null,
    created_at: new Date().toISOString(),
    decrypted_secret: "whsec_test_secret",
  };

  const database = {
    async query(sql: string) {
      if (
        sql.includes("from pixbrasil.merchant_webhook_endpoints e") &&
        sql.includes("$2::text = any(e.events)")
      ) {
        return { rows: [endpoint] };
      }

      if (sql.includes("insert into pixbrasil.merchant_webhook_deliveries")) {
        deliveryInsertCalls += 1;
        return deliveryInsertCalls === 1
          ? { rows: [{ id: "33333333-3333-3333-3333-333333333333" }] }
          : { rows: [] };
      }

      if (
        sql.includes("from pixbrasil.merchant_webhook_deliveries") &&
        sql.includes("payment_intent_id")
      ) {
        return {
          rows: [
            {
              id: "33333333-3333-3333-3333-333333333333",
              status: "DELIVERED",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  try {
    const service = new MerchantWebhooksService(database as never);
    const payment = {
      paymentIntentId: "44444444-4444-4444-4444-444444444444",
      merchantId: endpoint.merchant_id,
      reference: "ORDER-1",
      amount: 10,
      currency: "BRL",
      status: "SUCCEEDED",
      storeCode: "SIGNUM",
      providerCode: "MISTICPAY",
      providerPaymentId: "provider-1",
      completedAt: new Date().toISOString(),
      metadata: {},
    };

    await service.deliverPaymentEvent("payment.succeeded", payment);
    await service.deliverPaymentEvent("payment.succeeded", payment);

    assert.equal(fetchCalls, 1);
    assert.equal(deliveryInsertCalls, 2);

    const delivered = JSON.parse(firstDeliveryBody) as {
      data?: Record<string, unknown>;
    };
    const serialized = JSON.stringify(delivered);
    assert.equal(serialized.includes("MISTICPAY"), false);
    assert.equal(serialized.includes("provider-1"), false);
    assert.equal(Object.hasOwn(delivered.data ?? {}, "provider"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
