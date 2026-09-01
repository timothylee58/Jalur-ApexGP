from app.schemas.prediction import (
    PitWindow,
    PredictionResponse,
    Session,
    StrategyPrediction,
    WeatherSnapshot,
)

SESSION_WINDOW: dict[Session, tuple[int, int]] = {
    "FP1": (8, 18),
    "FP2": (8, 18),
    "FP3": (6, 16),
    "Quali": (1, 3),
    "Race": (12, 28),
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _confidence(rain_probability: float, is_conservative: bool) -> float:
    rain = _clamp(rain_probability / 100.0, 0.0, 1.0)
    if is_conservative:
        return round(_clamp(58 + rain * 32, 55, 92), 0)
    return round(_clamp(74 - rain * 28, 42, 86), 0)


def _tyre_sequence(session: Session, rain_probability: float, variant: str) -> list[str]:
    if rain_probability >= 60:
        return ["Intermediate", "Medium"] if variant == "conservative" else ["Soft", "Intermediate"]
    if rain_probability >= 35:
        return ["Medium", "Intermediate"] if variant == "conservative" else ["Soft", "Medium"]
    if session == "Quali":
        return ["Soft"]
    if session == "Race":
        return ["Medium", "Hard"] if variant == "conservative" else ["Soft", "Medium"]
    return ["Medium", "Soft"] if variant == "conservative" else ["Soft", "Medium"]


def _key_risk(session: Session, rain_probability: float, variant: str) -> str:
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


def build_prediction(session: Session, weather: WeatherSnapshot) -> PredictionResponse:
    rain = weather.rain_probability
    open_lap, close_lap = SESSION_WINDOW[session]
    span = close_lap - open_lap
    conservative_end = open_lap + max(1, round(span * (0.42 if rain < 50 else 0.32)))
    aggressive_start = open_lap + max(2, round(span * (0.48 if rain < 50 else 0.38)))

    conservative = StrategyPrediction(
        variant="conservative",
        tyre_sequence=_tyre_sequence(session, rain, "conservative"),
        confidence=_confidence(rain, True),
        pit_window=PitWindow(start_lap=open_lap, end_lap=conservative_end),
        reasoning=_conservative_reasoning(session, weather),
        key_risk=_key_risk(session, rain, "conservative"),
    )
    aggressive = StrategyPrediction(
        variant="aggressive",
        tyre_sequence=_tyre_sequence(session, rain, "aggressive"),
        confidence=_confidence(rain, False),
        pit_window=PitWindow(start_lap=aggressive_start, end_lap=close_lap),
        reasoning=_aggressive_reasoning(session, weather),
        key_risk=_key_risk(session, rain, "aggressive"),
    )

    return PredictionResponse(
        session=session,
        weather=weather,
        conservative=conservative,
        aggressive=aggressive,
    )


def _conservative_reasoning(session: Session, weather: WeatherSnapshot) -> str:
    if weather.rain_probability >= 55:
        return (
            f"{weather.condition} ({weather.rain_probability:.0f}% rain) — box before Turn 9 "
            "closes up; Sepang storms can red-flag a session in minutes."
        )
    if session == "Race":
        return (
            f"{weather.temp_c:.1f}°C — medium-hard one-stop. Protect the rear-left through "
            "Turn 9's closing radius, lift-and-coast into Turn 1."
        )
    if session == "Quali":
        return "Bank a clean lap before track evolution peaks — Turn 15 rewards a late apex on worn fronts."
    return (
        "Long-run mediums, one timed soft. Heat soak through Turns 5–7 is the main tyre risk "
        "before the back straight."
    )


def _aggressive_reasoning(session: Session, weather: WeatherSnapshot) -> str:
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
        return (
            "Soft-medium offset stop. Attack the DRS zone down the back straight, "
            "but don't burn the rears defending into Turn 15."
        )
    return "Short-run softs for a headline time — accept deg if it buys a tow through Sector 2."
