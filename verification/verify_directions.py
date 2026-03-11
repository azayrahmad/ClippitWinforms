from playwright.sync_api import sync_playwright, expect
import time

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 720})
        page = context.new_page()

        # Navigate to the demo
        page.goto("http://localhost:5173/")

        # Wait for agent to load
        expect(page.locator("#dash-state")).to_have_text("IdlingLevel1", timeout=15000)

        # 1. Test Gesture Left button
        page.click("#gesture-left-btn")
        time.sleep(1) # wait for animation to start
        # Use a soft expect or just log if we fail here to continue.
        try:
            expect(page.locator("#dash-state")).to_have_text("GesturingRight", timeout=5000)
        except Exception as e:
            print(f"Gesture Left failed: {e}")

        page.screenshot(path="verification/gesture_left.png")

        # 2. Test Gesture Right button
        page.click("#gesture-right-btn")
        time.sleep(1)
        try:
            expect(page.locator("#dash-state")).to_have_text("GesturingLeft", timeout=5000)
        except Exception as e:
            print(f"Gesture Right failed: {e}")

        page.screenshot(path="verification/gesture_right.png")

        # 3. Test Look at Mouse
        # Instead of check (which failed), use force: true or click a label
        page.click("label[for='look-mouse-check']")

        # Move mouse to the screen-left of the agent
        page.mouse.move(100, 360)
        time.sleep(1)
        try:
            expect(page.locator("#dash-anim")).to_have_text("LookRight", timeout=5000)
        except Exception as e:
            print(f"Look Left failed: {e}")

        page.screenshot(path="verification/look_left.png")

        # Move mouse to the screen-right
        page.mouse.move(1200, 360)
        time.sleep(1)
        try:
            expect(page.locator("#dash-anim")).to_have_text("LookLeft", timeout=5000)
        except Exception as e:
            print(f"Look Right failed: {e}")

        page.screenshot(path="verification/look_right.png")

        browser.close()

if __name__ == "__main__":
    run_verification()
