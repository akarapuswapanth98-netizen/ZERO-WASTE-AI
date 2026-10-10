import { expect, test } from "@playwright/test";

const ALLOWED = new Set([
  "/api/health",
  "/api/inventory",
  "/api/recommendations",
  "/api/forecast",
]);

function apiPaths(requests: string[]): string[] {
  return requests.map((u) => new URL(u).pathname).filter((p) => p.startsWith("/api/"));
}

test.describe("landing", () => {
  test("desktop: canvas, copy, CTAs, live stats, zero console errors", async ({ page }) => {
    const errors: string[] = [];
    const seen: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    page.on("request", (r) => {
      if (r.url().includes("/api/")) seen.push(r.url());
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ZeroWaste AI" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Agentic Intelligence for Smarter Grocery Inventory")).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(/Live from the demo/, { exact: false })).toBeVisible();
    await expect(page.getByText(/Demo Mode/, { exact: false }).first()).toBeVisible();
    for (const p of apiPaths(seen)) expect(ALLOWED.has(p.split("?")[0]), `non-allowlisted ${p}`).toBe(true);
    expect(errors, errors.join("\n")).toEqual([]);
    const draws = await page.evaluate(() => (window as unknown as { __r3f_landing?: { calls: number } }).__r3f_landing?.calls ?? 0);
    console.log(`LANDING-DRAW-CALLS: ${draws}`);
    expect(draws).toBeLessThanOrEqual(150);
    await page.getByRole("link", { name: "Enter app" }).first().click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByText(/Pending approvals/, { exact: false }).first()).toBeVisible({ timeout: 60000 });
  });

  test("mobile 360px: static fallback, identical copy and CTAs", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ZeroWaste AI" })).toBeVisible({ timeout: 30000 });
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Enter app" }).first()).toBeVisible();
  });

  test("webgl disabled: fallback, no errors", async ({ page }) => {
    await page.addInitScript(() => {
      (window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext = () => null;
    });
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 200));
    });
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ZeroWaste AI" })).toBeVisible({ timeout: 30000 });
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Enter app" }).first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("renders without the scroll scene", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "ZeroWaste AI" })).toBeVisible({ timeout: 30000 });
      await expect(page.getByRole("link", { name: "Enter app" }).first()).toBeVisible();
    });
  });
});
