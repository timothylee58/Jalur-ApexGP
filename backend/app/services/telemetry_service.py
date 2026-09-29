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

VERIFIED AGAINST THE LIVE API (2026-09-29). api.openf1.org is blocked by
the dev sandbox's egress policy, so the endpoints were exercised from an
external fetcher instead: /sessions, /drivers, /laps and the hand-built
`date>`/`date<` /car_data range query (offset-encoded timestamps included)
all return the shapes parsed below for the default session (key 11353).
Two things that check surfaced, both handled here:

  - 2026 cars have no DRS (Overtake Mode replaced it), and OpenF1 reports
    `"drs": null` on every 2026 sample. The parser used to feed that to
    int(), drop every sample as malformed, and 404 every lap. Null channels
    are now tolerated; only a sample with no timestamp or no speed is
    skipped.
  - The free tier is rate limited (3 req/s, 30 req/min, per OpenF1's FAQ)
    and one cold page view costs up to seven upstream calls. A 429 is
    retried once after its Retry-After, and a finished session's responses
    are cached — in this process, and (via the routes' Cache-Control) at
    Vercel's edge — because historical telemetry never changes.
"""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import httpx

from app.config import settings
from app.schemas.telemetry import TelemetryDriver, TelemetryLap, TelemetryLapTrace, TelemetrySample

DEFAULT_YEAR = 2026
DEFAULT_CIRCUIT = "Zandvoort"
DEFAULT_SESSION_NAME = "Race"

_TIMEOUT = httpx.Timeout(10.0)
# One retry for a 429, waiting what the server asks for within these bounds
# — long enough to clear a per-second burst, short enough to stay well
# inside the function's time budget.
_MAX_ATTEMPTS = 2
_RETRY_DELAY_S = (0.3, 2.0)
# OpenF1 treats a session as live until 30 minutes after it ends; only
# after that is its data final and safe to cache.
_LIVE_TAIL = timedelta(minutes=30)
_TRACE_CACHE_SIZE = 64


@dataclass(frozen=True)
class _SessionRef:
    key: int
    ends_at: datetime | None

    @property
    def final(self) -> bool:
        return self.ends_at is not None and datetime.now(UTC) > self.ends_at + _LIVE_TAIL


# Session lookups and driver rosters never change — cached for this
# process's lifetime (a warm Vercel function instance). Laps and lap traces
# are cached too, but only once the session is final (see _SessionRef).
_session_key_cache: dict[tuple[int, str, str], _SessionRef] = {}
_drivers_cache: dict[int, list[TelemetryDriver]] = {}
_laps_cache: dict[tuple[int, int], list[TelemetryLap]] = {}
_trace_cache: OrderedDict[tuple[int, int, int], TelemetryLapTrace] = OrderedDict()


class TelemetryUnavailable(Exception):
    """Raised when OpenF1 has no data for the requested session/driver/lap
    — a real "not found," not a transport failure. Routes turn this into a
    404 rather than a 502."""


class TelemetryUpstreamError(Exception):
    """OpenF1 was unreachable or returned a server error — a transport
    problem, not a "this doesn't exist" answer. Routes turn this into a
    502."""


def _retry_delay(response: httpx.Response) -> float:
    low, high = _RETRY_DELAY_S
    try:
        wanted = float(response.headers.get("retry-after", low))
    except ValueError:
        wanted = low
    return min(max(wanted, low), high)


async def _get(client: httpx.AsyncClient, path: str, query: str) -> list[dict[str, Any]]:
    url = f"{settings.openf1_base_url}{path}?{query}"
    for attempt in range(_MAX_ATTEMPTS):
        try:
            response = await client.get(url)
        except httpx.HTTPError as exc:
            raise TelemetryUpstreamError(f"OpenF1 request failed: {url}") from exc
        if response.status_code == 429 and attempt + 1 < _MAX_ATTEMPTS:
            await asyncio.sleep(_retry_delay(response))
            continue
        break
    if response.status_code == 429:
        raise TelemetryUpstreamError(
            "OpenF1 is rate limiting this app right now (free tier: 3 requests/second, "
            "30/minute) — try again in a minute."
        )
    try:
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise TelemetryUpstreamError(f"OpenF1 returned {response.status_code} for {url}") from exc
    payload = response.json()
    if not isinstance(payload, list):
        raise TelemetryUpstreamError(f"Unexpected OpenF1 response shape from {url}")
    return payload


async def _resolve_session(
    client: httpx.AsyncClient, year: int, circuit_short_name: str, session_name: str
) -> _SessionRef:
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
    ends_at = rows[0].get("date_end")
    ref = _SessionRef(
        key=int(rows[0]["session_key"]),
        ends_at=_parse_openf1_date(ends_at) if isinstance(ends_at, str) else None,
    )
    _session_key_cache[cache_key] = ref
    return ref


def session_is_final(
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> bool:
    """Whether a session already resolved in this process has finished for
    good — the routes use it to decide whether a response may be cached at
    the edge. Unknown sessions answer False (never cache on a guess)."""
    ref = _session_key_cache.get((year, circuit_short_name, session_name))
    return ref is not None and ref.final


async def get_drivers(
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryDriver]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        session = await _resolve_session(client, year, circuit_short_name, session_name)
        cached = _drivers_cache.get(session.key)
        if cached is not None:
            return cached

        rows = await _get(client, "/drivers", f"session_key={session.key}")
        # OpenF1 can list a driver more than once per session (e.g. a team
        # colour or name change mid-weekend) — keep the last row per
        # driver_number rather than the first, so a late correction wins.
        by_number: dict[int, TelemetryDriver] = {}
        for row in rows:
            try:
                number = int(row["driver_number"])
                colour = row.get("team_colour")
                by_number[number] = TelemetryDriver(
                    driver_number=number,
                    full_name=str(row.get("full_name", "")),
                    name_acronym=str(row.get("name_acronym", "")),
                    team_name=str(row.get("team_name", "")),
                    team_colour=str(colour) if colour else None,
                )
            except (KeyError, TypeError, ValueError):
                continue
        drivers = sorted(by_number.values(), key=lambda d: d.driver_number)
        _drivers_cache[session.key] = drivers
        return drivers


async def get_laps(
    driver_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryLap]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        session = await _resolve_session(client, year, circuit_short_name, session_name)
        cached = _laps_cache.get((session.key, driver_number))
        if cached is not None:
            return cached
        rows = await _get(
            client, "/laps", f"session_key={session.key}&driver_number={driver_number}"
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
    if session.final:
        _laps_cache[(session.key, driver_number)] = laps
    return laps


def _parse_openf1_date(value: str) -> datetime:
    # OpenF1 dates are ISO 8601 with an explicit offset (e.g.
    # "...+00:00") — fromisoformat handles that natively on Python 3.11+.
    return datetime.fromisoformat(value)


def _num(row: dict[str, Any], key: str) -> float:
    # A channel OpenF1 reports as null (or omits) reads as 0 rather than
    # invalidating the whole sample.
    value = row.get(key)
    return 0.0 if value is None else float(value)


def _integrate_distance(samples: list[TelemetrySample]) -> None:
    """Metres from the line, by trapezoidal integration of speed over time.
    OpenF1's car_data has no distance channel; this is what lets two laps
    be lined up by track position (within a percent or two of the real
    lap length, which the comparison normalises away)."""
    total = 0.0
    samples[0].distance = 0.0
    for prev, cur in zip(samples, samples[1:]):
        dt = max(cur.t - prev.t, 0.0)
        total += (prev.speed + cur.speed) / 2 / 3.6 * dt
        cur.distance = total


def _attach_positions(
    samples: list[TelemetrySample], location_rows: list[dict[str, Any]], lap_start: datetime
) -> bool:
    """Give each car sample the nearest-in-time /location fix (OpenF1 samples
    position and car data on separate ~3.7 Hz clocks). Returns whether any
    position was attached."""
    fixes: list[tuple[float, float, float]] = []
    for row in location_rows:
        date, x, y = row.get("date"), row.get("x"), row.get("y")
        if date is None or x is None or y is None:
            continue
        try:
            fixes.append(((_parse_openf1_date(date) - lap_start).total_seconds(), float(x), float(y)))
        except (TypeError, ValueError):
            continue
    if not fixes:
        return False
    fixes.sort()
    j = 0
    for sample in samples:
        while j + 1 < len(fixes) and abs(fixes[j + 1][0] - sample.t) <= abs(fixes[j][0] - sample.t):
            j += 1
        t, x, y = fixes[j]
        # Farther than half a second away isn't this point on track.
        if abs(t - sample.t) <= 0.5:
            sample.x, sample.y = x, y
    return any(sample.x is not None for sample in samples)


async def get_lap_trace(
    driver_number: int,
    lap_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> TelemetryLapTrace:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        session = await _resolve_session(client, year, circuit_short_name, session_name)
        cached = _trace_cache.get((session.key, driver_number, lap_number))
        if cached is not None:
            _trace_cache.move_to_end((session.key, driver_number, lap_number))
            return cached

        lap_rows = await _get(
            client,
            "/laps",
            f"session_key={session.key}&driver_number={driver_number}&lap_number={lap_number}",
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
            f"session_key={session.key}"
            f"&driver_number={driver_number}"
            f"&date>{quote(lap_start.isoformat())}"
            f"&date<{quote(datetime.fromtimestamp(lap_end, tz=lap_start.tzinfo).isoformat())}"
        )
        car_rows = await _get(client, "/car_data", date_query)
        # Position for the track map is a nice-to-have: if this one extra
        # call is refused (most likely the rate limit), the lap still loads,
        # just without a map — and isn't cached, so a later view can fill it.
        try:
            location_rows = await _get(client, "/location", date_query)
        except TelemetryUpstreamError:
            location_rows = []

        drivers = await get_drivers(year, circuit_short_name, session_name)

    driver = next((d for d in drivers if d.driver_number == driver_number), None)
    if driver is None:
        driver = TelemetryDriver(
            driver_number=driver_number, full_name="", name_acronym="", team_name=""
        )

    samples: list[TelemetrySample] = []
    for row in car_rows:
        # A sample is only useless without a timestamp or a speed; any other
        # channel may be null. (DRS is null on every 2026 sample — the cars
        # don't have it — and must not cost the sample.)
        date, speed, drs = row.get("date"), row.get("speed"), row.get("drs")
        if date is None or speed is None:
            continue
        try:
            samples.append(
                TelemetrySample(
                    t=(_parse_openf1_date(date) - lap_start).total_seconds(),
                    speed=float(speed),
                    throttle=_num(row, "throttle"),
                    brake=_num(row, "brake"),
                    rpm=_num(row, "rpm"),
                    gear=int(_num(row, "n_gear")),
                    drs=None if drs is None else int(drs),
                )
            )
        except (TypeError, ValueError):
            continue
    samples.sort(key=lambda s: s.t)

    if not samples:
        raise TelemetryUnavailable(
            f"OpenF1 returned no car_data samples for driver {driver_number}'s lap {lap_number}."
        )
    _integrate_distance(samples)
    has_positions = _attach_positions(samples, location_rows, lap_start)

    trace = TelemetryLapTrace(
        year=year,
        session_name=session_name,
        circuit_short_name=circuit_short_name,
        driver=driver,
        lap_number=lap_number,
        lap_duration=lap_duration,
        samples=samples,
    )
    if session.final and has_positions:
        _trace_cache[(session.key, driver_number, lap_number)] = trace
        while len(_trace_cache) > _TRACE_CACHE_SIZE:
            _trace_cache.popitem(last=False)
    return trace
