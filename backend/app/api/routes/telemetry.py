from fastapi import APIRouter, HTTPException

from app.schemas.telemetry import TelemetryDriver, TelemetryLap, TelemetryLapTrace
from app.services import telemetry_service
from app.services.telemetry_service import DEFAULT_CIRCUIT, DEFAULT_SESSION_NAME, DEFAULT_YEAR

router = APIRouter()


@router.get("/telemetry/drivers", response_model=list[TelemetryDriver])
async def telemetry_drivers(
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryDriver]:
    try:
        return await telemetry_service.get_drivers(year, circuit_short_name, session_name)
    except telemetry_service.TelemetryUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except telemetry_service.TelemetryUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/telemetry/laps", response_model=list[TelemetryLap])
async def telemetry_laps(
    driver_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> list[TelemetryLap]:
    try:
        return await telemetry_service.get_laps(driver_number, year, circuit_short_name, session_name)
    except telemetry_service.TelemetryUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except telemetry_service.TelemetryUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/telemetry/lap-trace", response_model=TelemetryLapTrace)
async def telemetry_lap_trace(
    driver_number: int,
    lap_number: int,
    year: int = DEFAULT_YEAR,
    circuit_short_name: str = DEFAULT_CIRCUIT,
    session_name: str = DEFAULT_SESSION_NAME,
) -> TelemetryLapTrace:
    try:
        return await telemetry_service.get_lap_trace(
            driver_number, lap_number, year, circuit_short_name, session_name
        )
    except telemetry_service.TelemetryUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except telemetry_service.TelemetryUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
