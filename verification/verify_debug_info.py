from playwright.sync_api import Page, expect, sync_playwright
import time
import re

def test_debug_info_visibility(page: Page):
  # 1. Arrange: Go to the local dev server.
  page.goto("http://localhost:5173/")

  # 2. Wait for the agent to load (Clippit is default)
  dash_state = page.locator("#dash-state")
  expect(dash_state).to_contain_text("Idling", timeout=10000)

  # 3. Assert: Verify the new debug fields are present
  expect(page.locator("#dash-duration")).to_be_visible()
  expect(page.locator("#dash-exit")).to_be_visible()
  expect(page.locator("#dash-exiting")).to_be_visible()

  # 4. Act: Play an animation to see values change
  page.locator("#play-btn").click()

  # Wait a bit for animation to start
  time.sleep(1)

  # 5. Screenshot: Capture the control panel with debug info
  page.screenshot(path="/home/jules/verification/debug_info.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      test_debug_info_visibility(page)
    finally:
      browser.close()
