import type { Session } from "@/types";

interface ScheduledSession {
  session: Session;
  start: string;
  end: string;
}

/**
 * 2026 Sepang weekend — session starts from
 * [Jolpica/Ergast](https://api.jolpi.ca/ergast/f1/2026/circuits/sepang/races/)
 * (round 16, "Bahrain Grand Prix in Malaysia"), converted to MYT (+08).
 * End times aren't in the feed (Ergast only publishes starts), so practice
 * and Quali are treated as 60 minutes and the race as 120 — same duration
 * convention the old hand-written April stub used. Re-fetch via
 * `GET /api/schedule` if you need to confirm the upstream hasn't moved.
 */
/** Public schedule list — MYT (+08) windows for countdown, .ics, and checklist. */
export const SEPANG_2026_SESSIONS: ScheduledSession[] = [
  { session: "FP1", start: "2026-10-02T12:30:00+08:00", end: "2026-10-02T13:30:00+08:00" },
  { session: "FP2", start: "2026-10-02T16:00:00+08:00", end: "2026-10-02T17:00:00+08:00" },
  { session: "FP3", start: "2026-10-03T12:30:00+08:00", end: "2026-10-03T13:30:00+08:00" },
  { session: "Quali", start: "2026-10-03T16:00:00+08:00", end: "2026-10-03T17:00:00+08:00" },
  { session: "Race", start: "2026-10-04T15:00:00+08:00", end: "2026-10-04T17:00:00+08:00" },
];

const SEPANG_2026 = SEPANG_2026_SESSIONS;

const SESSION_ORDER: Session[] = ["FP1", "FP2", "FP3", "Quali", "Race"];

const PARK_BUFFER_MINUTES = 10;

export interface GapWindow {
  afterSession: Session;
  nextSession: Session;
  endMs: number;
  nextStartMs: number;
  budgetMinutes: number | null;
}

function slot(session: Session): ScheduledSession | undefined {
  return SEPANG_2026.find((item) => item.session === session);
}

export function getLiveOrNextSession(now = new Date()): Session {
  const ms = now.getTime();

  for (const item of SEPANG_2026) {
    const start = new Date(item.start).getTime();
    const end = new Date(item.end).getTime();
    if (ms >= start && ms <= end) return item.session;
  }

  for (const item of SEPANG_2026) {
    if (new Date(item.start).getTime() > ms) return item.session;
  }

  return "Race";
}

export interface LiveSessionWindow {
  session: Session;
  startMs: number;
  endMs: number;
}

/** Non-null only while `now` actually falls inside one of the Sepang
 * weekend windows — real, not synthesized. That weekend is a fixed
 * October 2026 date (Jolpica round 16), so this returns null for the
 * overwhelming majority of real visits (any date outside those three
 * days), same honesty tradeoff `getLiveOrNextSession`'s "Race" fallback
 * already makes. Callers should treat null as the expected default, not
 * an error case. */
export function getLiveSessionWindow(now = new Date()): LiveSessionWindow | null {
  const ms = now.getTime();
  for (const item of SEPANG_2026) {
    const startMs = new Date(item.start).getTime();
    const endMs = new Date(item.end).getTime();
    if (ms >= startMs && ms <= endMs) {
      return { session: item.session, startMs, endMs };
    }
  }
  return null;
}

export function isRaceWeekend(now = new Date()): boolean {
  const first = new Date(SEPANG_2026[0].start).getTime();
  const last = new Date(SEPANG_2026[SEPANG_2026.length - 1].end).getTime();
  const ms = now.getTime();
  return ms >= first - 86_400_000 && ms <= last + 86_400_000;
}

export function getGapWindow(afterSession: Session): GapWindow | null {
  const index = SESSION_ORDER.indexOf(afterSession);
  if (index < 0 || index >= SESSION_ORDER.length - 1) return null;

  const current = slot(afterSession);
  const nextSession = SESSION_ORDER[index + 1];
  const next = slot(nextSession);
  if (!current || !next) return null;

  const endMs = new Date(current.end).getTime();
  const nextStartMs = new Date(next.start).getTime();
  const gapMs = nextStartMs - endMs;
  const sameDay = new Date(endMs).toDateString() === new Date(nextStartMs).toDateString();
  const budgetMinutes = sameDay && gapMs > 0 ? Math.floor(gapMs / 60_000) : null;

  return {
    afterSession,
    nextSession,
    endMs,
    nextStartMs,
    budgetMinutes,
  };
}

export function getLeaveByDeadline(nextStartMs: number, driveMinutes: number): Date | null {
  const leaveMs = nextStartMs - (driveMinutes + PARK_BUFFER_MINUTES) * 60_000;
  return new Date(leaveMs);
}
