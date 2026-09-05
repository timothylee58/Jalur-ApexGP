from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Session = Literal["FP1", "FP2", "FP3", "Quali", "Race"]
StrategyVariant = Literal["conservative", "aggressive"]
Compound = Literal["Soft", "Medium", "Hard", "Intermediate", "Wet"]


class PredictionRequest(BaseModel):
    """A session read, optionally with what-if overrides.

    When an override is ``None`` the live/climatology weather blend supplies the
    value; when it is set the simulator recomputes against the supplied value so
    the client can explore scenarios (drop the rain, heat the track, throw a
    safety car, force a starting compound) without waiting on real weather.
    """

    session: Session
    rain_probability: float | None = Field(default=None, ge=0, le=100)
    temp_c: float | None = Field(default=None, ge=0, le=60)
    safety_car: bool = False
    tyre_choice: Compound | None = None


class HourlyRainPoint(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    hour_label: str = Field(serialization_alias="hourLabel")
    rain_probability: float = Field(serialization_alias="rainProbability")


class WeatherSnapshot(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    temp_c: float = Field(serialization_alias="tempC")
    rain_probability: float = Field(serialization_alias="rainProbability")
    condition: str
    hourly_rain: list[HourlyRainPoint] = Field(default_factory=list, serialization_alias="hourlyRain")
    monsoon_note: str = Field(default="", serialization_alias="monsoonNote")


class PitWindow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    start_lap: int = Field(serialization_alias="startLap")
    end_lap: int = Field(serialization_alias="endLap")


class Stint(BaseModel):
    """One planned stint on a single compound within the modelled distance."""

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    compound: str
    start_lap: int = Field(serialization_alias="startLap")
    end_lap: int = Field(serialization_alias="endLap")
    laps: int


class StrategyPrediction(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    variant: StrategyVariant
    tyre_sequence: list[str] = Field(serialization_alias="tyreSequence")
    confidence: float
    pit_window: PitWindow = Field(serialization_alias="pitWindow")
    stints: list[Stint] = Field(default_factory=list)
    stop_count: int = Field(default=0, serialization_alias="stopCount")
    reasoning: str
    key_risk: str = Field(serialization_alias="keyRisk")
    referenced_corners: list[str] = Field(
        default_factory=list, serialization_alias="referencedCorners"
    )


class ConfidenceTrend(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    variant: StrategyVariant
    from_confidence: float = Field(serialization_alias="fromConfidence")
    to_confidence: float = Field(serialization_alias="toConfidence")
    label: str


class SimInputs(BaseModel):
    """Echoes the effective inputs the simulation actually ran on.

    Overrides collapse into concrete values here so the client can render what
    the read is based on and show which knobs are user-driven vs. weather-driven.
    """

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    rain_probability: float = Field(serialization_alias="rainProbability")
    temp_c: float = Field(serialization_alias="tempC")
    safety_car: bool = Field(serialization_alias="safetyCar")
    tyre_choice: str | None = Field(default=None, serialization_alias="tyreChoice")
    rain_overridden: bool = Field(default=False, serialization_alias="rainOverridden")
    temp_overridden: bool = Field(default=False, serialization_alias="tempOverridden")


class PredictionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    session: Session
    conservative: StrategyPrediction
    aggressive: StrategyPrediction
    weather: WeatherSnapshot
    race_laps: int = Field(default=0, serialization_alias="raceLaps")
    inputs: SimInputs | None = None
    # Honest framing: this is a deterministic climatology/live blend + a rules
    # based stint model, not a trained predictor. Surfaced so the UI can label
    # it a "simulator" rather than an "AI prediction".
    model_kind: str = Field(default="deterministic-simulator", serialization_alias="modelKind")
    confidence_trend: ConfidenceTrend | None = Field(default=None, serialization_alias="confidenceTrend")
