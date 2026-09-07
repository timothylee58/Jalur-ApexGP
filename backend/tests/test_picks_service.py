"""Unit tests for picks_service against a mocked httpx transport and a
monkeypatched jolpica_service (deadline / classification lookups are
already covered by their own test modules — these tests only need
canned return values from them)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.config import settings
from app.schemas.jolpica import (
    ClassifiedDriver,
    RaceClassification,
    ScheduleSession,
    WeekendSchedule,
)
from app.schemas.picks import PickAnswers, PickSubmission
from app.services import jolpica_service, picks_service
from app.services.picks_service import PicksClosed, PicksDeadlineUnknown, PicksStorageUnavailable

_RealAsyncClient = httpx.AsyncClient
MYT = ZoneInfo("Asia/Kuala_Lumpur")


def _patch_client(
    monkeypatch: pytest.MonkeyPatch, handler: Callable[[httpx.Request], httpx.Response]
) -> None:
    def factory(**kwargs: object) -> httpx.AsyncClient:
        return _RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)


@pytest.fixture(autouse=True)
def _configure_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")


def _future_schedule(*, quali_offset: timedelta) -> WeekendSchedule:
    quali_start = (datetime.now(MYT) + quali_offset).isoformat()
    return WeekendSchedule(
        season="2026",
        round="16",
        race_name="Bahrain Grand Prix in Malaysia",
        circuit_id="sepang",
        circuit_name="Sepang International Circuit",
        source="jolpica",
        sessions=[ScheduleSession(session="Quali", start=quali_start, end=quali_start)],
    )


SAMPLE_PICKS = PickAnswers(
    winner="norris",
    p2="piastri",
    p3="verstappen",
    pole="piastri",
    fastestLap="piastri",
    topConstructor="mclaren",
    dnfBand="1-2",
    beatsTeammateOf="mclaren",
    beatsTeammatePick="norris",
)


def test_storage_unavailable_when_not_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "supabase_url", None)
    monkeypatch.setattr(settings, "supabase_service_role_key", None)
    with pytest.raises(PicksStorageUnavailable):
        picks_service._headers()


@pytest.mark.asyncio
async def test_submit_pick_success(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _schedule(**_: object) -> WeekendSchedule:
        return _future_schedule(quali_offset=timedelta(days=1))

    monkeypatch.setattr(jolpica_service, "get_sepang_schedule", _schedule)

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert "/rest/v1/picks_predictions" in str(request.url)
        return httpx.Response(
            201,
            json=[
                {
                    "id": "abc-123",
                    "display_name": "Timothy",
                    "submitted_at": "2026-10-01T00:00:00+08:00",
                }
            ],
        )

    _patch_client(monkeypatch, handler)

    result = await picks_service.submit_pick(
        PickSubmission(displayName="Timothy", picks=SAMPLE_PICKS)
    )
    assert result.id == "abc-123"
    assert result.display_name == "Timothy"


@pytest.mark.asyncio
async def test_submit_pick_past_deadline_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _schedule(**_: object) -> WeekendSchedule:
        return _future_schedule(quali_offset=timedelta(days=-1))

    monkeypatch.setattr(jolpica_service, "get_sepang_schedule", _schedule)

    def _fail_if_called(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not reach Supabase once picks are closed")

    _patch_client(monkeypatch, _fail_if_called)

    with pytest.raises(PicksClosed):
        await picks_service.submit_pick(PickSubmission(displayName="Timothy", picks=SAMPLE_PICKS))


@pytest.mark.asyncio
async def test_submit_pick_when_deadline_unknown_raises_cleanly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Reproduced live against this sandbox's blocked network: Jolpica
    # unreachable must surface as PicksDeadlineUnknown (-> a clean 502),
    # never an uncaught JolpicaUpstreamError bubbling up as a bare 500.
    async def _unreachable(**_: object) -> WeekendSchedule:
        raise jolpica_service.JolpicaUpstreamError("Jolpica request failed")

    monkeypatch.setattr(jolpica_service, "get_sepang_schedule", _unreachable)

    def _fail_if_called(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not reach Supabase when the deadline can't be confirmed")

    _patch_client(monkeypatch, _fail_if_called)

    with pytest.raises(PicksDeadlineUnknown):
        await picks_service.submit_pick(PickSubmission(displayName="Timothy", picks=SAMPLE_PICKS))


@pytest.mark.asyncio
async def test_get_leaderboard_shapes_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET" and "count=exact" not in request.headers.get("Prefer", ""):
            return httpx.Response(
                200,
                json=[
                    {"id": "id-1", "display_name": "Ana", "score": 80},
                    {"id": "id-2", "display_name": "Ben", "score": None},
                ],
            )
        return httpx.Response(200, json=[], headers={"content-range": "0-0/2"})

    _patch_client(monkeypatch, handler)

    leaderboard = await picks_service.get_leaderboard(viewer_id="id-2")
    assert leaderboard.total_entries == 2
    assert leaderboard.is_scored is True
    assert leaderboard.entries[0].rank == 1
    assert leaderboard.entries[0].display_name == "Ana"
    assert leaderboard.entries[1].is_you is True
    # Ben's row is still unscored — must stay None, not get coerced to 0
    # (which would be indistinguishable from an honest zero score).
    assert leaderboard.entries[1].score is None


@pytest.mark.asyncio
async def test_score_pending_noop_when_round_not_final(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _not_final(**_: object) -> RaceClassification:
        return RaceClassification(
            season="2026", round="16", source="jolpica", is_final=False, results=[]
        )

    monkeypatch.setattr(jolpica_service, "get_race_classification", _not_final)

    def _fail_if_called(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not touch Supabase before the round is final")

    _patch_client(monkeypatch, _fail_if_called)

    scored = await picks_service.score_pending()
    assert scored == 0


@pytest.mark.asyncio
async def test_score_pending_scores_and_patches(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _final(**_: object) -> RaceClassification:
        return RaceClassification(
            season="2026",
            round="16",
            source="jolpica",
            is_final=True,
            pole_family_name="Piastri",
            results=[
                ClassifiedDriver(
                    position=1,
                    driver_family_name="Norris",
                    constructor_name="McLaren",
                    status="Finished",
                    points=25.0,
                    fastest_lap_rank=None,
                ),
            ],
        )

    monkeypatch.setattr(jolpica_service, "get_race_classification", _final)

    patched_ids: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": "id-1",
                        "winner": "norris",
                        "p2": "piastri",
                        "p3": "verstappen",
                        "pole": "piastri",
                        "fastest_lap": "piastri",
                        "top_constructor": "mclaren",
                        "dnf_band": "1-2",
                        "beats_teammate_of": "mclaren",
                        "beats_teammate_pick": "norris",
                    }
                ],
            )
        if request.method == "PATCH":
            patched_ids.append(str(request.url.params.get("id")))
            return httpx.Response(200, json=[])
        if request.method == "POST":
            return httpx.Response(201, json=[])
        raise AssertionError(f"unexpected method {request.method}")

    _patch_client(monkeypatch, handler)

    scored = await picks_service.score_pending()
    assert scored == 1
    assert patched_ids == ["eq.id-1"]


@pytest.mark.asyncio
async def test_score_pending_paginates_past_the_page_size(monkeypatch: pytest.MonkeyPatch) -> None:
    # Regression test: more pending rows than fit in one page must all get
    # scored, not just the first page's worth.
    monkeypatch.setattr(picks_service, "_SCORE_PENDING_PAGE_SIZE", 1)

    async def _final(**_: object) -> RaceClassification:
        return RaceClassification(
            season="2026",
            round="16",
            source="jolpica",
            is_final=True,
            pole_family_name="Piastri",
            results=[
                ClassifiedDriver(
                    position=1,
                    driver_family_name="Norris",
                    constructor_name="McLaren",
                    status="Finished",
                    points=25.0,
                    fastest_lap_rank=None,
                ),
            ],
        )

    monkeypatch.setattr(jolpica_service, "get_race_classification", _final)

    remaining = {"id-1", "id-2", "id-3"}
    patched_ids: list[str] = []

    def _row(entry_id: str) -> dict[str, str]:
        return {
            "id": entry_id,
            "winner": "norris",
            "p2": "piastri",
            "p3": "verstappen",
            "pole": "piastri",
            "fastest_lap": "piastri",
            "top_constructor": "mclaren",
            "dnf_band": "1-2",
            "beats_teammate_of": "mclaren",
            "beats_teammate_pick": "norris",
        }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            # One row per page, in a stable order, matching the
            # PAGE_SIZE=1 monkeypatch above.
            next_id = sorted(remaining)[0] if remaining else None
            return httpx.Response(200, json=[_row(next_id)] if next_id else [])
        if request.method == "PATCH":
            entry_id = str(request.url.params.get("id")).removeprefix("eq.")
            remaining.discard(entry_id)
            patched_ids.append(entry_id)
            return httpx.Response(200, json=[])
        if request.method == "POST":
            return httpx.Response(201, json=[])
        raise AssertionError(f"unexpected method {request.method}")

    _patch_client(monkeypatch, handler)

    scored = await picks_service.score_pending()
    assert scored == 3
    assert patched_ids == ["id-1", "id-2", "id-3"]
