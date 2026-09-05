from fastapi import APIRouter, HTTPException, Query

from app.core.mlflow_client import get_accuracy, log_outcome
from app.schemas.outcome import AccuracyResponse, OutcomeLogged, OutcomeRequest
from app.schemas.prediction import Session

router = APIRouter()


@router.post("/outcomes", response_model=OutcomeLogged)
async def submit_outcome(payload: OutcomeRequest) -> OutcomeLogged:
    date = log_outcome(payload)
    if date is None:
        # MLflow unavailable or the call timed out — not the caller's fault,
        # but they need to know the result wasn't actually recorded rather
        # than silently getting a 200 that implies it was.
        raise HTTPException(status_code=503, detail="Could not log outcome; tracking backend unavailable")
    return OutcomeLogged(logged=True, session=payload.session, date=date)


@router.get("/accuracy", response_model=AccuracyResponse)
async def accuracy(session: Session = Query(...)) -> AccuracyResponse:
    result = get_accuracy(session)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="No scored sessions yet — log at least one outcome for a day with a logged prediction.",
        )
    return result
