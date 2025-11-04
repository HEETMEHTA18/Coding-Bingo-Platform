import asyncio
from playwright.async_api import async_playwright, expect

import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    await asyncio.sleep(5)
    async with async_playwright() as p:
        for browser_type in [p.chromium]:
            browser = await browser_type.launch(headless=True)

            # Test as unauthenticated user
            context = await browser.new_context()
            page = await context.new_page()

            print("--- Testing as Unauthenticated User ---")

            # Should be redirected to /
            await page.goto("http://localhost:8080/admin")
            await page.wait_for_url("http://localhost:8080/")
            print("OK: /admin redirects to /")

            # Should be redirected to /
            await page.goto("http://localhost:8080/game")
            await page.wait_for_url("http://localhost:8080/")
            print("OK: /game redirects to /")

            # Should be redirected to /
            await page.goto("http://localhost:8080/congratulations")
            await page.wait_for_url("http://localhost:8080/")
            print("OK: /congratulations redirects to /")

            # Should stay on /leaderboard
            await page.goto("http://localhost:8080/leaderboard?room=TEST")
            await page.wait_for_url("http://localhost:8080/leaderboard?room=TEST")
            print("OK: /leaderboard is accessible")

            # Test as authenticated user
            await page.goto("http://localhost:8080/")
            await page.evaluate("""
                localStorage.setItem('bingo.team', JSON.stringify({ id: 'test-team', team_name: 'Test Team' }));
                localStorage.setItem('bingo.room', JSON.stringify({ code: 'TEST', title: 'Test Room' }));
            """)

            print("\\n--- Testing as Authenticated User ---")

            # Should be redirected to /game
            await page.goto("http://localhost:8080/")
            await page.wait_for_url("http://localhost:8080/game")
            print("OK: / redirects to /game")

            # Should be redirected to /game
            await page.goto("http://localhost:8080/admin")
            await page.wait_for_url("http://localhost:8080/game")
            print("OK: /admin redirects to /game")

            # Should stay on /leaderboard
            await page.goto("http://localhost:8080/leaderboard")
            await page.wait_for_url("http://localhost:8080/leaderboard")
            print("OK: /leaderboard is accessible")

            # Test as admin user
            await page.goto("http://localhost:8080/")
            await page.evaluate("localStorage.setItem('bingo.admin', 'true')")

            print("\\n--- Testing as Admin User ---")

            # Should be redirected to /admin
            await page.goto("http://localhost:8080/")
            await page.wait_for_url("http://localhost:8080/admin")
            print("OK: / redirects to /admin")

            # Should be redirected to /admin
            await page.goto("http://localhost:8080/game")
            await page.wait_for_url("http://localhost:8080/admin")
            print("OK: /game redirects to /admin")

            # Should stay on /leaderboard
            await page.goto("http://localhost:8080/leaderboard")
            await page.wait_for_url("http://localhost:8080/leaderboard")
            print("OK: /leaderboard is accessible")

            await browser.close()

asyncio.run(main())
