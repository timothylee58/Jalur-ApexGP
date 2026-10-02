import type { SessionBoard, SessionState, StrategyVariant, WeekendBoard } from "@/types";

const SOURCE_LABEL: Record<string, string> = {
  "openf1-track-weather": "Circuit weather station · OpenF1",
  "open-meteo-modelled": "Modelled rainfall · Open-Meteo",
  "jolpica-pitstops": "Timing sheet · Jolpica",
  manual: "Manual correction",
  scheduler: "Scheduler",
  predict: "Live read",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return SOURCE_LABEL[source] ?? source;
}

export const STATE_LABEL: Record<SessionState, string> = {
  upcoming: "Upcoming",
  live: "Live",
  awaiting: "Awaiting data",
  scored: "Scored",
  unscored: "Not scored",
};

export interface VariantSummary {
  variant: StrategyVariant;
  mean: number | null;
  rainMean: number | null;
}

/** Weekend-to-date average of each variant's composite and rain-call
 * scores, over the sessions that have been scored. */
export function weekendSummary(board: WeekendBoard): { scored: number; variants: VariantSummary[] } {
  const scored = board.sessions.filter((s) => s.scores.length > 0);
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  const variants = (["conservative", "aggressive"] as const).map((variant) => {
    const scores = scored.flatMap((s) => s.scores.filter((score) => score.variant === variant));
    return {
      variant,
      mean: mean(scores.map((score) => score.compositeScore)),
      rainMean: mean(scores.map((score) => score.rainCallScore)),
    };
  });
  return { scored: scored.length, variants };
}

function parts(iso: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))) {
    out[part.type] = part.value;
  }
  return out;
}

/** "Fri 2 Oct · 12:30–13:30 MYT", on Sepang's clock. */
export function sessionWindowLabel(session: Pick<SessionBoard, "start" | "end">): string {
  const a = parts(session.start);
  const b = parts(session.end);
  return `${a.weekday} ${a.day} ${a.month} · ${a.hour}:${a.minute}–${b.hour}:${b.minute} MYT`;
}

/** "12:24 MYT" — when a read was locked or an outcome recorded. */
export function clockLabel(iso: string): string {
  const p = parts(iso);
  return `${p.weekday} ${p.hour}:${p.minute} MYT`;
}

/** "3h 12m" / "8m" / "45s" until (or since) a moment. */
export function durationLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
