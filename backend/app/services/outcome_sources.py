"""What actually happened in a session, read from real data rather than
typed in by whoever visits the page.

RAIN. OpenF1's `weather` feed is the circuit's own weather station, sampled
about once a minute with a `rainfall` flag — the best available answer to
"did it rain during the session". OpenF1 publishes a session's data shortly
after it ends, so for a while after the flag there may be nothing yet. Past
a grace period the fallback is Open-Meteo's hourly precipitation for the
circuit: modelled rather than measured, and labelled that way.

PIT LAP. Only the race has a strategy pit stop to score against: the
winner's first stop, from Jolpica's pit-stop table. Practice and qualifying
runs pit constantly for reasons that have nothing to do with a race
strategy, so their pit-window call is left unscored rather than scored
against noise.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.services import jolpica_service

logger = logging.getLogger(__name__)
MYT = ZoneInfo("Asia/Kuala_Lumpur")
_TIMEOUT = httpx.Timeout(8.0)

OPENF1_SESSION_NAMES = {
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
    "Quali": "Qualifying",
    "Race": "Race",
}
# How long to keep waiting for the track's own weather station before
# settling for modelled precipitation.
OPENF1_GRACE = timedelta(minutes=75)
# An hour's modelled precipitation at or above this counts as rain — below
# it is drizzle that never wets a racing line.
RAIN_MM_PER_HOUR = 0.2


@dataclass
class RainReading:
    occurred: bool
    source: str
    detail: dict[str, Any] = field(default_factory=dict)


async def _openf1(client: httpx.AsyncClient, path: str, query: str) -> list[dict[str, Any]] | None:
    # Hand-built query string: OpenF1's comparison filters glue the operator
    # onto the field name (date_start>=...), which a params dict would escape.
    url = f"{settings.openf1_base_url}{path}?{query}"
    try:
        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("OpenF1 %s unavailable: %s", path, exc)
        return None
    return payload if isinstance(payload, list) else None


def _openf1_time(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")


async def openf1_rain(session: str, start: datetime, end: datetime) -> RainReading | None:
    """None when OpenF1 hasn't published the session (or is unreachable)."""
    name = OPENF1_SESSION_NAMES[session]
    window = timedelta(minutes=90)
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        sessions = await _openf1(
            client,
            "/sessions",
            f"session_name={quote(name)}"
            f"&date_start>={_openf1_time(start - window)}&date_start<={_openf1_time(start + window)}",
        )
        if not sessions:
            return None
        key = sessions[0].get("session_key")
        if key is None:
            return None
        samples = await _openf1(client, "/weather", f"session_key={key}")
    if not samples:
        return None
    wet = [s for s in samples if s.get("rainfall")]
    return RainReading(
        occurred=bool(wet),
        source="openf1-track-weather",
        detail={"sessionKey": key, "samples": len(samples), "wetSamples": len(wet)},
    )


async def open_meteo_rain(start: datetime, end: datetime) -> RainReading | None:
    local_start = start.astimezone(MYT)
    local_end = end.astimezone(MYT)
    params = {
        "latitude": settings.sepang_lat,
        "longitude": settings.sepang_lon,
        "hourly": "precipitation",
        "timezone": "Asia/Kuala_Lumpur",
        "start_date": local_start.date().isoformat(),
        "end_date": local_end.date().isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            response = await client.get(f"{settings.open_meteo_base_url}/forecast", params=params)
            response.raise_for_status()
            payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Open-Meteo precipitation unavailable: %s", exc)
        return None
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    amounts = hourly.get("precipitation") or []
    # Each value is the total for the hour *ending* at its timestamp, so an
    # hour overlaps the session when it ends after the start and began
    # before the end.
    overlapping: list[float] = []
    for stamp, amount in zip(times, amounts):
        try:
            ends = datetime.fromisoformat(stamp).replace(tzinfo=MYT)
        except ValueError:
            continue
        if ends > local_start and ends - timedelta(hours=1) < local_end and amount is not None:
            overlapping.append(float(amount))
    if not overlapping:
        return None
    peak = max(overlapping)
    return RainReading(
        occurred=peak >= RAIN_MM_PER_HOUR,
        source="open-meteo-modelled",
        detail={"hours": len(overlapping), "peakMmPerHour": round(peak, 2), "totalMm": round(sum(overlapping), 2)},
    )


async def rain_during(session: str, start: datetime, end: datetime, now: datetime) -> RainReading | None:
    """The best rain answer available right now, or None to try again later."""
    reading = await openf1_rain(session, start, end)
    if reading is not None:
        return reading
    if now < end + OPENF1_GRACE:
        return None
    return await open_meteo_rain(start, end)


async def race_reference_stop(season: int, round_: int) -> tuple[int | None, str, dict[str, Any]] | None:
    """(lap, source, detail) for the race winner's first stop; None until
    Jolpica has classified the race."""
    try:
        found = await jolpica_service.get_winner_first_stop(season, round_)
    except jolpica_service.JolpicaUpstreamError as exc:
        logger.warning("Jolpica pit stops unavailable: %s", exc)
        return None
    if found is None:
        return None
    winner, lap = found
    return lap, "jolpica-pitstops", {"winner": winner}
