from playwright.sync_api import sync_playwright
import json

def test_sizes():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        try:
            page.goto('http://localhost:5173/')
            page.wait_for_timeout(3000)

            # Short text
            page.evaluate('''async () => {
                await window.agent.speak("Hi", { hold: true });
            }''')
            page.wait_for_timeout(1000)
            short_rect = page.evaluate('''() => {
                const shadow = window.agent.shadowRoot;
                const balloon = shadow.querySelector('.clippy-balloon');
                const content = shadow.querySelector('.clippy-content');
                return {
                    balloon: balloon.getBoundingClientRect(),
                    content: content.getBoundingClientRect(),
                    contentStyle: {
                        width: content.style.width,
                        height: content.style.height,
                        maxWidth: content.style.maxWidth
                    }
                };
            }''')

            # Long text
            page.evaluate('''async () => {
                await window.agent.speak("This is a much longer text that should definitely take more space and maybe even wrap into multiple lines if it exceeds the max width of the balloon. We want to see it growing both in width and height if possible, especially if we keep adding more and more text to this specific balloon for testing purposes.", { hold: true });
            }''')
            page.wait_for_timeout(2000)
            long_rect = page.evaluate('''() => {
                const shadow = window.agent.shadowRoot;
                const balloon = shadow.querySelector('.clippy-balloon');
                const content = shadow.querySelector('.clippy-content');
                return {
                    balloon: balloon.getBoundingClientRect(),
                    content: content.getBoundingClientRect(),
                    contentStyle: {
                        width: content.style.width,
                        height: content.style.height,
                        maxWidth: content.style.maxWidth
                    }
                };
            }''')

            print(f"Short Balloon: {short_rect['balloon']['width']}x{short_rect['balloon']['height']}")
            print(f"Short Content: {short_rect['content']['width']}x{short_rect['content']['height']}")
            print(f"Short Style: {short_rect['contentStyle']}")

            print(f"Long Balloon: {long_rect['balloon']['width']}x{long_rect['balloon']['height']}")
            print(f"Long Content: {long_rect['content']['width']}x{long_rect['content']['height']}")
            print(f"Long Style: {long_rect['contentStyle']}")

            if short_rect['balloon']['width'] < long_rect['balloon']['width'] or short_rect['balloon']['height'] < long_rect['balloon']['height']:
                print("SUCCESS: Balloon resized!")
            else:
                print("FAILURE: Balloon remained same size.")

            page.screenshot(path='/app/verification/size_check.png', full_page=True)

        finally:
            browser.close()

if __name__ == "__main__":
    test_sizes()
