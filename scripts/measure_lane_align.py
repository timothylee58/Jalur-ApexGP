#!/usr/bin/env python3
"""Headless /circuit lane-alignment metric + screenshot (needs dev server on :3000)."""

import asyncio
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ARTIFACTS = Path("/opt/cursor/artifacts")
ARTIFACTS.mkdir(parents=True, exist_ok=True)


async def main() -> None:
    metric = None
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--use-angle=swiftshader", "--disable-dev-shm-usage"],
        )
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        def on_console(msg):
            nonlocal metric
            m = re.search(r"\[lane-align\] registered error:\s*([\d.]+)", msg.text)
            if m:
                metric = float(m.group(1))

        page.on("console", on_console)
        await page.goto("http://127.0.0.1:3000/circuit", wait_until="domcontentloaded", timeout=60_000)
        await page.wait_for_timeout(20_000)

        print(f"mean_ribbon_asphalt_distance={metric}")
        if metric is None:
            await browser.close()
            sys.exit(1)

        try:
            await page.screenshot(
                path=str(ARTIFACTS / "lane_align_after.png"),
                full_page=False,
                timeout=30_000,
            )
        except Exception as exc:
            print(f"screenshot skipped: {exc}", file=sys.stderr)

        await browser.close()

    if metric > 0.08:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())
