import httpx
from fastapi import APIRouter, HTTPException, Query

from app.schemas.picks import LeaderboardResponse, MyPickResponse, PickSubmission, PickSubmitted
from app.services import picks_service
from app.services.picks_service import PicksClosed, PicksStorageUnavailable

router = APIRouter()


@router.post("/picks", response_model=PickSubmitted, status_code=201)
async def submit_pick(payload: PickSubmission) -> PickSubmitted:
    try:
        return await picks_service.submit_pick(payload)
    except PicksClosed as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except PicksStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502, detail="Could not save your picks; try again shortly."
        ) from exc


@router.get("/picks/leaderboard", response_model=LeaderboardResponse)
async def leaderboard(
    limit: int = Query(default=50, ge=1, le=200),
    id: str | None = Query(default=None, description="Your own entry id, to highlight your row"),
) -> LeaderboardResponse:
    try:
        return await picks_service.get_leaderboard(limit=limit, viewer_id=id)
    except PicksStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not load the leaderboard.") from exc


@router.get("/picks/me", response_model=MyPickResponse)
async def my_pick(id: str = Query(...)) -> MyPickResponse:
    try:
        result = await picks_service.get_my_pick(id)
    except PicksStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Could not load your picks.") from exc
    if result is None:
        raise HTTPException(status_code=404, detail="No picks found for that id.")
    return result
