from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TelemetrySource = Literal["openf1", "tracinginsights"]


class TelemetryDriver(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    driver_number: int = Field(serialization_alias="driverNumber")
    full_name: str = Field(serialization_alias="fullName")
    name_acronym: str = Field(serialization_alias="nameAcronym")
    team_name: str = Field(serialization_alias="teamName")
    # Hex without '#', e.g. "F47600" — both sources publish the team's own
    # colour, which the charts use to tell drivers apart.
    team_colour: str | None = Field(default=None, serialization_alias="teamColour")


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
    # 0–100 from both sources (TracingInsights' 0/1 flag is scaled up).
    brake: float
    rpm: float
    gear: int
    # OpenF1's raw DRS status codes (0/1 off, 8 detected-eligible, 10/12/14
    # various active states) — passed through rather than collapsed to a
    # boolean so the frontend can decide how much nuance to show. None when
    # the car has no DRS at all: every 2026 sample, since the 2026 rules
    # replaced it with Overtake Mode.
    drs: int | None = None
    # Metres from the start line. TracingInsights publishes it; for OpenF1
    # it is integrated from speed. Lets laps be compared by *where* on track
    # something happened rather than when.
    distance: float | None = None
    # Track position in the timing feed's own coordinate frame (for the
    # track map). None when position data couldn't be fetched.
    x: float | None = None
    y: float | None = None


class TelemetryCorner(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    number: int
    # Metres from the start line along the reference lap.
    distance: float
    # The corner's position in the timing feed's frame. Internal only: used
    # to line corners up with a lap's own distances, never sent to clients.
    x: float | None = Field(default=None, exclude=True)
    y: float | None = Field(default=None, exclude=True)


class TelemetryLapTrace(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    year: int
    session_name: str = Field(serialization_alias="sessionName")
    circuit_short_name: str = Field(serialization_alias="circuitShortName")
    driver: TelemetryDriver
    lap_number: int = Field(serialization_alias="lapNumber")
    lap_duration: float = Field(serialization_alias="lapDuration")
    samples: list[TelemetrySample]
    source: TelemetrySource = "openf1"
    # Why the secondary source served this lap, when it did — shown to the
    # reader rather than silently swapping data sources.
    fallback_reason: str | None = Field(default=None, serialization_alias="fallbackReason")
    corners: list[TelemetryCorner] = Field(default_factory=list)


class SessionLap(BaseModel):
    """One driver's lap in the whole-session view — only the fields the
    overview charts draw (lap-time heatmap, tyre strategy, positions)."""

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    driver: str
    lap: int
    time: float | None = None
    compound: str | None = None
    stint: int | None = None
    position: int | None = None
    pit_in: bool = Field(default=False, serialization_alias="pitIn")
    pit_out: bool = Field(default=False, serialization_alias="pitOut")
    # Track status codes seen during the lap: "4" safety car, "5" red flag,
    # "6"/"7" virtual safety car, "2" yellow.
    status: str | None = None


class SessionOverviewDriver(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    code: str
    driver_number: int = Field(serialization_alias="driverNumber")
    full_name: str = Field(serialization_alias="fullName")
    team_name: str = Field(serialization_alias="teamName")
    team_colour: str | None = Field(default=None, serialization_alias="teamColour")


class SessionOverview(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    year: int
    session_name: str = Field(serialization_alias="sessionName")
    circuit_short_name: str = Field(serialization_alias="circuitShortName")
    event_name: str = Field(serialization_alias="eventName")
    source: TelemetrySource
    drivers: list[SessionOverviewDriver]
    laps: list[SessionLap]
