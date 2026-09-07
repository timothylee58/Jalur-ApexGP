"""Pure scoring for Race-day Picks — deterministic, no IO, unit-testable
in isolation, same shape as scoring_service.py.

A pick answer is always this app's own driver/team slug id (see
PickAnswers' docstring). A real classification from Jolpica carries only
names (driver family name, constructor name) — Ergast's own id slugs don't
reliably line up with this app's ids (Max Verstappen is "max_verstappen"
in Ergast, to disambiguate from his father Jos; several 2026 rookies have
no established Ergast slug yet since they haven't raced in the real data
this app pulls from). So matching happens by name instead: this module
holds a small, explicit id → real name table (kept in sync with
frontend/data/drivers.ts and data/teams.ts by hand — there are only 22
drivers and 11 teams, small enough that duplicating beats a build-time
codegen step here), and compares names with diacritics stripped and
case folded so "Perez" and "Pérez" are the same driver regardless of
which form either side happens to use.
"""

from __future__ import annotations

import unicodedata

from app.schemas.jolpica import ClassifiedDriver, RaceClassification
from app.schemas.picks import PickAnswers

POINTS_PER_QUESTION = 10

# id -> real family name, 2026-grid only (data/drivers.ts's three
# "sepang-history" entries aren't selectable picks and aren't listed here).
DRIVER_FAMILY_NAME: dict[str, str] = {
    "norris": "Norris",
    "piastri": "Piastri",
    "leclerc": "Leclerc",
    "hamilton": "Hamilton",
    "verstappen": "Verstappen",
    "hadjar": "Hadjar",
    "russell": "Russell",
    "antonelli": "Antonelli",
    "alonso": "Alonso",
    "stroll": "Stroll",
    "gasly": "Gasly",
    "colapinto": "Colapinto",
    "ocon": "Ocon",
    "bearman": "Bearman",
    "lawson": "Lawson",
    "lindblad": "Lindblad",
    "sainz": "Sainz",
    "albon": "Albon",
    "hulkenberg": "Hülkenberg",
    "bortoleto": "Bortoleto",
    "perez": "Pérez",
    "bottas": "Bottas",
}

# id -> real constructor name, matching data/teams.ts's 11 entries.
CONSTRUCTOR_NAME: dict[str, str] = {
    "mclaren": "McLaren",
    "ferrari": "Ferrari",
    "red-bull": "Red Bull",
    "mercedes": "Mercedes",
    "aston-martin": "Aston Martin",
    "alpine": "Alpine",
    "haas": "Haas",
    "racing-bulls": "Racing Bulls",
    "williams": "Williams",
    "audi": "Audi",
    "cadillac": "Cadillac",
}

# team id -> its two driver ids, mirroring data/teams.ts's driverIds pairs.
# Used only for the "beats teammate" question.
TEAM_DRIVER_IDS: dict[str, tuple[str, str]] = {
    "mclaren": ("norris", "piastri"),
    "ferrari": ("leclerc", "hamilton"),
    "red-bull": ("verstappen", "hadjar"),
    "mercedes": ("russell", "antonelli"),
    "aston-martin": ("alonso", "stroll"),
    "alpine": ("gasly", "colapinto"),
    "haas": ("ocon", "bearman"),
    "racing-bulls": ("lawson", "lindblad"),
    "williams": ("sainz", "albon"),
    "audi": ("hulkenberg", "bortoleto"),
    "cadillac": ("perez", "bottas"),
}


def _normalize(text: str) -> str:
    stripped = unicodedata.normalize("NFKD", text)
    without_marks = "".join(ch for ch in stripped if not unicodedata.combining(ch))
    return without_marks.strip().casefold()


def _names_match(a: str, b: str) -> bool:
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        # An empty string (e.g. an unknown/unmapped id looked up with a
        # default of "") is a substring of everything in Python — without
        # this guard an unrecognized pick id would score a false match
        # instead of correctly scoring zero for that question.
        return False
    return na == nb or na in nb or nb in na


def _is_dnf(status: str) -> bool:
    # Ergast marks lapped-but-classified finishers as "+1 Lap" / "+2 Laps"
    # etc. — that's a finish, not a DNF. Only "Finished" and "+N Lap(s)"
    # count as finishing; anything else (Retired, Accident, Engine, DNS,
    # DSQ, ...) is a DNF for this question's purposes.
    return not (status == "Finished" or status.startswith("+"))


def _by_position(classification: RaceClassification, position: int) -> ClassifiedDriver | None:
    for row in classification.results:
        if row.position == position:
            return row
    return None


def _fastest_lap_holder(classification: RaceClassification) -> ClassifiedDriver | None:
    for row in classification.results:
        if row.fastest_lap_rank == 1:
            return row
    return None


def _top_constructor_name(classification: RaceClassification) -> str | None:
    points_by_constructor: dict[str, float] = {}
    for row in classification.results:
        points_by_constructor[row.constructor_name] = (
            points_by_constructor.get(row.constructor_name, 0.0) + row.points
        )
    if not points_by_constructor:
        return None
    return max(points_by_constructor.items(), key=lambda item: item[1])[0]


def _dnf_band(classification: RaceClassification) -> str:
    dnf_count = sum(1 for row in classification.results if _is_dnf(row.status))
    if dnf_count == 0:
        return "0"
    if dnf_count <= 2:
        return "1-2"
    return "3+"


def _teammate_battle_winner(
    classification: RaceClassification, team_id: str
) -> str | None:
    """Returns the winning driver's id, or None if either driver's finishing
    position couldn't be determined (never guessed at — an unscoreable
    question just scores 0, same as any other unmatched answer)."""
    pair = TEAM_DRIVER_IDS.get(team_id)
    if pair is None:
        return None
    rows = {
        driver_id: next(
            (
                row
                for row in classification.results
                if _names_match(row.driver_family_name, DRIVER_FAMILY_NAME.get(driver_id, ""))
            ),
            None,
        )
        for driver_id in pair
    }
    a_id, b_id = pair
    row_a, row_b = rows[a_id], rows[b_id]
    if row_a is None or row_b is None or row_a.position is None or row_b.position is None:
        return None
    return a_id if row_a.position < row_b.position else b_id


def score_submission(picks: PickAnswers, classification: RaceClassification) -> int:
    """10 points per exactly-right answer, 0 otherwise — flat, matching the
    reference project this feature was scoped from. Partial credit (e.g.
    right driver/wrong podium slot) is a deliberate non-goal for v1."""
    if not classification.is_final:
        raise ValueError("Cannot score against a classification that isn't final yet")

    score = 0

    winner = _by_position(classification, 1)
    if winner and _names_match(winner.driver_family_name, DRIVER_FAMILY_NAME.get(picks.winner, "")):
        score += POINTS_PER_QUESTION

    p2 = _by_position(classification, 2)
    if p2 and _names_match(p2.driver_family_name, DRIVER_FAMILY_NAME.get(picks.p2, "")):
        score += POINTS_PER_QUESTION

    p3 = _by_position(classification, 3)
    if p3 and _names_match(p3.driver_family_name, DRIVER_FAMILY_NAME.get(picks.p3, "")):
        score += POINTS_PER_QUESTION

    if classification.pole_family_name and _names_match(
        classification.pole_family_name, DRIVER_FAMILY_NAME.get(picks.pole, "")
    ):
        score += POINTS_PER_QUESTION

    fastest = _fastest_lap_holder(classification)
    if fastest and _names_match(
        fastest.driver_family_name, DRIVER_FAMILY_NAME.get(picks.fastest_lap, "")
    ):
        score += POINTS_PER_QUESTION

    top_constructor = _top_constructor_name(classification)
    if top_constructor and _names_match(
        top_constructor, CONSTRUCTOR_NAME.get(picks.top_constructor, "")
    ):
        score += POINTS_PER_QUESTION

    if _dnf_band(classification) == picks.dnf_band:
        score += POINTS_PER_QUESTION

    teammate_winner = _teammate_battle_winner(classification, picks.beats_teammate_of)
    if teammate_winner is not None and teammate_winner == picks.beats_teammate_pick:
        score += POINTS_PER_QUESTION

    return score
