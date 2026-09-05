from app.schemas.outcome import VariantScore
from app.schemas.prediction import PitWindow
from app.services.scoring_service import (
    aggregate_scores,
    composite_score,
    score_pit_window,
    score_rain_call,
)


def test_score_rain_call_perfect_forecast_scores_100() -> None:
    assert score_rain_call(100.0, True) == 100.0
    assert score_rain_call(0.0, False) == 100.0


def test_score_rain_call_confidently_wrong_scores_low() -> None:
    assert score_rain_call(90.0, False) < 20.0
    assert score_rain_call(5.0, True) < 20.0


def test_score_rain_call_uncertain_forecast_scores_middling() -> None:
    # A 50/50 call is never confidently right or wrong either way.
    assert 70.0 < score_rain_call(50.0, True) < 80.0
    assert 70.0 < score_rain_call(50.0, False) < 80.0


def test_score_pit_window_hit_and_miss() -> None:
    window = PitWindow(start_lap=10, end_lap=20)
    assert score_pit_window(window, 15) is True
    assert score_pit_window(window, 10) is True
    assert score_pit_window(window, 20) is True
    assert score_pit_window(window, 9) is False
    assert score_pit_window(window, 21) is False


def test_score_pit_window_none_when_no_actual_lap() -> None:
    window = PitWindow(start_lap=10, end_lap=20)
    assert score_pit_window(window, None) is None


def test_composite_score_blends_both_components() -> None:
    assert composite_score(80.0, True) == 90.0
    assert composite_score(80.0, False) == 40.0


def test_composite_score_falls_back_to_rain_score_when_pit_unknown() -> None:
    assert composite_score(72.5, None) == 72.5


def test_aggregate_scores_computes_mean_and_hit_rate() -> None:
    scores = [
        VariantScore(
            variant="conservative",
            predicted_confidence=70,
            rain_call_score=80.0,
            pit_window_hit=True,
            composite_score=90.0,
            date="2026-09-01",
        ),
        VariantScore(
            variant="conservative",
            predicted_confidence=65,
            rain_call_score=60.0,
            pit_window_hit=False,
            composite_score=30.0,
            date="2026-09-02",
        ),
        VariantScore(
            variant="aggressive",
            predicted_confidence=80,
            rain_call_score=90.0,
            pit_window_hit=None,
            composite_score=90.0,
            date="2026-09-01",
        ),
    ]
    conservative = aggregate_scores(scores, variant="conservative")
    assert conservative.sample_size == 2
    assert conservative.mean_rain_call_score == 70.0
    assert conservative.pit_window_hit_rate == 50.0
    assert conservative.mean_composite_score == 60.0

    aggressive = aggregate_scores(scores, variant="aggressive")
    assert aggressive.sample_size == 1
    assert aggressive.pit_window_hit_rate is None


def test_aggregate_scores_empty_returns_zeroed_summary() -> None:
    summary = aggregate_scores([], variant="conservative")
    assert summary.sample_size == 0
    assert summary.mean_rain_call_score == 0.0
    assert summary.pit_window_hit_rate is None
