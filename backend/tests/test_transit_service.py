"""Unit tests for transit_service, run against a mocked httpx transport —
api.data.gov.my is blocked by this dev sandbox's own network egress
policy, so this is what actually got verified pre-merge; see the
"verification gap" note in transit_service.py's module docstring. These
check the GTFS static/realtime parsing and ETA heuristic this module is
responsible for, not whether the real API matches the shapes assumed
here. The realtime side is built against the real gtfs-realtime-bindings
library (constructing a genuine FeedMessage, not a hand-rolled fake), so
at least the protobuf wire format itself is exercised for real.
"""

from __future__ import annotations

import io
import zipfile
from collections.abc import Callable

import httpx
import pytest
from google.transit import gtfs_realtime_pb2

from app.services import transit_service
from app.services.transit_service import TransitUpstreamError, get_sepang_access

_RealAsyncClient = httpx.AsyncClient


def _patch_client(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    def factory(**kwargs: object) -> httpx.AsyncClient:
        return _RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)


@pytest.fixture(autouse=True)
def _clear_cache():
    transit_service._corridor_cache.clear()
    yield
    transit_service._corridor_cache.clear()


def _build_static_zip(routes_rows: list[str], stops_rows: list[str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "routes.txt",
            "route_id,route_short_name,route_long_name\n" + "\n".join(routes_rows),
        )
        zf.writestr(
            "stops.txt",
            "stop_id,stop_name,stop_lat,stop_lon\n" + "\n".join(stops_rows),
        )
    return buf.getvalue()


def _build_realtime_feed(vehicles: list[dict]) -> bytes:
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.header.gtfs_realtime_version = "2.0"
    for v in vehicles:
        entity = feed.entity.add()
        entity.id = v["entity_id"]
        entity.vehicle.trip.route_id = v["route_id"]
        entity.vehicle.vehicle.id = v["vehicle_id"]
        entity.vehicle.position.latitude = v["lat"]
        entity.vehicle.position.longitude = v["lon"]
        if v.get("speed_mps") is not None:
            entity.vehicle.position.speed = v["speed_mps"]
        if v.get("timestamp") is not None:
            entity.vehicle.timestamp = v["timestamp"]
    return feed.SerializeToString()


# A matched stop ~1.11 km due north of a vehicle at the same longitude
# (0.01 degrees latitude ~= 1.11 km) — chosen so the ETA arithmetic is
# easy to hand-check, not because it's a real Sepang coordinate.
_STOP_LAT, _STOP_LON = 2.7500, 101.7000
_VEHICLE_LAT, _VEHICLE_LON = 2.7400, 101.7000  # ~1.11 km south of the stop

_MATCHING_STATIC_ZIP = _build_static_zip(
    routes_rows=["R1,T1,Sepang Feeder", "R2,T2,City Loop"],
    stops_rows=[f"S1,Sepang Sentral,{_STOP_LAT},{_STOP_LON}", "S2,City Center,3.15,101.70"],
)
_NO_MATCH_STATIC_ZIP = _build_static_zip(
    routes_rows=["R2,T2,City Loop"],
    stops_rows=["S2,City Center,3.15,101.70"],
)


def _static_and_realtime_handler(realtime_bytes: bytes, static_zip: bytes = _MATCHING_STATIC_ZIP):
    def handler(request: httpx.Request) -> httpx.Response:
        if "gtfs-static" in request.url.path:
            return httpx.Response(200, content=static_zip)
        if "gtfs-realtime" in request.url.path:
            return httpx.Response(200, content=realtime_bytes)
        return httpx.Response(404)

    return handler


@pytest.mark.asyncio
async def test_no_matching_route_or_stop_returns_empty_with_note(monkeypatch):
    _patch_client(monkeypatch, _static_and_realtime_handler(b"", static_zip=_NO_MATCH_STATIC_ZIP))

    payload = await get_sepang_access()

    assert payload.matched_stops == []
    assert payload.live_vehicles == []
    assert "sepang" in payload.coverage_note.lower() or "klia" in payload.coverage_note.lower()


@pytest.mark.asyncio
async def test_matched_stop_but_no_live_vehicle(monkeypatch):
    empty_feed = _build_realtime_feed([])
    _patch_client(monkeypatch, _static_and_realtime_handler(empty_feed))

    payload = await get_sepang_access()

    assert len(payload.matched_stops) == 1
    assert payload.matched_stops[0].name == "Sepang Sentral"
    assert payload.live_vehicles == []
    assert "nothing running" in payload.coverage_note.lower()


@pytest.mark.asyncio
async def test_live_vehicle_uses_live_speed_when_moving(monkeypatch):
    # 10 m/s = 36 km/h; ~1.11 km at 36 km/h is ~1.85 minutes.
    feed = _build_realtime_feed(
        [
            {
                "entity_id": "e1",
                "route_id": "R1",
                "vehicle_id": "bus-1",
                "lat": _VEHICLE_LAT,
                "lon": _VEHICLE_LON,
                "speed_mps": 10.0,
                "timestamp": 1_700_000_000,
            }
        ]
    )
    _patch_client(monkeypatch, _static_and_realtime_handler(feed))

    payload = await get_sepang_access()

    assert len(payload.live_vehicles) == 1
    vehicle = payload.live_vehicles[0]
    assert vehicle.route_id == "R1"
    assert vehicle.route_name == "T1"
    assert vehicle.eta_method == "live_speed"
    assert vehicle.nearest_stop.name == "Sepang Sentral"
    assert 0.9 < vehicle.distance_km < 1.3
    assert 1.5 < vehicle.eta_minutes < 2.2
    assert vehicle.vehicle_timestamp.startswith("2023-11-14")


@pytest.mark.asyncio
async def test_live_vehicle_falls_back_when_stationary(monkeypatch):
    feed = _build_realtime_feed(
        [
            {
                "entity_id": "e1",
                "route_id": "R1",
                "vehicle_id": "bus-1",
                "lat": _VEHICLE_LAT,
                "lon": _VEHICLE_LON,
                "speed_mps": None,
            }
        ]
    )
    _patch_client(monkeypatch, _static_and_realtime_handler(feed))

    payload = await get_sepang_access()

    assert len(payload.live_vehicles) == 1
    assert payload.live_vehicles[0].eta_method == "fallback_speed"


@pytest.mark.asyncio
async def test_vehicle_on_unmatched_route_is_ignored(monkeypatch):
    feed = _build_realtime_feed(
        [
            {
                "entity_id": "e1",
                "route_id": "R2",  # City Loop — not a corridor match
                "vehicle_id": "bus-2",
                "lat": _VEHICLE_LAT,
                "lon": _VEHICLE_LON,
                "speed_mps": 10.0,
            }
        ]
    )
    _patch_client(monkeypatch, _static_and_realtime_handler(feed))

    payload = await get_sepang_access()

    assert payload.live_vehicles == []


@pytest.mark.asyncio
async def test_static_corridor_lookup_is_cached_across_calls(monkeypatch):
    static_calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal static_calls
        if "gtfs-static" in request.url.path:
            static_calls += 1
            return httpx.Response(200, content=_MATCHING_STATIC_ZIP)
        return httpx.Response(200, content=_build_realtime_feed([]))

    _patch_client(monkeypatch, handler)

    await get_sepang_access()
    await get_sepang_access()

    assert static_calls == 1


@pytest.mark.asyncio
async def test_static_transport_failure_raises_upstream_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    _patch_client(monkeypatch, handler)

    with pytest.raises(TransitUpstreamError):
        await get_sepang_access()


@pytest.mark.asyncio
async def test_malformed_realtime_feed_raises_upstream_error(monkeypatch):
    _patch_client(monkeypatch, _static_and_realtime_handler(b"not a protobuf message"))

    with pytest.raises(TransitUpstreamError):
        await get_sepang_access()
