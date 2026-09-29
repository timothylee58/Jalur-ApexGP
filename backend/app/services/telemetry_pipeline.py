"""Which source answers a telemetry request — the graceful-degradation
layer between the routes and the two data clients.

    OpenF1 (primary)  ->  TracingInsights (fallback)  ->  the original error

OpenF1 goes first: it is the live, queryable API and the one this page has
always cited. When it can't answer — its free tier caps requests at
3/second and 30/minute, or it is down, or it hasn't ingested a session — the
same lap is served from TracingInsights' published copy of the same
underlying timing data (FastF1, from F1's live-timing feed), and the
response says so. Readers see "via TracingInsights, because OpenF1 is
rate-limiting" rather than an error, and never data from one source
labelled as the other.

If both fail, which error the reader sees depends on what the fallback
learned. When TracingInsights has the session but not the thing asked for —
a driver with no timed laps (retired on lap 1, say) — that answer is
authoritative, being the same timing data, and it is what's reported (404).
When TracingInsights doesn't cover the session at all, it has learned
nothing, and the primary's error — "rate limited, try again in a minute" —
is the more useful one.
"""

from __future__ import annotations

import logging
import math
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Generic, TypeVar

from app.schemas.telemetry import (
    SessionOverview,
    TelemetryCorner,
    TelemetryDriver,
    TelemetryLap,
    TelemetryLapTrace,
    TelemetrySample,
    TelemetrySource,
)
from app.services import telemetry_service, tracinginsights_service
from app.services.telemetry_service import TelemetryUnavailable, TelemetryUpstreamError
from app.services.tracinginsights_service import SessionNotPublished

logger = logging.getLogger(__name__)

# How far a lap's nearest position fix may sit from a corner's published
# point and still count as that corner, as a share of the lap's bounding-box
# diagonal (~40 m at a typical circuit): wider than the spacing of position
# fixes plus a racing line's offset, far narrower than two legs of track.
_CORNER_SNAP_TOLERANCE = 0.04
# How far along the lap a corner may move when snapped, as a share of the
# lap: integrated distance drifts by a percent or two, not more.
_CORNER_SNAP_WINDOW = 0.08

T = TypeVar("T")


@dataclass(frozen=True)
class Sourced(Generic[T]):
    data: T
    source: TelemetrySource
    # Safe to cache at the edge: the session is over for good. Anything
    # TracingInsights serves is final by construction (it only publishes
    # after a session ends).
    final: bool
    fallback_reason: str | None = None


def _reason(exc: Exception) -> str:
    if isinstance(exc, TelemetryUpstreamError) and "rate limiting" in str(exc):
        return "OpenF1's free tier is rate-limiting this app right now"
    if isinstance(exc, TelemetryUpstreamError):
        return "OpenF1 isn't responding right now"
    return "OpenF1 doesn't have this data"


async def _with_fallback(
    primary: Callable[[], Awaitable[T]],
    fallback: Callable[[], Awaitable[T]],
    primary_final: Callable[[], bool],
    what: str,
) -> Sourced[T]:
    try:
        return Sourced(await primary(), "openf1", primary_final())
    except (TelemetryUpstreamError, TelemetryUnavailable) as primary_error:
        logger.warning("telemetry %s: OpenF1 failed (%s); trying TracingInsights", what, primary_error)
        try:
            data = await fallback()
        except TelemetryUnavailable as fallback_error:
            logger.warning("telemetry %s: TracingInsights failed too (%s)", what, fallback_error)
            if isinstance(fallback_error, SessionNotPublished):
                raise primary_error from fallback_error
            # The session is published; this driver/lap genuinely isn't in it.
            raise fallback_error from primary_error
        except TelemetryUpstreamError as fallback_error:
            logger.warning("telemetry %s: TracingInsights failed too (%s)", what, fallback_error)
            raise primary_error from fallback_error
        return Sourced(data, "tracinginsights", True, _reason(primary_error))


async def drivers(year: int, circuit: str, session: str) -> Sourced[list[TelemetryDriver]]:
    return await _with_fallback(
        lambda: telemetry_service.get_drivers(year, circuit, session),
        lambda: tracinginsights_service.get_drivers(year, circuit, session),
        lambda: telemetry_service.session_is_final(year, circuit, session),
        "drivers",
    )


async def laps(driver_number: int, year: int, circuit: str, session: str) -> Sourced[list[TelemetryLap]]:
    return await _with_fallback(
        lambda: telemetry_service.get_laps(driver_number, year, circuit, session),
        lambda: tracinginsights_service.get_laps(driver_number, year, circuit, session),
        lambda: telemetry_service.session_is_final(year, circuit, session),
        "laps",
    )


async def lap_trace(
    driver_number: int, lap_number: int, year: int, circuit: str, session: str
) -> Sourced[TelemetryLapTrace]:
    result = await _with_fallback(
        lambda: telemetry_service.get_lap_trace(driver_number, lap_number, year, circuit, session),
        lambda: tracinginsights_service.get_lap_trace(driver_number, lap_number, year, circuit, session),
        lambda: telemetry_service.session_is_final(year, circuit, session),
        "lap trace",
    )
    trace = result.data
    trace.source = result.source
    trace.fallback_reason = result.fallback_reason
    # Corner positions are circuit geometry, not the lap's own data, so they
    # come from TracingInsights whichever source served the lap. Optional:
    # the charts simply go without corner labels if they're unavailable.
    try:
        corners = await tracinginsights_service.get_corners(year, circuit, session)
        trace.corners = align_corners(corners, trace.samples) if result.source == "openf1" else corners
    except (TelemetryUpstreamError, TelemetryUnavailable) as exc:
        logger.info("telemetry corners unavailable: %s", exc)
    # An OpenF1 lap that came back without positions (its /location call was
    # refused) is complete enough to show but not to cache for a day.
    complete = result.source != "openf1" or any(s.x is not None for s in trace.samples)
    return Sourced(trace, result.source, result.final and complete, result.fallback_reason)


def align_corners(corners: list[TelemetryCorner], samples: list[TelemetrySample]) -> list[TelemetryCorner]:
    """TracingInsights' corner distances are metres along its reference lap;
    an OpenF1 lap's distances are integrated from speed and drift from that
    by the end of the lap, so plotted as-is the markers creep off their
    corners. Where the lap has positions, each corner takes the distance of
    this lap's own nearest position fix instead (both sources share the
    timing feed's coordinate frame). If any corner fails to land — the
    frames disagree, or the lap is missing positions — the published
    distances are kept rather than risk a wrong snap."""
    placed = [s for s in samples if s.x is not None and s.y is not None and s.distance is not None]
    if not corners or len(placed) < 2 or any(c.x is None or c.y is None for c in corners):
        return corners
    xs = [s.x for s in placed]
    ys = [s.y for s in placed]
    tolerance = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) * _CORNER_SNAP_TOLERANCE
    window = max(placed[-1].distance * _CORNER_SNAP_WINDOW, 1.0)

    aligned: list[TelemetryCorner] = []
    for corner in corners:
        nearby = [s for s in placed if abs(s.distance - corner.distance) <= window]
        best = min(nearby, key=lambda s: math.hypot(s.x - corner.x, s.y - corner.y), default=None)
        if best is None or math.hypot(best.x - corner.x, best.y - corner.y) > tolerance:
            return corners
        aligned.append(corner.model_copy(update={"distance": best.distance}))
    if any(b.distance < a.distance for a, b in zip(aligned, aligned[1:])):
        return corners
    return aligned


async def session_overview(year: int, circuit: str, session: str) -> Sourced[SessionOverview]:
    """Whole-session laps for every driver. TracingInsights publishes this
    as a single file; rebuilding it from OpenF1 would cost several calls per
    view against a 30-per-minute budget, so there's no OpenF1 path — if the
    file is unavailable, the overview charts are hidden."""
    return Sourced(await tracinginsights_service.get_session_overview(year, circuit, session), "tracinginsights", True)
