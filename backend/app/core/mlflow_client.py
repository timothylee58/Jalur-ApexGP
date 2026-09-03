from __future__ import annotations

import logging
import queue
import threading
from datetime import datetime
from typing import Callable, TypeVar
from zoneinfo import ZoneInfo

from app.config import settings
from app.schemas.prediction import ConfidenceTrend, PredictionResponse, Session

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


def _log_prediction(prediction: PredictionResponse) -> None:
    configure_mlflow()
    run_name = f"{prediction.session}-{prediction.weather.condition}"
    with mlflow.start_run(run_name=run_name):
        mlflow.log_param("session", prediction.session)
        mlflow.log_param("tyres_conservative", "-".join(prediction.conservative.tyre_sequence))
        mlflow.log_param("tyres_aggressive", "-".join(prediction.aggressive.tyre_sequence))
        mlflow.log_param("condition", prediction.weather.condition)
        mlflow.log_metric("temp_c", prediction.weather.temp_c)
        mlflow.log_metric("rain_probability", prediction.weather.rain_probability)
        mlflow.log_metric("confidence_conservative", prediction.conservative.confidence)
        mlflow.log_metric("confidence_aggressive", prediction.aggressive.confidence)
        mlflow.log_metric("pit_start_conservative", prediction.conservative.pit_window.start_lap)
        mlflow.log_metric("pit_start_aggressive", prediction.aggressive.pit_window.start_lap)


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
