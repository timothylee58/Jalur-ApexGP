"""Race-engineer assistant: retrieval over the app's own corpus, plus a
live read of the real feeds, answered by Claude.

SHAPE OF A TURN
  1. BM25 over `knowledge_base.DOCUMENTS` for the user's question.
  2. A live-context block, fetched concurrently and only when the
     question looks like it wants it — standings and the weather read
     are the two that go stale, and fetching both on every "what is
     DRS?" would add latency for nothing.
  3. One Claude call with the retrieved documents and live block as
     context, streamed back token by token.

WHAT IT IS ALLOWED TO CLAIM. There is no official F1 API (see
`knowledge_base`'s docstring). The system prompt below is explicit that
the assistant answers from this app's own material plus named
third-party feeds, and that it should say when something is the app's
simulation rather than a real measurement — the same standard the
strategy engine and telemetry pages already hold themselves to. The
retrieved documents are the grounding; the instruction not to invent
beyond them is the part that makes this RAG rather than a themed
chatbot.

DEGRADED MODES ARE NORMAL, NOT ERRORS. No API key configured is a
clean, explicit refusal rather than a 500. A live feed that fails is
dropped from the context with a note, because a weather outage should
not take the assistant down.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass

import anthropic

from app.config import settings
from app.services import knowledge_base

logger = logging.getLogger(__name__)

# Per the model guidance: default to Opus unless the operator chooses
# otherwise, which they can via CHAT_MODEL.
_DEFAULT_MODEL = "claude-opus-5"
_MAX_TOKENS = 4096
# The corpus is short and questions are conversational, so six documents
# is usually the whole relevant neighbourhood; more mostly adds tokens.
_RETRIEVAL_LIMIT = 6
_MAX_HISTORY_TURNS = 8

SYSTEM_PROMPT = """You are the race engineer assistant built into Jalur APEXGP, an \
independent Formula 1 fan project about a fictional 2026 race weekend at Sepang \
International Circuit.

Answer from the CONTEXT provided in the user's message. That context is this app's own \
knowledge base plus, when relevant, a live read from the real data feeds it uses.

Rules you must follow:

- Ground every factual claim in the provided context. If the context does not cover \
the question, say so plainly and say what you'd need — do not fill the gap from \
memory, and do not guess at numbers, dates, results or names.
- Distinguish what is real from what is this app's own construction. The 2026 Sepang \
weekend is fictional; Formula 1 has not announced a return to Malaysia. The hot lap on \
the circuit page is a solved simulation, not telemetry. The strategy engine is a \
documented heuristic, not a trained model. Say which you're describing when it matters.
- Never claim or imply that this app is official, licensed, endorsed by or affiliated \
with Formula 1, the FIA, FOM, any team, or Sepang International Circuit. There is no \
official public F1 API; the app's data comes from named community and government \
sources. If asked where a number came from, name the source.
- Be concise and concrete, in the voice of an engineer relaying a read: short, \
declarative, specific. Lead with the answer, then the reasoning. Plain prose, not \
bullet-point soup, unless a list genuinely is the answer.
- State uncertainty as uncertainty. If a figure in the context is marked estimated \
rather than sourced, say so rather than presenting it flat.
- Stay on Formula 1, this circuit, this app and getting to the race. For anything else, \
say it's outside what you cover."""

# Terms that make a live read worth the latency. Deliberately narrow:
# everything else in the corpus is static prose that does not go stale.
_LIVE_STANDINGS_RE = re.compile(
    r"\b(standing|standings|championship|points|leader|leading|who'?s winning|"
    r"current|so far this season|table)\b",
    re.IGNORECASE,
)
_LIVE_WEATHER_RE = re.compile(
    r"\b(weather|rain|raining|forecast|temperature|temp|hot|humid|wet|storm|"
    r"conditions)\b",
    re.IGNORECASE,
)


class ChatUnavailable(Exception):
    """The assistant cannot run at all — no API key configured, or the
    upstream model call failed outright. Routes turn this into a 503 with
    the message, which is written to be shown to a user as-is."""


@dataclass
class ChatMessage:
    role: str
    content: str


def _client() -> anthropic.AsyncAnthropic:
    if not settings.anthropic_api_key:
        raise ChatUnavailable(
            "The race engineer assistant isn't configured on this deployment — "
            "it needs an Anthropic API key set as ANTHROPIC_API_KEY."
        )
    return anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)


async def _live_standings() -> str | None:
    from app.services import jolpica_service

    try:
        payload = await jolpica_service.get_standings()
    except Exception as exc:  # noqa: BLE001 - any upstream failure degrades the same way
        logger.warning("chat live standings unavailable: %s", exc)
        return None
    if not payload.drivers:
        return None
    rows = ", ".join(
        f"{row.position}. {row.given_name} {row.family_name} "
        f"({row.points:g} pts, {row.constructor_name})"
        for row in payload.drivers[:5]
    )
    return (
        f"Live {payload.season} drivers' championship standings after round "
        f"{payload.round} (via Jolpica), top 5: {rows}."
    )


async def _live_weather() -> str | None:
    from app.services.weather_service import WeatherService

    try:
        snapshot = await WeatherService().get_snapshot()
    except Exception as exc:  # noqa: BLE001
        logger.warning("chat live weather unavailable: %s", exc)
        return None
    # get_snapshot never raises for an upstream outage — it falls back to
    # Sepang climatology — so say "read" rather than claiming it is live.
    note = f" {snapshot.monsoon_note}" if snapshot.monsoon_note else ""
    return (
        f"Current weather read for the circuit (Open-Meteo blended with Sepang "
        f"climatology): {snapshot.temp_c:.0f}C, {snapshot.rain_probability:.0f}% rain "
        f"probability, {snapshot.condition}.{note}"
    )


async def _gather_live_context(question: str) -> list[str]:
    """Only the feeds the question actually implicates, fetched together.
    A failing feed contributes nothing rather than failing the turn."""
    wanted = []
    if _LIVE_STANDINGS_RE.search(question):
        wanted.append(_live_standings())
    if _LIVE_WEATHER_RE.search(question):
        wanted.append(_live_weather())
    if not wanted:
        return []

    results = await asyncio.gather(*wanted, return_exceptions=True)
    out: list[str] = []
    for result in results:
        if isinstance(result, str):
            out.append(result)
        elif isinstance(result, BaseException):
            logger.warning("chat live context task failed: %s", result)
    return out


def build_context_block(question: str, live: list[str]) -> tuple[str, list[str]]:
    """The CONTEXT the model sees, and the ids of the documents behind it
    so the UI can show what the answer was grounded in."""
    hits = knowledge_base.search(question, limit=_RETRIEVAL_LIMIT)

    parts: list[str] = []
    if hits:
        parts.append("KNOWLEDGE BASE — the app's own material:")
        for hit in hits:
            doc = hit.document
            parts.append(f"\n[{doc.id}] {doc.title}\n{doc.body}")
    else:
        parts.append(
            "KNOWLEDGE BASE: nothing in the knowledge base matched this question."
        )

    if live:
        parts.append("\n\nLIVE DATA — fetched just now from real feeds:")
        for item in live:
            parts.append(f"\n- {item}")

    return "\n".join(parts), [hit.document.id for hit in hits]


def _history_messages(history: list[ChatMessage]) -> list[dict[str, str]]:
    # Trailing turns only: the retrieved context is rebuilt per question,
    # so old turns are for conversational continuity, not grounding.
    trimmed = [m for m in history if m.role in ("user", "assistant")][-_MAX_HISTORY_TURNS:]
    return [{"role": m.role, "content": m.content} for m in trimmed]


async def stream_answer(
    question: str, history: list[ChatMessage] | None = None
) -> AsyncIterator[dict]:
    """Yields `{"type": "sources", ...}` first, then a run of
    `{"type": "delta", "text": ...}`, then `{"type": "done"}`. Sending the
    sources up front lets the UI show what it's grounding on while the
    answer is still streaming."""
    client = _client()
    live = await _gather_live_context(question)
    context, source_ids = build_context_block(question, live)

    yield {"type": "sources", "ids": source_ids, "live": len(live)}

    messages = _history_messages(history or [])
    messages.append(
        {
            "role": "user",
            "content": f"CONTEXT\n{context}\n\nQUESTION\n{question}",
        }
    )

    try:
        async with client.messages.stream(
            model=settings.chat_model or _DEFAULT_MODEL,
            max_tokens=_MAX_TOKENS,
            # The instructions are identical on every turn, so caching the
            # prefix is free money across a conversation.
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            thinking={"type": "adaptive"},
            messages=messages,
        ) as stream:
            async for text in stream.text_stream:
                yield {"type": "delta", "text": text}
    except anthropic.RateLimitError as exc:
        logger.warning("chat rate limited: %s", exc)
        raise ChatUnavailable(
            "The assistant is rate limited right now — try again in a moment."
        ) from exc
    except anthropic.APIStatusError as exc:
        logger.error("chat upstream error %s: %s", exc.status_code, exc)
        raise ChatUnavailable(
            "The assistant couldn't reach the model just now."
        ) from exc
    except anthropic.APIConnectionError as exc:
        logger.error("chat connection error: %s", exc)
        raise ChatUnavailable(
            "The assistant couldn't reach the model just now."
        ) from exc

    yield {"type": "done"}
