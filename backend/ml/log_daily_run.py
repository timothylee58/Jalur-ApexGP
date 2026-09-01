"""Daily cron entrypoint: log a prediction for every session."""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.mlflow_client import log_prediction
from app.schemas.prediction import Session
from app.services.strategy_service import build_prediction
from app.services.weather_service import WeatherService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("log_daily_run")

SESSIONS: tuple[Session, ...] = ("FP1", "FP2", "FP3", "Quali", "Race")


async def run() -> None:
    weather_service = WeatherService()
    weather = await weather_service.get_snapshot()
    for session in SESSIONS:
        prediction = build_prediction(session, weather)
        log_prediction(prediction)
        logger.info("logged %s rain=%.0f%%", session, weather.rain_probability)


if __name__ == "__main__":
    asyncio.run(run())
