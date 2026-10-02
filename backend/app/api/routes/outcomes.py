import hmac
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, Query

from app.config import settings
from app.schemas.outcome import AccuracyResponse, OutcomeLogged, OutcomeRequest, WeekendBoard
from app.schemas.prediction import Session
from app.services import accuracy_service, supabase_rest

router = APIRouter()
logger = logging.getLogger(__name__)

_STORAGE_DOWN = "The accuracy record is unavailable right now — try again shortly."


@router.post("/outcomes", response_model=OutcomeLogged)
async def submit_outcome(
    payload: OutcomeRequest, x_admin_token: str | None = Header(default=None)
) -> OutcomeLogged:
    """Manual correction only. Outcomes are resolved automatically from
    official timing data (see accuracy_service), and a public write path
    would let anyone rewrite the scoreboard."""
    expected = settings.outcomes_admin_token
    if not expected or not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(
            status_code=403,
            detail="Outcomes are recorded automatically from official timing data; manual corrections need an admin token.",
        )
    try:
        date = await accuracy_service.record_manual_outcome(payload)
    except supabase_rest.SupabaseReadOnly as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (supabase_rest.SupabaseNotConfigured, httpx.HTTPError) as exc:
        logger.error("manual outcome not stored: %s", exc)
        raise HTTPException(status_code=503, detail=_STORAGE_DOWN) from exc
    return OutcomeLogged(logged=True, session=payload.session, date=date)


@router.get("/accuracy/weekend", response_model=WeekendBoard)
async def accuracy_weekend() -> WeekendBoard:
    """This weekend's accuracy loop, session by session — and the call that
    nudges it along: reading the board resolves any session whose official
    data has landed since the scheduler last ran."""
    try:
        return await accuracy_service.weekend_board()
    except (supabase_rest.SupabaseNotConfigured, httpx.HTTPError) as exc:
        logger.error("accuracy board unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=_STORAGE_DOWN) from exc


@router.get("/accuracy", response_model=AccuracyResponse)
async def accuracy(session: Session = Query(...)) -> AccuracyResponse:
    try:
        result = await accuracy_service.season_record(session)
    except (supabase_rest.SupabaseNotConfigured, httpx.HTTPError) as exc:
        logger.error("accuracy record unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=_STORAGE_DOWN) from exc
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No scored sessions yet — a session is scored once its outcome is recorded after it runs.",
        )
    return result
