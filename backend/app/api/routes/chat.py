import json
import logging
import re
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatSource
from app.services import chat_guard, knowledge_base, rag_service

router = APIRouter()
logger = logging.getLogger(__name__)

_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    # Proxies that buffer would defeat the point of streaming.
    "X-Accel-Buffering": "no",
}


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def _stream(events: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(events, media_type="text/event-stream", headers=_SSE_HEADERS)


def _scripted(source_ids: list[str], text: str) -> StreamingResponse:
    """A canned or cached answer, sent through the same SSE shape as a live
    one so the client has a single code path."""

    async def events() -> AsyncIterator[str]:
        yield _sse(_expand({"type": "sources", "ids": source_ids, "live": 0}))
        for start in range(0, len(text), 48):
            yield _sse({"type": "delta", "text": text[start : start + 48]})
        yield _sse({"type": "done"})

    return _stream(events())


@router.post("/chat")
async def chat(payload: ChatRequest, request: Request) -> StreamingResponse:
    """Server-sent events, one JSON object per `data:` line.

    Streaming rather than a single JSON response because a grounded
    answer takes several seconds to generate and a sidebar that sits
    blank for that long reads as broken. The first event carries the
    sources, so the UI can show what it is grounding on while the text
    is still arriving.

    The guardrails in chat_guard run first, cheapest first — origin, rate
    limit, topic screen, answer cache — so most abuse is turned away
    before it can spend a token.

    A configuration problem (no API key) is worth a real status code, so
    it is raised before the stream opens. Once the stream is open the
    status is already sent, so a mid-stream failure has to arrive as an
    `error` event instead — the client handles both.
    """
    if not chat_guard.origin_allowed(request.headers.get("origin")):
        raise HTTPException(status_code=403, detail="This assistant only answers requests from the Jalur APEXGP site.")

    client = chat_guard.client_key(dict(request.headers), request.client.host if request.client else None)
    decision = chat_guard.limiter.check(client)
    if not decision.allowed:
        raise HTTPException(
            status_code=429,
            detail=decision.message,
            headers={"Retry-After": str(decision.retry_after_s)},
        )

    question = _CONTROL_RE.sub("", payload.question).strip()
    if not question:
        raise HTTPException(status_code=422, detail="Ask a question first.")

    verdict = chat_guard.screen(question, bool(payload.history))
    if not verdict.allowed:
        logger.info("chat screened out: %s", verdict.reason)
        return _scripted([], verdict.reply)

    if not payload.history:
        cached = chat_guard.answers.get(question)
        if cached is not None:
            return _scripted(cached.source_ids, cached.text)

    history = [
        rag_service.ChatMessage(role=turn.role, content=turn.content)
        for turn in payload.history
    ]

    try:
        stream = rag_service.stream_answer(question, history)
        first = await anext(stream)
    except rag_service.ChatUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    async def events() -> AsyncIterator[str]:
        source_ids = list(first.get("ids", [])) if first.get("type") == "sources" else []
        cacheable = not payload.history and first.get("type") == "sources" and not first.get("live")
        text: list[str] = []
        finished = False
        try:
            yield _sse(_expand(first))
            async for event in stream:
                if event.get("type") == "delta":
                    text.append(event.get("text", ""))
                elif event.get("type") == "done":
                    finished = True
                yield _sse(_expand(event))
        except rag_service.ChatUnavailable as exc:
            yield _sse({"type": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001 - the connection is already open
            logger.exception("chat stream failed mid-flight")
            yield _sse(
                {
                    "type": "error",
                    "message": "The assistant stopped unexpectedly. Try asking again.",
                }
            )
            del exc
        else:
            # Only a complete answer to a standalone question with no live
            # data in it is safe to replay to the next person who asks.
            if finished and cacheable:
                chat_guard.answers.put(question, source_ids, "".join(text))

    return _stream(events())


def _expand(event: dict) -> dict:
    """Turns the service's bare document ids into titled sources — the
    service stays UI-agnostic, and the route owns what the client sees."""
    if event.get("type") != "sources":
        return event
    sources = []
    for doc_id in event.get("ids", []):
        doc = knowledge_base.document_by_id(doc_id)
        if doc:
            sources.append(
                ChatSource(id=doc.id, title=doc.title, section=doc.section).model_dump()
            )
    return {"type": "sources", "sources": sources, "live": event.get("live", 0)}
