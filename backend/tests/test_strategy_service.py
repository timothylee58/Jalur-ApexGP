from app.schemas.prediction import WeatherSnapshot
from app.services.strategy_service import RACE_LAPS, build_prediction


def test_race_returns_one_stop_stint_plan(dry_weather: WeatherSnapshot) -> None:
    prediction = build_prediction("Race", dry_weather)
    assert prediction.session == "Race"
    assert prediction.race_laps == RACE_LAPS
    for variant in (prediction.conservative, prediction.aggressive):
        assert variant.stop_count == 1
        assert len(variant.stints) == 2
        # Stints tile the full race distance without gaps.
        assert variant.stints[0].start_lap == 1
        assert variant.stints[-1].end_lap == RACE_LAPS
        assert variant.stints[0].end_lap + 1 == variant.stints[1].start_lap
        # Pit window brackets the modelled first-stint end.
        assert variant.pit_window.start_lap <= variant.stints[0].end_lap <= variant.pit_window.end_lap + 1


def test_aggressive_pits_earlier_than_conservative_when_dry(dry_weather: WeatherSnapshot) -> None:
    prediction = build_prediction("Race", dry_weather)
    # Softer opening compound => shorter first stint => earlier stop.
    assert prediction.aggressive.stints[0].end_lap < prediction.conservative.stints[0].end_lap
    assert "Medium" in prediction.conservative.tyre_sequence


def test_wet_raises_conservative_confidence(dry_weather: WeatherSnapshot, wet_weather: WeatherSnapshot) -> None:
    dry = build_prediction("Race", dry_weather)
    wet = build_prediction("Race", wet_weather)
    assert wet.conservative.confidence >= dry.conservative.confidence
    assert wet.aggressive.confidence <= dry.aggressive.confidence
    assert "Intermediate" in wet.conservative.tyre_sequence


def test_hotter_track_shortens_first_stint(dry_weather: WeatherSnapshot) -> None:
    hot = dry_weather.model_copy(update={"temp_c": 44.0})
    cool = dry_weather.model_copy(update={"temp_c": 26.0})
    hot_pred = build_prediction("Race", hot)
    cool_pred = build_prediction("Race", cool)
    assert hot_pred.conservative.stints[0].end_lap < cool_pred.conservative.stints[0].end_lap


def test_safety_car_pulls_pit_earlier_and_lifts_aggressive(dry_weather: WeatherSnapshot) -> None:
    base = build_prediction("Race", dry_weather)
    sc = build_prediction("Race", dry_weather, safety_car=True)
    assert sc.aggressive.stints[0].end_lap <= base.aggressive.stints[0].end_lap
    assert sc.aggressive.confidence >= base.aggressive.confidence


def test_forced_tyre_choice_overrides_opening_compound(dry_weather: WeatherSnapshot) -> None:
    forced = build_prediction("Race", dry_weather, tyre_choice="Hard")
    assert forced.conservative.tyre_sequence[0] == "Hard"
    assert forced.aggressive.tyre_sequence[0] == "Hard"


def test_forced_slicks_in_the_wet_are_penalised(wet_weather: WeatherSnapshot) -> None:
    sensible = build_prediction("Race", wet_weather)
    reckless = build_prediction("Race", wet_weather, tyre_choice="Soft")
    # Slicks in a downpour must read as clearly less confident than the auto call.
    assert reckless.conservative.confidence < sensible.conservative.confidence


def test_referenced_corners_match_reasoning(dry_weather: WeatherSnapshot) -> None:
    race = build_prediction("Race", dry_weather)
    # Dry race conservative reasoning names Turn 9 and Turn 1.
    assert "T9" in race.conservative.referenced_corners
    assert "T1" in race.conservative.referenced_corners
    # Aggressive dry race names Turn 15.
    assert "T15" in race.aggressive.referenced_corners


def test_all_sessions_return_both_cards(dry_weather: WeatherSnapshot) -> None:
    for session in ("FP1", "FP2", "FP3", "Quali", "Race"):
        prediction = build_prediction(session, dry_weather)
        assert prediction.conservative.variant == "conservative"
        assert prediction.aggressive.variant == "aggressive"
        assert 0 <= prediction.conservative.confidence <= 100
        assert 0 <= prediction.aggressive.confidence <= 100
        assert prediction.conservative.pit_window.start_lap <= prediction.conservative.pit_window.end_lap
        assert prediction.aggressive.key_risk
        assert prediction.conservative.stints
