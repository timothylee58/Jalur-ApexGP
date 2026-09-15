"""Chat route plumbing.

The model call is stubbed throughout — these cover the parts that break
without anyone noticing: SSE framing, the sources-first ordering the UI
depends on, and the two degraded paths (no API key, mid-stream failure).
"""

import json
from collections.abc import AsyncIterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import rag_service

client = TestClient(app)


def _frames(body: str) -> list[dict]:
    """Parse an SSE body into its decoded JSON payloads."""
    out = []
    for frame in body.split("\n\n"):
        for line in frame.split("\n"):
            if line.startswith("data: "):
                out.append(json.loads(line[6:]))
    return out


@pytest.fixture
def stub_stream(monkeypatch):
    """Replace the model-backed generator with a scripted one."""

    def install(events: list[dict], raises: Exception | None = None):
        async def fake(question: str, history=None) -> AsyncIterator[dict]:
            for event in events:
                yield event
            if raises is not None:
                raise raises

        monkeypatch.setattr(rag_service, "stream_answer", fake)

    return install


class TestChatRoute:
    def test_streams_sources_then_deltas_then_done(self, stub_stream):
        stub_stream(
            [
                {"type": "sources", "ids": ["circuit-t15", "strategy-undercut"], "live": 1},
                {"type": "delta", "text": "Turn 15 "},
                {"type": "delta", "text": "is a hairpin."},
                {"type": "done"},
            ]
        )
        response = client.post("/api/chat", json={"question": "what is turn 15"})
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")

        frames = _frames(response.text)
        assert [f["type"] for f in frames] == ["sources", "delta", "delta", "done"]

        # Sources must lead: the UI renders them while the answer streams.
        assert frames[0]["live"] == 1
        titles = [s["title"] for s in frames[0]["sources"]]
        assert any("Turn 15" in t for t in titles)
        # Bare ids are expanded into titled sources by the route.
        assert set(frames[0]["sources"][0]) == {"id", "title", "section"}

        answer = "".join(f["text"] for f in frames if f["type"] == "delta")
        assert answer == "Turn 15 is a hairpin."

    def test_unknown_document_ids_are_dropped_not_echoed(self, stub_stream):
        stub_stream([{"type": "sources", "ids": ["nope-not-real"], "live": 0}, {"type": "done"}])
        frames = _frames(client.post("/api/chat", json={"question": "hi"}).text)
        assert frames[0]["sources"] == []

    def test_missing_api_key_is_a_503_with_a_readable_message(self, monkeypatch):
        monkeypatch.setattr(rag_service.settings, "anthropic_api_key", None)
        response = client.post("/api/chat", json={"question": "what is DRS"})
        assert response.status_code == 503
        # The message is shown to the user as-is, so it has to read like prose.
        assert "ANTHROPIC_API_KEY" in response.json()["detail"]

    def test_midstream_failure_arrives_as_an_error_event(self, stub_stream):
        # The status line is already sent by then, so it cannot be a 5xx.
        stub_stream(
            [{"type": "sources", "ids": [], "live": 0}, {"type": "delta", "text": "partial"}],
            raises=rag_service.ChatUnavailable("rate limited, try again"),
        )
        response = client.post("/api/chat", json={"question": "hello"})
        assert response.status_code == 200
        frames = _frames(response.text)
        assert frames[-1]["type"] == "error"
        assert "rate limited" in frames[-1]["message"]

    def test_unexpected_midstream_exception_does_not_leak_internals(self, stub_stream):
        stub_stream(
            [{"type": "sources", "ids": [], "live": 0}],
            raises=RuntimeError("psycopg connection string blah"),
        )
        frames = _frames(client.post("/api/chat", json={"question": "hello"}).text)
        assert frames[-1]["type"] == "error"
        assert "psycopg" not in frames[-1]["message"]

    @pytest.mark.parametrize(
        "payload",
        [
            {},
            {"question": ""},
            {"question": "x" * 2001},
            {"question": "ok", "history": [{"role": "system", "content": "hi"}]},
        ],
    )
    def test_rejects_malformed_requests(self, payload):
        assert client.post("/api/chat", json=payload).status_code == 422


class TestContextBlock:
    def test_includes_retrieved_documents_and_live_data(self):
        context, ids = rag_service.build_context_block(
            "what is the slowest corner", ["Live weather: 31C."]
        )
        assert "circuit-berjaya-tioman" in ids
        assert "Berjaya Tioman" in context
        assert "Live weather: 31C." in context
        assert "LIVE DATA" in context

    def test_says_so_when_nothing_matched(self):
        context, ids = rag_service.build_context_block("zzzxqv gibberish", [])
        assert ids == []
        assert "nothing in the knowledge base matched" in context.lower()
        assert "LIVE DATA" not in context

    def test_history_is_trimmed_and_filtered(self):
        history = [
            rag_service.ChatMessage(role="user", content=f"q{i}") for i in range(20)
        ]
        messages = rag_service._history_messages(history)
        assert len(messages) == 8
        assert messages[-1]["content"] == "q19"


class TestLiveContextGating:
    """Live feeds are only fetched when the question implicates them —
    otherwise every 'what is DRS?' would pay for two upstream calls."""

    @pytest.mark.parametrize(
        "question", ["who is leading the championship", "what are the standings"]
    )
    def test_standings_questions_trigger_standings(self, question):
        assert rag_service._LIVE_STANDINGS_RE.search(question)

    @pytest.mark.parametrize("question", ["will it rain", "what's the forecast"])
    def test_weather_questions_trigger_weather(self, question):
        assert rag_service._LIVE_WEATHER_RE.search(question)

    @pytest.mark.parametrize("question", ["what is DRS", "explain parc ferme"])
    def test_static_questions_trigger_neither(self, question):
        assert not rag_service._LIVE_STANDINGS_RE.search(question)
        assert not rag_service._LIVE_WEATHER_RE.search(question)

    @pytest.mark.asyncio
    async def test_gather_returns_empty_for_a_static_question(self):
        assert await rag_service._gather_live_context("what is an undercut") == []
