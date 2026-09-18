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


test("cards nao apresentam overflow textual nos breakpoints auditados", async ({ page }) => {
  await page.goto("/");

  const failures = await page.locator("[data-layout-card]").evaluateAll((cards) =>
    cards.flatMap((card, cardIndex) => {
      const nodes = [card, ...Array.from(card.querySelectorAll("p,span,li,h2,h3"))];
      return nodes
        .filter((node) => {
          const el = node as HTMLElement;
          const style = window.getComputedStyle(el);
          if (style.overflowX === "auto" || style.overflowX === "scroll") return false;
          return el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2;
        })
        .map((node) => ({
          cardIndex,
          tag: node.tagName,
          text: (node.textContent || "").trim().slice(0, 120),
          clientWidth: (node as HTMLElement).clientWidth,
          scrollWidth: (node as HTMLElement).scrollWidth,
        }));
    })
  );

  expect(failures).toEqual([]);
});


test("PWA possui manifest, service worker e offline shell", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.display).toBe("standalone");
  expect(body.icons.length).toBeGreaterThanOrEqual(3);

  expect((await request.get("/sw.js")).ok()).toBeTruthy();
  expect((await request.get("/offline")).ok()).toBeTruthy();

  await page.goto("/");
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestHref).toBeTruthy();
});
