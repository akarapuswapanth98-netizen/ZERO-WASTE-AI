"""Verify loading page and upgraded advanced 3D vibecoding in browser."""
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = r"C:\Users\akara\.gemini\antigravity-ide\brain\5d41ad20-a0b1-468d-bdda-4c81d0137e49"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def verify_loading_and_3d():
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        # Fresh context without sessionStorage to capture the StartupLoader
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        def handle_console(msg):
            if msg.type == "error":
                text = msg.text
                if "favicon" not in text:
                    console_errors.append(text)
                    print(f"[CONSOLE ERROR]: {text}")

        page.on("console", handle_console)

        print("\n--- 1. Testing Futuristic Startup Loading Screen ---")
        page.goto("http://localhost:3000")
        # Capture loading screen mid-boot
        page.wait_for_timeout(350)
        shot_loading = os.path.join(ARTIFACTS_DIR, "m3_loading_screen.png")
        page.screenshot(path=shot_loading)
        print(f"Captured Loading Screen screenshot: {shot_loading}")

        # Wait for boot completion and main UI reveal
        page.wait_for_timeout(2500)

        print("\n--- 2. Testing Advanced 3D Hero Orb with Particle Constellation ---")
        shot_overview = os.path.join(ARTIFACTS_DIR, "m3_overview_advanced_3d.png")
        page.screenshot(path=shot_overview)
        print(f"Captured Advanced Overview screenshot: {shot_overview}")
        assert page.locator("text=QUANTUM NEURAL CORE // 3D PARALLAX").is_visible()
        assert page.locator("canvas").first.is_visible()

        print("\n--- 3. Testing 3D Warehouse Shelves with Lidar Sweep ---")
        page.goto("http://localhost:3000/inventory")
        page.wait_for_timeout(2000)
        shot_inventory = os.path.join(ARTIFACTS_DIR, "m3_shelves_laser_sweep.png")
        page.screenshot(path=shot_inventory)
        print(f"Captured 3D Shelves screenshot: {shot_inventory}")
        assert page.locator("text=3D Isometric Shelf Visualizer").is_visible()
        assert page.locator("text=Laser Lidar Sweep Active").is_visible()

        browser.close()

    print("\n--- VERIFICATION SUMMARY ---")
    print(f"Console Errors: {len(console_errors)}")
    if console_errors:
        print("Errors found:", console_errors)
        sys.exit(1)
    print("ALL LOADING & 3D VIBECODING TESTS PASSED WITH 0 CONSOLE ERRORS!")


if __name__ == "__main__":
    verify_loading_and_3d()
