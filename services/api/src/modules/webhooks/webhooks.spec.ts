import { strict as assert } from "node:assert";
import { test } from "node:test";
import { WebhooksService } from "./webhooks.service";

test("MisticPay webhook is S2S verified and stored without payer PII", async () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];

  const database = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });

      if (sql.includes("from pixbrasil.gateway_connections")) {
        return {
          rows: [
            {
              connection_id: "11111111-1111-1111-1111-111111111111",
              decrypted_secret: JSON.stringify({
                clientId: "pk_test",
                clientSecret: "sk_test",
              }),
            },
          ],
        };
      }

      if (sql.includes("insert into pixbrasil.provider_webhook_events")) {
        return { rows: [{ id: "22222222-2222-2222-2222-222222222222" }] };
      }

      return { rows: [] };
    },
  };

  const providers = {
    get() {
      return {
        async verifyWebhook() {
          return { transaction: { transactionState: "COMPLETO" } };
        },
        mapProviderStatus() {
          return "SUCCEEDED";
        },
      };
    },
  };

  const merchantWebhooks = {
    async deliverPaymentEvent() {
      return undefined;
    },
  };

  const financialCore = {
    async finalizeSuccessfulPayment() {
      return undefined;
    },
  };

  const service = new WebhooksService(
    database as never,
    providers as never,
    merchantWebhooks as never,
    financialCore as never,
  );

  const result = await service.handleMisticPay(
    {
      transactionId: 31484480,
      transactionType: "DEPOSITO",
      transactionMethod: "PIX",
      status: "COMPLETO",
      value: 455,
      fee: 23,
      e2e: "E2E123",
      ispb: "18236120",
      bankName: "BANK",
      clientName: "Sensitive Name",
      clientDocument: "52998224725",
    } as never,
    {},
  );

  assert.equal(result.success, true);
  assert.equal(result.verifiedStatus, "SUCCEEDED");

  const insert = queries.find((entry) =>
    entry.sql.includes("insert into pixbrasil.provider_webhook_events"),
  );
  assert.ok(insert);
  const persistedPayload = JSON.parse(String(insert.params[4]));
  assert.equal(persistedPayload.transactionId, "31484480");
  assert.equal("clientName" in persistedPayload, false);
  assert.equal("clientDocument" in persistedPayload, false);
  assert.match(insert.sql, /'RECEIVED'/);
});

test("replayed successful provider webhook still finalizes finance and merchant delivery", async () => {
  let finalized = 0;
  let delivered = 0;

  const database = {
    async query(sql: string) {
      if (sql.includes("from pixbrasil.gateway_connections")) {
        return {
          rows: [
            {
              connection_id: "11111111-1111-1111-1111-111111111111",
              decrypted_secret: JSON.stringify({
                clientId: "pk_test",
                clientSecret: "sk_test",
              }),
            },
          ],
        };
      }

      if (sql.includes("insert into pixbrasil.provider_webhook_events")) {
        return { rows: [] };
      }

      if (
        sql.includes("select id") &&
        sql.includes("from pixbrasil.provider_webhook_events")
      ) {
        return {
          rows: [{ id: "22222222-2222-2222-2222-222222222222" }],
        };
      }

      if (sql.includes("with matched_attempt as")) {
        return {
          rows: [
            {
              payment_intent_id: "33333333-3333-3333-3333-333333333333",
              merchant_id: "44444444-4444-4444-4444-444444444444",
              reference: "ORDER-1",
              amount: "10.00",
              currency: "BRL",
              status: "SUCCEEDED",
              store_code: "SIGNUM",
              completed_at: new Date().toISOString(),
              merchant_metadata: {},
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const providers = {
    get() {
      return {
        async verifyWebhook() {
          return { transaction: { transactionState: "COMPLETO" } };
        },
        mapProviderStatus() {
          return "SUCCEEDED";
        },
      };
    },
  };

  const merchantWebhooks = {
    async deliverPaymentEvent() {
      delivered += 1;
    },
  };

  const financialCore = {
    async finalizeSuccessfulPayment() {
      finalized += 1;
      return { settlementId: "settlement-1" };
    },
  };

  const service = new WebhooksService(
    database as never,
    providers as never,
    merchantWebhooks as never,
    financialCore as never,
  );

  const result = await service.handleMisticPay(
    {
      transactionId: 31484480,
      transactionType: "DEPOSITO",
      transactionMethod: "PIX",
      status: "COMPLETO",
    },
    {},
  );

  assert.equal(result.replay, true);
  assert.equal(finalized, 1);
  assert.equal(delivered, 1);
});
