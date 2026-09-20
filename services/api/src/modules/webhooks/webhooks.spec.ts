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

  const settlements = {
    async postVerifiedPayment() {
      return null;
    },
  };

  const service = new WebhooksService(
    database as never,
    providers as never,
    merchantWebhooks as never,
    settlements as never,
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
});
