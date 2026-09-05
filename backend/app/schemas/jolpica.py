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
