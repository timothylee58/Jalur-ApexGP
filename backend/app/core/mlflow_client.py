from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from app.config import settings
from app.schemas.prediction import ConfidenceTrend, PredictionResponse, Session

logger = logging.getLogger(__name__)
MYT = ZoneInfo("Asia/Kuala_Lumpur")

try:
    import mlflow
    from mlflow.tracking import MlflowClient
except ImportError:
    mlflow = None
    MlflowClient = None


def configure_mlflow() -> None:
    if mlflow is None:
        return
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment("jalur-apexgp-predictions")


def log_prediction(prediction: PredictionResponse) -> None:
    if mlflow is None:
        logger.info("MLflow not installed; skipping run log")
        return
    try:
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
    except Exception:
        logger.exception("MLflow logging failed; prediction still returned")


def get_confidence_trend(session: Session, current: PredictionResponse) -> ConfidenceTrend | None:
    if mlflow is None or MlflowClient is None:
        return None
    try:
        configure_mlflow()
        client = MlflowClient()
        experiment = client.get_experiment_by_name("jalur-apexgp-predictions")
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
    except Exception:
        logger.exception("MLflow trend lookup failed")
        return None
