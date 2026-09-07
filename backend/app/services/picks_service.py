"""Storage + orchestration for Race-day Picks, backed by Supabase's
PostgREST HTTP API (not a Postgres driver — this app has no DB dependency
anywhere else, and every other external integration here already talks
HTTP via httpx, so a REST call keeps that same shape rather than adding a
new kind of dependency for one feature).

Only this backend ever holds the Supabase service_role key — the frontend
never talks to Supabase directly, same trust boundary as the Databricks
token elsewhere in this app. Row Level Security is enabled on both tables
with no permissive policies, so even a leaked anon key gets nothing; the
service_role key bypasses RLS by design, which is what lets this module
read/write at all.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.schemas.jolpica import RaceClassification
from app.schemas.picks import (
    LeaderboardResponse,
    LeaderboardRow,
    MyPickResponse,
    PickAnswers,
    PickSubmission,
    PickSubmitted,
)
from app.services import jolpica_service
from app.services.picks_scoring import score_submission

logger = logging.getLogger(__name__)
MYT = ZoneInfo("Asia/Kuala_Lumpur")
_TIMEOUT = httpx.Timeout(10.0)

_TABLE = "picks_predictions"
_CACHE_TABLE = "picks_race_cache"


class PicksStorageUnavailable(Exception):
    """Supabase isn't configured (missing URL/key) — a deploy/config
    problem, not a user-facing 4xx. Distinct from MLflow's "continue
    without it" pattern elsewhere in this app: picks storage isn't
    best-effort, a submission that silently didn't save would be worse
    than a loud error telling the operator to fix their env vars."""


class PicksClosed(Exception):
    """The picks deadline has passed — a real 4xx, not a config problem."""


def _configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


def _headers(*, prefer: str | None = None) -> dict[str, str]:
    if not _configured():
        raise PicksStorageUnavailable(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set — picks storage is unavailable."
        )
    headers = {
        "apikey": settings.supabase_service_role_key or "",
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _rest_url(path: str) -> str:
    base = (settings.supabase_url or "").rstrip("/")
    return f"{base}/rest/v1/{path}"


async def get_deadline() -> datetime:
    """Picks lock when qualifying starts, not race start — a fan who's
    already seen the grid shouldn't be able to lock in a pole guess. One
    deadline covers all 8 questions rather than a per-question staggered
    lock, a deliberate v1 simplification stated plainly in the page copy."""
    schedule = await jolpica_service.get_sepang_schedule()
    quali = next(s for s in schedule.sessions if s.session == "Quali")
    return datetime.fromisoformat(quali.start)


async def submit_pick(submission: PickSubmission) -> PickSubmitted:
    deadline = await get_deadline()
    now = datetime.now(MYT)
    if now >= deadline:
        raise PicksClosed(f"Picks closed at {deadline.isoformat()} (qualifying start).")

    picks = submission.picks
    row = {
        "display_name": submission.display_name,
        "winner": picks.winner,
        "p2": picks.p2,
        "p3": picks.p3,
        "pole": picks.pole,
        "fastest_lap": picks.fastest_lap,
        "top_constructor": picks.top_constructor,
        "dnf_band": picks.dnf_band,
        "beats_teammate_of": picks.beats_teammate_of,
        "beats_teammate_pick": picks.beats_teammate_pick,
    }

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            _rest_url(_TABLE),
            headers=_headers(prefer="return=representation"),
            json=row,
        )
        response.raise_for_status()
    created = response.json()[0]
    return PickSubmitted(
        id=created["id"], display_name=created["display_name"], submitted_at=created["submitted_at"]
    )


async def get_leaderboard(*, limit: int = 50, viewer_id: str | None = None) -> LeaderboardResponse:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            _rest_url(_TABLE),
            headers=_headers(),
            params={
                "select": "id,display_name,score",
                "order": "score.desc.nullslast,submitted_at.asc",
                "limit": str(limit),
            },
        )
        response.raise_for_status()
        rows: list[dict[str, Any]] = response.json()

        count_response = await client.get(
            _rest_url(_TABLE),
            headers={**_headers(), "Prefer": "count=exact"},
            params={"select": "id", "limit": "1"},
        )
        count_response.raise_for_status()
        content_range = count_response.headers.get("content-range", "*/0")
        total_entries = int(content_range.split("/")[-1]) if "/" in content_range else len(rows)

    is_scored = any(row.get("score") is not None for row in rows)
    entries = [
        LeaderboardRow(
            rank=index + 1,
            display_name=row["display_name"],
            score=row.get("score") or 0,
            is_you=(row["id"] == viewer_id),
        )
        for index, row in enumerate(rows)
    ]
    return LeaderboardResponse(is_scored=is_scored, entries=entries, total_entries=total_entries)


async def get_my_pick(entry_id: str) -> MyPickResponse | None:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.get(
            _rest_url(_TABLE),
            headers=_headers(),
            params={"id": f"eq.{entry_id}", "select": "*"},
        )
        response.raise_for_status()
        rows = response.json()
    if not rows:
        return None
    row = rows[0]
    rank = None
    if row.get("score") is not None:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            better_response = await client.get(
                _rest_url(_TABLE),
                headers={**_headers(), "Prefer": "count=exact"},
                params={"select": "id", "score": f"gt.{row['score']}", "limit": "1"},
            )
            better_response.raise_for_status()
            content_range = better_response.headers.get("content-range", "*/0")
            ahead = int(content_range.split("/")[-1]) if "/" in content_range else 0
        rank = ahead + 1

    return MyPickResponse(
        id=row["id"],
        display_name=row["display_name"],
        picks=PickAnswers(
            winner=row["winner"],
            p2=row["p2"],
            p3=row["p3"],
            pole=row["pole"],
            fastestLap=row["fastest_lap"],
            topConstructor=row["top_constructor"],
            dnfBand=row["dnf_band"],
            beatsTeammateOf=row["beats_teammate_of"],
            beatsTeammatePick=row["beats_teammate_pick"],
        ),
        submitted_at=row["submitted_at"],
        score=row.get("score"),
        rank=rank,
    )


async def score_pending() -> int:
    """Scores every submitted-but-unscored entry against the real round-16
    classification. A no-op (returns 0) until Jolpica reports the round
    final — safe to run on a schedule well before race day. Called from
    ml/score_picks.py, the same GitHub Actions cron shape as
    ml/log_daily_run.py."""
    classification: RaceClassification = await jolpica_service.get_race_classification()
    if not classification.is_final:
        logger.info("Round %s not final yet; nothing to score", jolpica_service.DEFAULT_ROUND)
        return 0

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        pending_response = await client.get(
            _rest_url(_TABLE),
            headers=_headers(),
            params={"score": "is.null", "select": "*"},
        )
        pending_response.raise_for_status()
        pending = pending_response.json()

        scored_count = 0
        for row in pending:
            picks = PickAnswers(
                winner=row["winner"],
                p2=row["p2"],
                p3=row["p3"],
                pole=row["pole"],
                fastestLap=row["fastest_lap"],
                topConstructor=row["top_constructor"],
                dnfBand=row["dnf_band"],
                beatsTeammateOf=row["beats_teammate_of"],
                beatsTeammatePick=row["beats_teammate_pick"],
            )
            score = score_submission(picks, classification)
            patch_response = await client.patch(
                _rest_url(_TABLE),
                headers=_headers(),
                params={"id": f"eq.{row['id']}"},
                json={"score": score, "scored_at": datetime.now(MYT).isoformat()},
            )
            patch_response.raise_for_status()
            scored_count += 1

        cache_response = await client.post(
            _rest_url(_CACHE_TABLE),
            headers={**_headers(), "Prefer": "resolution=merge-duplicates"},
            json={
                "round": int(classification.round),
                "is_final": True,
                "payload": classification.model_dump(mode="json"),
            },
        )
        cache_response.raise_for_status()

    logger.info("Scored %d pending picks against round %s", scored_count, classification.round)
    return scored_count
