import { expect, test } from "@playwright/test";

test("landing publica carrega sem links vazios e sem overflow horizontal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Entrada via PIX/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir conta/i })).toHaveAttribute("href", "/early-access");
  expect(await page.locator('a[href="#"]').count()).toBe(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});

test("rotas publicas e legais essenciais respondem", async ({ page }) => {
  for (const path of ["/personal","/business","/pricing","/how-it-works","/support","/legal/terms","/legal/privacy","/legal/regulatory-status"]) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBeTruthy();
  }
});

test("health endpoint e web-only", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({ success: true, service: "PiXBrasil Web", component: "landing", status: "ONLINE" });
});
