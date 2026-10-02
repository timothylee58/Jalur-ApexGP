"""The automated accuracy loop: locking pre-session predictions, resolving
outcomes from real data, and scoring them — storage and upstreams faked."""

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.schemas.prediction import Session
from app.services import accuracy_service, accuracy_store, outcome_sources
from app.services.accuracy_service import SessionWindow, Weekend
from app.services.outcome_sources import RainReading
from app.services.strategy_service import build_prediction
from app.services.weather_service import SEPANG_CLIMATOLOGY

UTC = timezone.utc
FP1_START = datetime(2026, 10, 2, 4, 30, tzinfo=UTC)
WEEKEND = Weekend(
    season=2026,
    round=16,
    race_name="Bahrain Grand Prix in Malaysia",
    sessions=(
        SessionWindow("FP1", FP1_START, FP1_START + timedelta(hours=1)),
        SessionWindow("FP2", FP1_START + timedelta(hours=3, minutes=30), FP1_START + timedelta(hours=4, minutes=30)),
        SessionWindow("Race", FP1_START + timedelta(days=2, hours=2, minutes=30), FP1_START + timedelta(days=2, hours=4, minutes=30)),
    ),
)
FP2_END = WEEKEND.window("FP2").end
RACE_END = WEEKEND.window("Race").end


class FakeStore:
    def __init__(self):
        self.predictions: dict[str, dict] = {}
        self.outcomes: dict[str, dict] = {}

    async def upsert_prediction(self, row):
        self.predictions[row["session"]] = row

    async def upsert_outcome(self, row):
        self.outcomes[row["session"]] = row

    async def predictions_for_round(self, season, round_):
        return list(self.predictions.values())

    async def outcomes_for_round(self, season, round_):
        return list(self.outcomes.values())

    async def rows_for_session(self, session):
        return (
            [r for r in self.predictions.values() if r["session"] == session],
            [r for r in self.outcomes.values() if r["session"] == session],
        )


@pytest.fixture
def store(monkeypatch):
    fake = FakeStore()
    for name in ("upsert_prediction", "upsert_outcome", "predictions_for_round", "outcomes_for_round", "rows_for_session"):
        monkeypatch.setattr(accuracy_store, name, getattr(fake, name))

    async def fixed_weekend():
        return WEEKEND

    monkeypatch.setattr(accuracy_service, "weekend", fixed_weekend)
    accuracy_service._last_attempt.clear()

    async def climatology(self):
        return SEPANG_CLIMATOLOGY.model_copy()

    monkeypatch.setattr(accuracy_service.WeatherService, "get_snapshot", climatology)
    monkeypatch.setattr(accuracy_service, "_last_snapshot", -1e9)
    return fake


@pytest.fixture
def sources(monkeypatch):
    """Scripted upstreams: set .rain / .stop to control what's 'published'."""

    class Sources:
        rain: RainReading | None = RainReading(True, "openf1-track-weather", {"wetSamples": 12})
        stop: tuple | None = None
        rain_calls = 0

    async def rain_during(session, start, end, now):
        Sources.rain_calls += 1
        return Sources.rain

    async def race_reference_stop(season, round_):
        return Sources.stop

    monkeypatch.setattr(outcome_sources, "rain_during", rain_during)
    monkeypatch.setattr(outcome_sources, "race_reference_stop", race_reference_stop)
    return Sources


def prediction(session: Session):
    return build_prediction(session, SEPANG_CLIMATOLOGY)


class TestLockingPredictions:
    @pytest.mark.asyncio
    async def test_locks_before_the_start_and_never_after(self, store):
        assert await accuracy_service.record_prediction(prediction("FP1"), source="predict", now=FP1_START - timedelta(hours=1))
        assert store.predictions["FP1"]["source"] == "predict"
        assert not await accuracy_service.record_prediction(prediction("FP1"), source="predict", now=FP1_START)
        assert not await accuracy_service.record_prediction(
            prediction("FP1"), source="predict", now=FP1_START + timedelta(minutes=5)
        )

    @pytest.mark.asyncio
    async def test_a_read_days_ahead_is_not_the_sessions_read(self, store):
        assert not await accuracy_service.record_prediction(
            prediction("Race"), source="predict", now=FP1_START - timedelta(hours=1)
        )
        assert "Race" not in store.predictions

    @pytest.mark.asyncio
    async def test_scheduler_locks_only_sessions_about_to_start(self, store):
        async def build(session):
            return prediction(session)

        locked = await accuracy_service.snapshot_upcoming(build, now=FP1_START - timedelta(hours=2))
        assert locked == ["FP1"]
        assert store.predictions["FP1"]["source"] == "scheduler"


class TestBoardReadsKeepTheLoopMoving:
    """GitHub delays or drops scheduled runs, so a board read takes the
    scheduler's lock step itself."""

    @pytest.mark.asyncio
    async def test_a_board_read_locks_sessions_about_to_start(self, store, sources):
        await accuracy_service.weekend_board(now=FP1_START - timedelta(hours=2))
        assert store.predictions["FP1"]["source"] == "scheduler"
        assert "FP2" not in store.predictions

    @pytest.mark.asyncio
    async def test_relocks_at_most_once_per_throttle_window(self, store, monkeypatch):
        first = FP1_START - timedelta(hours=2)
        assert await accuracy_service.snapshot_on_read(first) == ["FP1"]
        assert await accuracy_service.snapshot_on_read(first + timedelta(minutes=1)) == []
        assert store.predictions["FP1"]["made_at"] == first.isoformat()

        monkeypatch.setattr(accuracy_service, "_last_snapshot", -1e9)
        later = first + timedelta(minutes=11)
        assert await accuracy_service.snapshot_on_read(later) == ["FP1"]
        assert store.predictions["FP1"]["made_at"] == later.isoformat()

    @pytest.mark.asyncio
    async def test_no_weather_fetch_when_nothing_is_about_to_start(self, store, monkeypatch):
        async def unexpected(self):
            raise AssertionError("weather fetched with no session in the lead window")

        monkeypatch.setattr(accuracy_service.WeatherService, "get_snapshot", unexpected)
        assert await accuracy_service.snapshot_on_read(FP2_END + timedelta(hours=1)) == []

    @pytest.mark.asyncio
    async def test_a_failed_lock_still_resolves(self, store, sources, monkeypatch):
        async def down(self):
            raise httpx.ConnectError("open-meteo unreachable")

        monkeypatch.setattr(accuracy_service.WeatherService, "get_snapshot", down)
        # FP1 finished 90 minutes ago; FP2 starts within the lead window.
        await accuracy_service.weekend_board(now=FP1_START + timedelta(hours=2, minutes=30))
        assert store.outcomes["FP1"]["rain_source"] == "openf1-track-weather"
        assert "FP2" not in store.predictions


class TestResolvingOutcomes:
    @pytest.mark.asyncio
    async def test_records_rain_for_a_finished_session(self, store, sources):
        written = await accuracy_service.resolve(now=FP2_END + timedelta(minutes=30), force=True)
        assert written == ["FP1", "FP2"]
        assert store.outcomes["FP1"]["rain_occurred"] is True
        assert store.outcomes["FP1"]["rain_source"] == "openf1-track-weather"
        assert store.outcomes["FP1"]["actual_pit_lap"] is None

    @pytest.mark.asyncio
    async def test_waits_when_no_data_is_published_yet(self, store, sources):
        sources.rain = None
        assert await accuracy_service.resolve(now=FP2_END + timedelta(minutes=5), force=True) == []
        assert store.outcomes == {}

    @pytest.mark.asyncio
    async def test_unfinished_sessions_are_left_alone(self, store, sources):
        assert await accuracy_service.resolve(now=FP1_START + timedelta(minutes=30), force=True) == []

    @pytest.mark.asyncio
    async def test_race_pit_lap_fills_in_once_the_classification_lands(self, store, sources):
        sources.rain = RainReading(False, "openf1-track-weather")
        await accuracy_service.resolve(now=RACE_END + timedelta(minutes=30), force=True)
        assert store.outcomes["Race"]["pit_source"] is None
        sources.stop = (24, "jolpica-pitstops", {"winner": "russell"})
        rain_calls = sources.rain_calls
        assert await accuracy_service.resolve(now=RACE_END + timedelta(hours=3), force=True) == ["Race"]
        assert store.outcomes["Race"]["actual_pit_lap"] == 24
        assert store.outcomes["Race"]["detail"]["pit"] == {"winner": "russell"}
        # The rain answer already recorded is kept, not re-read.
        assert sources.rain_calls == rain_calls

    @pytest.mark.asyncio
    async def test_page_views_are_throttled(self, store, sources):
        sources.rain = None
        now = FP2_END + timedelta(minutes=30)
        await accuracy_service.resolve(now=now)
        calls = sources.rain_calls
        await accuracy_service.resolve(now=now)
        assert sources.rain_calls == calls


class TestBoard:
    @pytest.mark.asyncio
    async def test_states_scores_and_polling(self, store, sources):
        await accuracy_service.record_prediction(prediction("FP2"), source="predict", now=FP1_START)
        board = await accuracy_service.weekend_board(now=FP2_END + timedelta(minutes=40))
        states = {s.session: s.state for s in board.sessions}
        assert states == {"FP1": "unscored", "FP2": "scored", "Race": "upcoming"}
        fp2 = next(s for s in board.sessions if s.session == "FP2")
        assert [score.variant for score in fp2.scores] == ["conservative", "aggressive"]
        # Practice has no strategy stop: the composite is the rain score alone.
        assert fp2.scores[0].pit_window_hit is None
        assert fp2.scores[0].composite_score == fp2.scores[0].rain_call_score
        assert board.next_check_seconds == 300

    @pytest.mark.asyncio
    async def test_polls_fast_while_a_session_is_live(self, store, sources):
        board = await accuracy_service.weekend_board(now=FP1_START + timedelta(minutes=10), resolve_now=False)
        assert board.sessions[0].state == "live"
        assert board.next_check_seconds == 30

    def test_race_pit_window_hit_scores_into_the_composite(self):
        row = accuracy_store.prediction_row(prediction("Race"), season=2026, round_=16, made_at="x", source="t")
        start, end = row["pit_start_conservative"], row["pit_end_conservative"]
        outcome = {"rain_occurred": False, "actual_pit_lap": start}
        hit, miss = (
            accuracy_service.score_pair(row, outcome, date="2026-10-04")[0],
            accuracy_service.score_pair(row, {**outcome, "actual_pit_lap": end + 5}, date="2026-10-04")[0],
        )
        assert hit.pit_window_hit is True and miss.pit_window_hit is False
        assert hit.composite_score > miss.composite_score


class TestOutcomeSources:
    @pytest.mark.asyncio
    async def test_open_meteo_counts_only_hours_overlapping_the_session(self, monkeypatch):
        payload = {
            "hourly": {
                "time": ["2026-10-02T12:00", "2026-10-02T13:00", "2026-10-02T14:00", "2026-10-02T15:00"],
                # 12:00 covers 11-12 (before FP1), 13:00 and 14:00 overlap 12:30-13:30.
                "precipitation": [5.0, 0.0, 0.4, 9.0],
            }
        }

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["start_date"] == "2026-10-02"
            return httpx.Response(200, json=payload)

        real_client = httpx.AsyncClient
        monkeypatch.setattr(
            outcome_sources.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)
        )
        reading = await outcome_sources.open_meteo_rain(FP1_START, FP1_START + timedelta(hours=1))
        assert reading is not None and reading.occurred is True
        assert reading.detail["hours"] == 2
        assert reading.detail["peakMmPerHour"] == 0.4

    @pytest.mark.asyncio
    async def test_openf1_rainfall_flags_decide_and_empty_means_not_yet(self, monkeypatch):
        weather = [{"rainfall": 0}, {"rainfall": 1}, {"rainfall": 0}]

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/sessions"):
                return httpx.Response(200, json=[{"session_key": 9999}])
            return httpx.Response(200, json=weather)

        real_client = httpx.AsyncClient
        monkeypatch.setattr(
            outcome_sources.httpx, "AsyncClient", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)
        )
        reading = await outcome_sources.openf1_rain("FP1", FP1_START, FP1_START + timedelta(hours=1))
        assert reading.occurred is True and reading.detail["wetSamples"] == 1
        weather.clear()
        assert await outcome_sources.openf1_rain("FP1", FP1_START, FP1_START + timedelta(hours=1)) is None

    @pytest.mark.asyncio
    async def test_modelled_fallback_only_after_the_grace_period(self, monkeypatch):
        async def no_openf1(*a):
            return None

        async def modelled(start, end):
            return RainReading(False, "open-meteo-modelled")

        monkeypatch.setattr(outcome_sources, "openf1_rain", no_openf1)
        monkeypatch.setattr(outcome_sources, "open_meteo_rain", modelled)
        end = FP1_START + timedelta(hours=1)
        assert await outcome_sources.rain_during("FP1", FP1_START, end, end + timedelta(minutes=30)) is None
        late = await outcome_sources.rain_during("FP1", FP1_START, end, end + timedelta(hours=2))
        assert late is not None and late.source == "open-meteo-modelled"


class TestRoutes:
    client = TestClient(app)

    def test_manual_outcomes_need_the_admin_token(self, store, monkeypatch):
        monkeypatch.setattr(settings, "outcomes_admin_token", None)
        body = {"session": "FP1", "rainOccurred": True, "actualPitLap": 12}
        assert self.client.post("/api/outcomes", json=body).status_code == 403

        monkeypatch.setattr(settings, "outcomes_admin_token", "s3cret")
        assert self.client.post("/api/outcomes", json=body, headers={"X-Admin-Token": "nope"}).status_code == 403
        ok = self.client.post("/api/outcomes", json=body, headers={"X-Admin-Token": "s3cret"})
        assert ok.status_code == 200
        assert ok.json()["date"] == "2026-10-02"
        assert store.outcomes["FP1"]["rain_source"] == "manual"

    def test_weekend_board_serialises_camel_case(self, store, sources):
        board = self.client.get("/api/accuracy/weekend")
        assert board.status_code == 200
        body = board.json()
        assert {"season", "round", "raceName", "generatedAt", "sessions", "nextCheckSeconds"} <= set(body)
        assert body["sessions"][0]["session"] == "FP1"

    def test_board_is_a_503_when_storage_is_not_configured(self, monkeypatch):
        monkeypatch.setattr(settings, "supabase_url", None)

        async def fixed_weekend():
            return WEEKEND

        monkeypatch.setattr(accuracy_service, "weekend", fixed_weekend)
        response = self.client.get("/api/accuracy/weekend")
        assert response.status_code == 503
