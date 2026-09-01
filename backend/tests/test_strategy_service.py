from app.schemas.prediction import WeatherSnapshot
from app.services.strategy_service import build_prediction


def test_race_dry_keeps_aggressive_window_later(dry_weather: WeatherSnapshot) -> None:
    prediction = build_prediction("Race", dry_weather)
    assert prediction.session == "Race"
    assert prediction.aggressive.confidence > 50
    assert prediction.conservative.pit_window.end_lap <= prediction.aggressive.pit_window.start_lap or (
        prediction.conservative.pit_window.end_lap < prediction.aggressive.pit_window.end_lap
    )
    assert "Medium" in prediction.conservative.tyre_sequence


def test_wet_raises_conservative_confidence(dry_weather: WeatherSnapshot, wet_weather: WeatherSnapshot) -> None:
    dry = build_prediction("Race", dry_weather)
    wet = build_prediction("Race", wet_weather)
    assert wet.conservative.confidence >= dry.conservative.confidence
    assert wet.aggressive.confidence <= dry.aggressive.confidence
    assert "Intermediate" in wet.conservative.tyre_sequence


def test_all_sessions_return_both_cards(dry_weather: WeatherSnapshot) -> None:
    for session in ("FP1", "FP2", "FP3", "Quali", "Race"):
        prediction = build_prediction(session, dry_weather)
        assert prediction.conservative.variant == "conservative"
        assert prediction.aggressive.variant == "aggressive"
        assert 0 <= prediction.conservative.confidence <= 100
        assert 0 <= prediction.aggressive.confidence <= 100
        assert prediction.conservative.pit_window.start_lap <= prediction.conservative.pit_window.end_lap
        assert prediction.aggressive.key_risk
