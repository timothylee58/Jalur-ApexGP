from fastapi import APIRouter, HTTPException, Response

from app.schemas.telemetry import SessionOverview, TelemetryDriver, TelemetryLap, TelemetryLapTrace
from app.services import telemetry_pipeline
from app.services.telemetry_pipeline import Sourced
from app.services.telemetry_service import (
    DEFAULT_CIRCUIT,
    DEFAULT_SESSION_NAME,
    DEFAULT_YEAR,
    TelemetryUnavailable,
    TelemetryUpstreamError,
)

router = APIRouter()

# A finished session's telemetry never changes, so its responses are cached
# at Vercel's edge: after the first request per URL, page views stop costing
# upstream calls at all — which is what keeps the app inside OpenF1's
# free-tier rate limit. Anything not provably final is never cached.
_FINAL_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
_NO_STORE = "no-store"
# Which source answered. Exposed to the browser via CORS (see main.py) so
# the page can say where the data came from.
SOURCE_HEADER = "X-Telemetry-Source"


def _respond(response: Response, result: Sourced):
    response.headers["Cache-Control"] = _FINAL_CACHE if result.final else _NO_STORE
    response.headers[SOURCE_HEADER] = result.source
    return result.data


def _http_error(exc: Exception) -> HTTPException:
    status = 404 if isinstance(exc, TelemetryUnavailable) else 502
    return HTTPException(status_code=status, detail=str(exc))


@router.get("/telemetry/drivers", response_model=list[TelemetryDriver])
async def telemetry_drivers(
    response: Response,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryDriver]:
    try:
        return _respond(response, await telemetry_pipeline.drivers(year, circuit_short_name, session_name))
    except (TelemetryUnavailable, TelemetryUpstreamError) as exc:
        raise _http_error(exc) from exc


@router.get("/telemetry/laps", response_model=list[TelemetryLap])
async def telemetry_laps(
    response: Response,
    driver_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryLap]:
    try:
        return _respond(
            response, await telemetry_pipeline.laps(driver_number, year, circuit_short_name, session_name)
        )
    except (TelemetryUnavailable, TelemetryUpstreamError) as exc:
        raise _http_error(exc) from exc


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
        return _respond(
            response,
            await telemetry_pipeline.lap_trace(driver_number, lap_number, year, circuit_short_name, session_name),
        )
    except (TelemetryUnavailable, TelemetryUpstreamError) as exc:
        raise _http_error(exc) from exc


@router.get("/telemetry/session-overview", response_model=SessionOverview)
async def telemetry_session_overview(
    response: Response,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> SessionOverview:
    try:
        return _respond(
            response, await telemetry_pipeline.session_overview(year, circuit_short_name, session_name)
        )
    except (TelemetryUnavailable, TelemetryUpstreamError) as exc:
        raise _http_error(exc) from exc
