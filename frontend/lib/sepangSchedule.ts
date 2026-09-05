import type { Session } from "@/types";

interface ScheduledSession {
  session: Session;
  start: string;
  end: string;
}

/** 2026 Sepang GP weekend — hardcoded MYT, no live calendar API. */
const SEPANG_2026: ScheduledSession[] = [
  { session: "FP1", start: "2026-04-11T11:30:00+08:00", end: "2026-04-11T12:30:00+08:00" },
  { session: "FP2", start: "2026-04-11T15:00:00+08:00", end: "2026-04-11T16:00:00+08:00" },
  { session: "FP3", start: "2026-04-12T11:30:00+08:00", end: "2026-04-12T12:30:00+08:00" },
  { session: "Quali", start: "2026-04-12T15:00:00+08:00", end: "2026-04-12T16:00:00+08:00" },
  { session: "Race", start: "2026-04-13T15:00:00+08:00", end: "2026-04-13T17:00:00+08:00" },
];

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

/** Non-null only while `now` actually falls inside one of the hardcoded
 * SEPANG_2026 windows — real, not synthesized. Since that weekend is a
 * fixed April 2026 date, this returns null for the overwhelming majority of
 * real visits (any date outside those three days), same honesty tradeoff
 * `getLiveOrNextSession`'s "Race" fallback already makes. Callers should
 * treat null as the expected default, not an error case. */
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
