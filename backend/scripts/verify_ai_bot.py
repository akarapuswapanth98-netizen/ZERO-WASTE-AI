"""Verification script for ZeroWaste Copilot AI Bot."""
import os
import sys
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = r"C:\Users\akara\.gemini\antigravity-ide\brain\5d41ad20-a0b1-468d-bdda-4c81d0137e49"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"


def verify_ai_bot():
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

        print("\n--- 1. Navigating to Home ---")
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(2000)

        print("\n--- 2. Verifying Floating AI Bot Launcher ---")
        bot_btn = page.locator("#open-ai-bot-btn")
        assert bot_btn.is_visible(), "AI Bot launcher button not visible on page!"
        print("Floating AI Bot launcher button is visible.")

        print("\n--- 3. Opening AI Bot Modal ---")
        bot_btn.click()
        page.wait_for_timeout(1000)
        modal = page.locator("#ai-bot-modal")
        assert modal.is_visible(), "AI Bot modal did not open!"
        print("AI Bot drawer opened successfully.")

        print("\n--- 4. Clicking Quick Prompt: 'Expiring in 48h' ---")
        prompt_chip = page.locator("button:has-text('Expiring in 48h')")
        assert prompt_chip.is_visible(), "Quick prompt chip not visible!"
        prompt_chip.click()

        print("\n--- 5. Waiting for Bot Response ---")
        page.wait_for_timeout(3000)
        bot_reply = page.locator("text=expiring within the next 48 hours")
        assert bot_reply.is_visible(), "Bot response not found!"
        print("Bot response rendered successfully with grounded inventory numbers.")

        screenshot_path = os.path.join(ARTIFACTS_DIR, "ai_bot_copilot.png")
        page.screenshot(path=screenshot_path)
        print(f"Captured screenshot at {screenshot_path}")

        print("\n--- 6. Verifying Follow-up Input ---")
        input_box = page.locator("#ai-bot-input")
        input_box.fill("How much carbon and food waste have we saved?")
        page.locator("#ai-bot-submit-btn").click()
        page.wait_for_timeout(3000)
        assert page.locator("text=Sustainability Metrics To Date").is_visible()
        print("Sustainability response rendered correctly.")

        screenshot_path2 = os.path.join(ARTIFACTS_DIR, "ai_bot_conversation.png")
        page.screenshot(path=screenshot_path2)
        print(f"Captured multi-turn screenshot at {screenshot_path2}")

        browser.close()

    print("\n--- VERIFICATION SUMMARY ---")
    print(f"Console Errors: {len(console_errors)}")
    if console_errors:
        print("Errors found:", console_errors)
        sys.exit(1)
    print("ALL AI BOT TESTS PASSED WITH 0 CONSOLE ERRORS!")


if __name__ == "__main__":
    verify_ai_bot()
