from pydantic import BaseModel, ConfigDict, Field

from app.schemas.prediction import Session, StrategyVariant


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
