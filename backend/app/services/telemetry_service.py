"""Real F1 telemetry via OpenF1 (openf1.org) — an independent, community-run
API, not an official F1/FIA/FOM product, free and keyless for historical
data (anything from 2023 onward; live data during an active session needs
a paid OpenF1 account, which this app doesn't use — see README's "Note on
live data" for why that's an acceptable gap rather than something faked).

This app's own Sepang race weekend is fictional (see docs/BRAND.md), so
there's no real OpenF1 session for it. Rather than pretend otherwise, this
service defaults to a real, clearly-labeled session that actually
happened — the 2026 Dutch Grand Prix at Zandvoort, the same round already
cited (WebSearch-verified) for the driver/team "last time out" recaps in
data/drivers.ts and data/teams.ts. `year`/`circuit_short_name`/
`session_name` are still parameters, not hardcoded constants, so a caller
(or a future admin script) can point this at a different real session
without a code change.

IMPORTANT — verification gap: this module was written and unit-tested
against a mocked OpenF1 transport (see tests/test_telemetry_service.py)
because api.openf1.org is blocked by this sandbox's own network egress
policy (org policy, not something to route around — see
/root/.ccr/README.md). Field names and query syntax below are taken from
OpenF1's public docs and third-party write-ups, cross-checked across
several independent sources, but have NOT been confirmed against a live
response from this environment. Test this against the real API (this
runs fine outside this sandbox — a normal dev machine, CI runner, or the
deployed Vercel function all have ordinary internet access) before
trusting it in production; the most likely failure mode is the target
session not existing yet in OpenF1's archive, which surfaces as a clean
404 from the endpoints below rather than a crash.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings
from app.schemas.telemetry import TelemetryDriver, TelemetryLap, TelemetryLapTrace, TelemetrySample

DEFAULT_YEAR = 2026
DEFAULT_CIRCUIT = "Zandvoort"
DEFAULT_SESSION_NAME = "Race"

_TIMEOUT = httpx.Timeout(10.0)

# Session-key lookups and driver rosters for a real, already-completed
# session never change — cache them for this process's lifetime (a warm
# Vercel function instance) rather than re-querying OpenF1 on every
# request. Keyed by (year, circuit_short_name, session_name).
_session_key_cache: dict[tuple[int, str, str], int] = {}
_drivers_cache: dict[int, list[TelemetryDriver]] = {}


class TelemetryUnavailable(Exception):
    """Raised when OpenF1 has no data for the requested session/driver/lap
    — a real "not found," not a transport failure. Routes turn this into a
    404 rather than a 502."""


class TelemetryUpstreamError(Exception):
    """OpenF1 was unreachable or returned a server error — a transport
    problem, not a "this doesn't exist" answer. Routes turn this into a
    502."""


async def _get(client: httpx.AsyncClient, path: str, query: str) -> list[dict[str, Any]]:
    url = f"{settings.openf1_base_url}{path}?{query}"
    try:
        response = await client.get(url)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise TelemetryUpstreamError(f"OpenF1 request failed: {url}") from exc
    payload = response.json()
    if not isinstance(payload, list):
        raise TelemetryUpstreamError(f"Unexpected OpenF1 response shape from {url}")
    return payload


async def _resolve_session_key(
    client: httpx.AsyncClient, year: int, circuit_short_name: str, session_name: str
) -> int:
    cache_key = (year, circuit_short_name, session_name)
    cached = _session_key_cache.get(cache_key)
    if cached is not None:
        return cached

    query = (
        f"year={year}"
        f"&circuit_short_name={quote(circuit_short_name)}"
        f"&session_name={quote(session_name)}"
    )
    rows = await _get(client, "/sessions", query)
    if not rows:
        raise TelemetryUnavailable(
            f"No OpenF1 session found for year={year}, circuit={circuit_short_name}, "
            f"session={session_name} — it may not be in OpenF1's archive yet."
        )
    session_key = int(rows[0]["session_key"])
    _session_key_cache[cache_key] = session_key
    return session_key


async def get_drivers(
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryDriver]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        session_key = await _resolve_session_key(client, year, circuit_short_name, session_name)
        cached = _drivers_cache.get(session_key)
        if cached is not None:
            return cached

        rows = await _get(client, "/drivers", f"session_key={session_key}")
        # OpenF1 can list a driver more than once per session (e.g. a team
        # colour or name change mid-weekend) — keep the last row per
        # driver_number rather than the first, so a late correction wins.
        by_number: dict[int, TelemetryDriver] = {}
        for row in rows:
            try:
                number = int(row["driver_number"])
                by_number[number] = TelemetryDriver(
                    driver_number=number,
                    full_name=str(row.get("full_name", "")),
                    name_acronym=str(row.get("name_acronym", "")),
                    team_name=str(row.get("team_name", "")),
                )
            except (KeyError, TypeError, ValueError):
                continue
        drivers = sorted(by_number.values(), key=lambda d: d.driver_number)
        _drivers_cache[session_key] = drivers
        return drivers


async def get_laps(
    driver_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryLap]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        session_key = await _resolve_session_key(client, year, circuit_short_name, session_name)
        rows = await _get(
            client, "/laps", f"session_key={session_key}&driver_number={driver_number}"
        )

    laps: list[TelemetryLap] = []
    for row in rows:
        duration = row.get("lap_duration")
        # Out-laps/in-laps and any lap OpenF1 couldn't time carry a null
        # lap_duration — not useful for a telemetry replay, so drop them
        # rather than showing a lap the UI can't actually play.
        if duration is None:
            continue
        try:
            laps.append(TelemetryLap(lap_number=int(row["lap_number"]), lap_duration=float(duration)))
        except (KeyError, TypeError, ValueError):
            continue
    laps.sort(key=lambda lap: lap.lap_number)
    if not laps:
        raise TelemetryUnavailable(f"No timed laps found for driver {driver_number} in this session.")
    return laps


def _parse_openf1_date(value: str) -> datetime:
    # OpenF1 dates are ISO 8601 with an explicit offset (e.g.
    # "...+00:00") — fromisoformat handles that natively on Python 3.11+.
    return datetime.fromisoformat(value)


async def get_lap_trace(
    driver_number: int,
    lap_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> TelemetryLapTrace:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        session_key = await _resolve_session_key(client, year, circuit_short_name, session_name)

        lap_rows = await _get(
            client,
            "/laps",
            f"session_key={session_key}&driver_number={driver_number}&lap_number={lap_number}",
        )
        if not lap_rows or lap_rows[0].get("lap_duration") is None or lap_rows[0].get("date_start") is None:
            raise TelemetryUnavailable(
                f"Lap {lap_number} for driver {driver_number} isn't a timed lap with a start time."
            )
        lap_duration = float(lap_rows[0]["lap_duration"])
        lap_start = _parse_openf1_date(lap_rows[0]["date_start"])
        # OpenF1's date filters take a literal `>`/`<` in the parameter
        # name (not a `key=value` pair, and not `>=`) — e.g.
        # `date>2023-09-16T13:03:35.200`. httpx's dict-based `params=`
        # can't express that (it would insert an `=` after the operator),
        # so this builds the query string by hand instead.
        lap_end = lap_start.timestamp() + lap_duration
        date_query = (
            f"session_key={session_key}"
            f"&driver_number={driver_number}"
            f"&date>{quote(lap_start.isoformat())}"
            f"&date<{quote(datetime.fromtimestamp(lap_end, tz=lap_start.tzinfo).isoformat())}"
        )
        car_rows = await _get(client, "/car_data", date_query)

        drivers = await get_drivers(year, circuit_short_name, session_name)

    driver = next((d for d in drivers if d.driver_number == driver_number), None)
    if driver is None:
        driver = TelemetryDriver(
            driver_number=driver_number, full_name="", name_acronym="", team_name=""
        )

    samples: list[TelemetrySample] = []
    for row in car_rows:
        try:
            sample_time = _parse_openf1_date(row["date"])
            samples.append(
                TelemetrySample(
                    t=(sample_time - lap_start).total_seconds(),
                    speed=float(row.get("speed", 0.0)),
                    throttle=float(row.get("throttle", 0.0)),
                    brake=float(row.get("brake", 0.0)),
                    rpm=float(row.get("rpm", 0.0)),
                    gear=int(row.get("n_gear", 0)),
                    drs=int(row.get("drs", 0)),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    samples.sort(key=lambda s: s.t)

    if not samples:
        raise TelemetryUnavailable(
            f"OpenF1 returned no car_data samples for driver {driver_number}'s lap {lap_number}."
        )

    return TelemetryLapTrace(
        year=year,
        session_name=session_name,
        circuit_short_name=circuit_short_name,
        driver=driver,
        lap_number=lap_number,
        lap_duration=lap_duration,
        samples=samples,
    )
