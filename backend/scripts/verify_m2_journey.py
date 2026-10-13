"""Automated Playwright Journey Verification & Screenshot Capture for Milestone 2."""
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = r"C:\Users\akara\.gemini\antigravity-ide\brain\5d41ad20-a0b1-468d-bdda-4c81d0137e49"
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def run_verification():
    console_errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        # Listen to console messages
        def handle_console(msg):
            if msg.type == "error":
                # Ignore harmless React hydration or favicon 404 if any
                text = msg.text
                if "favicon" not in text:
                    console_errors.append(text)
                    print(f"[CONSOLE ERROR]: {text}")

        page.on("console", handle_console)

        print("\n--- 1. Testing Overview (/) ---")
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(2000)
        shot1 = os.path.join(ARTIFACTS_DIR, "m2_overview.png")
        page.screenshot(path=shot1)
        print(f"Captured Overview screenshot: {shot1}")
        assert "ZeroWaste AI" in page.title()
        assert page.locator("text=Expiring in 48h").is_visible()
        assert page.locator("text=CO2e Avoided").is_visible()

        print("\n--- 2. Testing Inventory (/inventory) ---")
        page.goto("http://localhost:3000/inventory", wait_until="networkidle")
        page.wait_for_timeout(1000)
        # Search for Milk
        search_input = page.locator("#input-inventory-search")
        search_input.fill("Milk")
        page.wait_for_timeout(500)
        # Open batch drawer
        inspect_btn = page.locator("text=Inspect Batches").first
        inspect_btn.click()
        page.wait_for_timeout(1000)
        shot2 = os.path.join(ARTIFACTS_DIR, "m2_inventory.png")
        page.screenshot(path=shot2)
        print(f"Captured Inventory screenshot: {shot2}")
        page.locator("text=Close Drawer").click()
        page.wait_for_timeout(500)

        print("\n--- 3. Testing Planner (/planner) ---")
        page.goto("http://localhost:3000/planner", wait_until="networkidle")
        page.wait_for_timeout(1000)
        # Click Run Agent Coordinator
        run_coord = page.locator("#btn-run-coordinator")
        run_coord.click()
        page.wait_for_timeout(3000)
        shot3 = os.path.join(ARTIFACTS_DIR, "m2_planner.png")
        page.screenshot(path=shot3)
        print(f"Captured Planner screenshot: {shot3}")
        # Test 'Why this action?' modal
        why_btn = page.locator("text=Why this action?").first
        if why_btn.is_visible():
            why_btn.click()
            page.wait_for_timeout(500)
            page.locator("text=Close").click()
            page.wait_for_timeout(500)

        print("\n--- 4. Testing Scenarios (/scenarios) ---")
        page.goto("http://localhost:3000/scenarios", wait_until="networkidle")
        page.wait_for_timeout(1000)
        # Click preset supplier_delay
        page.locator("#preset-supplier_delay").click()
        page.wait_for_timeout(500)
        # Run simulation
        page.locator("#btn-run-simulation").click()
        page.wait_for_timeout(3000)
        shot4 = os.path.join(ARTIFACTS_DIR, "m2_scenarios.png")
        page.screenshot(path=shot4)
        print(f"Captured Scenarios screenshot: {shot4}")
        assert page.locator("text=Policy Performance Matrix").is_visible()

        print("\n--- 5. Testing Evaluation (/evaluation) ---")
        page.goto("http://localhost:3000/evaluation", wait_until="networkidle")
        page.wait_for_timeout(1500)
        shot5 = os.path.join(ARTIFACTS_DIR, "m2_evaluation.png")
        page.screenshot(path=shot5)
        print(f"Captured Evaluation screenshot: {shot5}")
        assert page.locator("#table-evaluation-metrics").is_visible()

        print("\n--- 6. Testing Audit & Events (/audit) ---")
        page.goto("http://localhost:3000/audit", wait_until="networkidle")
        page.wait_for_timeout(1000)
        # Switch to Sim Events tab
        page.locator("#tab-sim-events").click()
        page.wait_for_timeout(1000)
        shot6 = os.path.join(ARTIFACTS_DIR, "m2_audit.png")
        page.screenshot(path=shot6)
        print(f"Captured Audit screenshot: {shot6}")
        assert page.locator("#table-sim-events").is_visible()

        browser.close()

    print("\n--- Console Verification ---")
    print(f"Console errors detected: {len(console_errors)}")
    if console_errors:
        for err in console_errors:
            print(f"  - {err}")
    assert len(console_errors) == 0, f"Failed with {len(console_errors)} console errors!"
    print("ALL M2 PAGES & USER JOURNEYS VERIFIED SUCCESSFULLY WITH 0 CONSOLE ERRORS!")

if __name__ == "__main__":
    run_verification()
