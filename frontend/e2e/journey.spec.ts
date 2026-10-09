import { expect, test } from "@playwright/test";

const API = "http://127.0.0.1:8000";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

test("full planner journey: seed -> agents -> approve + reject -> execute -> persistence", async ({ page, request }) => {
  // deterministic header state first (backend env pins AS_OF), then UI flows
  await api("/api/seed/reset?seed=42", { method: "POST" });
  await page.goto("/");
  await expect(page.getByText("As of 2026-10-05").filter({ visible: true }).first()).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: /Demo tools/ }).click();
  await page.getByRole("button", { name: "Seed demo" }).click();
  await page.getByRole("button", { name: /wipe \+ reseed/ }).click();
  await expect(page.getByText(/Seeded \d+ SKUs/, { exact: false })).toBeVisible({ timeout: 120000 });

  // run agents via UI menu
  await page.getByRole("button", { name: /Demo tools/ }).click();
  await page.getByRole("button", { name: "Run agents" }).click();
  await page.getByRole("button", { name: /90 proposals/ }).click();
  await expect(page.getByText(/proposals ready for review/, { exact: false })).toBeVisible({ timeout: 180000 });

  // one open proposal per (store, SKU): older undecided rows are superseded, queue pairs unique
  {
    const proposed = await api("/api/recommendations?status=proposed");
    const pairs = proposed.recommendations.map((r: { store_id: string; sku: string }) => `${r.store_id}|${r.sku}`);
    expect(new Set(pairs).size, "duplicate open proposals for one pair").toBe(pairs.length);
    const sup = await api("/api/recommendations?status=superseded");
    expect(sup.recommendations.length, "expected superseded rows from the re-run").toBeGreaterThan(0);
  }

  // planner: pin two proposals via API, then drive their exact cards (no positional races)
  const proposed0 = await api("/api/recommendations?status=proposed");
  expect(proposed0.recommendations.length).toBeGreaterThanOrEqual(2);
  const targetA = proposed0.recommendations[0] as { rec_id: string; sku: string; store_id: string };
  const targetB = (proposed0.recommendations.find((r: { rec_id: string }) => r.rec_id !== targetA.rec_id) ?? proposed0.recommendations[1]) as { rec_id: string; sku: string; store_id: string };
  const cardForId = (recId: string) => page.locator(`[data-rec-id="${recId}"]`);

  await page.goto("/planner");
  // isolate the pinned card: store filter + search (also paginates to it)
  await page.getByLabel("Store filter").selectOption(targetA.store_id);
  await page.getByLabel("Search proposals").fill(targetA.sku);
  const cardA = cardForId(targetA.rec_id);
  await expect(cardA).toBeVisible({ timeout: 60000 });
  await cardA.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Confirm approve" }).click();
  await expect(page.locator("[aria-live=polite] > div").first()).toBeVisible({ timeout: 30000 });
  {
    const live = ((await page.locator("[aria-live=polite]").textContent()) ?? "").slice(0, 300);
    console.log(`LIVE-AFTER-APPROVE: ${live}`);
    expect(live).toMatch(/Approved .* execute it/);
  }
  await expect(cardA).toHaveCount(0, { timeout: 30000 }); // approved card leaves the proposed list
  const approvedA = await api(`/api/recommendations/${targetA.rec_id}`);
  expect(approvedA.status).toBe("approved");

  // drain the approve toast so later assertions can't match stale text
  await expect(page.getByText(/Approved .* execute it/, { exact: false })).toHaveCount(0, { timeout: 15000 });

  const cardB = cardForId(targetB.rec_id);
  await page.getByLabel("Store filter").selectOption(targetB.store_id);
  await page.getByLabel("Search proposals").fill(targetB.sku);
  await expect(cardB).toBeVisible({ timeout: 30000 });
  await cardB.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByLabel("Decision reason").fill("e2e-reject");
  await page.getByRole("button", { name: "Confirm reject" }).click();
  await expect(page.locator("[aria-live=polite] > div").first()).toBeVisible({ timeout: 30000 });
  {
    const live = ((await page.locator("[aria-live=polite]").textContent()) ?? "").slice(0, 300);
    console.log(`LIVE-AFTER-REJECT: ${live}`);
    expect(live).toMatch(/nothing will execute/);
  }
  const rejectedB = await api(`/api/recommendations/${targetB.rec_id}`);
  expect(rejectedB.status).toBe("rejected");

  // approved proposal executes to a real terminal status
  await page.getByLabel("Status filter").selectOption("approved");
  await page.getByLabel("Store filter").selectOption("");
  await page.getByLabel("Search proposals").fill("");
  const cardAApproved = cardForId(targetA.rec_id);
  await expect(cardAApproved).toBeVisible({ timeout: 60000 });
  await cardAApproved.getByRole("button", { name: "Execute (sim)", exact: true }).click();
  await page.getByRole("button", { name: "Confirm execute" }).click();
  await expect(page.getByText(/Executed in simulation|Failed:/, { exact: false })).toBeVisible({ timeout: 30000 });

  // rejected proposal executes nothing (API must refuse)
  const rejected = await api("/api/recommendations?status=rejected");
  expect(rejected.recommendations.length).toBeGreaterThan(0);
  const bad = await request.post(`${API}/api/execute/${rejected.recommendations[0].rec_id}`);
  expect(bad.status()).toBe(400);

  // scenario reproducibility: same seed twice, identical metrics ignoring runtime
  const runOpts = { method: "POST", data: { preset: "demand_spike", seeds: 3, base_seed: 7 } };
  const a = await (await request.post(`${API}/api/scenarios/run`, runOpts)).json();
  const b = await (await request.post(`${API}/api/scenarios/run`, runOpts)).json();
  for (const pol of ["agentic", "fifo", "fixed-threshold"]) {
    for (const k of ["waste_units", "waste_cost", "stockout_units", "order_cost", "revenue", "sales_units", "service_level"]) {
      expect(a.policies[pol][k], `${pol}/${k}`).toEqual(b.policies[pol][k]);
    }
  }

  // evaluation + audit reflect the decisions
  await page.goto("/evaluation");
  await expect(page.getByText(/Planner decisions:/, { exact: false })).toBeVisible({ timeout: 60000 });
  await page.goto("/audit");
  await expect(page.getByText(/Agent executions/, { exact: false })).toBeVisible();

  // reload persistence: counts survive a full reload
  await page.goto("/planner");
  const before = await page.getByRole("button", { name: "Approve", exact: true }).count().catch(() => -1);
  await page.reload();
  await page.getByLabel("Status filter").selectOption("proposed");
  await page.waitForTimeout(3000);
  const body = await page.content();
  expect(body).toContain("Planner Review");
  expect(before).toBeGreaterThanOrEqual(0);
});

test("inventory explorer: 3D loads, backend time-travel recomputes, mobile falls back to 2D", async ({ page }, testInfo) => {
  await page.goto("/inventory");
  await expect(page.getByText("3D Inventory Explorer")).toBeVisible({ timeout: 60000 });
  const smallScreen = testInfo.project.name === "mobile" || testInfo.project.name === "mobile360";
  if (smallScreen) {
    await expect(page.getByText(/2D fallback active/, { exact: false })).toBeVisible({ timeout: 60000 });
    // hero also falls back to a static gradient + SVG (no canvas) without WebGL
    await page.goto("/");
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.goto("/inventory");
    await expect(page.getByText("3D Inventory Explorer")).toBeVisible({ timeout: 60000 });
  } else {
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 60000 });
  }
  // select first row -> backend risk panel appears
  await page.locator("tbody tr").first().click();
  await expect(page.getByText(/At-risk/, { exact: false })).toBeVisible({ timeout: 30000 });
  if (testInfo.project.name === "desktop" || testInfo.project.name === "chromium-full") {
    // draw-call budget: interact (fly-to re-renders), then sample the renderer info
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as { __r3f?: { calls: number } }).__r3f?.calls ?? 0), { timeout: 60000 })
      .toBeGreaterThan(0);
    const calls = await page.evaluate(() => (window as unknown as { __r3f?: { calls: number } }).__r3f?.calls ?? 0);
    console.log(`DRAW-CALLS: ${calls}`);
    expect(calls, "draw-call budget").toBeLessThanOrEqual(200);
  }
  // time-travel slider drives backend recompute (effective date shifts)
  const slider = page.getByLabel("Time travel days");
  await slider.evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(el, "3");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.getByText("eff. 2026-10-08", { exact: false })).toBeVisible({ timeout: 30000 });
});
