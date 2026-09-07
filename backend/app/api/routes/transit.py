import logging

from fastapi import APIRouter, HTTPException

from app.schemas.transit import SepangAccessPayload
from app.services import transit_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/transit/sepang-access", response_model=SepangAccessPayload)
async def sepang_access() -> SepangAccessPayload:
    # No route/vehicle matching a real world isn't an error — it's an
    # honest empty result the payload itself explains (coverage_note).
    # Only a real transport/format failure reaches here as an exception.
    try:
        return await transit_service.get_sepang_access()
    except transit_service.TransitUpstreamError as exc:
        # The full str(exc) — upstream status code + a response-body
        # snippet, from transit_service's _describe_http_error — is
        # exactly what a developer needs to tell "wrong query param" from
        # "endpoint moved" from "feed is just down", but it's also raw
        # upstream internals (headers/body content data.gov.my controls,
        # not this app). That's fine in a server log, not fine echoed
        # verbatim to any anonymous caller of this public, keyless
        # endpoint. Log the diagnostic detail here; the client gets an
        # honest but generic reason.
        logger.warning("transit upstream failure on /transit/sepang-access: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Live transit data is temporarily unavailable — the upstream GTFS feed didn't respond as expected.",
        ) from exc
