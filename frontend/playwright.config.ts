import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180000,
  expect: { timeout: 30000 },
  // Serial: all tests share one mutable backend DB (seed/decide), so parallel
  // workers would decide/wipe rows under each other.
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: "../backend",
      port: 8000,
      reuseExistingServer: false,
      timeout: 90000,
      env: {
        AS_OF: "2026-10-05",
        DEMO_MODE: "true",
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5434/zerowaste_e2e",
      },
    },
    {
      command: "npx next dev --port 3000",
      port: 3000,
      reuseExistingServer: false,
      timeout: 180000,
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // full Chromium build (not headless shell) + narrow 360px viewport, per round-3 checks
    { name: "chromium-full", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    {
      name: "mobile360",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } },
    },
  ],
});
