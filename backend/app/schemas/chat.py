from pydantic import BaseModel, ConfigDict, Field


class ChatTurn(BaseModel):
    """One prior turn, replayed for conversational continuity. Grounding
    is rebuilt per question from the knowledge base, so history is not
    what the answer is based on."""

    role: str = Field(pattern="^(user|assistant)$")
    # Generous enough for any answer the assistant itself gives; the
    # service trims what it actually replays (see rag_service).
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # The UI caps input at 500 characters; the slack covers pasted text
    # with a few stray characters, not essays.
    question: str = Field(min_length=1, max_length=600)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class ChatSource(BaseModel):
    """A knowledge-base document the answer was grounded in, surfaced so
    the UI can show its working rather than presenting the answer as
    coming from nowhere."""

    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)

    id: str
    title: str
    section: str
