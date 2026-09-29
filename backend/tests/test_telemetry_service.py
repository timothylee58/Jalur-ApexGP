"""Unit tests for telemetry_service, run against a mocked httpx transport
(api.openf1.org is blocked by the dev sandbox's egress policy). The mocked
rows mirror real OpenF1 responses, which were checked against the live API
from an external fetcher — see the module docstring in telemetry_service.py.
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


def _clear() -> None:
    from app.services import tracinginsights_service

    tracinginsights_service._json_cache.clear()
    telemetry_service._session_key_cache.clear()
    telemetry_service._drivers_cache.clear()
    telemetry_service._laps_cache.clear()
    telemetry_service._trace_cache.clear()


@pytest.fixture(autouse=True)
def _clear_caches():
    _clear()
    yield
    _clear()


@pytest.fixture
def no_sleep(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    """Records retry waits instead of sleeping through them."""
    waits: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        waits.append(seconds)

    monkeypatch.setattr(telemetry_service.asyncio, "sleep", fake_sleep)
    return waits


FINISHED = "2026-08-23T15:00:00+00:00"
IN_THE_FUTURE = "2999-01-01T00:00:00+00:00"


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
        if request.url.path == "/v1/location":
            return httpx.Response(200, json=[])
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch_client(monkeypatch, handler)

    trace = await get_lap_trace(driver_number=4, lap_number=5, year=2055, circuit_short_name="Testville", session_name="Race")
    assert trace.lap_duration == 2.0
    assert trace.driver.full_name == "Lando Norris"
    assert [round(s.t, 3) for s in trace.samples] == [0.0, 1.0]
    assert trace.samples[0].speed == 200
    assert trace.samples[1].speed == 250


def _real_2026_handler(
    date_end: str = FINISHED, car_rows: list[dict] | None = None, location_status: int = 200
):
    """Rows shaped exactly like OpenF1's live responses for the 2026 Dutch GP
    (session 11353): note `"drs": null` on every car_data row."""
    lap_start = "2026-08-23T13:41:02.648000+00:00"
    rows = car_rows if car_rows is not None else [
        {"date": "2026-08-23T13:41:02.680000+00:00", "session_key": 11353, "speed": 310, "brake": 0,
         "n_gear": 8, "driver_number": 1, "meeting_key": 1292, "throttle": 100, "rpm": 11275, "drs": None},
        {"date": "2026-08-23T13:41:04.881000+00:00", "session_key": 11353, "speed": 285, "brake": 100,
         "n_gear": 8, "driver_number": 1, "meeting_key": 1292, "throttle": 0, "rpm": 11848, "drs": None},
    ]
    calls: dict[str, int] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        calls[request.url.path] = calls.get(request.url.path, 0) + 1
        if request.url.host == "raw.githubusercontent.com":
            # Corner distances for the charts come from TracingInsights.
            if request.url.path.endswith("/corners.json"):
                return httpx.Response(200, json={"CornerNumber": [1], "Distance": [484.42]})
            return httpx.Response(404)
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[{"session_key": 11353, "date_end": date_end}])
        if request.url.path == "/v1/laps":
            return httpx.Response(
                200,
                json=[{"lap_number": 6, "lap_duration": 76.867, "date_start": lap_start}],
            )
        if request.url.path == "/v1/car_data":
            return httpx.Response(200, json=rows)
        if request.url.path == "/v1/drivers":
            return httpx.Response(
                200,
                json=[{"driver_number": 1, "full_name": "Lando NORRIS", "name_acronym": "NOR",
                       "team_name": "McLaren", "team_colour": "F47600"}],
            )
        if request.url.path == "/v1/location":
            if location_status != 200:
                return httpx.Response(location_status)
            # Real /location rows from the same lap (x/y in the feed's frame).
            return httpx.Response(
                200,
                json=[
                    {"date": "2026-08-23T13:41:02.781000+00:00", "x": 645, "y": 4112, "z": 537},
                    {"date": "2026-08-23T13:41:04.781000+00:00", "x": 1242, "y": 5622, "z": 538},
                ],
            )
        raise AssertionError(f"unexpected path {request.url.path}")

    return handler, calls


@pytest.mark.asyncio
async def test_2026_samples_with_null_drs_are_kept(monkeypatch: pytest.MonkeyPatch) -> None:
    # The regression that 404'd every 2026 lap: int(None) on the DRS channel
    # threw, and every sample was discarded as malformed.
    handler, _ = _real_2026_handler()
    _patch_client(monkeypatch, handler)

    trace = await get_lap_trace(driver_number=1, lap_number=6)
    assert len(trace.samples) == 2
    assert all(sample.drs is None for sample in trace.samples)
    assert trace.samples[1].brake == 100
    assert trace.samples[1].gear == 8


@pytest.mark.asyncio
async def test_null_channels_read_as_zero_but_a_sample_without_speed_is_dropped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    handler, _ = _real_2026_handler(
        car_rows=[
            {"date": "2026-08-23T13:41:03.000000+00:00", "speed": 300, "throttle": None, "brake": None,
             "rpm": None, "n_gear": None, "drs": None},
            {"date": "2026-08-23T13:41:04.000000+00:00", "speed": None, "throttle": 100, "brake": 0,
             "rpm": 11000, "n_gear": 8, "drs": None},
        ]
    )
    _patch_client(monkeypatch, handler)

    trace = await get_lap_trace(driver_number=1, lap_number=6)
    assert len(trace.samples) == 1
    sample = trace.samples[0]
    assert (sample.speed, sample.throttle, sample.brake, sample.rpm, sample.gear) == (300, 0, 0, 0, 0)


@pytest.mark.asyncio
async def test_a_429_is_retried_once_after_its_retry_after(
    monkeypatch: pytest.MonkeyPatch, no_sleep: list[float]
) -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        if request.url.path == "/v1/sessions":
            attempts += 1
            if attempts == 1:
                return httpx.Response(429, headers={"Retry-After": "1"})
            return httpx.Response(200, json=[{"session_key": 11353, "date_end": FINISHED}])
        return httpx.Response(200, json=[{"driver_number": 1, "full_name": "Lando NORRIS"}])

    _patch_client(monkeypatch, handler)

    drivers = await get_drivers()
    assert [d.driver_number for d in drivers] == [1]
    assert attempts == 2
    assert no_sleep == [1.0]


@pytest.mark.asyncio
async def test_a_persistent_429_surfaces_as_rate_limited(
    monkeypatch: pytest.MonkeyPatch, no_sleep: list[float]
) -> None:
    _patch_client(monkeypatch, lambda request: httpx.Response(429, headers={"Retry-After": "60"}))

    with pytest.raises(TelemetryUpstreamError, match="rate limiting"):
        await get_drivers()
    # One retry only, and never a minute-long stall inside a request.
    assert no_sleep == [telemetry_service._RETRY_DELAY_S[1]]


@pytest.mark.asyncio
async def test_a_finished_session_is_served_from_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    handler, calls = _real_2026_handler(date_end=FINISHED)
    _patch_client(monkeypatch, handler)

    await get_laps(driver_number=1)
    await get_laps(driver_number=1)
    await get_lap_trace(driver_number=1, lap_number=6)
    await get_lap_trace(driver_number=1, lap_number=6)

    assert calls["/v1/sessions"] == 1
    assert calls["/v1/car_data"] == 1
    # One /laps call for the lap list and one for the lap's start time.
    assert calls["/v1/laps"] == 2
    assert telemetry_service.session_is_final()


@pytest.mark.asyncio
async def test_a_session_that_is_not_over_is_never_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    handler, calls = _real_2026_handler(date_end=IN_THE_FUTURE)
    _patch_client(monkeypatch, handler)

    await get_lap_trace(driver_number=1, lap_number=6)
    await get_lap_trace(driver_number=1, lap_number=6)

    assert calls["/v1/car_data"] == 2
    assert not telemetry_service.session_is_final()


def test_routes_cache_final_sessions_at_the_edge_and_nothing_else(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)

    handler, _ = _real_2026_handler(date_end=FINISHED)
    _patch_client(monkeypatch, handler)
    final = client.get("/api/telemetry/lap-trace?driver_number=1&lap_number=6")
    assert final.status_code == 200
    assert "s-maxage" in final.headers["cache-control"]
    assert final.json()["samples"][0]["drs"] is None

    _clear()
    handler, _ = _real_2026_handler(date_end=IN_THE_FUTURE)
    _patch_client(monkeypatch, handler)
    live = client.get("/api/telemetry/lap-trace?driver_number=1&lap_number=6")
    assert live.status_code == 200
    assert live.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_lap_trace_gains_distance_positions_and_team_colour(monkeypatch: pytest.MonkeyPatch) -> None:
    handler, _ = _real_2026_handler()
    _patch_client(monkeypatch, handler)

    trace = await get_lap_trace(driver_number=1, lap_number=6)
    first, second = trace.samples
    # 310 -> 285 km/h over 2.201 s: trapezoidal distance ≈ 181.6 m.
    assert first.distance == 0.0
    assert second.distance == pytest.approx((310 + 285) / 2 / 3.6 * 2.201, rel=1e-6)
    # Each car sample takes the nearest /location fix within half a second.
    assert (first.x, first.y) == (645, 4112)
    assert (second.x, second.y) == (1242, 5622)
    assert trace.driver.team_colour == "F47600"


@pytest.mark.asyncio
async def test_a_refused_location_call_costs_the_map_not_the_lap(
    monkeypatch: pytest.MonkeyPatch, no_sleep: list[float]
) -> None:
    handler, calls = _real_2026_handler(location_status=429)
    _patch_client(monkeypatch, handler)

    trace = await get_lap_trace(driver_number=1, lap_number=6)
    assert len(trace.samples) == 2
    assert all(sample.x is None for sample in trace.samples)
    # Not cached without positions, so a later request can still fill them.
    await get_lap_trace(driver_number=1, lap_number=6)
    assert calls["/v1/car_data"] == 2
