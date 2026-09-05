from fastapi import APIRouter, HTTPException

from app.schemas.transit import SepangAccessPayload
from app.services import transit_service

router = APIRouter()


@router.get("/transit/sepang-access", response_model=SepangAccessPayload)
async def sepang_access() -> SepangAccessPayload:
    # No route/vehicle matching a real world isn't an error — it's an
    # honest empty result the payload itself explains (coverage_note).
    # Only a real transport/format failure reaches here as an exception.
    try:
        return await transit_service.get_sepang_access()
    except transit_service.TransitUpstreamError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
