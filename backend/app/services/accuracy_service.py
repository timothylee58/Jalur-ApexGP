"""The prediction-accuracy loop, end to end and without anyone typing in
results.

1. LOCK A PREDICTION. Before each session, the latest unmodified read is
   stored as that session's prediction — from live /predict traffic and
   from the scheduler (ml/accuracy_tick.py), which reads every session in
   the hours before it starts. The last write before lights out wins; after
   the start nothing can overwrite it, so a prediction can never be made
   with hindsight.
2. RESOLVE THE OUTCOME. Once a session ends, outcome_sources reads what
   actually happened: rain from the track's weather station (modelled
   precipitation as a late fallback) and, for the race, the winner's first
   pit stop. The scheduler polls every few minutes, and the weekend board
   also resolves on read, so a page view right after the data lands
   updates it without waiting for the next tick.
3. SCORE. scoring_service compares the two, per strategy variant.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from app.schemas.outcome import (
    AccuracyResponse,
    OutcomeRequest,
    PredictionSnapshot,
    SessionBoard,
    SessionOutcome,
    VariantScore,
    WeekendBoard,
)
from app.schemas.prediction import PitWindow, PredictionResponse, Session
from app.services import accuracy_store, jolpica_service, outcome_sources, supabase_rest
from app.services.scoring_service import (
    aggregate_scores,
    composite_score,
    score_pit_window,
    score_rain_call,
)

logger = logging.getLogger(__name__)

# Used when Jolpica's schedule can't be reached — the same weekend the
# frontend bakes in (lib/sepangSchedule.ts).
_FALLBACK = {
    "season": 2026,
    "round": 16,
    "race_name": "Bahrain Grand Prix in Malaysia",
    "sessions": [
        ("FP1", "2026-10-02T12:30:00+08:00", "2026-10-02T13:30:00+08:00"),
        ("FP2", "2026-10-02T16:00:00+08:00", "2026-10-02T17:00:00+08:00"),
        ("FP3", "2026-10-03T12:30:00+08:00", "2026-10-03T13:30:00+08:00"),
        ("Quali", "2026-10-03T16:00:00+08:00", "2026-10-03T17:00:00+08:00"),
        ("Race", "2026-10-04T15:00:00+08:00", "2026-10-04T17:00:00+08:00"),
    ],
}

# Snapshots older than this before the start aren't the read for that
# session — they just cost a write.
SNAPSHOT_HORIZON = timedelta(hours=24)
# The scheduler reads each session in this window before it starts.
SCHEDULER_LEAD = timedelta(hours=3)
# How long after a race to keep looking for the reference pit stop.
PIT_LOOKUP_WINDOW = timedelta(days=3)
# A page view retries an unresolved session at most this often per instance.
RESOLVE_THROTTLE_S = 90.0
RESOLVE_BUDGET_S = 6.0


class AccuracyUnavailable(Exception):
    """Storage isn't configured or reachable — surfaced as a 503."""


@dataclass(frozen=True)
class SessionWindow:
    session: Session
    start: datetime
    end: datetime


@dataclass(frozen=True)
class Weekend:
    season: int
    round: int
    race_name: str
    sessions: tuple[SessionWindow, ...]

    def window(self, session: str) -> SessionWindow | None:
        return next((s for s in self.sessions if s.session == session), None)


def _parse(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def weekend() -> Weekend:
    try:
        schedule = await jolpica_service.get_sepang_schedule()
        return Weekend(
            season=int(schedule.season),
            round=int(schedule.round),
            race_name=schedule.race_name,
            sessions=tuple(SessionWindow(s.session, _parse(s.start), _parse(s.end)) for s in schedule.sessions),  # type: ignore[arg-type]
        )
    except Exception as exc:  # noqa: BLE001 - any schedule failure falls back the same way
        logger.warning("schedule unavailable, using the baked weekend: %s", exc)
        return Weekend(
            season=_FALLBACK["season"],
            round=_FALLBACK["round"],
            race_name=_FALLBACK["race_name"],
            sessions=tuple(SessionWindow(name, _parse(a), _parse(b)) for name, a, b in _FALLBACK["sessions"]),
        )


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---- 1. locking predictions --------------------------------------------------


async def record_prediction(
    prediction: PredictionResponse, *, source: str, now: datetime | None = None, wk: Weekend | None = None
) -> bool:
    """Store `prediction` as its session's pre-session read, if the session
    hasn't started yet and is close enough for this to be its read."""
    now = now or _now()
    wk = wk or await weekend()
    window = wk.window(prediction.session)
    if window is None or now >= window.start or window.start - now > SNAPSHOT_HORIZON:
        return False
    row = accuracy_store.prediction_row(
        prediction, season=wk.season, round_=wk.round, made_at=now.isoformat(), source=source
    )
    await accuracy_store.upsert_prediction(row)
    return True


async def snapshot_upcoming(build, now: datetime | None = None) -> list[str]:
    """Scheduler step: lock a fresh read for every session starting within
    SCHEDULER_LEAD. `build(session)` returns a PredictionResponse."""
    now = now or _now()
    wk = await weekend()
    done: list[str] = []
    for window in wk.sessions:
        if now < window.start <= now + SCHEDULER_LEAD:
            prediction = await build(window.session)
            if await record_prediction(prediction, source="scheduler", now=now, wk=wk):
                done.append(window.session)
    return done


# ---- 2. resolving outcomes ---------------------------------------------------

_last_attempt: dict[tuple[int, int, str], float] = {}


def _needs_work(window: SessionWindow, outcome: dict[str, Any] | None, now: datetime) -> bool:
    if now < window.end:
        return False
    if outcome is None:
        return True
    return window.session == "Race" and outcome.get("pit_source") is None and now < window.end + PIT_LOOKUP_WINDOW


async def resolve(now: datetime | None = None, *, force: bool = False) -> list[str]:
    """Record the outcome of every finished session that doesn't have one
    yet (and the race's pit stop once Jolpica has it). Returns the sessions
    written this call."""
    now = now or _now()
    wk = await weekend()
    outcomes = {row["session"]: row for row in await accuracy_store.outcomes_for_round(wk.season, wk.round)}
    written: list[str] = []
    for window in wk.sessions:
        existing = outcomes.get(window.session)
        if not _needs_work(window, existing, now):
            continue
        key = (wk.season, wk.round, window.session)
        if not force and time.monotonic() - _last_attempt.get(key, -1e9) < RESOLVE_THROTTLE_S:
            continue
        _last_attempt[key] = time.monotonic()

        detail: dict[str, Any] = dict(existing.get("detail") or {}) if existing else {}
        if existing:
            rain_occurred, rain_source = bool(existing["rain_occurred"]), str(existing["rain_source"])
        else:
            reading = await outcome_sources.rain_during(window.session, window.start, window.end, now)
            if reading is None:
                continue
            rain_occurred, rain_source = reading.occurred, reading.source
            detail["rain"] = reading.detail

        lap, pit_source = (existing or {}).get("actual_pit_lap"), (existing or {}).get("pit_source")
        if window.session == "Race" and pit_source is None:
            stop = await outcome_sources.race_reference_stop(wk.season, wk.round)
            if stop is not None:
                lap, pit_source, pit_detail = stop
                detail["pit"] = pit_detail
            elif existing:
                continue

        await accuracy_store.upsert_outcome(
            {
                "season": wk.season,
                "round": wk.round,
                "session": window.session,
                "rain_occurred": rain_occurred,
                "actual_pit_lap": lap,
                "rain_source": rain_source,
                "pit_source": pit_source,
                "detail": detail,
                "recorded_at": now.isoformat(),
            }
        )
        written.append(window.session)
    return written


async def record_manual_outcome(outcome: OutcomeRequest, now: datetime | None = None) -> str:
    """An operator's correction — wins over whatever was resolved."""
    now = now or _now()
    wk = await weekend()
    window = wk.window(outcome.session)
    await accuracy_store.upsert_outcome(
        {
            "season": wk.season,
            "round": wk.round,
            "session": outcome.session,
            "rain_occurred": outcome.rain_occurred,
            "actual_pit_lap": outcome.actual_pit_lap,
            "rain_source": "manual",
            "pit_source": "manual" if outcome.actual_pit_lap is not None else None,
            "detail": {"notes": outcome.notes[:250]} if outcome.notes else {},
            "recorded_at": now.isoformat(),
        }
    )
    return (window.start if window else now).astimezone(outcome_sources.MYT).date().isoformat()


# ---- 3. scoring and the board ------------------------------------------------


def score_pair(prediction: dict[str, Any], outcome: dict[str, Any], *, date: str) -> list[VariantScore]:
    scores: list[VariantScore] = []
    actual = outcome.get("actual_pit_lap")
    rain = score_rain_call(float(prediction["rain_probability"]), bool(outcome["rain_occurred"]))
    for variant in ("conservative", "aggressive"):
        window = PitWindow(
            start_lap=int(prediction[f"pit_start_{variant}"]), end_lap=int(prediction[f"pit_end_{variant}"])
        )
        # Practice and qualifying have no strategy stop to score against.
        hit = score_pit_window(window, int(actual) if actual is not None else None)
        scores.append(
            VariantScore(
                variant=variant,
                predicted_confidence=float(prediction[f"confidence_{variant}"]),
                rain_call_score=rain,
                pit_window_hit=hit,
                composite_score=composite_score(rain, hit),
                date=date,
            )
        )
    return scores


def _snapshot(row: dict[str, Any]) -> PredictionSnapshot:
    return PredictionSnapshot(
        made_at=row["made_at"],
        source=row["source"],
        rain_probability=float(row["rain_probability"]),
        condition=row["condition"],
        confidence_conservative=float(row["confidence_conservative"]),
        confidence_aggressive=float(row["confidence_aggressive"]),
        pit_window_conservative=PitWindow(
            start_lap=int(row["pit_start_conservative"]), end_lap=int(row["pit_end_conservative"])
        ),
        pit_window_aggressive=PitWindow(
            start_lap=int(row["pit_start_aggressive"]), end_lap=int(row["pit_end_aggressive"])
        ),
    )


def _outcome(row: dict[str, Any]) -> SessionOutcome:
    return SessionOutcome(
        rain_occurred=bool(row["rain_occurred"]),
        actual_pit_lap=row.get("actual_pit_lap"),
        rain_source=row["rain_source"],
        pit_source=row.get("pit_source"),
        recorded_at=row["recorded_at"],
        detail=row.get("detail") or {},
    )


def _state(window: SessionWindow, has_prediction: bool, has_outcome: bool, now: datetime) -> str:
    if now < window.start:
        return "upcoming"
    if now < window.end:
        return "live"
    if not has_prediction:
        return "unscored"
    return "scored" if has_outcome else "awaiting"


async def weekend_board(now: datetime | None = None, *, resolve_now: bool = True) -> WeekendBoard:
    now = now or _now()
    if resolve_now and not supabase_rest.read_only():
        try:
            await asyncio.wait_for(resolve(now), timeout=RESOLVE_BUDGET_S)
        except Exception as exc:  # noqa: BLE001 - the board still renders from what's stored
            logger.warning("on-read outcome resolution skipped: %s", exc)
    wk = await weekend()
    predictions = {r["session"]: r for r in await accuracy_store.predictions_for_round(wk.season, wk.round)}
    outcomes = {r["session"]: r for r in await accuracy_store.outcomes_for_round(wk.season, wk.round)}

    sessions: list[SessionBoard] = []
    pending = False
    for window in wk.sessions:
        prediction = predictions.get(window.session)
        outcome = outcomes.get(window.session)
        state = _state(window, prediction is not None, outcome is not None, now)
        date = window.start.astimezone(outcome_sources.MYT).date().isoformat()
        scores = score_pair(prediction, outcome, date=date) if prediction and outcome else []
        if state in ("live", "awaiting") or _needs_work(window, outcome, now):
            pending = pending or now < window.end + PIT_LOOKUP_WINDOW
        sessions.append(
            SessionBoard(
                session=window.session,
                start=window.start.isoformat(),
                end=window.end.isoformat(),
                state=state,
                prediction=_snapshot(prediction) if prediction else None,
                outcome=_outcome(outcome) if outcome else None,
                scores=scores,
            )
        )
    upcoming_soon = any(now < w.start <= now + timedelta(minutes=30) for w in wk.sessions)
    return WeekendBoard(
        season=str(wk.season),
        round=str(wk.round),
        race_name=wk.race_name,
        generated_at=now.isoformat(),
        sessions=sessions,
        next_check_seconds=30 if pending or upcoming_soon else 300,
    )


async def season_record(session: Session) -> AccuracyResponse | None:
    """Every round's score for one session type."""
    predictions, outcomes = await accuracy_store.rows_for_session(session)
    by_round = {(o["season"], o["round"]): o for o in outcomes}
    scores: list[VariantScore] = []
    for prediction in predictions:
        outcome = by_round.get((prediction["season"], prediction["round"]))
        if outcome is not None:
            scores.extend(score_pair(prediction, outcome, date=str(outcome["recorded_at"])[:10]))
    if not scores:
        return None
    return AccuracyResponse(
        session=session,
        sample_size=len(scores) // 2,
        conservative=aggregate_scores(scores, variant="conservative"),
        aggressive=aggregate_scores(scores, variant="aggressive"),
        recent=sorted(scores, key=lambda s: s.date, reverse=True)[:10],
    )
