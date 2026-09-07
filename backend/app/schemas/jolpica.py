from pydantic import BaseModel, ConfigDict, Field


class ScheduleSession(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    session: str
    start: str
    end: str


class WeekendSchedule(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    season: str
    round: str
    race_name: str = Field(serialization_alias="raceName")
    circuit_id: str = Field(serialization_alias="circuitId")
    circuit_name: str = Field(serialization_alias="circuitName")
    source: str
    sessions: list[ScheduleSession]


class DriverStandingRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    position: int
    points: float
    wins: int
    driver_id: str = Field(serialization_alias="driverId")
    given_name: str = Field(serialization_alias="givenName")
    family_name: str = Field(serialization_alias="familyName")
    constructor_name: str = Field(serialization_alias="constructorName")


class ConstructorStandingRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    position: int
    points: float
    wins: int
    constructor_id: str = Field(serialization_alias="constructorId")
    name: str


class StandingsPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    season: str
    round: str
    source: str
    drivers: list[DriverStandingRow]
    constructors: list[ConstructorStandingRow]


class ClassifiedDriver(BaseModel):
    """One driver's row in a final race classification.

    Deliberately carries names, not Ergast's driverId/constructorId slugs —
    this app's own driver/team ids (data/drivers.ts, data/teams.ts) don't
    reliably match those slugs (e.g. Max Verstappen is "max_verstappen" in
    Ergast, disambiguated from his father Jos), and several 2026 rookies
    have no established Ergast slug to guess at yet. Matching by
    (diacritic-stripped, case-insensitive) family/constructor name in
    picks_scoring.py sidesteps guessing at slugs entirely.
    """

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    position: int | None
    driver_family_name: str = Field(serialization_alias="driverFamilyName")
    constructor_name: str = Field(serialization_alias="constructorName")
    status: str
    points: float
    fastest_lap_rank: int | None = Field(default=None, serialization_alias="fastestLapRank")


class RaceClassification(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    season: str
    round: str
    source: str
    # False when the round hasn't been run/classified yet — callers must
    # not score against a classification with is_final=False.
    is_final: bool = Field(serialization_alias="isFinal")
    pole_family_name: str | None = Field(default=None, serialization_alias="poleFamilyName")
    results: list[ClassifiedDriver]
