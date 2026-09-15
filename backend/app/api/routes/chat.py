import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatRequest, ChatSource
from app.services import knowledge_base, rag_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    """Server-sent events, one JSON object per `data:` line.

    Streaming rather than a single JSON response because a grounded
    answer takes several seconds to generate and a sidebar that sits
    blank for that long reads as broken. The first event carries the
    sources, so the UI can show what it is grounding on while the text
    is still arriving.

    A configuration problem (no API key) is worth a real status code, so
    it is raised before the stream opens. Once the stream is open the
    status is already sent, so a mid-stream failure has to arrive as an
    `error` event instead — the client handles both.
    """
    history = [
        rag_service.ChatMessage(role=turn.role, content=turn.content)
        for turn in request.history
    ]

    try:
        stream = rag_service.stream_answer(request.question, history)
        first = await anext(stream)
    except rag_service.ChatUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    async def events() -> AsyncIterator[str]:
        def sse(payload: dict) -> str:
            return f"data: {json.dumps(payload)}\n\n"

        try:
            yield sse(_expand(first))
            async for event in stream:
                yield sse(_expand(event))
        except rag_service.ChatUnavailable as exc:
            yield sse({"type": "error", "message": str(exc)})
        except Exception as exc:  # noqa: BLE001 - the connection is already open
            logger.exception("chat stream failed mid-flight")
            yield sse(
                {
                    "type": "error",
                    "message": "The assistant stopped unexpectedly. Try asking again.",
                }
            )
            del exc

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            # Proxies that buffer would defeat the point of streaming.
            "X-Accel-Buffering": "no",
        },
    )


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
