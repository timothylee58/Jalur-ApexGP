/**
 * Race-control logic for /drive, kept pure so it's tested
 * (timing.test.ts): the five-light start, lap and sector timing, the live
 * delta to a reference lap, and the distance traces ghosts replay.
 */

export const LIGHTS = { count: 5, firstAt: 1.0, interval: 1.0 };

/** How many red lights are lit `elapsed` seconds into the start sequence,
 * and whether they've gone out. They come on one a second, then after a
 * random hold (as in F1) all go out together — that's the start. */
export function startLights(elapsed: number, holdS: number): { lit: number; out: boolean; outAt: number } {
  const outAt = LIGHTS.firstAt + (LIGHTS.count - 1) * LIGHTS.interval + holdS;
  if (elapsed >= outAt) return { lit: 0, out: true, outAt };
  const lit = elapsed < LIGHTS.firstAt ? 0 : Math.min(LIGHTS.count, Math.floor((elapsed - LIGHTS.firstAt) / LIGHTS.interval) + 1);
  return { lit, out: false, outAt };
}

/** F1's lights-out hold is random so nobody can anticipate it. */
export function randomHold(random = Math.random): number {
  return 0.4 + random() * 1.8;
}

/** A lap as distance sampled every TRACE_DT seconds. */
export const TRACE_DT = 0.1;
export type Trace = number[];

/** Distance covered at lap time `t` along a trace (clamped to its ends). */
export function distanceAt(trace: Trace, t: number): number {
  if (trace.length === 0) return 0;
  const f = t / TRACE_DT;
  const i = Math.floor(f);
  if (i < 0) return trace[0];
  if (i >= trace.length - 1) return trace[trace.length - 1];
  return trace[i] + (trace[i + 1] - trace[i]) * (f - i);
}

/** Lap time at which a trace reached distance `s` (the trace only ever
 * moves forward, so a binary search finds it). */
export function timeAtDistance(trace: Trace, s: number): number {
  if (trace.length === 0) return 0;
  if (s <= trace[0]) return 0;
  const last = trace.length - 1;
  if (s >= trace[last]) return last * TRACE_DT;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (trace[mid] <= s) lo = mid;
    else hi = mid;
  }
  const span = trace[hi] - trace[lo] || 1e-9;
  return (lo + (s - trace[lo]) / span) * TRACE_DT;
}

/** Seconds ahead (negative) or behind (positive) the reference lap at the
 * same point on track. */
export function deltaTo(reference: Trace, t: number, s: number): number {
  return t - timeAtDistance(reference, s);
}

export function sectorOf(s: number, ends: [number, number]): 0 | 1 | 2 {
  if (s < ends[0]) return 0;
  if (s < ends[1]) return 1;
  return 2;
}

/** F1 timing-screen colours: purple for a best ever, green for a personal
 * best this session, yellow for anything slower. */
export function splitColour(time: number, bestEver: number | null, bestSession: number | null): "purple" | "green" | "yellow" {
  if (bestEver == null || time < bestEver) return "purple";
  if (bestSession == null || time < bestSession) return "green";
  return "yellow";
}

export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––.–––";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

export function formatDelta(seconds: number): string {
  const sign = seconds < 0 ? "−" : "+";
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}

/**
 * Re-time a lap solved on one centreline onto another: distances are
 * mapped piecewise-linearly between matching landmarks (the corner apexes)
 * so each corner lines up on both lines even where their overall lengths
 * differ. `from`/`to` are paired landmark distances, sorted ascending, each
 * list starting at the line (0) and ending at the lap length.
 */
export function remapDistance(s: number, from: number[], to: number[]): number {
  for (let i = 0; i < from.length - 1; i += 1) {
    if (s <= from[i + 1]) {
      const f = (s - from[i]) / (from[i + 1] - from[i] || 1);
      return to[i] + (to[i + 1] - to[i]) * f;
    }
  }
  return to[to.length - 1];
}
