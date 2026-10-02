"""Preview deploys share production's Supabase project: they may read it,
never write to it. These pin that every write path refuses on a preview
before any request leaves the process, and that reads still work."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.schemas.jolpica import ScheduleSession, WeekendSchedule
from app.services import accuracy_service, accuracy_store, jolpica_service, supabase_rest
from app.services.accuracy_service import SessionWindow, Weekend

_RealAsyncClient = httpx.AsyncClient
MYT = ZoneInfo("Asia/Kuala_Lumpur")
UTC = timezone.utc

TICKET = {
    "displayName": "Timothy",
    "picks": {
        "winner": "norris",
        "p2": "piastri",
        "p3": "verstappen",
        "pole": "piastri",
        "fastestLap": "piastri",
        "topConstructor": "mclaren",
        "dnfBand": "1-2",
        "beatsTeammateOf": "mclaren",
        "beatsTeammatePick": "norris",
    },
}


@pytest.fixture(autouse=True)
def preview(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    """A configured preview deploy whose HTTP client records, and fails,
    every request — so a write that slipped through would show up."""
    monkeypatch.setattr(settings, "supabase_url", "https://example.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "test-service-role-key")
    monkeypatch.setattr(settings, "vercel_env", "preview")
    monkeypatch.setattr(settings, "supabase_read_only", None)
    sent: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return httpx.Response(200, json=[])

    def factory(**kwargs: object) -> httpx.AsyncClient:
        return _RealAsyncClient(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", factory)
    return sent


@pytest.mark.parametrize(
    ("vercel_env", "override", "expected"),
    [
        ("preview", None, True),
        ("production", None, False),
        ("development", None, False),
        (None, None, False),
        ("preview", False, False),
        ("production", True, True),
    ],
)
def test_read_only_follows_the_deploy_unless_overridden(
    monkeypatch, vercel_env, override, expected
):
    monkeypatch.setattr(settings, "vercel_env", vercel_env)
    monkeypatch.setattr(settings, "supabase_read_only", override)
    assert supabase_rest.read_only() is expected
    assert supabase_rest.writable() is not expected


def test_preview_reads_but_refuses_write_headers():
    assert supabase_rest.headers()["apikey"] == "test-service-role-key"
    with pytest.raises(supabase_rest.SupabaseReadOnly):
        supabase_rest.write_headers(prefer="return=minimal")


@pytest.mark.asyncio
async def test_accuracy_upserts_never_leave_the_process(preview):
    with pytest.raises(supabase_rest.SupabaseReadOnly):
        await accuracy_store.upsert_outcome({"season": 2026, "round": 16, "session": "FP1"})
    assert preview == []


@pytest.mark.asyncio
async def test_board_renders_stored_rows_without_resolving(monkeypatch, preview):
    start = datetime(2026, 10, 2, 4, 30, tzinfo=UTC)
    weekend = Weekend(
        2026,
        16,
        "Bahrain Grand Prix in Malaysia",
        (SessionWindow("FP1", start, start + timedelta(hours=1)),),
    )

    async def fixed_weekend():
        return weekend

    resolved: list[bool] = []

    async def resolve(*_, **__):
        resolved.append(True)
        return []

    monkeypatch.setattr(accuracy_service, "weekend", fixed_weekend)
    monkeypatch.setattr(accuracy_service, "resolve", resolve)

    board = await accuracy_service.weekend_board(now=start + timedelta(hours=3))

    assert resolved == []
    assert [s.state for s in board.sessions] == ["unscored"]
    assert {r.method for r in preview} == {"GET"}


def test_picks_route_answers_403_with_a_plain_reason(monkeypatch, preview):
    async def schedule(**_: object) -> WeekendSchedule:
        quali = (datetime.now(MYT) + timedelta(days=1)).isoformat()
        return WeekendSchedule(
            season="2026",
            round="16",
            race_name="Bahrain Grand Prix in Malaysia",
            circuit_id="sepang",
            circuit_name="Sepang International Circuit",
            source="jolpica",
            sessions=[ScheduleSession(session="Quali", start=quali, end=quali)],
        )

    monkeypatch.setattr(jolpica_service, "get_sepang_schedule", schedule)

    response = TestClient(app).post("/api/picks", json=TICKET)

    assert response.status_code == 403
    assert "preview deployment" in response.json()["detail"]
    assert preview == []


def test_manual_outcome_route_refuses_on_preview(monkeypatch, preview):
    monkeypatch.setattr(settings, "outcomes_admin_token", "secret")

    async def fixed_weekend():
        start = datetime(2026, 10, 2, 4, 30, tzinfo=UTC)
        return Weekend(
            2026,
            16,
            "Bahrain Grand Prix in Malaysia",
            (SessionWindow("FP1", start, start + timedelta(hours=1)),),
        )

    monkeypatch.setattr(accuracy_service, "weekend", fixed_weekend)

    response = TestClient(app).post(
        "/api/outcomes",
        json={"session": "FP1", "rainOccurred": False},
        headers={"X-Admin-Token": "secret"},
    )

    assert response.status_code == 403
    assert preview == []
