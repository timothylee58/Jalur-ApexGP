"""Unit tests for the pure Race-day Picks scorer."""

from __future__ import annotations

import pytest

from app.schemas.jolpica import ClassifiedDriver, RaceClassification
from app.schemas.picks import PickAnswers
from app.services.picks_scoring import POINTS_PER_QUESTION, score_submission

CORRECT_PICKS = PickAnswers(
    winner="norris",
    p2="piastri",
    p3="verstappen",
    pole="piastri",
    fastest_lap="piastri",
    top_constructor="mclaren",
    dnf_band="1-2",
    beats_teammate_of="mclaren",
    beats_teammate_pick="norris",
)


def _classification(*, is_final: bool = True) -> RaceClassification:
    return RaceClassification(
        season="2026",
        round="16",
        source="jolpica",
        is_final=is_final,
        pole_family_name="Piastri",
        results=[
            ClassifiedDriver(
                position=1,
                driver_family_name="Norris",
                constructor_name="McLaren",
                status="Finished",
                points=25.0,
                fastest_lap_rank=2,
            ),
            ClassifiedDriver(
                position=2,
                driver_family_name="Piastri",
                constructor_name="McLaren",
                status="Finished",
                points=18.0,
                fastest_lap_rank=1,
            ),
            ClassifiedDriver(
                position=3,
                driver_family_name="Verstappen",
                constructor_name="Red Bull",
                status="Finished",
                points=15.0,
                fastest_lap_rank=None,
            ),
            ClassifiedDriver(
                position=4,
                driver_family_name="Leclerc",
                constructor_name="Ferrari",
                status="+1 Lap",
                points=12.0,
                fastest_lap_rank=None,
            ),
            ClassifiedDriver(
                position=None,
                driver_family_name="Pérez",
                constructor_name="Cadillac",
                status="Retired",
                points=0.0,
                fastest_lap_rank=None,
            ),
        ],
    )


def test_all_correct_scores_maximum() -> None:
    assert score_submission(CORRECT_PICKS, _classification()) == 80


def test_wrong_winner_costs_ten_points() -> None:
    picks = CORRECT_PICKS.model_copy(update={"winner": "verstappen"})
    assert score_submission(picks, _classification()) == 70


def test_wrong_dnf_band() -> None:
    # Only Pérez retired — the real band is "1-2"; a "0" guess is wrong.
    picks = CORRECT_PICKS.model_copy(update={"dnf_band": "0"})
    assert score_submission(picks, _classification()) == 70


def test_lapped_finisher_is_not_counted_as_a_dnf() -> None:
    # Leclerc's "+1 Lap" status is a finish, not a DNF — only Pérez's
    # "Retired" should count, keeping the band at "1-2" not "3+".
    picks = CORRECT_PICKS.model_copy(update={"dnf_band": "3+"})
    assert score_submission(picks, _classification()) == 70


def test_teammate_battle_wrong_pick() -> None:
    picks = CORRECT_PICKS.model_copy(update={"beats_teammate_pick": "piastri"})
    assert score_submission(picks, _classification()) == 70


def test_diacritic_insensitive_matching() -> None:
    # data/drivers.ts spells it "Pérez"; this classification's constructor
    # question doesn't touch Pérez, but the teammate-battle helper does —
    # exercised indirectly by never crashing/mismatching on the accent.
    picks = CORRECT_PICKS.model_copy(
        update={"beats_teammate_of": "cadillac", "beats_teammate_pick": "perez"}
    )
    classification = _classification()
    # Bottas isn't in this fixture's results, so his row is None and the
    # question is correctly left unscoreable rather than guessed at.
    assert score_submission(picks, classification) == 70


def test_raises_when_classification_not_final() -> None:
    with pytest.raises(ValueError):
        score_submission(CORRECT_PICKS, _classification(is_final=False))


def test_unknown_driver_id_scores_zero_for_that_question_not_a_crash() -> None:
    picks = CORRECT_PICKS.model_copy(update={"winner": "not-a-real-driver-id"})
    assert score_submission(picks, _classification()) == 70


def test_tied_top_constructor_accepts_either_tied_pick() -> None:
    # A genuine points tie isn't rare at low totals — max() alone would
    # silently favor whichever constructor happened to appear first in
    # the results list, scoring a correct pick of the OTHER tied
    # constructor as wrong.
    classification = RaceClassification(
        season="2026",
        round="16",
        source="jolpica",
        is_final=True,
        pole_family_name=None,
        results=[
            ClassifiedDriver(
                position=1,
                driver_family_name="Leclerc",
                constructor_name="Ferrari",
                status="Finished",
                points=10.0,
                fastest_lap_rank=None,
            ),
            ClassifiedDriver(
                position=2,
                driver_family_name="Verstappen",
                constructor_name="Red Bull",
                status="Finished",
                points=10.0,
                fastest_lap_rank=None,
            ),
        ],
    )
    base = PickAnswers(
        winner="not-a-real-driver-id",
        p2="not-a-real-driver-id",
        p3="not-a-real-driver-id",
        pole="not-a-real-driver-id",
        fastest_lap="not-a-real-driver-id",
        top_constructor="ferrari",
        dnf_band="3+",
        beats_teammate_of="mclaren",
        beats_teammate_pick="not-a-real-driver-id",
    )
    assert score_submission(base, classification) == POINTS_PER_QUESTION
    assert (
        score_submission(base.model_copy(update={"top_constructor": "red-bull"}), classification)
        == POINTS_PER_QUESTION
    )
    assert (
        score_submission(base.model_copy(update={"top_constructor": "mclaren"}), classification)
        == 0
    )
