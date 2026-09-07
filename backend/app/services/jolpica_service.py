"""Schedule + standings via Jolpica (api.jolpi.ca) — the open-source
Ergast-compatible F1 results API, not an official F1/FIA/FOM product.
Free and keyless.

This app's Sepang weekend is the 2026 Bahrain Grand Prix hosted at Sepang
(Jolpica round 16). Session *starts* come from Jolpica; end times aren't
in the Ergast schema, so practice/Quali are treated as 60 minutes and the
race as 120 — same duration convention the frontend schedule bake uses.
Standings default to the current, still-in-progress season — a live read
refetched every few minutes (see _STANDINGS_CACHE_TTL_SECONDS), not a
fixed snapshot — overridable via `season` (e.g. the 2025 season close the
driver/team career stats in data/drivers.ts still hold themselves to).

Unlike OpenF1, api.jolpi.ca is reachable from this sandbox, so the unit
tests below can (and do) hit a mocked transport for determinism while
live calls work fine here too.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.config import settings
from app.schemas.jolpica import (
    ClassifiedDriver,
    ConstructorStandingRow,
    DriverStandingRow,
    RaceClassification,
    ScheduleSession,
    StandingsPayload,
    WeekendSchedule,
)

DEFAULT_SEASON = 2026
DEFAULT_CIRCUIT_ID = "sepang"
# Jolpica round 16 of the 2026 season — the real Bahrain Grand Prix this
# app's fiction relocates to Sepang (see module docstring above). Race-day
# Picks scores against this round's real classification once it's final.
DEFAULT_ROUND = 16
# Was a fixed 2025 season-close snapshot — the standings strip now tracks
# the *current*, still-in-progress season live instead, same as the
# schedule above. A caller can still pass ?season=2025 for the old
# snapshot; this is only the default.
STANDINGS_SEASON = DEFAULT_SEASON

_TIMEOUT = httpx.Timeout(10.0)
_MYT = timezone(timedelta(hours=8))
# Standings only change once a session's results are final, not
# continuously — but a warm serverless instance can live for a while, and
# an indefinite in-process cache would silently serve a stale table for
# that whole lifetime. A short TTL keeps this "live" in the sense that
# actually matters (never more than a few minutes behind Jolpica) without
# hitting the upstream API on every single request.
_STANDINGS_CACHE_TTL_SECONDS = 300

# Practice / Quali duration when Ergast only publishes a start; race is
# longer. Mirrors the frontend bake in lib/sepangSchedule.ts.
_DURATION_MINUTES = {
    "FP1": 60,
    "FP2": 60,
    "FP3": 60,
    "Quali": 60,
    "Race": 120,
}

_schedule_cache: dict[tuple[int, str], WeekendSchedule] = {}
_standings_cache: dict[int, tuple[StandingsPayload, float]] = {}


class JolpicaUnavailable(Exception):
    """Raised when Jolpica has no data for the requested resource — a real
    "not found," not a transport failure. Routes turn this into a 404."""


class JolpicaUpstreamError(Exception):
    """Jolpica was unreachable or returned a server error — a transport
    problem, not a "this doesn't exist" answer. Routes turn this into a
    502."""


async def _get(client: httpx.AsyncClient, path: str) -> dict[str, Any]:
    base = settings.jolpica_base_url.rstrip("/")
    url = f"{base}/{path.lstrip('/')}"
    try:
        response = await client.get(url)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise JolpicaUpstreamError(f"Jolpica request failed: {url}") from exc
    payload = response.json()
    if not isinstance(payload, dict) or "MRData" not in payload:
        raise JolpicaUpstreamError(f"Unexpected Jolpica response shape from {url}")
    return payload


def _parse_start(date: str, time: str) -> datetime:
    # Ergast times are UTC with a trailing Z.
    return datetime.fromisoformat(f"{date}T{time.replace('Z', '+00:00')}").astimezone(_MYT)


def _session_window(label: str, date: str, time: str) -> ScheduleSession:
    start = _parse_start(date, time)
    end = start + timedelta(minutes=_DURATION_MINUTES[label])
    return ScheduleSession(
        session=label,
        start=start.isoformat(),
        end=end.isoformat(),
    )


def _race_to_schedule(race: dict[str, Any]) -> WeekendSchedule:
    try:
        sessions = [
            _session_window("FP1", race["FirstPractice"]["date"], race["FirstPractice"]["time"]),
            _session_window("FP2", race["SecondPractice"]["date"], race["SecondPractice"]["time"]),
            _session_window("FP3", race["ThirdPractice"]["date"], race["ThirdPractice"]["time"]),
            _session_window("Quali", race["Qualifying"]["date"], race["Qualifying"]["time"]),
            _session_window("Race", race["date"], race["time"]),
        ]
    except KeyError as exc:
        raise JolpicaUnavailable(
            f"Jolpica race is missing a session block ({exc}) — cannot build a schedule."
        ) from exc

    circuit = race["Circuit"]
    return WeekendSchedule(
        season=str(race["season"]),
        round=str(race["round"]),
        race_name=str(race["raceName"]),
        circuit_id=str(circuit["circuitId"]),
        circuit_name=str(circuit["circuitName"]),
        source="jolpica",
        sessions=sessions,
    )


async def get_sepang_schedule(
    season: int = DEFAULT_SEASON,
    circuit_id: str = DEFAULT_CIRCUIT_ID,
) -> WeekendSchedule:
    cache_key = (season, circuit_id)
    cached = _schedule_cache.get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        payload = await _get(client, f"{season}/circuits/{circuit_id}/races/")

    races = payload.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    if not races:
        raise JolpicaUnavailable(
            f"No Jolpica race found for season={season}, circuit={circuit_id}."
        )

    schedule = _race_to_schedule(races[0])
    _schedule_cache[cache_key] = schedule
    return schedule


async def get_standings(season: int = STANDINGS_SEASON) -> StandingsPayload:
    cached = _standings_cache.get(season)
    if cached is not None:
        payload, fetched_at = cached
        if time.monotonic() - fetched_at < _STANDINGS_CACHE_TTL_SECONDS:
            return payload

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        drivers_payload = await _get(client, f"{season}/driverstandings/")
        constructors_payload = await _get(client, f"{season}/constructorstandings/")

    driver_lists = (
        drivers_payload.get("MRData", {}).get("StandingsTable", {}).get("StandingsLists", [])
    )
    constructor_lists = (
        constructors_payload.get("MRData", {})
        .get("StandingsTable", {})
        .get("StandingsLists", [])
    )
    if not driver_lists or not constructor_lists:
        raise JolpicaUnavailable(f"No Jolpica standings found for season={season}.")

    driver_list = driver_lists[0]
    constructor_list = constructor_lists[0]

    drivers: list[DriverStandingRow] = []
    for row in driver_list.get("DriverStandings", []):
        try:
            driver = row["Driver"]
            constructors = row.get("Constructors") or []
            constructor_name = (
                str(constructors[0]["name"]) if constructors else "Unknown"
            )
            drivers.append(
                DriverStandingRow(
                    position=int(row["position"]),
                    points=float(row["points"]),
                    wins=int(row["wins"]),
                    driver_id=str(driver["driverId"]),
                    given_name=str(driver["givenName"]),
                    family_name=str(driver["familyName"]),
                    constructor_name=constructor_name,
                )
            )
        except (KeyError, TypeError, ValueError):
            continue

    constructors: list[ConstructorStandingRow] = []
    for row in constructor_list.get("ConstructorStandings", []):
        try:
            constructor = row["Constructor"]
            constructors.append(
                ConstructorStandingRow(
                    position=int(row["position"]),
                    points=float(row["points"]),
                    wins=int(row["wins"]),
                    constructor_id=str(constructor["constructorId"]),
                    name=str(constructor["name"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue

    if not drivers or not constructors:
        raise JolpicaUnavailable(f"Jolpica standings for season={season} parsed empty.")

    result = StandingsPayload(
        season=str(driver_list.get("season", season)),
        round=str(driver_list.get("round", "")),
        source="jolpica",
        drivers=drivers,
        constructors=constructors,
    )
    _standings_cache[season] = (result, time.monotonic())
    return result


async def get_race_classification(
    season: int = DEFAULT_SEASON, round_: int = DEFAULT_ROUND
) -> RaceClassification:
    """Real classification for a round — the source of truth Race-day Picks
    scores against. No in-memory cache here (unlike schedule/standings):
    the durable cache is picks_service's Supabase row, since a serverless
    instance's own memory isn't where "was this round already scored" needs
    to live. Returns is_final=False (not an error) before the race has run —
    that's an expected, common state for callers to handle, not a fault.
    """
    # Ergast/Jolpica returns HTTP 200 with an empty Races list for a round
    # that hasn't run yet — not a 404 — so a not-final round surfaces here
    # as empty data, not an exception. A genuine transport failure still
    # propagates as JolpicaUpstreamError, same as every other call in this
    # module.
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        results_payload = await _get(client, f"{season}/{round_}/results/")
        quali_payload = await _get(client, f"{season}/{round_}/qualifying/")

    races = results_payload.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    if not races or not races[0].get("Results"):
        return RaceClassification(
            season=str(season), round=str(round_), source="jolpica", is_final=False, results=[]
        )

    race = races[0]
    results: list[ClassifiedDriver] = []
    for row in race["Results"]:
        try:
            driver = row["Driver"]
            constructor = row["Constructor"]
            fastest_lap = row.get("FastestLap") or {}
            position_text = str(row.get("position", ""))
            results.append(
                ClassifiedDriver(
                    position=int(position_text) if position_text.isdigit() else None,
                    driver_family_name=str(driver["familyName"]),
                    constructor_name=str(constructor["name"]),
                    status=str(row.get("status", "")),
                    points=float(row.get("points", 0.0)),
                    fastest_lap_rank=(
                        int(fastest_lap["rank"]) if fastest_lap.get("rank") is not None else None
                    ),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue

    pole_family_name: str | None = None
    quali_races = quali_payload.get("MRData", {}).get("RaceTable", {}).get("Races", [])
    if quali_races and quali_races[0].get("QualifyingResults"):
        for row in quali_races[0]["QualifyingResults"]:
            if str(row.get("position")) == "1":
                pole_family_name = str(row["Driver"]["familyName"])
                break

    return RaceClassification(
        season=str(race.get("season", season)),
        round=str(race.get("round", round_)),
        source="jolpica",
        is_final=bool(results),
        pole_family_name=pole_family_name,
        results=results,
    )
