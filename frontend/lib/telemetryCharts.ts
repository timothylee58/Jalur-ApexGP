import type { SessionLap, TelemetrySample } from "@/types/telemetry";

/**
 * Chart maths for /telemetry. Pure functions, so the charts stay thin and
 * this stays tested (telemetryCharts.test.ts).
 */

/** Metres from the line for each sample: the published channel when every
 * sample has one, otherwise integrated from speed (trapezoidal). */
export function distances(samples: TelemetrySample[]): number[] {
  if (samples.length > 0 && samples.every((s) => typeof s.distance === "number")) {
    return samples.map((s) => s.distance as number);
  }
  const out = samples.length ? [0] : [];
  for (let i = 1; i < samples.length; i += 1) {
    const dt = Math.max(samples[i].t - samples[i - 1].t, 0);
    out.push(out[i - 1] + ((samples[i].speed + samples[i - 1].speed) / 2 / 3.6) * dt);
  }
  return out;
}

/** Linear interpolation of ys at x over ascending xs (clamped at the ends). */
export function interpolate(xs: number[], ys: number[], x: number): number {
  const n = xs.length;
  if (n === 0) return 0;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  const f = span > 0 ? (x - xs[lo]) / span : 0;
  return ys[lo] + (ys[hi] - ys[lo]) * f;
}

/**
 * Time gained or lost by lap B against lap A along the lap, as seconds
 * (positive = B behind). Laps are aligned on *relative* distance, so two
 * slightly different racing lines — or an integrated distance that is a
 * percent off — don't masquerade as time. At the line the delta equals
 * the lap-time difference, which is what anchors it.
 */
export function lapDelta(
  a: TelemetrySample[],
  b: TelemetrySample[],
  points = 240,
): { rel: number; delta: number }[] {
  if (a.length < 2 || b.length < 2) return [];
  const da = distances(a);
  const db = distances(b);
  const ra = da.map((d) => d / (da[da.length - 1] || 1));
  const rb = db.map((d) => d / (db[db.length - 1] || 1));
  const ta = a.map((s) => s.t);
  const tb = b.map((s) => s.t);
  const out: { rel: number; delta: number }[] = [];
  for (let i = 0; i <= points; i += 1) {
    const rel = i / points;
    out.push({ rel, delta: interpolate(rb, tb, rel) - interpolate(ra, ta, rel) });
  }
  return out;
}

/** Colour ramp for speed on the track map: slow is warm, fast is cool —
 * the same reading TracingInsights' heatmaps use (cooler = quicker). */
const SPEED_STOPS: [number, [number, number, number]][] = [
  [0, [194, 59, 34]], // brick — heaviest braking zones
  [0.35, [245, 166, 35]], // amber
  [0.65, [244, 239, 230]], // paper
  [1, [46, 196, 182]], // teal — full speed
];

export function rampColour(fraction: number, stops = SPEED_STOPS): string {
  const f = Math.max(0, Math.min(1, fraction));
  for (let i = 1; i < stops.length; i += 1) {
    const [p1, c1] = stops[i];
    const [p0, c0] = stops[i - 1];
    if (f <= p1) {
      const k = (f - p0) / (p1 - p0 || 1);
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k));
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    }
  }
  const last = stops[stops.length - 1][1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

/** Lap-time heatmap colours: coolest for the quickest laps, warmest for the
 * slowest (pit laps, safety cars). */
const HEAT_STOPS: [number, [number, number, number]][] = [
  [0, [46, 196, 182]],
  [0.45, [244, 239, 230]],
  [0.75, [245, 166, 35]],
  [1, [194, 59, 34]],
];

export function heatColour(fraction: number): string {
  return rampColour(fraction, HEAT_STOPS);
}

/** Where `value` ranks among `sorted` (ascending), 0 = quickest, 1 = slowest.
 * Colouring by rank rather than by seconds keeps a race readable: a median
 * lap four seconds off the best (fuel, traffic, tyres) would otherwise
 * saturate the scale along with the pit laps. */
export function percentileRank(sorted: number[], value: number): number {
  if (sorted.length < 2) return 0;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo / (sorted.length - 1);
}

/**
 * Fuel-corrected lap time, TracingInsights' approximation: every kilogram
 * of fuel costs ~0.03 s a lap, a race starts with ~100 kg (a sprint ~30 kg),
 * and it burns linearly. Removes the early-race weight penalty so pace from
 * different stints compares fairly. An approximation, labelled as one.
 */
export function fuelCorrected(time: number, lap: number, totalLaps: number, startFuelKg = 100): number {
  const remaining = startFuelKg * Math.max(0, 1 - lap / Math.max(totalLaps, 1));
  return time - remaining * 0.03;
}

export interface Stint {
  stint: number;
  compound: string | null;
  firstLap: number;
  lastLap: number;
}

/** Consecutive laps on the same stint, per driver. */
export function stintsOf(laps: SessionLap[]): Stint[] {
  const sorted = [...laps].sort((x, y) => x.lap - y.lap);
  const out: Stint[] = [];
  for (const lap of sorted) {
    const current = out[out.length - 1];
    const stint = lap.stint ?? current?.stint ?? 1;
    if (current && current.stint === stint) {
      current.lastLap = lap.lap;
      current.compound ??= lap.compound;
    } else {
      out.push({ stint, compound: lap.compound, firstLap: lap.lap, lastLap: lap.lap });
    }
  }
  return out;
}

/** Final classification order from the last lap each driver completed:
 * more laps first, then better position on that lap. */
export function finishingOrder(laps: SessionLap[]): string[] {
  const last = new Map<string, SessionLap>();
  for (const lap of laps) {
    const seen = last.get(lap.driver);
    if (!seen || lap.lap > seen.lap) last.set(lap.driver, lap);
  }
  return [...last.values()]
    .sort((x, y) => y.lap - x.lap || (x.position ?? 99) - (y.position ?? 99))
    .map((lap) => lap.driver);
}

/** Pirelli sidewall colours keyed the way the timing feeds spell compounds. */
export const COMPOUND_COLOUR: Record<string, string> = {
  SOFT: "#e0301f",
  MEDIUM: "#ffd200",
  HARD: "#f4efe6",
  INTERMEDIATE: "#43b02a",
  WET: "#2f6fe0",
};

export function teamColour(hex: string | null | undefined, fallback = "#a39b8f"): string {
  return hex && /^[0-9a-f]{6}$/i.test(hex) ? `#${hex}` : fallback;
}
