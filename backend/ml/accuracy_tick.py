"""Scheduler entrypoint for the accuracy loop (every few minutes in CI).

Two steps, both idempotent: lock a fresh prediction for any session about
to start, then record the outcome of any session that has finished. Fails
loudly when Supabase isn't configured, like the picks scorer — a red run is
the signal that the secrets still need setting.
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import accuracy_service, supabase_rest
from app.services.strategy_service import build_prediction
from app.services.weather_service import WeatherService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("accuracy_tick")


async def run() -> int:
    if not supabase_rest.configured():
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set")
        return 1
    weather = await WeatherService().get_snapshot()

    async def build(session):
        return build_prediction(session, weather)

    locked = await accuracy_service.snapshot_upcoming(build)
    resolved = await accuracy_service.resolve(force=True)
    logger.info("locked predictions: %s · resolved outcomes: %s", locked or "none", resolved or "none")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
