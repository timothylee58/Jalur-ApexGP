"""Live public-transit access toward Sepang International Circuit, via
Malaysia's official open-data GTFS feeds (developer.data.gov.my) for
Prasarana (RapidKL bus). A real, free, keyless *government* API — not an
F1-, FIA-, or circuit-operated feed, and covered by the same "not an
official partner" framing as every other data source this app uses.

IMPORTANT — two honesty gaps, stated plainly rather than papered over
(same standard as README's "Note on AI" and OpenF1's live-data gap):

1. The official race-weekend shuttle isn't in these feeds. For 2–4
   October 2026 Rapid KL and SIC run free buses to the circuit from KLIA 2,
   Mitsui Outlet Park KLIA and Bandar Baru Enstek (7am–midnight, every
   10–15 min) — an event charter, never part of the standing GTFS network,
   so it can't be live-tracked. SHUTTLE_NOTES below carries it as static,
   clearly-labelled information only, never mixed into the live vehicle
   list.
2. The standing RapidKL bus network has no route with a stop *at* the
   circuit — Sepang is fairly isolated near KLIA. This service reports
   live ETA to the nearest real stop it can find serving the corridor
   *toward* Sepang/KLIA (matched by name against the real GTFS static
   feed, never a hardcoded guess at a route number), not to the circuit
   gate itself. `coverage_note` on every response says so explicitly, and
   an empty `live_vehicles` list is a legitimate, honest answer (no
   matching route currently running), not a bug.

ETA is a documented heuristic — straight-line distance from a vehicle's
live GPS position to the nearest matched stop, divided by that vehicle's
own live reported speed, falling back to a conservative average urban-bus
pace when it's stationary or unreported (ETA_FALLBACK_SPEED_KMH) — not a
trained model. No historical arrival-time data exists yet for this
corridor to train one on; this service's own live reads, logged over
time, are the real path to one later. `eta_method` on every result says
which one produced it.

IMPORTANT — verification gap: this module was written and unit-tested
against a mocked httpx transport plus a synthetic GTFS-RT protobuf
message built directly against the same gtfs-realtime-bindings the real
feed uses (see tests/test_transit_service.py), because api.data.gov.my is
blocked by this sandbox's own network egress policy (org policy, not
something to route around — see /root/.ccr/README.md) — the same gap
telemetry_service.py already documents for OpenF1. Endpoint paths and the
`category` parameter values below are taken from developer.data.gov.my's
own docs, cross-checked against independent write-ups, but have NOT been
confirmed against a live response from this environment. Test this
against the real API (runs fine outside this sandbox — a normal dev
machine, CI runner, or the deployed Vercel function all have ordinary
internet access) before trusting it in production; the most likely
failure mode is a GTFS static/realtime response shape that's drifted from
what's documented here, which should surface as a clean 502 (see
TransitUpstreamError below) rather than a silent wrong answer.
"""

from __future__ import annotations

import csv
import io
import zipfile
from datetime import datetime, timezone
from math import atan2, cos, radians, sin, sqrt

import httpx
from google.transit import gtfs_realtime_pb2

from app.config import settings
from app.schemas.transit import HistoricalShuttleNote, LiveVehicleEta, SepangAccessPayload, TransitStop

_TIMEOUT = httpx.Timeout(15.0)

# rapid-bus-kl is RapidKL's standing city/feeder bus network — the only
# Prasarana category with any plausible reach toward Sepang/KLIA.
# rapid-rail-kl (LRT/MRT/monorail) is a fixed urban network nowhere near
# the circuit, so it isn't queried here; add it only if a real reason
# turns up, not speculatively.
DEFAULT_CATEGORIES = ["rapid-bus-kl"]

# Matched against route names AND stop names (case-insensitive substring).
# Deliberately narrow: "sepang" and "klia" are the closest real places any
# standing RapidKL route could plausibly reach. Widening this (e.g.
# "putrajaya", "nilai") is easy but was left out of v1 rather than guessed
# at — see the module docstring's verification gap.
CORRIDOR_KEYWORDS = ["sepang", "klia"]

# A stationary or unreported vehicle can't drive a live-speed ETA — below
# this (~3 km/h) treat it as effectively stopped and fall back instead of
# dividing by a near-zero speed.
_MIN_MOVING_SPEED_MPS = 0.8
# A documented, conservative assumption, not a fitted number — roughly a
# KL-traffic urban bus pace. Labelled on every ETA that uses it
# (`eta_method: "fallback_speed"`) so the frontend can show it as an
# estimate, not a live read.
ETA_FALLBACK_SPEED_KMH = 25.0

SHUTTLE_NOTES: list[HistoricalShuttleNote] = [
    HistoricalShuttleNote(
        label="Official race-weekend shuttle (free, 2–4 Oct 2026)",
        detail=(
            "Rapid KL and Sepang International Circuit run free shuttle buses "
            "to the circuit from 7am to midnight on all three days, every "
            "10–15 minutes subject to traffic. Pick-up points: KLIA 2 (Level 1 "
            "Bus Hub, Bays B1–B3), Mitsui Outlet Park KLIA (Bus Hub) and "
            "Bandar Baru Enstek (De-Village, Persiaran Millenia 2). It's an "
            "event charter, not a standing GTFS route, so it isn't in the live "
            "vehicle list."
        ),
    ),
    HistoricalShuttleNote(
        label="Nearest real transit outside race weekend",
        detail=(
            "The standing RapidKL network has no route with a stop at the "
            "circuit itself. The live vehicles below show the closest a "
            "currently-running scheduled service gets, when one is; outside "
            "the race-weekend shuttle the final leg is taxi, e-hailing or "
            "private transport."
        ),
    ),
]


class TransitUpstreamError(Exception):
    """The GTFS static or realtime feed was unreachable, or didn't decode
    as the format its own docs describe — a transport/format problem, not
    "no route happens to match." Routes turn this into a 502."""


def _describe_http_error(exc: httpx.HTTPError) -> str:
    """A real status code + response snippet when there is one
    (raise_for_status() failures — HTTPStatusError carries .response),
    otherwise the exception's own message (connection/timeout errors,
    which never got a response at all). Folded into TransitUpstreamError's
    message specifically because this module's own docstring flags its
    endpoint shape as unverified against a live response — when this
    fires for real, knowing *which* HTTP status/body it got back is the
    difference between "wrong query param" and "endpoint moved" and
    "feed is just down right now"."""
    if isinstance(exc, httpx.HTTPStatusError):
        snippet = exc.response.text[:200]
        return f"upstream returned {exc.response.status_code}: {snippet}"
    return f"{type(exc).__name__}: {exc}"


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_km = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)
    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * earth_radius_km * atan2(sqrt(a), sqrt(1 - a))


def _estimate_eta(
    vehicle_lat: float,
    vehicle_lon: float,
    vehicle_speed_mps: float | None,
    stop_lat: float,
    stop_lon: float,
) -> tuple[float, float, str]:
    distance_km = _haversine_km(vehicle_lat, vehicle_lon, stop_lat, stop_lon)
    if vehicle_speed_mps is not None and vehicle_speed_mps > _MIN_MOVING_SPEED_MPS:
        speed_kmh = vehicle_speed_mps * 3.6
        method = "live_speed"
    else:
        speed_kmh = ETA_FALLBACK_SPEED_KMH
        method = "fallback_speed"
    eta_minutes = (distance_km / speed_kmh) * 60.0
    return distance_km, eta_minutes, method


async def _fetch_static_zip(client: httpx.AsyncClient, category: str) -> zipfile.ZipFile:
    url = f"{settings.gtfs_static_base_url}/prasarana"
    try:
        response = await client.get(url, params={"category": category})
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise TransitUpstreamError(
            f"GTFS static request failed: {url} (category={category}) — {_describe_http_error(exc)}"
        ) from exc
    try:
        return zipfile.ZipFile(io.BytesIO(response.content))
    except zipfile.BadZipFile as exc:
        raise TransitUpstreamError(
            f"GTFS static feed for category={category} wasn't a valid zip"
        ) from exc


def _match_routes(zf: zipfile.ZipFile) -> dict[str, str]:
    """route_id -> a human-readable name, for every route whose name
    contains a corridor keyword. Missing routes.txt (a malformed or
    unexpectedly-shaped feed) yields no matches rather than a crash — a
    real "nothing found" and a "couldn't read the feed" should look the
    same to a caller that just wants to know whether a route matched."""
    matched: dict[str, str] = {}
    try:
        with zf.open("routes.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            for row in reader:
                short_name = str(row.get("route_short_name") or "").strip()
                long_name = str(row.get("route_long_name") or "").strip()
                haystack = f"{short_name} {long_name}".lower()
                if any(keyword in haystack for keyword in CORRIDOR_KEYWORDS):
                    route_id = row.get("route_id")
                    if route_id:
                        matched[str(route_id)] = (short_name or long_name or str(route_id))
    except KeyError:
        pass
    return matched


def _match_stops(zf: zipfile.ZipFile) -> list[TransitStop]:
    matched: list[TransitStop] = []
    try:
        with zf.open("stops.txt") as f:
            reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            for row in reader:
                name = str(row.get("stop_name") or "")
                if not any(keyword in name.lower() for keyword in CORRIDOR_KEYWORDS):
                    continue
                try:
                    matched.append(
                        TransitStop(
                            stop_id=str(row["stop_id"]),
                            name=name,
                            lat=float(row["stop_lat"]),
                            lon=float(row["stop_lon"]),
                        )
                    )
                except (KeyError, ValueError):
                    continue
    except KeyError:
        pass
    return matched


# Static routes/stops for a real transit network barely change day to day
# — fetch once per warm process and reuse, same convention as the
# schedule/driver caches in jolpica_service.py and telemetry_service.py.
_corridor_cache: dict[tuple[str, ...], tuple[dict[str, str], list[TransitStop]]] = {}


async def _get_corridor_match(
    client: httpx.AsyncClient, categories: list[str]
) -> tuple[dict[str, str], list[TransitStop]]:
    cache_key = tuple(categories)
    cached = _corridor_cache.get(cache_key)
    if cached is not None:
        return cached

    route_names: dict[str, str] = {}
    stops: list[TransitStop] = []
    seen_stop_ids: set[str] = set()
    for category in categories:
        zf = await _fetch_static_zip(client, category)
        route_names.update(_match_routes(zf))
        for stop in _match_stops(zf):
            if stop.stop_id not in seen_stop_ids:
                seen_stop_ids.add(stop.stop_id)
                stops.append(stop)

    result = (route_names, stops)
    _corridor_cache[cache_key] = result
    return result


async def _fetch_realtime_bytes(client: httpx.AsyncClient, category: str) -> bytes:
    url = f"{settings.gtfs_realtime_base_url}/prasarana"
    try:
        response = await client.get(url, params={"category": category})
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise TransitUpstreamError(
            f"GTFS-Realtime request failed: {url} (category={category}) — {_describe_http_error(exc)}"
        ) from exc
    return response.content


def _match_live_vehicles(
    raw: bytes, route_names: dict[str, str], stops: list[TransitStop]
) -> list[LiveVehicleEta]:
    if not stops or not route_names:
        return []

    feed = gtfs_realtime_pb2.FeedMessage()
    try:
        feed.ParseFromString(raw)
    except Exception as exc:  # google.protobuf's DecodeError, kept broad on purpose
        raise TransitUpstreamError("GTFS-Realtime feed did not decode as a valid protobuf message") from exc

    results: list[LiveVehicleEta] = []
    for entity in feed.entity:
        if not entity.HasField("vehicle"):
            continue
        vp = entity.vehicle
        route_id = vp.trip.route_id if vp.HasField("trip") else ""
        if route_id not in route_names:
            continue
        if not vp.HasField("position"):
            continue

        lat, lon = vp.position.latitude, vp.position.longitude
        speed_mps = vp.position.speed if vp.position.HasField("speed") else None
        nearest_stop = min(stops, key=lambda stop: _haversine_km(lat, lon, stop.lat, stop.lon))
        distance_km, eta_minutes, method = _estimate_eta(lat, lon, speed_mps, nearest_stop.lat, nearest_stop.lon)

        vehicle_id = vp.vehicle.id if vp.HasField("vehicle") and vp.vehicle.id else entity.id
        timestamp = (
            datetime.fromtimestamp(vp.timestamp, tz=timezone.utc).isoformat()
            if vp.HasField("timestamp") and vp.timestamp
            else ""
        )
        results.append(
            LiveVehicleEta(
                route_id=route_id,
                route_name=route_names[route_id],
                vehicle_id=str(vehicle_id),
                nearest_stop=nearest_stop,
                distance_km=round(distance_km, 2),
                eta_minutes=round(eta_minutes, 1),
                eta_method=method,
                vehicle_timestamp=timestamp,
            )
        )
    return results


def _build_coverage_note(stops: list[TransitStop], vehicles: list[LiveVehicleEta]) -> str:
    if not stops:
        return (
            "No stop in RapidKL's standing network currently matches "
            "'Sepang' or 'KLIA' by name. On race weekend, use the free "
            "Rapid KL shuttle from KLIA 2 instead."
        )
    if not vehicles:
        return (
            f"{len(stops)} matched stop(s) toward the corridor, but no "
            "RapidKL vehicle is currently reporting a position on a "
            "matching route — this is a live 'nothing running right now' "
            "read, not an error."
        )
    return (
        f"Live ETA to the nearest of {len(stops)} matched stop(s) toward "
        "Sepang/KLIA — this is the nearest reachable point on RapidKL's "
        "standing network, not the circuit gate itself."
    )


async def get_sepang_access(categories: list[str] | None = None) -> SepangAccessPayload:
    categories = categories or DEFAULT_CATEGORIES
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        route_names, stops = await _get_corridor_match(client, categories)
        live_vehicles: list[LiveVehicleEta] = []
        if route_names and stops:
            for category in categories:
                raw = await _fetch_realtime_bytes(client, category)
                live_vehicles.extend(_match_live_vehicles(raw, route_names, stops))

    live_vehicles.sort(key=lambda vehicle: vehicle.eta_minutes)
    return SepangAccessPayload(
        generated_at=datetime.now(timezone.utc).isoformat(),
        coverage_note=_build_coverage_note(stops, live_vehicles),
        matched_stops=stops,
        live_vehicles=live_vehicles,
        historical_shuttle=SHUTTLE_NOTES,
        source="data.gov.my — Prasarana GTFS (RapidKL)",
    )
