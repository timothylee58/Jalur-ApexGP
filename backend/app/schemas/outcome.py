from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.prediction import PitWindow, Session, StrategyVariant


class OutcomeRequest(BaseModel):
    """What a race engineer reports after a session actually runs.

    Deliberately minimal — the two facts that both strategy variants make a
    real call on (did it rain, when did the leader/reference car actually
    pit) are enough to score both the rain call and the pit-window call
    without asking for a full timing-sheet import.
    """

    model_config = ConfigDict(populate_by_name=True)

    session: Session
    rain_occurred: bool = Field(alias="rainOccurred")
    actual_pit_lap: int | None = Field(default=None, alias="actualPitLap")
    notes: str = ""


class OutcomeLogged(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    logged: bool
    session: Session
    date: str


class VariantScore(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    variant: StrategyVariant
    predicted_confidence: float = Field(serialization_alias="predictedConfidence")
    rain_call_score: float = Field(serialization_alias="rainCallScore")
    pit_window_hit: bool | None = Field(serialization_alias="pitWindowHit")
    composite_score: float = Field(serialization_alias="compositeScore")
    date: str


class AccuracySummary(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    variant: StrategyVariant
    sample_size: int = Field(serialization_alias="sampleSize")
    mean_rain_call_score: float = Field(serialization_alias="meanRainCallScore")
    pit_window_hit_rate: float | None = Field(serialization_alias="pitWindowHitRate")
    mean_composite_score: float = Field(serialization_alias="meanCompositeScore")


class AccuracyResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    session: Session
    sample_size: int = Field(serialization_alias="sampleSize")
    conservative: AccuracySummary
    aggressive: AccuracySummary
    recent: list[VariantScore]


class PredictionSnapshot(BaseModel):
    """The read locked in for a session: the last unmodified prediction
    stored before it started."""

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    made_at: str = Field(serialization_alias="madeAt")
    source: str
    rain_probability: float = Field(serialization_alias="rainProbability")
    condition: str
    confidence_conservative: float = Field(serialization_alias="confidenceConservative")
    confidence_aggressive: float = Field(serialization_alias="confidenceAggressive")
    pit_window_conservative: PitWindow = Field(serialization_alias="pitWindowConservative")
    pit_window_aggressive: PitWindow = Field(serialization_alias="pitWindowAggressive")


class SessionOutcome(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    rain_occurred: bool = Field(serialization_alias="rainOccurred")
    actual_pit_lap: int | None = Field(default=None, serialization_alias="actualPitLap")
    rain_source: str = Field(serialization_alias="rainSource")
    pit_source: str | None = Field(default=None, serialization_alias="pitSource")
    recorded_at: str = Field(serialization_alias="recordedAt")
    detail: dict[str, Any] = Field(default_factory=dict)


SessionState = Literal["upcoming", "live", "awaiting", "scored", "unscored"]


class SessionBoard(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    session: Session
    start: str
    end: str
    state: SessionState
    prediction: PredictionSnapshot | None = None
    outcome: SessionOutcome | None = None
    scores: list[VariantScore] = Field(default_factory=list)


class WeekendBoard(BaseModel):
    """The race weekend's accuracy loop as it stands right now."""

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    season: str
    round: str
    race_name: str = Field(serialization_alias="raceName")
    generated_at: str = Field(serialization_alias="generatedAt")
    sessions: list[SessionBoard]
    # How soon the page should look again: short while a session is live or
    # its outcome is still being resolved, long otherwise.
    next_check_seconds: int = Field(serialization_alias="nextCheckSeconds")
