import { strict as assert } from "node:assert";
import { test } from "node:test";
import { FinancialCoreService } from "./financial-core.service";

test("Telegram payout notification masks PIX key and links to Admin ticket", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_PAYOUT_CHAT_ID;
  let sentBody = "";

  process.env.TELEGRAM_BOT_TOKEN = "bot_test";
  process.env.TELEGRAM_PAYOUT_CHAT_ID = "chat_test";

  globalThis.fetch = (async (_input, init) => {
    sentBody = String(init?.body ?? "");
    return new Response(
      JSON.stringify({ ok: true, result: { message_id: 42 } }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const service = new FinancialCoreService({} as never);
    const notify = (
      service as unknown as {
        notifyTelegramPayout(input: {
          payoutId: string;
          accountId: string;
          amount: number;
          email: string;
          pixKey: string;
          note: string;
        }): Promise<{ status: string }>;
      }
    ).notifyTelegramPayout.bind(service);

    const fullPixKey = "merchant.finance@example.com";
    const result = await notify({
      payoutId: "11111111-1111-1111-1111-111111111111",
      accountId: "22222222-2222-2222-2222-222222222222",
      amount: 125.5,
      email: "finance@example.com",
      pixKey: fullPixKey,
      note: "Pagamento operacional",
    });

    const payload = JSON.parse(sentBody) as { text?: string };
    assert.equal(result.status, "DELIVERED");
    assert.ok(payload.text);
    assert.equal(payload.text!.includes(fullPixKey), false);
    assert.match(payload.text!, /mer••••••.com/);
    assert.equal(
      payload.text!.includes("https://admin.pixbrasil.org/payouts?ticket="),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;

    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;

    if (originalChatId === undefined) delete process.env.TELEGRAM_PAYOUT_CHAT_ID;
    else process.env.TELEGRAM_PAYOUT_CHAT_ID = originalChatId;
  }
});
