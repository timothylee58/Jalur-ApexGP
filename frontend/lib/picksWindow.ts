import { SEPANG_2026_SESSIONS } from "@/lib/sepangSchedule";
import type { WeekendSchedule } from "@/types/jolpica";

/**
 * When Race-day Picks opens and locks. Picks lock at the start of
 * qualifying (the backend enforces the same instant; see
 * picks_service.get_deadline), so the page can count down to it and close
 * the form itself instead of letting a fan fill in eight answers only to
 * be told "closed" on submit.
 */
export interface PicksWindow {
  raceName: string;
  round: string;
  lockAt: Date;
  raceAt: Date;
  raceEndAt: Date;
  /** false while showing the schedule baked into the app, before (or
   * instead of) the live one from Jolpica. */
  live: boolean;
}

export type PicksPhase = "open" | "locked" | "racing" | "awaiting-result";

const MYT = "Asia/Kuala_Lumpur";

function fromSessions(
  raceName: string,
  round: string,
  sessions: { session: string; start: string; end: string }[],
  live: boolean,
): PicksWindow | null {
  const quali = sessions.find((s) => s.session === "Quali");
  const race = sessions.find((s) => s.session === "Race");
  if (!quali || !race) return null;
  const lockAt = new Date(quali.start);
  const raceAt = new Date(race.start);
  const raceEndAt = new Date(race.end);
  if ([lockAt, raceAt, raceEndAt].some((d) => Number.isNaN(d.getTime()))) return null;
  return { raceName, round, lockAt, raceAt, raceEndAt, live };
}

export const BAKED_WINDOW = fromSessions(
  "Bahrain Grand Prix in Malaysia",
  "16",
  SEPANG_2026_SESSIONS,
  false,
) as PicksWindow;

export function windowFromSchedule(schedule: WeekendSchedule): PicksWindow | null {
  return fromSessions(schedule.raceName, schedule.round, schedule.sessions, true);
}

export function picksPhase(window: PicksWindow, now: Date): PicksPhase {
  const t = now.getTime();
  if (t < window.lockAt.getTime()) return "open";
  if (t < window.raceAt.getTime()) return "locked";
  if (t < window.raceEndAt.getTime()) return "racing";
  return "awaiting-result";
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdown(from: Date, to: Date): Countdown {
  let s = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 1000));
  const days = Math.floor(s / 86400);
  s -= days * 86400;
  const hours = Math.floor(s / 3600);
  s -= hours * 3600;
  const minutes = Math.floor(s / 60);
  return { days, hours, minutes, seconds: s - minutes * 60 };
}

// Built from parts rather than a formatted string: runtimes disagree on
// the punctuation (Node's ICU gives "Sat 3 Oct", Chrome's "Sat, 3 Oct"),
// and the server-rendered text has to match the browser's exactly.
function parts(date: Date, timeZone: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).formatToParts(date)) {
    out[part.type] = part.value;
  }
  return out;
}

/** "Sat 3 Oct, 16:00 MYT" — always Sepang's own clock, whatever the
 * viewer's time zone, because that's the time the paddock runs to. */
export function formatMyt(date: Date): string {
  const p = parts(date, MYT);
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} MYT`;
}

/** The same instant on the viewer's own clock ("Sat 09:00 BST"), or null
 * when that already is Sepang's UTC+8 and repeating it would be noise. */
export function formatLocal(date: Date, timeZone?: string): string | null {
  const offset = (zone: string | undefined) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value;
  if (offset(timeZone) === offset(MYT)) return null;
  const p = parts(date, timeZone);
  return `${p.weekday} ${p.hour}:${p.minute} ${p.timeZoneName}`;
}
