import { expect, test } from "@playwright/test";

// Proxy lockdown (dev server): allowlisted routes pass, everything else 403/404.
// Production seed-gate is verified separately against `next start` (see report).
test("proxy allows UI routes and blocks the rest", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "proxy contract checked once");
  const ok = await request.get("/api/stores");
  expect(ok.status(), "allowlisted GET /api/stores").toBe(200);

  const health = await request.get("/api/health");
  expect(health.status(), "allowlisted GET /api/health").toBe(200);

  const cal = await request.get("/api/scenarios/calibration");
  expect(cal.status(), "allowlisted GET /api/scenarios/calibration").toBe(200);

  const unknown = await request.get("/api/nope");
  expect(unknown.status(), "unknown route").toBe(404);

  const wrongMethod = await request.delete("/api/stores");
  expect(wrongMethod.status(), "known route, wrong method").toBe(403);

  const unlisted = await request.post("/api/sales/ingest", { data: {} });
  expect(unlisted.status(), "backend route not used by UI").toBe(404);

  const wrongMethodId = await request.delete("/api/recommendations/abc");
  expect(wrongMethodId.status(), "ID route, wrong method").toBe(403);

  // dev mode: seed/reset stays open for Seed demo + E2E
  const seed = await request.post("/api/seed/reset?seed=42");
  expect(seed.status(), "dev seed/reset").toBe(200);
});
