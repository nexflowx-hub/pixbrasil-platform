import { expect, test } from "@playwright/test";

test("landing publica carrega sem links vazios e sem overflow horizontal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Entrada via PIX/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Abrir conta/i })).toHaveAttribute("href", "/early-access");
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
      .filter((entry) => entry.widthOverflow > 2 || entry.heightOverflow > 2),
  );

  expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
});

test("conteudo textual dos cards permanece dentro dos limites visuais", async ({ page }) => {
  await page.goto("/");

  const issues = await page.locator("[data-layout-guard]").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const cardRect = card.getBoundingClientRect();
      return Array.from(card.querySelectorAll("[data-text-safe]"))
        .filter((node) => (node.textContent ?? "").trim().length > 0)
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return {
            kind: (card as HTMLElement).dataset.layoutGuard ?? "unknown",
            text: (node.textContent ?? "").trim().slice(0, 100),
            left: rect.left - cardRect.left,
            right: rect.right - cardRect.right,
            top: rect.top - cardRect.top,
            bottom: rect.bottom - cardRect.bottom,
          };
        })
        .filter((entry) => entry.left < -2 || entry.right > 2 || entry.top < -2 || entry.bottom > 2);
    }),
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
    start_url: "/app?source=pwa",
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

test("app demo instalado abre em rota dedicada e sem operacoes reais", async ({ page }) => {
  const response = await page.goto("/app?source=pwa");
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText("Modo demonstração")).toBeVisible();
  await expect(page.getByText(/operações financeiras desativadas/i)).toBeVisible();
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

test("captura visual da landing para auditoria responsiva", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("landing-audit.png"),
    fullPage: true,
    animations: "disabled",
  });
});
