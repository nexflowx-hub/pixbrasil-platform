import { expect, test } from "@playwright/test";

test("landing publica carrega sem links vazios e sem overflow horizontal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Entrada via PIX/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Solicitar acesso/i })).toHaveAttribute("href", "/early-access");
  expect(await page.locator('a[href="#"]').count()).toBe(0);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test("cards criticos nao deixam texto escapar do container", async ({ page }) => {
  await page.goto("/");

  const issues = await page.locator("[data-layout-guard]").evaluateAll((elements) =>
    elements
      .map((element) => {
        const node = element as HTMLElement;
        return {
          kind: node.dataset.layoutGuard ?? "unknown",
          widthOverflow: node.scrollWidth - node.clientWidth,
          heightOverflow: node.scrollHeight - node.clientHeight,
          text: node.innerText.replace(/\s+/g, " ").trim().slice(0, 120),
        };
      })
      .filter((entry) => entry.widthOverflow > 2),
  );

  expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
});

test("PWA manifest e service worker estao publicamente disponiveis", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();

  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    short_name: "PiXBrasil",
    display: "standalone",
    scope: "/",
  });
  expect(Array.isArray(manifest.icons)).toBeTruthy();
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

  const swResponse = await request.get("/sw.js");
  expect(swResponse.ok()).toBeTruthy();
  const sw = await swResponse.text();
  expect(sw).toContain("pixbrasil-public-v1");
  expect(sw).toContain("/icons/");
  expect(sw).not.toContain('url.pathname.startsWith("/api/")');
});

test("rotas publicas e legais essenciais respondem", async ({ page }) => {
  for (const path of [
    "/personal",
    "/business",
    "/pricing",
    "/how-it-works",
    "/support",
    "/legal/terms",
    "/legal/privacy",
    "/legal/regulatory-status",
  ]) {
    const response = await page.goto(path);
    expect(response?.ok(), path).toBeTruthy();
  }
});

test("health endpoint e web-only", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({
    success: true,
    service: "PiXBrasil Web",
    component: "landing",
    status: "ONLINE",
  });
});


test("client portal exige sessão e a tela de login é operacional", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Entrar no PiXBrasil/i })).toBeVisible();

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
});
