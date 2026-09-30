import itertools
import re

import pytest

from app.schemas.prediction import WeatherSnapshot
from app.services.strategy_service import (
    RACE_LAPS,
    SESSION_LAPS,
    _referenced_corners,
    build_prediction,
)

SESSIONS = ("FP1", "FP2", "FP3", "Quali", "Race")
COMPOUNDS = ("Soft", "Medium", "Hard", "Intermediate", "Wet")

# Every input combination the what-if controls can produce, at the rain
# levels either side of the engine's 35% and 60% thresholds.
SCENARIOS = list(
    itertools.product(SESSIONS, (12.0, 42.0, 78.0), (None, *COMPOUNDS), (False, True))
)


def _read(session: str, rain: float, tyre: str | None, safety_car: bool):
    weather = WeatherSnapshot(temp_c=32.0, rain_probability=rain, condition="Partly cloudy")
    return build_prediction(session, weather, safety_car=safety_car, tyre_choice=tyre)


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


@pytest.mark.parametrize(("session", "rain", "tyre", "safety_car"), SCENARIOS)
def test_every_plan_covers_the_session_from_lap_one(
    session: str, rain: float, tyre: str | None, safety_car: bool
) -> None:
    prediction = _read(session, rain, tyre, safety_car)
    total = SESSION_LAPS[session]
    assert prediction.race_laps == total
    for variant in (prediction.conservative, prediction.aggressive):
        stints = variant.stints
        assert [s.compound for s in stints] == variant.tyre_sequence
        assert stints[0].start_lap == 1
        assert stints[-1].end_lap == total
        for stint in stints:
            assert stint.laps == stint.end_lap - stint.start_lap + 1
        for before, after in zip(stints, stints[1:]):
            assert after.start_lap == before.end_lap + 1
        assert variant.stop_count == len(stints) - 1
        assert 1 <= variant.pit_window.start_lap <= variant.pit_window.end_lap <= total


@pytest.mark.parametrize(("session", "rain", "tyre", "safety_car"), SCENARIOS)
def test_card_text_names_only_the_plans_own_tyres(
    session: str, rain: float, tyre: str | None, safety_car: bool
) -> None:
    # The bug this guards: a practice card showing Medium → Intermediate
    # while its text said "long-run mediums, one timed soft".
    prediction = _read(session, rain, tyre, safety_car)
    for variant in (prediction.conservative, prediction.aggressive):
        for compound in variant.tyre_sequence:
            assert compound in variant.reasoning, (compound, variant.reasoning)
        for compound in set(COMPOUNDS) - set(variant.tyre_sequence):
            pattern = re.compile(rf"\b{compound}")
            assert not pattern.search(variant.reasoning), (compound, variant.reasoning)
            assert not pattern.search(variant.key_risk), (compound, variant.key_risk)


@pytest.mark.parametrize(("session", "rain", "tyre", "safety_car"), SCENARIOS)
def test_each_read_has_its_own_key_risk(
    session: str, rain: float, tyre: str | None, safety_car: bool
) -> None:
    prediction = _read(session, rain, tyre, safety_car)
    assert prediction.conservative.key_risk != prediction.aggressive.key_risk


def test_practice_runs_long_and_push_in_opposite_orders(dry_weather: WeatherSnapshot) -> None:
    prediction = build_prediction("FP2", dry_weather)
    long_first, push_first = prediction.conservative.stints, prediction.aggressive.stints
    assert long_first[0].laps > long_first[1].laps
    assert push_first[0].laps < push_first[1].laps
    # The change window brackets the lap each read goes back to the garage.
    for variant in (prediction.conservative, prediction.aggressive):
        change = variant.stints[0].end_lap
        assert variant.pit_window.start_lap <= change <= variant.pit_window.end_lap


def test_hotter_track_shortens_the_practice_long_run(dry_weather: WeatherSnapshot) -> None:
    hot = build_prediction("FP2", dry_weather.model_copy(update={"temp_c": 44.0}))
    cool = build_prediction("FP2", dry_weather.model_copy(update={"temp_c": 26.0}))
    assert hot.conservative.stints[0].laps < cool.conservative.stints[0].laps


def test_quali_stakes_the_lap_on_different_q3_runs(dry_weather: WeatherSnapshot) -> None:
    prediction = build_prediction("Quali", dry_weather)
    assert prediction.conservative.tyre_sequence == ["Soft"]
    assert prediction.conservative.pit_window.end_lap < prediction.aggressive.pit_window.start_lap
    assert prediction.aggressive.pit_window.end_lap == SESSION_LAPS["Quali"]


def test_quali_never_asks_for_slicks_other_than_softs(wet_weather: WeatherSnapshot) -> None:
    for rain in (12.0, 42.0, 78.0):
        prediction = build_prediction("Quali", wet_weather.model_copy(update={"rain_probability": rain}))
        for variant in (prediction.conservative, prediction.aggressive):
            assert set(variant.tyre_sequence) <= {"Soft", "Intermediate"}


def test_forced_slicks_in_heavy_rain_box_for_inters(wet_weather: WeatherSnapshot) -> None:
    prediction = build_prediction("Race", wet_weather, tyre_choice="Medium")
    assert prediction.conservative.tyre_sequence == ["Medium", "Intermediate"]
    assert "wrong tyre" in prediction.conservative.key_risk


def test_turn_15_does_not_also_highlight_turn_1() -> None:
    assert _referenced_corners("Don't burn the rears defending into Turn 15.") == ["T15"]
    assert _referenced_corners("Lift into Turn 1, then Turns 5–7.") == ["T1", "T5–T7"]


def test_the_long_run_is_always_the_longer_stint(dry_weather: WeatherSnapshot) -> None:
    for tyre in (None, "Soft", "Medium", "Hard", "Intermediate", "Wet"):
        for rain in (12.0, 42.0, 78.0):
            weather = dry_weather.model_copy(update={"rain_probability": rain})
            for variant in (build_prediction("FP2", weather, tyre_choice=tyre).conservative,):
                first, second = variant.stints
                long_stint = first if "long" not in variant.reasoning.split("then")[1] else second
                assert long_stint.laps >= min(first.laps, second.laps)
                assert "push" not in variant.reasoning.split("then")[0] or first.laps < second.laps
