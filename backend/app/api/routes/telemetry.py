from fastapi import APIRouter, HTTPException, Response

from app.schemas.telemetry import TelemetryDriver, TelemetryLap, TelemetryLapTrace
from app.services import telemetry_service
from app.services.telemetry_service import DEFAULT_CIRCUIT, DEFAULT_SESSION_NAME, DEFAULT_YEAR

router = APIRouter()

# A finished session's telemetry never changes, so its responses are cached
# at Vercel's edge: after the first request per URL, page views stop costing
# OpenF1 calls at all — which is what keeps the app inside OpenF1's free-tier
# rate limit. Anything not provably final (a live or unknown session) is
# never cached.
_FINAL_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
_NO_STORE = "no-store"


def _cache_headers(response: Response, year: int, circuit_short_name: str, session_name: str) -> None:
    final = telemetry_service.session_is_final(year, circuit_short_name, session_name)
    response.headers["Cache-Control"] = _FINAL_CACHE if final else _NO_STORE


@router.get("/telemetry/drivers", response_model=list[TelemetryDriver])
async def telemetry_drivers(
    response: Response,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryDriver]:
    try:
        drivers = await telemetry_service.get_drivers(year, circuit_short_name, session_name)
    except telemetry_service.TelemetryUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except telemetry_service.TelemetryUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    _cache_headers(response, year, circuit_short_name, session_name)
    return drivers


@router.get("/telemetry/laps", response_model=list[TelemetryLap])
async def telemetry_laps(
    response: Response,
    driver_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryLap]:
    try:
        laps = await telemetry_service.get_laps(driver_number, year, circuit_short_name, session_name)
    except telemetry_service.TelemetryUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except telemetry_service.TelemetryUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    _cache_headers(response, year, circuit_short_name, session_name)
    return laps


@router.get("/telemetry/lap-trace", response_model=TelemetryLapTrace)
async def telemetry_lap_trace(
    response: Response,
    driver_number: int,
    lap_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> TelemetryLapTrace:
    try:
        trace = await telemetry_service.get_lap_trace(
            driver_number, lap_number, year, circuit_short_name, session_name
        )
    except telemetry_service.TelemetryUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except telemetry_service.TelemetryUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    _cache_headers(response, year, circuit_short_name, session_name)
    return trace
