"""Unit tests for telemetry_service, run against a mocked httpx transport —
api.openf1.org is blocked by this dev sandbox's own network egress policy,
so this is what actually got verified pre-merge; see the "verification gap"
note in telemetry_service.py's module docstring. These check the request
construction and response parsing this module is responsible for, not
whether OpenF1's real API matches the shapes assumed here.
"""

from __future__ import annotations

from collections.abc import Callable

import httpx
import pytest

from app.services import telemetry_service
from app.services.telemetry_service import (
    TelemetryUnavailable,
    TelemetryUpstreamError,
    get_drivers,
    get_lap_trace,
    get_laps,
)

_RealAsyncClient = httpx.AsyncClient


def _patch_client(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    # Must close over the *original* AsyncClient captured above, not
    # `httpx.AsyncClient` — monkeypatch replaces that name with this very
    # factory, so referencing it inside the factory body would call the
    # factory again (infinite self-recursion, surfaced as a confusing
    # "multiple values for keyword argument 'transport'" TypeError instead
    # of a stack overflow, since each recursive call added another
    # `transport=` kwarg on top of the one already in **kw).
    def factory(**kwargs: object) -> httpx.AsyncClient:
        return _RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)


@pytest.fixture(autouse=True)
def _clear_caches():
    telemetry_service._session_key_cache.clear()
    telemetry_service._drivers_cache.clear()
    yield
    telemetry_service._session_key_cache.clear()
    telemetry_service._drivers_cache.clear()


@pytest.mark.asyncio
async def test_session_key_is_cached_across_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    session_calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal session_calls
        if request.url.path == "/v1/sessions":
            session_calls += 1
            return httpx.Response(200, json=[{"session_key": 9999}])
        if request.url.path == "/v1/drivers":
            return httpx.Response(200, json=[])
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    await get_drivers(year=2099, circuit_short_name="Testville", session_name="Race")
    await get_drivers(year=2099, circuit_short_name="Testville", session_name="Race")
    assert session_calls == 1


@pytest.mark.asyncio
async def test_get_drivers_dedupes_and_sorts_by_number(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[{"session_key": 1}])
        if request.url.path == "/v1/drivers":
            return httpx.Response(
                200,
                json=[
                    {"driver_number": 4, "full_name": "Lando Norris", "name_acronym": "NOR", "team_name": "McLaren"},
                    {"driver_number": 1, "full_name": "Max Verstappen", "name_acronym": "VER", "team_name": "Red Bull"},
                    # A repeated row for #4 with a corrected name — the later
                    # row should win, not the first.
                    {"driver_number": 4, "full_name": "Lando Norris ", "name_acronym": "NOR", "team_name": "McLaren"},
                ],
            )
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    drivers = await get_drivers(year=2050, circuit_short_name="Testville", session_name="Race")
    assert [d.driver_number for d in drivers] == [1, 4]
    assert drivers[1].full_name == "Lando Norris "


@pytest.mark.asyncio
async def test_get_laps_drops_untimed_laps(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[{"session_key": 1}])
        if request.url.path == "/v1/laps":
            return httpx.Response(
                200,
                json=[
                    {"lap_number": 1, "lap_duration": None},  # out-lap
                    {"lap_number": 2, "lap_duration": 91.234},
                    {"lap_number": 3, "lap_duration": 90.001},
                ],
            )
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    laps = await get_laps(driver_number=4, year=2051, circuit_short_name="Testville", session_name="Race")
    assert [lap.lap_number for lap in laps] == [2, 3]


@pytest.mark.asyncio
async def test_get_laps_raises_when_none_timed(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[{"session_key": 1}])
        if request.url.path == "/v1/laps":
            return httpx.Response(200, json=[{"lap_number": 1, "lap_duration": None}])
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    with pytest.raises(TelemetryUnavailable):
        await get_laps(driver_number=4, year=2052, circuit_short_name="Testville", session_name="Race")


@pytest.mark.asyncio
async def test_missing_session_raises_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[])
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    with pytest.raises(TelemetryUnavailable):
        await get_drivers(year=2053, circuit_short_name="Nowhere", session_name="Race")


@pytest.mark.asyncio
async def test_upstream_5xx_raises_upstream_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    _patch_client(monkeypatch, handler)

    with pytest.raises(TelemetryUpstreamError):
        await get_drivers(year=2054, circuit_short_name="Testville", session_name="Race")


@pytest.mark.asyncio
async def test_lap_trace_computes_relative_time_and_sorts_samples(monkeypatch: pytest.MonkeyPatch) -> None:
    lap_start = "2026-08-23T14:00:00.000000+00:00"

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[{"session_key": 42}])
        if request.url.path == "/v1/laps":
            return httpx.Response(
                200,
                json=[{"lap_number": 5, "lap_duration": 2.0, "date_start": lap_start}],
            )
        if request.url.path == "/v1/car_data":
            # Assert the hand-built date-range query actually carries the
            # literal `>`/`<` operators OpenF1 expects, not `key=value`.
            raw_query = request.url.query.decode()
            assert "date%3E" in raw_query or "date>" in raw_query
            assert "date%3C" in raw_query or "date<" in raw_query
            return httpx.Response(
                200,
                json=[
                    # Deliberately out of chronological order.
                    {"date": "2026-08-23T14:00:01.000000+00:00", "speed": 250, "throttle": 100, "brake": 0, "rpm": 11000, "n_gear": 7, "drs": 12},
                    {"date": "2026-08-23T14:00:00.000000+00:00", "speed": 200, "throttle": 80, "brake": 0, "rpm": 10000, "n_gear": 6, "drs": 0},
                ],
            )
        if request.url.path == "/v1/drivers":
            return httpx.Response(200, json=[{"driver_number": 4, "full_name": "Lando Norris", "name_acronym": "NOR", "team_name": "McLaren"}])
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    trace = await get_lap_trace(driver_number=4, lap_number=5, year=2055, circuit_short_name="Testville", session_name="Race")
    assert trace.lap_duration == 2.0
    assert trace.driver.full_name == "Lando Norris"
    assert [round(s.t, 3) for s in trace.samples] == [0.0, 1.0]
    assert trace.samples[0].speed == 200
    assert trace.samples[1].speed == 250
