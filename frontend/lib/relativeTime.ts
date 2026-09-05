const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 86_400_000 },
  { unit: "month", ms: 30 * 86_400_000 },
  { unit: "week", ms: 7 * 86_400_000 },
  { unit: "day", ms: 86_400_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "3 days ago" style formatting for a past ISO date. Clamps to "just now"
 * for anything under a minute, including a future date (clock skew, or —
 * as with a couple of `data/news.ts` entries — an approximate publish date
 * that rounds ahead of `now`) rather than showing a confusing negative. */
export function formatRelativeTime(iso: string, now = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  if (diffMs < 60_000) return "just now";

  for (const { unit, ms } of UNITS) {
    const value = Math.floor(diffMs / ms);
    if (value >= 1) return formatter.format(-value, unit);
  }
  return "just now";
}
