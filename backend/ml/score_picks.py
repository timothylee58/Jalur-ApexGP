"""Scheduled cron entrypoint: score any Race-day Picks entries still
pending against the real round-16 classification. A no-op until Jolpica
reports the round final — safe to run well before race day, same shape as
ml/log_daily_run.py."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.picks_service import score_pending

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("score_picks")


async def run() -> None:
    scored = await score_pending()
    logger.info("score_picks run complete: %d entries scored", scored)


if __name__ == "__main__":
    asyncio.run(run())
