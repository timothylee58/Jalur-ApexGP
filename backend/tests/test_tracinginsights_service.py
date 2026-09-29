"""TracingInsights client and the OpenF1 -> TracingInsights fallback.

Fixtures are cut from the real published files for the 2026 Dutch GP race
(github.com/TracingInsights/2026, "Dutch Grand Prix/Race/…"): columnar
JSON, "None" strings for missing values, a 0/1 brake flag.
"""

from __future__ import annotations

from collections.abc import Callable
from urllib.parse import unquote

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import telemetry_pipeline, telemetry_service, tracinginsights_service
from app.schemas.telemetry import TelemetryCorner, TelemetrySample
from app.services.telemetry_service import TelemetryUnavailable, TelemetryUpstreamError

_RealAsyncClient = httpx.AsyncClient

TI_BASE = "/TracingInsights/2026/main/Dutch Grand Prix/Race"

DRIVERS = {
    "drivers": [
        {"driver": "NOR", "team": "McLaren", "dn": "1", "fn": "Lando", "ln": "Norris", "tc": "F47600", "url": "x"},
        {"driver": "VER", "team": "Red Bull Racing", "dn": "3", "fn": "Max", "ln": "Verstappen", "tc": "4781D7", "url": "x"},
    ]
}
NOR_LAPS = {
    "time": ["None", 123.197, 74.321],
    "lap": [1, 2, 49],
    "compound": ["MEDIUM", "MEDIUM", "HARD"],
}
NOR_49_TEL = {
    "tel": {
        "time": [0.0, 0.067, 0.116],
        "rpm": [11621.1, 11638.0, 11642.08],
        "speed": [318.63, 319.0, 319.18],
        "gear": [8, 8, 8],
        "throttle": [100.0, 100.0, 100.0],
        "brake": [0, 1, 0],
        "drs": [0, 0, 0],
        "distance": [0.143, 6.1, 10.46],
        "x": [13.72, 34.77, 50.0],
        "y": [2507.06, 2562.15, 2602.0],
        "dataKey": "2026-Dutch Grand Prix-Race-NOR-49",
    }
}
CORNERS = {
    "CornerNumber": [1, 2, 3],
    "X": [2045.2, 1769.6, 733.6],
    "Y": [6685.9, 3831.8, 2809.6],
    "Angle": [66.7, -18.4, 29.3],
    "Distance": [484.42, 790.17, 961.68],
    "Rotation": 0.0,
}
SESSION_LAPS = {
    "drv": ["NOR", "NOR", "VER"],
    "lap": [1, 2, 1],
    "time": ["None", 123.197, 85.1],
    "compound": ["MEDIUM", "MEDIUM", "SOFT"],
    "stint": [1, 1, 1],
    "pos": [1, 1, 2],
    "pin": ["None", 3610.95, "None"],
    "pout": ["None", "None", "None"],
    "status": ["1", "125", "1"],
}

TI_FILES = {
    f"{TI_BASE}/drivers.json": DRIVERS,
    f"{TI_BASE}/NOR/laptimes.json": NOR_LAPS,
    f"{TI_BASE}/NOR/49_tel.json": NOR_49_TEL,
    f"{TI_BASE}/corners.json": CORNERS,
    f"{TI_BASE}/session_laptimes.json": SESSION_LAPS,
}


def _patch(monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]) -> None:
    def factory(**kwargs: object) -> httpx.AsyncClient:
        return _RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)


def _ti(request: httpx.Request) -> httpx.Response:
    # Paths arrive percent-encoded ("Dutch%20Grand%20Prix/..."); the fixture
    # keys are written plainly.
    payload = TI_FILES.get(unquote(request.url.path))
    return httpx.Response(200, json=payload) if payload is not None else httpx.Response(404, text="404: Not Found")


def _openf1_rate_limited(request: httpx.Request) -> httpx.Response:
    if request.url.host == "raw.githubusercontent.com":
        return _ti(request)
    return httpx.Response(429, headers={"Retry-After": "1"})


@pytest.fixture(autouse=True)
def _clear(monkeypatch: pytest.MonkeyPatch):
    for cache in (
        telemetry_service._session_key_cache,
        telemetry_service._drivers_cache,
        telemetry_service._laps_cache,
        telemetry_service._trace_cache,
        tracinginsights_service._json_cache,
    ):
        cache.clear()

    async def no_sleep(seconds: float) -> None:
        return None

    monkeypatch.setattr(telemetry_service.asyncio, "sleep", no_sleep)
    yield


# --- the client ------------------------------------------------------------


def test_event_folders_follow_the_repository_names() -> None:
    assert tracinginsights_service.event_folder(2026, "Zandvoort") == "Dutch Grand Prix"
    # 2026 renamed Barcelona's round; Madrid took the Spanish GP name.
    assert tracinginsights_service.event_folder(2026, "Catalunya") == "Barcelona Grand Prix"
    assert tracinginsights_service.event_folder(2025, "Catalunya") == "Spanish Grand Prix"
    assert tracinginsights_service.event_folder(2026, "Madring") == "Spanish Grand Prix"
    assert tracinginsights_service.event_folder(2026, "Nowhere") is None


@pytest.mark.asyncio
async def test_drivers_read_like_openf1_drivers(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _ti)
    drivers = await tracinginsights_service.get_drivers(2026, "Zandvoort", "Race")
    assert [(d.driver_number, d.full_name, d.name_acronym, d.team_colour) for d in drivers] == [
        (1, "Lando NORRIS", "NOR", "F47600"),
        (3, "Max VERSTAPPEN", "VER", "4781D7"),
    ]


@pytest.mark.asyncio
async def test_laps_skip_the_none_strings(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _ti)
    laps = await tracinginsights_service.get_laps(1, 2026, "Zandvoort", "Race")
    assert [(lap.lap_number, lap.lap_duration) for lap in laps] == [(2, 123.197), (49, 74.321)]


@pytest.mark.asyncio
async def test_lap_trace_maps_channels_onto_openf1_conventions(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _ti)
    trace = await tracinginsights_service.get_lap_trace(1, 49, 2026, "Zandvoort", "Race")
    assert trace.source == "tracinginsights"
    assert trace.lap_duration == 74.321
    assert [s.brake for s in trace.samples] == [0.0, 100.0, 0.0]
    # 2026 cars have no DRS: the published 0s are reported as absent.
    assert all(s.drs is None for s in trace.samples)
    assert trace.samples[2].distance == 10.46
    assert (trace.samples[0].x, trace.samples[0].y) == (13.72, 2507.06)


def test_drs_is_kept_for_seasons_that_had_it() -> None:
    payload = {"tel": {"time": [0.0, 0.1], "speed": [300, 301], "drs": [0, 1]}}
    samples = tracinginsights_service._parse_samples(payload, 2025)
    assert [s.drs for s in samples] == [0, 12]


@pytest.mark.asyncio
async def test_a_missing_file_is_unavailable_not_an_outage(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _ti)
    with pytest.raises(TelemetryUnavailable):
        await tracinginsights_service.get_lap_trace(1, 2, 2026, "Zandvoort", "Race")  # no 2_tel.json


@pytest.mark.asyncio
async def test_session_overview_reads_pits_positions_and_gaps(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _ti)
    overview = await tracinginsights_service.get_session_overview(2026, "Zandvoort", "Race")
    assert overview.event_name == "Dutch Grand Prix"
    assert [d.code for d in overview.drivers] == ["NOR", "VER"]
    nor_lap_2 = next(l for l in overview.laps if l.driver == "NOR" and l.lap == 2)
    assert (nor_lap_2.time, nor_lap_2.pit_in, nor_lap_2.pit_out, nor_lap_2.status) == (123.197, True, False, "125")
    nor_lap_1 = next(l for l in overview.laps if l.driver == "NOR" and l.lap == 1)
    assert nor_lap_1.time is None


# --- the fallback ----------------------------------------------------------


@pytest.mark.asyncio
async def test_a_rate_limited_openf1_falls_back_to_tracinginsights(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _openf1_rate_limited)
    result = await telemetry_pipeline.lap_trace(1, 49, 2026, "Zandvoort", "Race")
    assert result.source == "tracinginsights"
    assert result.data.source == "tracinginsights"
    assert "rate-limiting" in (result.data.fallback_reason or "")
    assert result.final  # TracingInsights only publishes finished sessions
    assert [c.number for c in result.data.corners] == [1, 2, 3]


@pytest.mark.asyncio
async def test_when_both_fail_the_primary_error_is_reported(monkeypatch: pytest.MonkeyPatch) -> None:
    def everything_down(request: httpx.Request) -> httpx.Response:
        if request.url.host == "raw.githubusercontent.com":
            return httpx.Response(404)
        return httpx.Response(429)

    _patch(monkeypatch, everything_down)
    with pytest.raises(TelemetryUpstreamError, match="rate limiting"):
        await telemetry_pipeline.drivers(2026, "Zandvoort", "Race")


def test_routes_name_the_source_that_answered(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _openf1_rate_limited)
    client = TestClient(app)

    drivers = client.get("/api/telemetry/drivers")
    assert drivers.status_code == 200
    assert drivers.headers["x-telemetry-source"] == "tracinginsights"
    assert [d["driverNumber"] for d in drivers.json()] == [1, 3]

    trace = client.get("/api/telemetry/lap-trace?driver_number=1&lap_number=49")
    assert trace.status_code == 200
    body = trace.json()
    assert body["source"] == "tracinginsights"
    assert body["fallbackReason"].startswith("OpenF1's free tier")
    assert body["corners"][0] == {"number": 1, "distance": 484.42}
    assert "s-maxage" in trace.headers["cache-control"]


def test_session_overview_route(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch(monkeypatch, _ti)
    response = TestClient(app).get("/api/telemetry/session-overview")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "tracinginsights"
    assert body["laps"][1]["pitIn"] is True
    assert body["drivers"][0]["teamColour"] == "F47600"


@pytest.mark.asyncio
async def test_a_driver_missing_from_a_published_session_is_reported_as_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # VER retired on lap 1 at Zandvoort: his published laptimes hold a single
    # untimed lap. With OpenF1 down, "no timed laps" is the true answer — not
    # "OpenF1 isn't responding".
    ver_laps = {"time": ["None"], "lap": [1]}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host != "raw.githubusercontent.com":
            return httpx.Response(503)
        if request.url.path == f"{TI_BASE}/VER/laptimes.json":
            return httpx.Response(200, json=ver_laps)
        return _ti(request)

    _patch(monkeypatch, handler)
    with pytest.raises(TelemetryUnavailable, match="No timed laps found for driver 3"):
        await telemetry_pipeline.laps(3, 2026, "Zandvoort", "Race")
    response = TestClient(app).get("/api/telemetry/laps?driver_number=3")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_an_unpublished_session_keeps_the_primary_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "raw.githubusercontent.com":
            return httpx.Response(404)
        return httpx.Response(429)

    _patch(monkeypatch, handler)
    with pytest.raises(TelemetryUpstreamError, match="rate limiting"):
        await telemetry_pipeline.laps(1, 2026, "Zandvoort", "Race")
    with pytest.raises(tracinginsights_service.SessionNotPublished):
        await tracinginsights_service.get_laps(1, 2026, "Nowhere", "Race")


@pytest.mark.parametrize("session_name", ["..", ".", "", "../../2025/main/x", "Race/../..", "Race\\..\\x"])
def test_a_session_name_cannot_leave_the_event_folder(session_name: str) -> None:
    with pytest.raises(tracinginsights_service.SessionNotPublished):
        tracinginsights_service._url(2026, "Zandvoort", session_name, "drivers.json")


def test_session_names_are_encoded_as_one_segment() -> None:
    url = tracinginsights_service._url(2026, "Zandvoort", "Sprint Qualifying", "drivers.json")
    assert url.endswith("/2026/main/Dutch%20Grand%20Prix/Sprint%20Qualifying/drivers.json")


@pytest.mark.asyncio
async def test_an_empty_openf1_roster_falls_back_to_tracinginsights(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "raw.githubusercontent.com":
            return _ti(request)
        if request.url.path == "/v1/sessions":
            return httpx.Response(200, json=[{"session_key": 1, "date_end": "2026-08-23T15:00:00+00:00"}])
        if request.url.path == "/v1/drivers":
            return httpx.Response(200, json=[])
        raise AssertionError(f"unexpected path {request.url.path}")

    _patch(monkeypatch, handler)
    result = await telemetry_pipeline.drivers(2026, "Zandvoort", "Race")
    assert result.source == "tracinginsights"
    assert [d.driver_number for d in result.data] == [1, 3]


# --- corner alignment ------------------------------------------------------


def _lap_along_x(stretch: float) -> list[TelemetrySample]:
    """A straight 1000 m lap in the timing frame (1/10 m units), with
    integrated distance off by `stretch` — as speed integration drifts."""
    return [
        TelemetrySample(t=i, speed=200, throttle=100, brake=0, rpm=11000, gear=7,
                        distance=i * 10 * stretch, x=i * 100.0, y=0.0)
        for i in range(101)
    ]


def test_corners_snap_to_the_laps_own_distances() -> None:
    corners = [
        TelemetryCorner(number=1, distance=300, x=3000, y=40),
        TelemetryCorner(number=2, distance=700, x=7000, y=-40),
    ]
    aligned = telemetry_pipeline.align_corners(corners, _lap_along_x(1.03))
    assert [round(c.distance) for c in aligned] == [309, 721]


def test_corners_keep_published_distances_when_the_frames_disagree() -> None:
    corners = [TelemetryCorner(number=1, distance=300, x=3000, y=9000)]
    assert telemetry_pipeline.align_corners(corners, _lap_along_x(1.03)) == corners


def test_corners_keep_published_distances_without_positions() -> None:
    samples = _lap_along_x(1.03)
    for s in samples:
        s.x = s.y = None
    corners = [TelemetryCorner(number=1, distance=300, x=3000, y=40)]
    assert telemetry_pipeline.align_corners(corners, samples) == corners


def test_corner_positions_stay_out_of_the_api() -> None:
    corner = TelemetryCorner(number=1, distance=484.42, x=2045.2, y=6685.9)
    assert corner.model_dump(by_alias=True) == {"number": 1, "distance": 484.42}
