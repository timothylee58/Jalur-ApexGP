"""Pure scoring functions comparing a logged prediction against what
actually happened. Kept free of MLflow/IO so they're trivially unit
testable — app.core.mlflow_client does the run lookup/joining and calls
into these.
"""

from __future__ import annotations

from app.schemas.outcome import AccuracySummary, VariantScore
from app.schemas.prediction import PitWindow


def score_rain_call(predicted_rain_probability: float, rain_occurred: bool) -> float:
    """Brier-score-based accuracy, rescaled to 0–100 (higher is better).

    Brier score is (forecast_probability - outcome)^2, ranging 0 (perfect)
    to 1 (worst possible). Flipping and rescaling to 0–100 keeps this
    metric on the same "higher is better" scale as everything else the UI
    shows (confidence, hit rate), rather than making the reader mentally
    invert a lower-is-better error term.
    """
    forecast = max(0.0, min(1.0, predicted_rain_probability / 100.0))
    outcome = 1.0 if rain_occurred else 0.0
    brier = (forecast - outcome) ** 2
    return round((1.0 - brier) * 100, 1)


def score_pit_window(pit_window: PitWindow, actual_pit_lap: int | None) -> bool | None:
    """Whether the actual pit lap fell inside the predicted window.

    None (not False) when no actual lap was reported — a session where the
    reference stop was never logged shouldn't count as a miss.
    """
    if actual_pit_lap is None:
        return None
    return pit_window.start_lap <= actual_pit_lap <= pit_window.end_lap


def composite_score(rain_call_score: float, pit_window_hit: bool | None) -> float:
    """Blend the two component scores into one number for a quick read.

    A pit-window hit/miss is binary (0 or 100); when it's unknown (no
    actual lap reported), the composite falls back to the rain-call score
    alone rather than penalizing a variant for missing data it was never
    given a chance to be scored against.
    """
    if pit_window_hit is None:
        return rain_call_score
    pit_score = 100.0 if pit_window_hit else 0.0
    return round((rain_call_score + pit_score) / 2, 1)


def aggregate_scores(scores: list[VariantScore], *, variant: str) -> AccuracySummary:
    variant_scores = [s for s in scores if s.variant == variant]
    if not variant_scores:
        return AccuracySummary(
            variant=variant,  # type: ignore[arg-type]
            sample_size=0,
            mean_rain_call_score=0.0,
            pit_window_hit_rate=None,
            mean_composite_score=0.0,
        )

    rain_scores = [s.rain_call_score for s in variant_scores]
    pit_calls = [s.pit_window_hit for s in variant_scores if s.pit_window_hit is not None]
    composite = [s.composite_score for s in variant_scores]

    return AccuracySummary(
        variant=variant,  # type: ignore[arg-type]
        sample_size=len(variant_scores),
        mean_rain_call_score=round(sum(rain_scores) / len(rain_scores), 1),
        pit_window_hit_rate=(
            round(sum(1 for hit in pit_calls if hit) / len(pit_calls) * 100, 1) if pit_calls else None
        ),
        mean_composite_score=round(sum(composite) / len(composite), 1),
    )
