import type { Session } from "@/types";

interface ScheduledSession {
  session: Session;
  /** ISO 8601 start in MYT */
  start: string;
  /** ISO 8601 end in MYT */
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

export function getLiveOrNextSession(now = new Date()): Session {
  const ms = now.getTime();

  for (const slot of SEPANG_2026) {
    const start = new Date(slot.start).getTime();
    const end = new Date(slot.end).getTime();
    if (ms >= start && ms <= end) return slot.session;
  }

  for (const slot of SEPANG_2026) {
    if (new Date(slot.start).getTime() > ms) return slot.session;
  }

  return "Race";
}

export function isRaceWeekend(now = new Date()): boolean {
  const first = new Date(SEPANG_2026[0].start).getTime();
  const last = new Date(SEPANG_2026[SEPANG_2026.length - 1].end).getTime();
  const ms = now.getTime();
  return ms >= first - 86_400_000 && ms <= last + 86_400_000;
}
