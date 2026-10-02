"""Durable storage for the accuracy loop: one pre-session prediction and one
outcome per (season, round, session), in Supabase.

This replaced MLflow as the accuracy store. MLflow on a serverless
function needs a remote tracking server to persist anything, and when that
server went away every outcome log and scoreboard read failed with it. A
keyed upsert per session is also a better fit than a run log: the scoreboard
needs "the last read before lights out" and "what actually happened", not
every prediction ever made.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.schemas.prediction import PredictionResponse
from app.services import supabase_rest

PREDICTIONS = "accuracy_predictions"
OUTCOMES = "accuracy_outcomes"
_KEY = "season,round,session"
_TIMEOUT = httpx.Timeout(8.0)


def prediction_row(
    prediction: PredictionResponse, *, season: int, round_: int, made_at: str, source: str
) -> dict[str, Any]:
    return {
        "season": season,
        "round": round_,
        "session": prediction.session,
        "made_at": made_at,
        "source": source,
        "rain_probability": prediction.weather.rain_probability,
        "temp_c": prediction.weather.temp_c,
        "condition": prediction.weather.condition,
        "confidence_conservative": prediction.conservative.confidence,
        "confidence_aggressive": prediction.aggressive.confidence,
        "pit_start_conservative": prediction.conservative.pit_window.start_lap,
        "pit_end_conservative": prediction.conservative.pit_window.end_lap,
        "pit_start_aggressive": prediction.aggressive.pit_window.start_lap,
        "pit_end_aggressive": prediction.aggressive.pit_window.end_lap,
    }


async def _upsert(table: str, row: dict[str, Any]) -> None:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            supabase_rest.rest_url(f"{table}?on_conflict={_KEY}"),
            headers=supabase_rest.headers(prefer="resolution=merge-duplicates,return=minimal"),
            json=row,
        )
        response.raise_for_status()


async def upsert_prediction(row: dict[str, Any]) -> None:
    await _upsert(PREDICTIONS, row)


async def upsert_outcome(row: dict[str, Any]) -> None:
    await _upsert(OUTCOMES, row)


async def _select(table: str, query: str) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(supabase_rest.rest_url(f"{table}?{query}"), headers=supabase_rest.headers())
        response.raise_for_status()
        rows = response.json()
    return rows if isinstance(rows, list) else []


async def predictions_for_round(season: int, round_: int) -> list[dict[str, Any]]:
    return await _select(PREDICTIONS, f"season=eq.{season}&round=eq.{round_}&select=*")


async def outcomes_for_round(season: int, round_: int) -> list[dict[str, Any]]:
    return await _select(OUTCOMES, f"season=eq.{season}&round=eq.{round_}&select=*")


async def rows_for_session(session: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Every round's prediction and outcome for one session type, for the
    season-long record per session."""
    query = f"session=eq.{session}&select=*&order=season.asc,round.asc"
    return await _select(PREDICTIONS, query), await _select(OUTCOMES, query)
