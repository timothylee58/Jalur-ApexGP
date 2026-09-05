from __future__ import annotations

import logging
import queue
import threading
from datetime import datetime
from typing import Callable, TypeVar
from zoneinfo import ZoneInfo

from app.config import settings
from app.schemas.outcome import AccuracyResponse, OutcomeRequest, VariantScore
from app.schemas.prediction import ConfidenceTrend, PredictionResponse, Session
from app.services.scoring_service import (
    aggregate_scores,
    composite_score,
    score_pit_window,
    score_rain_call,
)

logger = logging.getLogger(__name__)
MYT = ZoneInfo("Asia/Kuala_Lumpur")

# A wedged or misconfigured tracking backend must never hold up /predict's
# actual response. Verified empirically that this isn't hypothetical: with
# an unreachable Databricks host, mlflow.set_experiment() itself blocks
# indefinitely — before any HTTP call, inside Databricks SDK's own auth
# resolution — so MLFLOW_HTTP_REQUEST_TIMEOUT (which only bounds mlflow's
# own REST calls) does not cover this stall. Bounding it ourselves in a
# worker thread is the only reliable guarantee, regardless of what the
# underlying SDK does internally.
MLFLOW_CALL_TIMEOUT_SECONDS = 4.0

T = TypeVar("T")

try:
    import mlflow
    from mlflow.tracking import MlflowClient
except ImportError:
    mlflow = None
    MlflowClient = None


def _run_bounded(
    fn: Callable[[], T], *, label: str, timeout: float = MLFLOW_CALL_TIMEOUT_SECONDS
) -> T | None:
    """Run fn() in a daemon thread with a hard wall-clock timeout.

    Plain threading.Thread(daemon=True), not ThreadPoolExecutor: an
    executor's workers are non-daemon, so even with shutdown(wait=False)
    (needed anyway — the default wait=True would block here until the
    submitted call finishes, defeating the timeout entirely) a genuinely
    stuck call keeps the whole process alive afterward, since Python only
    exits once every non-daemon thread has finished. Verified empirically:
    with an executor, a wedged mlflow call still forced the process to hang
    well past its own timed-out future.result(). On a serverless platform
    that measures billed duration by process/container lifetime rather than
    "response sent", that difference is the whole point. daemon=True means
    a call that never returns is simply abandoned at process exit.
    """
    result_queue: queue.Queue[tuple[bool, T | BaseException]] = queue.Queue(maxsize=1)

    def _target() -> None:
        try:
            result_queue.put((True, fn()))
        except BaseException as exc:  # noqa: BLE001 — relayed to the caller below, not swallowed here
            result_queue.put((False, exc))

    thread = threading.Thread(target=_target, daemon=True)
    thread.start()
    try:
        ok, value = result_queue.get(timeout=timeout)
    except queue.Empty:
        logger.warning("MLflow %s timed out after %ss; continuing without it", label, timeout)
        return None
    if ok:
        return value  # type: ignore[return-value]
    logger.exception("MLflow %s failed; continuing without it", label, exc_info=value)
    return None


def configure_mlflow() -> None:
    if mlflow is None:
        return
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment(settings.mlflow_experiment_name)


def _today_str() -> str:
    return datetime.now(MYT).date().isoformat()


def _log_prediction(prediction: PredictionResponse) -> None:
    configure_mlflow()
    run_name = f"{prediction.session}-{prediction.weather.condition}"
    with mlflow.start_run(run_name=run_name):
        mlflow.set_tag("run_type", "prediction")
        # Same-day tag scoring joins predictions to a later outcome log on —
        # see get_accuracy below. Local time (MYT), matching the trend
        # lookup's own day boundary, so a run just before/after midnight UTC
        # doesn't land on the "wrong" day relative to when the session ran.
        mlflow.set_tag("date", _today_str())
        mlflow.log_param("session", prediction.session)
        mlflow.log_param("tyres_conservative", "-".join(prediction.conservative.tyre_sequence))
        mlflow.log_param("tyres_aggressive", "-".join(prediction.aggressive.tyre_sequence))
        mlflow.log_param("condition", prediction.weather.condition)
        mlflow.log_metric("temp_c", prediction.weather.temp_c)
        mlflow.log_metric("rain_probability", prediction.weather.rain_probability)
        mlflow.log_metric("confidence_conservative", prediction.conservative.confidence)
        mlflow.log_metric("confidence_aggressive", prediction.aggressive.confidence)
        mlflow.log_metric("pit_start_conservative", prediction.conservative.pit_window.start_lap)
        mlflow.log_metric("pit_end_conservative", prediction.conservative.pit_window.end_lap)
        mlflow.log_metric("pit_start_aggressive", prediction.aggressive.pit_window.start_lap)
        mlflow.log_metric("pit_end_aggressive", prediction.aggressive.pit_window.end_lap)


def log_prediction(
    prediction: PredictionResponse, *, timeout: float = MLFLOW_CALL_TIMEOUT_SECONDS
) -> None:
    """timeout defaults to the request-path bound (4s) — right for the
    /predict caller, which has a real user waiting on the response. The
    daily cron (ml/log_daily_run.py) has no such caller and nothing else to
    do, so it passes a longer timeout: a merely-slow-but-reachable backend
    would otherwise get cut off at 4s and silently fail every session while
    the workflow still exits green, which defeats the entire point of that
    cron (seeding same-day trend history)."""
    if mlflow is None:
        logger.info("MLflow not installed; skipping run log")
        return
    _run_bounded(lambda: _log_prediction(prediction), label="run log", timeout=timeout)


def _get_confidence_trend(session: Session, current: PredictionResponse) -> ConfidenceTrend | None:
    configure_mlflow()
    client = MlflowClient()
    experiment = client.get_experiment_by_name(settings.mlflow_experiment_name)
    if experiment is None:
        return None

    today = datetime.now(MYT).date()
    runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        filter_string=f"params.session = '{session}'",
        order_by=["start_time ASC"],
        max_results=50,
    )
    same_day = [
        run
        for run in runs
        if run.info.start_time
        and datetime.fromtimestamp(run.info.start_time / 1000, tz=MYT).date() == today
    ]
    if len(same_day) < 2:
        return None

    earliest = same_day[0]
    metric_key = "confidence_conservative"
    if metric_key not in earliest.data.metrics:
        return None

    earlier_value = float(earliest.data.metrics[metric_key])
    current_value = current.conservative.confidence
    if abs(current_value - earlier_value) < 1:
        return None

    start = datetime.fromtimestamp(earliest.info.start_time / 1000, tz=MYT)
    hours = (datetime.now(MYT) - start).total_seconds() / 3600
    label = "since this morning" if hours >= 4 else "since earlier today"

    return ConfidenceTrend(
        variant="conservative",
        from_confidence=round(earlier_value, 0),
        to_confidence=round(current_value, 0),
        label=label,
    )


def get_confidence_trend(session: Session, current: PredictionResponse) -> ConfidenceTrend | None:
    if mlflow is None or MlflowClient is None:
        return None
    return _run_bounded(lambda: _get_confidence_trend(session, current), label="trend lookup")


def _log_outcome(outcome: OutcomeRequest) -> str:
    configure_mlflow()
    date = _today_str()
    run_name = f"outcome-{outcome.session}-{date}"
    with mlflow.start_run(run_name=run_name):
        mlflow.set_tag("run_type", "outcome")
        mlflow.set_tag("date", date)
        mlflow.log_param("session", outcome.session)
        mlflow.log_metric("rain_occurred", 1.0 if outcome.rain_occurred else 0.0)
        if outcome.actual_pit_lap is not None:
            mlflow.log_metric("actual_pit_lap", outcome.actual_pit_lap)
        if outcome.notes:
            mlflow.log_param("notes", outcome.notes[:250])
    return date


def log_outcome(outcome: OutcomeRequest, *, timeout: float = MLFLOW_CALL_TIMEOUT_SECONDS) -> str | None:
    """Records what actually happened in a session, for later scoring
    against the prediction(s) already logged for the same day. Mirrors
    log_prediction's bounding: an unreachable tracking backend must not
    turn a quick "log the result" call into a hung request.
    """
    if mlflow is None:
        logger.info("MLflow not installed; skipping outcome log")
        return None
    return _run_bounded(lambda: _log_outcome(outcome), label="outcome log", timeout=timeout)


def _score_run_against_outcome(
    prediction_run, outcome_run, *, variant: StrategyVariant
) -> VariantScore | None:
    metrics = prediction_run.data.metrics
    confidence_key = f"confidence_{variant}"
    start_key = f"pit_start_{variant}"
    end_key = f"pit_end_{variant}"
    if confidence_key not in metrics or start_key not in metrics:
        return None

    rain_probability = metrics.get("rain_probability", 0.0)
    rain_occurred = bool(outcome_run.data.metrics.get("rain_occurred", 0.0))
    actual_pit_lap = outcome_run.data.metrics.get("actual_pit_lap")

    from app.schemas.prediction import PitWindow  # local import avoids a cycle at module load

    pit_window = PitWindow(
        start_lap=int(metrics[start_key]),
        # Older runs logged before pit_end_* existed fall back to start_lap
        # so a missing end metric can't crash scoring — it just can't ever
        # register a pit-window hit, which is the honest outcome anyway.
        end_lap=int(metrics.get(end_key, metrics[start_key])),
    )
    rain_score = score_rain_call(rain_probability, rain_occurred)
    pit_hit = score_pit_window(pit_window, int(actual_pit_lap) if actual_pit_lap is not None else None)

    return VariantScore(
        variant=variant,
        predicted_confidence=metrics[confidence_key],
        rain_call_score=rain_score,
        pit_window_hit=pit_hit,
        composite_score=composite_score(rain_score, pit_hit),
        date=outcome_run.data.tags.get("date", ""),
    )


def _get_accuracy(session: Session) -> AccuracyResponse | None:
    configure_mlflow()
    client = MlflowClient()
    experiment = client.get_experiment_by_name(settings.mlflow_experiment_name)
    if experiment is None:
        return None

    base_filter = f"params.session = '{session}'"
    prediction_runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        filter_string=f"{base_filter} and tags.run_type = 'prediction'",
        order_by=["start_time ASC"],
        max_results=200,
    )
    outcome_runs = client.search_runs(
        experiment_ids=[experiment.experiment_id],
        filter_string=f"{base_filter} and tags.run_type = 'outcome'",
        order_by=["start_time ASC"],
        max_results=200,
    )
    if not prediction_runs or not outcome_runs:
        return None

    # One outcome per day is the expected shape (a session only actually
    # happens once); if logged more than once, the latest report wins.
    outcome_by_date = {run.data.tags.get("date"): run for run in outcome_runs if run.data.tags.get("date")}

    scores: list[VariantScore] = []
    for prediction_run in prediction_runs:
        date = prediction_run.data.tags.get("date")
        outcome_run = outcome_by_date.get(date)
        if outcome_run is None:
            continue
        for variant in ("conservative", "aggressive"):
            score = _score_run_against_outcome(prediction_run, outcome_run, variant=variant)
            if score is not None:
                scores.append(score)

    if not scores:
        return None

    return AccuracyResponse(
        session=session,
        sample_size=len(outcome_by_date),
        conservative=aggregate_scores(scores, variant="conservative"),
        aggressive=aggregate_scores(scores, variant="aggressive"),
        recent=sorted(scores, key=lambda s: s.date, reverse=True)[:10],
    )


def get_accuracy(session: Session) -> AccuracyResponse | None:
    if mlflow is None or MlflowClient is None:
        return None
    return _run_bounded(lambda: _get_accuracy(session), label="accuracy lookup")
