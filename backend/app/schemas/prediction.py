from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Session = Literal["FP1", "FP2", "FP3", "Quali", "Race"]
StrategyVariant = Literal["conservative", "aggressive"]


class PredictionRequest(BaseModel):
    session: Session


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


class StrategyPrediction(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    variant: StrategyVariant
    tyre_sequence: list[str] = Field(serialization_alias="tyreSequence")
    confidence: float
    pit_window: PitWindow = Field(serialization_alias="pitWindow")
    reasoning: str
    key_risk: str = Field(serialization_alias="keyRisk")


class ConfidenceTrend(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    variant: StrategyVariant
    from_confidence: float = Field(serialization_alias="fromConfidence")
    to_confidence: float = Field(serialization_alias="toConfidence")
    label: str


class PredictionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    session: Session
    conservative: StrategyPrediction
    aggressive: StrategyPrediction
    weather: WeatherSnapshot
    confidence_trend: ConfidenceTrend | None = Field(default=None, serialization_alias="confidenceTrend")
