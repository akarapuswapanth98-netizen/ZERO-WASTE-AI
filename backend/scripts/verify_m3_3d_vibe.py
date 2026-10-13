"""Automated Playwright Journey Verification & Screenshot Capture for Milestone 3 (3D Vibe Coding)."""
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = r"C:\Users\akara\.gemini\antigravity-ide\brain\5d41ad20-a0b1-468d-bdda-4c81d0137e49"
os.makedirs(ARTIFACTS_DIR, exist_ok=True)
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def run_m3_verification():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        def handle_console(msg):
            if msg.type == "error":
                text = msg.text
                if "favicon" not in text:
                    console_errors.append(text)
                    print(f"[CONSOLE ERROR]: {text}")

        page.on("console", handle_console)

        print("\n--- 1. Testing Overview with 3D Inventory Orb (/) ---")
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(2500)
        shot1 = os.path.join(ARTIFACTS_DIR, "m3_overview_3d.png")
        page.screenshot(path=shot1)
        print(f"Captured Overview screenshot: {shot1}")
        assert page.locator("text=QUANTUM FIFO CORE // LIVE").is_visible()
        assert page.locator("canvas").first.is_visible()

        print("\n--- 2. Testing Inventory with 3D Warehouse Shelves (/inventory) ---")
        page.goto("http://localhost:3000/inventory", wait_until="networkidle")
        page.wait_for_timeout(2000)
        shot2 = os.path.join(ARTIFACTS_DIR, "m3_inventory_shelves_3d.png")
        page.screenshot(path=shot2)
        print(f"Captured Inventory screenshot: {shot2}")
        assert page.locator("text=3D Isometric Shelf Visualizer").is_visible()
        assert page.locator("canvas").first.is_visible()

        print("\n--- 3. Testing Forecast Tournament (/forecast) ---")
        page.goto("http://localhost:3000/forecast", wait_until="networkidle")
        page.wait_for_timeout(2000)
        shot3 = os.path.join(ARTIFACTS_DIR, "m3_forecast_page.png")
        page.screenshot(path=shot3)
        print(f"Captured Forecast screenshot: {shot3}")
        assert page.locator("text=Perishable Demand Tourney").is_visible()
        assert page.locator("text=Winner").first.is_visible()

        print("\n--- 4. Testing Spoilage Risk Simulator (/risk) ---")
        page.goto("http://localhost:3000/risk", wait_until="networkidle")
        page.wait_for_timeout(2000)
        # Drag time travel slider
        slider = page.locator("#slider-risk-offset")
        slider.fill("3")
        page.wait_for_timeout(1000)
        shot4 = os.path.join(ARTIFACTS_DIR, "m3_risk_page.png")
        page.screenshot(path=shot4)
        print(f"Captured Risk screenshot: {shot4}")
        assert page.locator("text=FIFO Depletion & Spoilage Simulator").is_visible()

        print("\n--- 5. Testing Agent Command Center (/agents) ---")
        page.goto("http://localhost:3000/agents", wait_until="networkidle")
        page.wait_for_timeout(2000)
        shot5 = os.path.join(ARTIFACTS_DIR, "m3_agents_page.png")
        page.screenshot(path=shot5)
        print(f"Captured Agents screenshot: {shot5}")
        assert page.locator("text=5-Agent Deliberation & Counterfactual Replay").is_visible()
        assert page.locator("text=Counterfactual: No Intervention Taken").is_visible()

        browser.close()

    print("\n--- M3 VERIFICATION SUMMARY ---")
    print(f"Console Errors: {len(console_errors)}")
    if console_errors:
        print("Errors found:", console_errors)
        sys.exit(1)
    print("ALL M3 3D VIBE TESTS PASSED WITH 0 CONSOLE ERRORS!")


if __name__ == "__main__":
    run_m3_verification()
