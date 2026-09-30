"""Deterministic Sepang strategy simulator.

This is NOT a trained model. It is a transparent, rules-based blend: the weather
snapshot (live Open-Meteo + Sepang climatology) feeds a tyre/compound heuristic
and a lap-by-lap stint model that derives pit windows from modelled tyre life
rather than a fixed fraction of the session. What-if inputs (rain, track temp,
safety car, forced starting compound) flow through the same rules so the client
can explore scenarios live.

Every session gets a plan that covers its whole lap budget from lap 1: a
one-stop race, two practice runs with a tyre change between them, or
qualifying's three segments. The text on each card (reasoning and key risk)
is written from that plan's own compounds and laps, so what the card says
always matches the tyres it shows.
"""

import re

from app.schemas.prediction import (
    PitWindow,
    PredictionResponse,
    Session,
    Stint,
    StrategyPrediction,
    StrategyVariant,
    WeatherSnapshot,
)

# Laps each session's plan covers. The race is Sepang's real 56. The rest are
# stylised per-car budgets: a 60-minute practice session, and qualifying as
# three 6-lap segments (two runs of out-lap, flying lap, in-lap in each).
SESSION_LAPS: dict[Session, int] = {"FP1": 20, "FP2": 22, "FP3": 18, "Quali": 18, "Race": 56}
RACE_LAPS = SESSION_LAPS["Race"]
QUALI_SEGMENT_LAPS = 6

# A practice push run: out-lap, push lap, cool-down, push lap, in-lap.
SHORT_RUN_LAPS = 5
# Share of a compound's modelled life a practice long run uses; teams stop
# well before the cliff to keep the set for later.
LONG_RUN_SHARE = 0.55

WET_COMPOUNDS = ("Intermediate", "Wet")

# Baseline dry-tyre life in laps at a nominal 31°C ambient on Sepang's abrasive,
# hot surface. Stylised but ordered like real Pirelli behaviour: softer = faster
# but shorter-lived. Wet compounds are life on a genuinely wet track.
COMPOUND_BASE_LIFE: dict[str, int] = {
    "Soft": 16,
    "Medium": 26,
    "Hard": 38,
    "Intermediate": 22,
    "Wet": 30,
}

NOMINAL_TEMP_C = 31.0


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _adjusted_life(compound: str, temp_c: float) -> float:
    """Tyre life in laps, shortened as the track heats past the nominal temp."""
    base = COMPOUND_BASE_LIFE.get(compound, 24)
    # ~1% life lost per °C over nominal; capped so extremes stay plausible.
    temp_factor = _clamp(1.0 - 0.011 * (temp_c - NOMINAL_TEMP_C), 0.72, 1.18)
    return base * temp_factor


def _tyre_fit_penalty(compound: str, rain_probability: float) -> float:
    """Confidence penalty (points) for running a compound unsuited to conditions.

    Used when the user forces a starting tyre — e.g. slicks in a downpour, or
    wets on a dry line — so a deliberately bad what-if choice reads as risky.
    """
    is_slick = compound in ("Soft", "Medium", "Hard")
    if rain_probability >= 60:
        if is_slick:
            return 24.0
        return 0.0 if compound == "Wet" else 6.0  # inters slightly off in heavy rain
    if rain_probability >= 35:
        if compound == "Wet":
            return 14.0
        if compound == "Soft":
            return 6.0
        return 0.0
    # Dry: wet-weather rubber is pointless.
    if compound in ("Intermediate", "Wet"):
        return 20.0
    return 0.0


def _confidence(
    rain_probability: float,
    is_conservative: bool,
    *,
    temp_c: float,
    safety_car: bool,
    tyre_penalty: float,
) -> float:
    rain = _clamp(rain_probability / 100.0, 0.0, 1.0)
    base = 58 + rain * 32 if is_conservative else 74 - rain * 28

    # Heat drives degradation: it nibbles at the aggressive read and slightly
    # rewards the tyre-conserving conservative one.
    temp_delta = temp_c - 32.0
    base += (temp_delta * 0.35) if is_conservative else (-temp_delta * 0.7)

    # A safety car makes the stop "cheap" and cuts undercut exposure — the
    # aggressive read benefits most.
    if safety_car:
        base += 3 if is_conservative else 7

    base -= tyre_penalty

    low, high = (55, 92) if is_conservative else (40, 90)
    return round(_clamp(base, low, high), 0)


def _is_wet(compound: str) -> bool:
    return compound in WET_COMPOUNDS


def _plural(compound: str) -> str:
    return f"{compound}s"


def _auto_sequence(session: Session, rain_probability: float, variant: str) -> list[str]:
    conservative = variant == "conservative"
    if session == "Quali":
        # A one-lap exercise: softs unless it's wet. The split is who commits
        # to the weather call and who gambles against it.
        if rain_probability >= 60:
            return ["Intermediate"] if conservative else ["Intermediate", "Soft"]
        if rain_probability >= 35:
            return ["Soft", "Intermediate"] if conservative else ["Soft"]
        return ["Soft"]
    if rain_probability >= 60:
        return ["Intermediate", "Medium"] if conservative else ["Soft", "Intermediate"]
    if rain_probability >= 35:
        return ["Medium", "Intermediate"] if conservative else ["Soft", "Medium"]
    if session == "Race":
        return ["Medium", "Hard"] if conservative else ["Soft", "Medium"]
    return ["Medium", "Soft"] if conservative else ["Soft", "Medium"]


def _second_compound(opening: str, variant: str, rain_probability: float) -> str:
    """A sensible follow-on compound when the user forces the opening tyre."""
    if rain_probability >= 60:
        # Slicks and full wets both end up on inters in heavy rain; inters
        # run until the line dries enough for mediums.
        return "Medium" if opening == "Intermediate" else "Intermediate"
    if rain_probability >= 35:
        return "Medium" if _is_wet(opening) else "Intermediate"
    # Dry: pair with a different slick — conservative wants durability, aggressive pace.
    durable = {"Soft": "Medium", "Medium": "Hard", "Hard": "Medium"}
    pacey = {"Soft": "Medium", "Medium": "Soft", "Hard": "Medium"}
    table = durable if variant == "conservative" else pacey
    return table.get(opening, "Medium")


def _tyre_sequence(
    session: Session,
    rain_probability: float,
    variant: str,
    tyre_choice: str | None,
) -> list[str]:
    if tyre_choice is None:
        return _auto_sequence(session, rain_probability, variant)
    if session == "Quali":
        return [tyre_choice]
    return [tyre_choice, _second_compound(tyre_choice, variant, rain_probability)]


def _simulate_race_stints(
    tyre_sequence: list[str],
    *,
    temp_c: float,
    safety_car: bool,
) -> tuple[list[Stint], PitWindow]:
    """Model a one-stop race from modelled tyre life, not a fixed fraction.

    The first stint runs until its compound's modelled life; the pit window is a
    band around that lap. A safety car pulls the stop earlier (cheap track
    position) and widens the window.
    """
    opening = tyre_sequence[0]
    second = tyre_sequence[1] if len(tyre_sequence) > 1 else _second_compound(opening, "conservative", 0)

    life = _adjusted_life(opening, temp_c)
    earliest = max(6, round(RACE_LAPS * 0.16))
    latest = RACE_LAPS - 4
    pit_lap = int(_clamp(round(life), earliest, latest))
    if safety_car:
        pit_lap = int(_clamp(pit_lap - 4, earliest - 2, latest))

    span_lo = 3 if not safety_car else 4
    win_start = int(_clamp(pit_lap - span_lo, 2, RACE_LAPS - 2))
    win_end = int(_clamp(pit_lap + 2, win_start + 1, RACE_LAPS - 1))

    stints = [
        Stint(compound=opening, start_lap=1, end_lap=pit_lap, laps=pit_lap),
        Stint(compound=second, start_lap=pit_lap + 1, end_lap=RACE_LAPS, laps=RACE_LAPS - pit_lap),
    ]
    return stints, PitWindow(start_lap=win_start, end_lap=win_end)


def _two_stints(first: str, second: str, change: int, total: int) -> list[Stint]:
    return [
        Stint(compound=first, start_lap=1, end_lap=change, laps=change),
        Stint(compound=second, start_lap=change + 1, end_lap=total, laps=total - change),
    ]


def _practice_plan(
    session: Session,
    tyre_sequence: list[str],
    *,
    variant: str,
    temp_c: float,
) -> tuple[list[Stint], PitWindow]:
    """Two runs that fill the session, with a tyre change between them.

    Conservative banks its long run first and finishes with a push run;
    aggressive does the push run first, then the long run. A long run uses a
    share of its compound's modelled life, so a hotter track shortens it. The
    window is the laps around the change.
    """
    total = SESSION_LAPS[session]
    first, second = tyre_sequence[0], tyre_sequence[1]
    if variant == "conservative":
        long_run = round(_adjusted_life(first, temp_c) * LONG_RUN_SHARE)
        change = int(_clamp(long_run, 8, total - SHORT_RUN_LAPS))
    else:
        change = SHORT_RUN_LAPS
    window = PitWindow(start_lap=max(2, change - 1), end_lap=min(total - 1, change + 1))
    return _two_stints(first, second, change, total), window


def _quali_plan(tyre_sequence: list[str], *, variant: str) -> tuple[list[Stint], PitWindow]:
    """Q1 to Q3 as one lap budget, one or two compounds.

    The window is the Q3 run each read stakes its lap on: the first run for
    conservative (a banker), the final one for aggressive.
    """
    total = SESSION_LAPS["Quali"]
    if len(tyre_sequence) == 1:
        stints = [Stint(compound=tyre_sequence[0], start_lap=1, end_lap=total, laps=total)]
    else:
        # Rain arriving: switch after Q1. A drying track: slicks only for Q3.
        segments = 1 if _is_wet(tyre_sequence[1]) else 2
        stints = _two_stints(tyre_sequence[0], tyre_sequence[1], segments * QUALI_SEGMENT_LAPS, total)

    run = QUALI_SEGMENT_LAPS // 2
    q3_start = total - QUALI_SEGMENT_LAPS + 1
    if variant == "conservative":
        window = PitWindow(start_lap=q3_start, end_lap=q3_start + run - 1)
    else:
        window = PitWindow(start_lap=total - run + 1, end_lap=total)
    return stints, window


def _weather_shift(stints: list[Stint]) -> str:
    """How the plan's tyres follow the weather: "dry" (slicks only), "rain"
    (slick to wet), "drying" (wet to slick) or "wet" (wet tyres only)."""
    first, last = _is_wet(stints[0].compound), _is_wet(stints[-1].compound)
    if first and last:
        return "wet"
    if first:
        return "drying"
    if last:
        return "rain"
    return "dry"


# Corner codes match frontend/data/circuitCorners.ts so the map can highlight
# exactly the corners the reasoning text names. Word boundaries keep "Turn 15"
# from also lighting up Turn 1.
_CORNER_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("T1", re.compile(r"\bturn 1\b")),
    ("T5–T7", re.compile(r"\bturns? 5\b|\besses\b")),
    ("T9", re.compile(r"\bturn 9\b")),
    ("T15", re.compile(r"\bturn 15\b")),
]


def _referenced_corners(*texts: str) -> list[str]:
    blob = " ".join(texts).lower()
    return [code for code, pattern in _CORNER_PATTERNS if pattern.search(blob)]


def _rain_label(weather: WeatherSnapshot) -> str:
    return f"{weather.condition} ({weather.rain_probability:.0f}% rain)"


# What each compound's run is for in practice, by run type.
_LONG_RUN_FOR: dict[str, str] = {
    "Soft": "high-fuel data on the softest tyre",
    "Medium": "race-pace and degradation data",
    "Hard": "a race-distance baseline on the hardest tyre",
    "Intermediate": "wet-running mileage on the crossover tyre",
    "Wet": "full-wet mileage, in case race day is a washout",
}
_PUSH_RUN_FOR: dict[str, str] = {
    "Soft": "a low-fuel push lap",
    "Medium": "a push lap on the race tyre",
    "Hard": "a single-lap read on the hardest tyre",
    "Intermediate": "a timed lap if a shower dampens the line",
    "Wet": "a feel for full wets if the rain gets heavy",
}


def _race_reasoning(variant: str, stints: list[Stint], weather: WeatherSnapshot, safety_car: bool) -> str:
    conservative = variant == "conservative"
    first, second = stints
    a, b, pit = _plural(first.compound), _plural(second.compound), first.end_lap
    shift = _weather_shift(stints)
    if shift == "rain":
        text = (
            f"{_rain_label(weather)} — start on {a} and box for {b} the moment the shower reaches Turn 9; "
            f"the model has it around L{pit}. Sepang storms can red-flag a race in minutes."
            if conservative
            else f"Stay out on {a} while the racing line is dry through Turn 1 — the gain is big if the cell "
            f"holds off. Box for {b} the lap it hits the pit straight, around L{pit} in the model."
        )
    elif shift == "drying":
        text = (
            f"{_rain_label(weather)} — start on {a} and wait for a dry line through Turn 1 before switching "
            f"to {b} around L{pit}. Let someone else be first onto slicks."
            if conservative
            else f"Start on {a}, then be first onto {b} once a dry line forms through Turn 1 — around L{pit} "
            "in the model. It's the biggest gain in a drying race."
        )
    elif shift == "wet":
        text = (
            f"{_rain_label(weather)} — {a} while there's standing water, then {b} once the spray drops, "
            f"around L{pit}. Stay off the painted kerbs at Turn 9 and Turn 15."
            if conservative
            else f"Start on {a}, then switch to {b} early — around L{pit}. The first car onto the lighter "
            "tyre gains seconds a lap."
        )
    else:
        text = (
            f"{weather.temp_c:.1f}°C — a durable one-stop: {a} to around L{pit}, then {b} to the flag. "
            "Protect the rear-left through Turn 9's closing radius and lift-and-coast into Turn 1."
            if conservative
            else f"Offset one-stop: box early off the {a} around L{pit} and attack on fresher {b}. Use "
            "Overtake Mode down the back straight, but don't burn the rears defending into Turn 15."
        )
        if not conservative and weather.rain_probability >= 35:
            text += f" It's a bet that the shower misses — {weather.rain_probability:.0f}% says it might not."
    if safety_car:
        text += (
            " Safety car? Take the cheap stop and hold track position."
            if conservative
            else " Under a safety car, dive in early — the pit loss shrinks and you jump the queue."
        )
    return text


def _practice_reasoning(variant: str, stints: list[Stint], weather: WeatherSnapshot) -> str:
    first, second = stints
    a, b = _plural(first.compound), _plural(second.compound)
    unsettled = weather.rain_probability >= 35 or _weather_shift(stints) != "dry"
    # The longer stint is the long run, whichever order it comes in: a
    # short-life opener can leave more laps after it than it runs itself.
    long_first = first.laps >= second.laps
    first_for = (_LONG_RUN_FOR if long_first else _PUSH_RUN_FOR)[first.compound]
    second_for = (_PUSH_RUN_FOR if long_first else _LONG_RUN_FOR)[second.compound]
    if variant == "conservative":
        text = (
            f"{first.laps} laps on {a} for {first_for}, then {second.laps} laps "
            f"on {b} for {second_for}."
        )
        if unsettled:
            return (
                f"{text} {_rain_label(weather)}: a Sepang storm can red-flag the session in minutes, "
                "so bank the long run first."
            )
        return f"{text} At {weather.temp_c:.0f}°C, heat soak through Turns 5–7 is the main tyre risk."
    text = (
        f"Open with {first.laps} laps on {a} for {first_for}, then {second.laps} laps "
        f"on {b} for {second_for}."
    )
    if unsettled:
        return f"{text} Get the push lap in before the weather turns."
    return f"{text} Chase a tow through Sector 2 on the push lap — accept the deg for a headline time."


def _quali_reasoning(variant: str, stints: list[Stint], weather: WeatherSnapshot) -> str:
    conservative = variant == "conservative"
    a = _plural(stints[0].compound)
    shift = _weather_shift(stints)
    if len(stints) == 2:
        b = _plural(stints[1].compound)
        if shift == "rain":
            return (
                f"{_rain_label(weather)} — bank a Q1 lap on {a} before the shower, switch to {b} "
                "from Q2 if it reaches Turn 9, and bank again on the first Q3 run."
            )
        return f"Start on {a} for Q1 and Q2, then gamble on {b} for Q3 if a dry line forms through Turn 1."
    if shift == "wet":
        return (
            f"{_rain_label(weather)} — {a} all session. Bank a lap early in each segment, before the spray "
            "and the queue build, and stay off the painted kerbs at Turn 9."
            if conservative
            else f"Stay on {a} all session and run late in each segment as the line clears — the track is "
            "quickest at the flag."
        )
    if conservative:
        return (
            f"Stay on {a} all session and bank a clean lap on the first Q3 run, before track evolution "
            "peaks — Turn 15 rewards a late apex."
        )
    text = (
        f"Stay on {a} all session and save the flyer for the last Q3 run — evolution at Sepang peaks as the "
        "sun drops behind the main grandstand."
    )
    if weather.rain_probability >= 35:
        text += " It's a bet that the shower holds off until the flag."
    return text


def _reasoning(
    session: Session, variant: str, stints: list[Stint], weather: WeatherSnapshot, safety_car: bool
) -> str:
    if session == "Race":
        return _race_reasoning(variant, stints, weather, safety_car)
    if session == "Quali":
        return _quali_reasoning(variant, stints, weather)
    return _practice_reasoning(variant, stints, weather)


def _wrong_tyre_risk(session: Session, conservative: bool, opening: str, rain_probability: float) -> str:
    """For a forced opening tyre the conditions don't suit (the picker's
    "wrong tyre" band)."""
    a = _plural(opening)
    if _is_wet(opening):
        track = "dry" if rain_probability < 35 else "damp"
    else:
        track = "wet"
    if session == "Quali":
        return (
            f"{a} are the wrong tyre on a {track} track — expect to go out in Q1."
            if conservative
            else f"{a} on a {track} track — only a perfect lap gets you through Q1."
        )
    if conservative:
        return (
            f"{a} are the wrong tyre on a {track} track — change at the first chance rather than "
            "wait for the window."
        )
    if session == "Race":
        return f"{a} on a {track} track — every lap you stretch them costs more than the stop you're saving."
    return f"{a} on a {track} track — the laps on them won't tell you anything useful for the weekend."


def _key_risk(
    session: Session,
    variant: str,
    stints: list[Stint],
    weather: WeatherSnapshot,
    *,
    safety_car: bool,
    tyre_penalty: float,
) -> str:
    conservative = variant == "conservative"
    rain = weather.rain_probability
    shift = _weather_shift(stints)
    a = _plural(stints[0].compound)
    b = _plural(stints[-1].compound)

    if tyre_penalty >= 14:
        return _wrong_tyre_risk(session, conservative, stints[0].compound, rain)

    if session == "Race":
        if safety_car:
            return (
                "Staying out while others pit under the safety car drops you behind cars on fresher tyres."
                if conservative
                else "If the safety car pits the field together, your offset advantage evaporates on "
                "the restart."
            )
        if shift == "rain":
            return (
                f"Boxing for {b} too early if the storm slides south of the circuit."
                if conservative
                else f"Caught on {a} when the cell hits — one lap on a wet track costs more than the stop."
            )
        if shift == "drying":
            return (
                f"Waiting too long for {b} — cars that switch a lap earlier leap-frog you."
                if conservative
                else f"{b} on a damp Turn 9 — go too early and you're in the gravel."
            )
        if shift == "wet":
            return (
                "Aquaplaning on the back straight if the rain gets heavier before you switch."
                if conservative
                else f"{b} in standing water — switch too early and they can't clear the spray."
            )
        if conservative:
            return "Undercut from cars behind if you cover the pit window too conservatively."
        if rain >= 35:
            return "Caught on slicks if the shower arrives — the stop you saved turns into two."
        return "Rear deg on the back straight if the stop is stretched."

    if session == "Quali":
        if conservative:
            if shift == "rain":
                return (
                    f"Switching to {b} too soon — if the shower misses, the cars on {a} take the "
                    "top spots."
                )
            if shift == "wet":
                return f"A drying line late in Q3 — {a} can't match slicks if the rain stops."
            return (
                "Track evolution — an early banker is the slowest lap of the segment, so expect "
                "to be bumped down late."
            )
        if shift == "drying":
            return f"{b} on a still-damp Turn 9 — one lock-up and there's no lap left."
        if shift == "wet":
            return (
                "Running late in the segment — one red flag for a stranded car and there's no "
                "lap on the board."
            )
        if rain >= 35:
            return "A shower on the final run leaves you with no time on the board."
        return (
            "Everything rides on the last run — a yellow flag or a Turn 15 queue and there's no "
            "time for another lap."
        )

    unsettled = rain >= 35 or shift != "dry"
    if conservative:
        return (
            "A red flag mid-run wipes out the long-run data — there's rarely time to run it again."
            if unsettled
            else "Heat soak through the esses — deg builds lap on lap, so judge the long run on its "
            "last laps."
        )
    if _is_wet(stints[-1].compound):
        return (
            f"The line drying under the {b} — they overheat on a dry track and the wet data "
            "stops meaning anything."
        )
    return (
        "Rain on the long run — the race-pace data ends early, with no second chance at it."
        if unsettled
        else f"Traffic on the push lap — one queue into Turn 15 and the {a}' best lap is gone."
    )


def _build_variant(
    session: Session,
    weather: WeatherSnapshot,
    *,
    variant: StrategyVariant,
    safety_car: bool,
    tyre_choice: str | None,
) -> StrategyPrediction:
    rain = weather.rain_probability
    tyres = _tyre_sequence(session, rain, variant, tyre_choice)

    if session == "Race":
        stints, window = _simulate_race_stints(tyres, temp_c=weather.temp_c, safety_car=safety_car)
    elif session == "Quali":
        stints, window = _quali_plan(tyres, variant=variant)
    else:
        stints, window = _practice_plan(session, tyres, variant=variant, temp_c=weather.temp_c)

    tyre_penalty = _tyre_fit_penalty(tyres[0], rain) if tyre_choice is not None else 0.0
    reasoning = _reasoning(session, variant, stints, weather, safety_car)
    key_risk = _key_risk(session, variant, stints, weather, safety_car=safety_car, tyre_penalty=tyre_penalty)

    return StrategyPrediction(
        variant=variant,
        tyre_sequence=tyres,
        confidence=_confidence(
            rain,
            variant == "conservative",
            temp_c=weather.temp_c,
            safety_car=safety_car,
            tyre_penalty=tyre_penalty,
        ),
        pit_window=window,
        stints=stints,
        # Tyre changes: a pit stop in the race, a trip to the garage in
        # practice, a switch between segments in qualifying.
        stop_count=len(stints) - 1,
        reasoning=reasoning,
        key_risk=key_risk,
        referenced_corners=_referenced_corners(reasoning, key_risk),
    )


def build_prediction(
    session: Session,
    weather: WeatherSnapshot,
    *,
    safety_car: bool = False,
    tyre_choice: str | None = None,
) -> PredictionResponse:
    conservative = _build_variant(
        session, weather, variant="conservative", safety_car=safety_car, tyre_choice=tyre_choice
    )
    aggressive = _build_variant(
        session, weather, variant="aggressive", safety_car=safety_car, tyre_choice=tyre_choice
    )

    return PredictionResponse(
        session=session,
        weather=weather,
        conservative=conservative,
        aggressive=aggressive,
        race_laps=SESSION_LAPS[session],
    )
