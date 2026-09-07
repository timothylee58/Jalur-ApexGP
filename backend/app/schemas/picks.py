from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DnfBand = Literal["0", "1-2", "3+"]


class PickAnswers(BaseModel):
    """One fan's 8 answers. Every field is this app's own driver/team slug
    id (data/drivers.ts / data/teams.ts ids on the frontend) — never an
    Ergast id, which picks_scoring.py has no reliable way to guess for
    2026 rookies with no race history yet. See picks_scoring.py's module
    docstring for how these get matched to a real classification.
    """

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    winner: str
    p2: str
    p3: str
    pole: str
    fastest_lap: str = Field(alias="fastestLap")
    top_constructor: str = Field(alias="topConstructor")
    dnf_band: DnfBand = Field(alias="dnfBand")
    beats_teammate_of: str = Field(alias="beatsTeammateOf")
    beats_teammate_pick: str = Field(alias="beatsTeammatePick")


class PickSubmission(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    display_name: str = Field(alias="displayName", min_length=1, max_length=40)
    picks: PickAnswers


class PickSubmitted(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    display_name: str = Field(serialization_alias="displayName")
    submitted_at: str = Field(serialization_alias="submittedAt")


class LeaderboardRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    rank: int
    display_name: str = Field(serialization_alias="displayName")
    score: int
    is_you: bool = Field(default=False, serialization_alias="isYou")


class LeaderboardResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    is_scored: bool = Field(serialization_alias="isScored")
    entries: list[LeaderboardRow]
    total_entries: int = Field(serialization_alias="totalEntries")


class MyPickResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    display_name: str = Field(serialization_alias="displayName")
    picks: PickAnswers
    submitted_at: str = Field(serialization_alias="submittedAt")
    score: int | None = None
    rank: int | None = None
