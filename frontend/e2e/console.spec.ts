import { expect, test } from "@playwright/test";

const ROUTES = ["/", "/inventory", "/forecast", "/risk", "/agents", "/planner", "/scenarios", "/evaluation", "/audit"];

test("no console errors or page errors on any route", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${m.location()?.url}] ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 300)}`));
  for (const r of ROUTES) {
    await page.goto(r, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
  }
  expect(errors, errors.join("\n")).toEqual([]);
});
