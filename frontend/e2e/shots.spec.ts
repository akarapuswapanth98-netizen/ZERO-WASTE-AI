import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8000";
const SHOTS = "../docs/screenshots";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

test("capture docs screenshots", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "screenshots captured once on desktop");
  await page.setViewportSize({ width: 1440, height: 900 });
  await api("/api/seed/reset?seed=42", { method: "POST" });
  await api("/api/agents/run", { method: "POST", body: JSON.stringify({}) });

  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/01-overview-hero.png` });

  await page.goto("/inventory");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/02-explorer-3d.png` });

  await page.goto("/planner");
  await expect(page.getByRole("button", { name: "Approve", exact: true }).first()).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Approve", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/03-planner-modal.png` });
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/scenarios");
  await page.getByLabel("Seed count").fill("3");
  await page.getByRole("button", { name: "Run comparison" }).click();
  await expect(page.getByText(/Waste reduction|n\/a \(baseline/, { exact: false })).toBeVisible({ timeout: 180000 });
  await page.screenshot({ path: `${SHOTS}/04-scenarios.png`, fullPage: true });

  await page.goto("/evaluation");
  await expect(page.getByText(/Latest full comparison/, { exact: false })).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: `${SHOTS}/05-evaluation.png`, fullPage: true });

  await page.goto("/agents");
  await expect(page.getByText(/Latest traces/, { exact: false })).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: `${SHOTS}/06-agents.png`, fullPage: true });
});
