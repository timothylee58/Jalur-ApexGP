"""Deterministic Sepang strategy simulator.

This is NOT a trained model. It is a transparent, rules-based blend: the weather
snapshot (live Open-Meteo + Sepang climatology) feeds a tyre/compound heuristic
and a lap-by-lap stint model that derives pit windows from modelled tyre life
rather than a fixed fraction of the session. What-if inputs (rain, track temp,
safety car, forced starting compound) flow through the same rules so the client
can explore scenarios live.
"""

from app.schemas.prediction import (
    PitWindow,
    PredictionResponse,
    Session,
    Stint,
    StrategyPrediction,
    StrategyVariant,
    WeatherSnapshot,
)

# Modelled race distance for the Grand Prix (Sepang is 56 laps). Non-race
# sessions don't run a stint plan; they use SESSION_WINDOW timing instead.
RACE_LAPS = 56

SESSION_WINDOW: dict[Session, tuple[int, int]] = {
    "FP1": (8, 18),
    "FP2": (8, 18),
    "FP3": (6, 16),
    "Quali": (1, 3),
    "Race": (12, 28),
}

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


def _auto_sequence(session: Session, rain_probability: float, variant: str) -> list[str]:
    if rain_probability >= 60:
        return ["Intermediate", "Medium"] if variant == "conservative" else ["Soft", "Intermediate"]
    if rain_probability >= 35:
        return ["Medium", "Intermediate"] if variant == "conservative" else ["Soft", "Medium"]
    if session == "Quali":
        return ["Soft"]
    if session == "Race":
        return ["Medium", "Hard"] if variant == "conservative" else ["Soft", "Medium"]
    return ["Medium", "Soft"] if variant == "conservative" else ["Soft", "Medium"]


def _second_compound(opening: str, variant: str, rain_probability: float) -> str:
    """A sensible follow-on compound when the user forces the opening tyre."""
    if rain_probability >= 60:
        return "Intermediate" if opening == "Wet" else "Medium"
    if rain_probability >= 35:
        return "Medium" if opening in ("Intermediate", "Wet") else "Intermediate"
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


def _session_plan(
    session: Session,
    tyre_sequence: list[str],
    *,
    variant: str,
    rain_probability: float,
) -> tuple[list[Stint], PitWindow]:
    """Lightweight run plan for non-race sessions (single stint, no stop)."""
    open_lap, close_lap = SESSION_WINDOW[session]
    span = close_lap - open_lap
    if variant == "conservative":
        end = open_lap + max(1, round(span * (0.42 if rain_probability < 50 else 0.32)))
        window = PitWindow(start_lap=open_lap, end_lap=end)
    else:
        start = open_lap + max(2, round(span * (0.48 if rain_probability < 50 else 0.38)))
        window = PitWindow(start_lap=start, end_lap=close_lap)
    stint = Stint(
        compound=tyre_sequence[0],
        start_lap=window.start_lap,
        end_lap=window.end_lap,
        laps=max(1, window.end_lap - window.start_lap),
    )
    return [stint], window


# Corner codes match frontend/data/circuitCorners.ts so the map can highlight
# exactly the corners the reasoning text names.
_CORNER_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("T1", ("turn 1", "into turn 1")),
    ("T5–T7", ("turns 5", "turn 5", "esses")),
    ("T9", ("turn 9",)),
    ("T15", ("turn 15",)),
]


def _referenced_corners(*texts: str) -> list[str]:
    blob = " ".join(texts).lower()
    found = [code for code, keys in _CORNER_KEYWORDS if any(k in blob for k in keys)]
    return found


def _key_risk(session: Session, rain_probability: float, variant: str, safety_car: bool) -> str:
    if safety_car and variant == "aggressive":
        return "If the safety car pits the field together, your offset advantage evaporates on the restart."
    if rain_probability >= 55:
        return (
            "Undercut exposure if a shower hits while you're on slicks."
            if variant == "aggressive"
            else "Boxing too early if the storm slides south of the circuit."
        )
    if session == "Quali":
        return "Traffic on the out-lap — Turn 15 queue can cost a flying lap."
    if session == "Race":
        return (
            "Rear deg on the back straight if the stop is stretched."
            if variant == "aggressive"
            else "Undercut from cars behind if you cover the pit window too conservatively."
        )
    return "Heat soak through the esses — deg before you reach the timing line."


def _conservative_reasoning(session: Session, weather: WeatherSnapshot, safety_car: bool) -> str:
    if weather.rain_probability >= 55:
        return (
            f"{weather.condition} ({weather.rain_probability:.0f}% rain) — box before Turn 9 "
            "closes up; Sepang storms can red-flag a session in minutes."
        )
    if session == "Race":
        sc = " Safety car? Take the cheap stop and hold track position." if safety_car else ""
        return (
            f"{weather.temp_c:.1f}°C — durable one-stop, pit around modelled tyre life. "
            "Protect the rear-left through Turn 9's closing radius, lift-and-coast into Turn 1." + sc
        )
    if session == "Quali":
        return "Bank a clean lap before track evolution peaks — Turn 15 rewards a late apex on worn fronts."
    return (
        "Long-run mediums, one timed soft. Heat soak through Turns 5–7 is the main tyre risk "
        "before the back straight."
    )


def _aggressive_reasoning(session: Session, weather: WeatherSnapshot, safety_car: bool) -> str:
    if weather.rain_probability >= 55:
        return (
            "Stay out on slicks only while the racing line is dry through Turn 1. "
            "The undercut is massive if a cell hits the pit straight."
        )
    if session == "Quali":
        return (
            "Send the flyer on the last attempt — Q3 evolution at Sepang typically peaks "
            "when the sun drops behind the main grandstand."
        )
    if session == "Race":
        sc = " Under a safety car, dive early — the pit loss shrinks and you jump the queue." if safety_car else ""
        return (
            "Soft-medium offset stop, pit early off the softer opening tyre. Attack the DRS zone "
            "down the back straight, but don't burn the rears defending into Turn 15." + sc
        )
    return "Short-run softs for a headline time — accept deg if it buys a tow through Sector 2."


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
        stop_count = len(stints) - 1
    else:
        stints, window = _session_plan(session, tyres, variant=variant, rain_probability=rain)
        stop_count = 0

    tyre_penalty = _tyre_fit_penalty(tyres[0], rain) if tyre_choice is not None else 0.0
    reasoning = (
        _conservative_reasoning(session, weather, safety_car)
        if variant == "conservative"
        else _aggressive_reasoning(session, weather, safety_car)
    )
    key_risk = _key_risk(session, rain, variant, safety_car)

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
        stop_count=stop_count,
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
        race_laps=RACE_LAPS if session == "Race" else SESSION_WINDOW[session][1],
    )
