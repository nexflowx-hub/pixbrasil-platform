import { expect, test, type Page } from "@playwright/test";

const accountId = "11111111-1111-1111-1111-111111111111";

const session = {
  success: true,
  data: {
    email: "finance@example.com",
    userStatus: "ACTIVE",
    aal: "aal2",
    accounts: [
      {
        accountId,
        accountType: "BUSINESS",
        accountStatus: "ACTIVE",
        kycStatus: "VERIFIED",
        role: "OWNER",
        baseCurrency: "BRL",
        merchant: {
          merchant_id: "22222222-2222-2222-2222-222222222222",
          trade_name: "Novidades.Store",
          tier_code: "BUSINESS",
          merchant_status: "ACTIVE",
        },
      },
    ],
  },
};

const cashflow = Array.from({ length: 30 }, (_, index) => ({
  day: new Date(Date.UTC(2026, 7, 23 + index)).toISOString().slice(0, 10),
  incoming_brl: String(index % 4 === 0 ? 1490 + index * 20 : 490 + index * 11),
  outgoing_brl: String(index % 7 === 0 ? 300 + index * 5 : 0),
}));

const overview = {
  success: true,
  data: {
    accessRole: "OWNER",
    account: {
      id: accountId,
      type: "BUSINESS",
      status: "ACTIVE",
      kyc_status: "VERIFIED",
      identity_level: "BUSINESS",
      base_currency: "BRL",
      pricing_plan_code: "BUSINESS",
      policy_profile_code: "STANDARD",
    },
    wallets: [
      {
        wallet_id: "33333333-3333-3333-3333-333333333333",
        wallet_status: "ACTIVE",
        asset_code: "BRL",
        symbol: "BRL",
        asset_name: "Real brasileiro",
        asset_type: "FIAT",
        network: "INTERNAL",
        decimals: 2,
        available: "48720.50",
        pending: "12840.00",
        reserved: "3200.00",
        blocked: "0",
      },
    ],
    transactions: [],
    business: {
      merchant: {
        merchant_id: "22222222-2222-2222-2222-222222222222",
        trade_name: "Novidades.Store",
        merchant_status: "ACTIVE",
        tier_code: "BUSINESS",
      },
      summary: {
        availableBrl: 48720.5,
        pendingBrl: 12840,
        reservedBrl: 3200,
        blockedBrl: 0,
      },
      stores: [
        {
          id: "40000000-0000-0000-0000-000000000001",
          code: "SIGNUM",
          name: "Signum",
          status: "ACTIVE",
          currency: "BRL",
          release_profile: "PIX_D0",
          release_class: "D0",
          available_brl: "1320.00",
          pending_brl: "2480.00",
          total_net_brl: "3800.00",
          next_available_at: "2026-09-22T19:20:00-03:00",
        },
        {
          id: "40000000-0000-0000-0000-000000000002",
          code: "AUTOHUB360",
          name: "AutoHub360",
          status: "ACTIVE",
          currency: "BRL",
          release_profile: "PIX_D0",
          release_class: "D0",
          available_brl: "3420.00",
          pending_brl: "0",
          total_net_brl: "3420.00",
          next_available_at: null,
        },
        {
          id: "40000000-0000-0000-0000-000000000003",
          code: "MYPETS-ONG",
          name: "MyPets ONG",
          status: "ACTIVE",
          currency: "BRL",
          release_profile: "PIX_D1",
          release_class: "D1",
          available_brl: "320.00",
          pending_brl: "2560.00",
          total_net_brl: "2880.00",
          next_available_at: "2026-09-23T09:00:00-03:00",
        },
      ],
      payments: [
        {
          id: "50000000-0000-0000-0000-000000000001",
          external_reference: "ORDER-SIGNUM-001",
          amount: "49.90",
          currency: "BRL",
          status: "SUCCEEDED",
          payment_method: "PIX",
          store_code: "SIGNUM",
          created_at: "2026-09-22T18:42:00-03:00",
          updated_at: "2026-09-22T18:43:00-03:00",
          completed_at: "2026-09-22T18:43:00-03:00",
        },
      ],
      payouts: [],
      settlements: [
        {
          id: "60000000-0000-0000-0000-000000000001",
          external_reference: "ORDER-SIGNUM-001",
          store_code: "SIGNUM",
          gross_brl: "49.90",
          fees_brl: "1.99",
          net_brl: "47.91",
          status: "AVAILABLE",
          available_at: "2026-09-22T18:44:00-03:00",
          created_at: "2026-09-22T18:43:00-03:00",
        },
      ],
      operations: {
        pixStatus: "OPERATIONAL",
        payments30d: 281,
        successful30d: 277,
        successRate30d: "98.58",
      },
      cashflow,
    },
    capabilities: {
      financialWritesEnabled: true,
      depositsEnabled: true,
      withdrawalsEnabled: true,
      exchangeEnabled: false,
      payoutsEnabled: true,
    },
  },
};

async function mockBusiness(page: Page) {
  await page.route("**/api/client/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(session),
    });
  });
  await page.route("**/api/client/accounts/*/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(overview),
    });
  });
  await page.route("**/api/client/accounts/*/developer", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { apiKeys: [], webhooks: [] },
      }),
    });
  });
}

test("Business dashboard mantém hierarquia premium e não expõe providers", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await mockBusiness(page);
  await page.goto("/app");

  await expect(page.getByRole("heading", { name: "Visão geral financeira" })).toBeVisible();
  await expect(page.getByText("Wallet BRL empresarial", { exact: false })).toBeVisible();
  await expect(page.getByText("Operação PIX", { exact: true })).toBeVisible();
  await expect(page.getByText("API Keys & Webhooks", { exact: true })).toBeVisible();

  const body = await page.locator("body").innerText();
  for (const forbidden of [
    "MisticPay",
    "PixGo",
    "MISTICPAY",
    "PIXGO",
    "provider",
    "gateway",
  ]) {
    expect(body.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }

  const sidebar = await page.locator("aside").first().boundingBox();
  const topbar = await page.locator("header").first().boundingBox();
  const wallet = await page
    .getByText("Wallet BRL empresarial", { exact: false })
    .locator("xpath=ancestor::article[1]")
    .boundingBox();
  const pending = await page.getByRole("button", { name: /A liberar/i }).boundingBox();

  expect(sidebar?.width ?? 0).toBeGreaterThanOrEqual(248);
  expect(sidebar?.width ?? 999).toBeLessThanOrEqual(256);
  expect(topbar?.height ?? 0).toBeGreaterThanOrEqual(66);
  expect(topbar?.height ?? 999).toBeLessThanOrEqual(72);
  expect(wallet?.width ?? 0).toBeGreaterThan(450);
  expect(pending?.width ?? 0).toBeGreaterThan(160);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test("Business dashboard mobile não cria overflow e mantém navegação acessível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBusiness(page);
  await page.goto("/app");

  await expect(page.getByRole("heading", { name: "Visão geral financeira" })).toBeVisible();
  const menu = page.getByRole("button", { name: "Abrir menu" });
  await expect(menu).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);

  await menu.click();
  await expect(page.getByRole("button", { name: "Fechar menu" }).last()).toBeVisible();
  await expect(page.locator("aside").last()).toBeVisible();
});


test("Terminal móvel abre como POS e mantém infraestrutura interna invisível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBusiness(page);
  await page.goto("/terminal");

  await expect(page.getByRole("heading", { name: "Terminal PIX" })).toBeVisible();
  await expect(page.getByText("Cobrança presencial", { exact: true })).toBeVisible();
  await expect(page.getByText("Signum", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cobrar agora" })).toBeVisible();

  const body = (await page.locator("body").innerText()).toLowerCase();
  for (const forbidden of ["misticpay", "pixgo", "provider", "gateway"]) {
    expect(body).not.toContain(forbidden);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});
