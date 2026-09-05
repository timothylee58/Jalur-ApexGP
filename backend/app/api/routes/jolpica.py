from fastapi import APIRouter, HTTPException

from app.schemas.jolpica import StandingsPayload, WeekendSchedule
from app.services import jolpica_service
from app.services.jolpica_service import (
    DEFAULT_CIRCUIT_ID,
    DEFAULT_SEASON,
    STANDINGS_SEASON,
)

router = APIRouter()


@router.get("/schedule", response_model=WeekendSchedule)
async def weekend_schedule(
    season: int = DEFAULT_SEASON,
    circuit_id: str = DEFAULT_CIRCUIT_ID,
) -> WeekendSchedule:
    try:
        return await jolpica_service.get_sepang_schedule(season=season, circuit_id=circuit_id)
    except jolpica_service.JolpicaUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except jolpica_service.JolpicaUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/standings", response_model=StandingsPayload)
async def championship_standings(season: int = STANDINGS_SEASON) -> StandingsPayload:
    try:
        return await jolpica_service.get_standings(season=season)
    except jolpica_service.JolpicaUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except jolpica_service.JolpicaUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
