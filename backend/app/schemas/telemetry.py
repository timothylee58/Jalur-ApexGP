from pydantic import BaseModel, ConfigDict, Field


class TelemetryDriver(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    driver_number: int = Field(serialization_alias="driverNumber")
    full_name: str = Field(serialization_alias="fullName")
    name_acronym: str = Field(serialization_alias="nameAcronym")
    team_name: str = Field(serialization_alias="teamName")


class TelemetryLap(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    lap_number: int = Field(serialization_alias="lapNumber")
    lap_duration: float = Field(serialization_alias="lapDuration")


class TelemetrySample(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    # Seconds since this lap's date_start — not a wall-clock timestamp, so
    # the frontend can scrub/replay without caring what date the real
    # session happened on.
    t: float
    speed: float
    throttle: float
    brake: float
    rpm: float
    gear: int
    # OpenF1's raw DRS status codes (0/1 off, 8 detected-eligible, 10/12/14
    # various active states) — passed through rather than collapsed to a
    # boolean so the frontend can decide how much nuance to show.
    drs: int


class TelemetryLapTrace(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    year: int
    session_name: str = Field(serialization_alias="sessionName")
    circuit_short_name: str = Field(serialization_alias="circuitShortName")
    driver: TelemetryDriver
    lap_number: int = Field(serialization_alias="lapNumber")
    lap_duration: float = Field(serialization_alias="lapDuration")
    samples: list[TelemetrySample]
