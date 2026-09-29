import type { TelemetryCorner, TelemetrySample } from "@/types/telemetry";
import { distances } from "@/lib/telemetryCharts";

/**
 * Geometry for /telemetry's track map, drawn the way printed circuit
 * guides draw a track: one bold ribbon of constant width, direction
 * chevrons cut into the straights, a chequered start/finish band, and
 * corner numbers set off the track on leader lines. Pure functions, so
 * the component stays a thin renderer and this stays tested
 * (trackMap.test.ts).
 */

export interface Pt {
  x: number;
  y: number;
}

export interface Callout {
  number: number;
  /** Leader start, on the ribbon's edge at the corner. */
  from: Pt;
  /** Leader end, just short of the label. */
  to: Pt;
  /** Label centre. */
  at: Pt;
  fontSize: number;
}

export interface TrackLayout {
  width: number;
  height: number;
  /** Ribbon half-width, in viewBox units. */
  half: number;
  centreline: Pt[];
  /** Index into the lap's samples for each centreline point. */
  sampleIndex: number[];
  /** One quad per centreline segment, as SVG polygon points. */
  ribbon: string[];
  /** Chevrons cut into the straights, pointing the way the cars run. */
  chevrons: string[];
  startFinish: { x: number; y: number; angle: number };
  callouts: Callout[];
  project: (x: number, y: number) => Pt;
}

export const MAP_WIDTH = 1000;
const HALF = 10.5;

interface Options {
  /** Grows the type on narrow screens, where the viewBox shrinks it. */
  textScale?: number;
}

export function buildTrackLayout(
  samples: TelemetrySample[],
  corners: TelemetryCorner[] = [],
  { textScale = 1 }: Options = {},
): TrackLayout | null {
  const raw = samples
    .map((s, i) => ({ x: s.x, y: s.y, i }))
    .filter((p): p is { x: number; y: number; i: number } => p.x != null && p.y != null);
  if (raw.length < 20) return null;

  const pad = 64 + 30 * textScale;
  const minX = Math.min(...raw.map((p) => p.x));
  const maxX = Math.max(...raw.map((p) => p.x));
  const minY = Math.min(...raw.map((p) => p.y));
  const maxY = Math.max(...raw.map((p) => p.y));
  const scale = (MAP_WIDTH - pad * 2) / Math.max(maxX - minX, maxY - minY, 1);
  const height = Math.round((maxY - minY) * scale + pad * 2);
  const offsetX = pad + (MAP_WIDTH - pad * 2 - (maxX - minX) * scale) / 2;
  // Feed y grows "up" on the map; SVG y grows down.
  const project = (x: number, y: number): Pt => ({
    x: offsetX + (x - minX) * scale,
    y: height - pad - (y - minY) * scale,
  });

  // A light triangular smoothing takes the jitter out of the position fixes,
  // which a wide ribbon would otherwise turn into ragged edges.
  const projected = raw.map((p) => project(p.x, p.y));
  const smoothed = projected.map((_, k) => {
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (let o = -2; o <= 2; o += 1) {
      const q = projected[k + o];
      if (!q) continue;
      const w = 3 - Math.abs(o);
      sx += q.x * w;
      sy += q.y * w;
      sw += w;
    }
    return { x: sx / sw, y: sy / sw };
  });

  const centreline: Pt[] = [];
  const sampleIndex: number[] = [];
  smoothed.forEach((p, k) => {
    const last = centreline[centreline.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.75) return;
    centreline.push(p);
    sampleIndex.push(raw[k].i);
  });
  if (centreline.length < 20) return null;

  // Close the loop when the lap ends where it started (it normally does).
  const first = centreline[0];
  const last = centreline[centreline.length - 1];
  const steps = centreline.slice(1).map((p, k) => Math.hypot(p.x - centreline[k].x, p.y - centreline[k].y));
  const typicalStep = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)] || 1;
  if (Math.hypot(last.x - first.x, last.y - first.y) < typicalStep * 4) {
    centreline.push({ ...first });
    sampleIndex.push(sampleIndex[sampleIndex.length - 1]);
  }

  const path = cumulative(centreline);
  const total = path[path.length - 1];
  const at = (s: number) => pointAlong(centreline, path, s);
  const angleAt = (s: number) => {
    const a = at(s - 8);
    const b = at(s + 8);
    return Math.atan2(b.y - a.y, b.x - a.x);
  };

  const lapDist = distances(samples);

  const sfAngle = angleAt(8);
  return {
    width: MAP_WIDTH,
    height,
    half: HALF,
    centreline,
    sampleIndex,
    ribbon: ribbonQuads(centreline, HALF),
    chevrons: chevronsFor(centreline, path, total, HALF),
    startFinish: { x: first.x, y: first.y, angle: (sfAngle * 180) / Math.PI },
    callouts: placeCallouts(
      corners,
      centreline,
      path,
      sampleIndex.map((i) => lapDist[i]),
      HALF,
      {
        width: MAP_WIDTH,
        height,
        fontSize: 25 * textScale,
      },
    ),
    project,
  };
}

function cumulative(points: Pt[]): number[] {
  const out = [0];
  for (let k = 1; k < points.length; k += 1) {
    out.push(out[k - 1] + Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y));
  }
  return out;
}

function pointAlong(points: Pt[], path: number[], s: number): Pt {
  const total = path[path.length - 1];
  const target = Math.max(0, Math.min(total, s));
  let lo = 0;
  let hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid] <= target) lo = mid;
    else hi = mid;
  }
  const span = path[hi] - path[lo];
  const f = span > 0 ? (target - path[lo]) / span : 0;
  return {
    x: points[lo].x + (points[hi].x - points[lo].x) * f,
    y: points[lo].y + (points[hi].y - points[lo].y) * f,
  };
}

const fmt = (p: Pt) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

/**
 * The ribbon as one quad per segment, offset along mitred vertex normals so
 * neighbouring quads share their edges exactly: every segment can take its
 * own colour with clean, square colour boundaries — thick round-capped lines
 * would instead overlap into scalloped discs. The miter is capped so a
 * noisy fix can't spike the edge.
 */
export function ribbonQuads(points: Pt[], half: number): string[] {
  const n = points.length;
  const dirs = points.slice(1).map((p, k) => {
    const dx = p.x - points[k].x;
    const dy = p.y - points[k].y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  });
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let k = 0; k < n; k += 1) {
    const d0 = dirs[Math.max(k - 1, 0)];
    const d1 = dirs[Math.min(k, n - 2)];
    let nx = -(d0.y + d1.y);
    let ny = d0.x + d1.x;
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) {
      nx = -d1.y;
      ny = d1.x;
    } else {
      nx /= len;
      ny /= len;
    }
    const cos = Math.max(nx * -d1.y + ny * d1.x, 0.6);
    const m = half / cos;
    left.push({ x: points[k].x + nx * m, y: points[k].y + ny * m });
    right.push({ x: points[k].x - nx * m, y: points[k].y - ny * m });
  }
  return dirs.map((_, k) => `${fmt(left[k])} ${fmt(left[k + 1])} ${fmt(right[k + 1])} ${fmt(right[k])}`);
}

/** Heading change (radians) across ±window units of track at each point. */
function turning(points: Pt[], path: number[], window: number): number[] {
  const out: number[] = [];
  let j0 = 0;
  let j1 = 0;
  for (let k = 0; k < points.length; k += 1) {
    while (path[k] - path[j0] > window) j0 += 1;
    if (j1 < k) j1 = k;
    while (j1 + 1 < points.length && path[j1 + 1] - path[k] <= window) j1 += 1;
    if (j0 === k || j1 === k) {
      out.push(0);
      continue;
    }
    const a = Math.atan2(points[k].y - points[j0].y, points[k].x - points[j0].x);
    const b = Math.atan2(points[j1].y - points[k].y, points[j1].x - points[k].x);
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    out.push(Math.abs(d));
  }
  return out;
}

/**
 * A chevron on each of the longest straights, like the arrows a printed
 * circuit map cuts into its track — kept clear of the start/finish band.
 */
function chevronsFor(points: Pt[], path: number[], total: number, half: number): string[] {
  const turn = turning(points, path, 32);
  const runs: { a: number; b: number }[] = [];
  let start = -1;
  turn.forEach((t, k) => {
    const straight = t < 0.14;
    if (straight && start < 0) start = k;
    if ((!straight || k === turn.length - 1) && start >= 0) {
      runs.push({ a: path[start], b: path[straight ? k : k - 1] });
      start = -1;
    }
  });

  const placed: number[] = [];
  const keepClear = 90;
  for (const run of runs.filter((r) => r.b - r.a >= 110).sort((x, y) => y.b - y.a - (x.b - x.a))) {
    if (placed.length >= 5) break;
    const lo = Math.max(run.a + 30, keepClear);
    const hi = Math.min(run.b - 30, total - keepClear);
    if (hi <= lo) continue;
    const s = Math.max(lo, Math.min(hi, (run.a + run.b) / 2));
    if (placed.some((p) => Math.abs(p - s) < 150)) continue;
    placed.push(s);
  }

  const depth = half * 0.85;
  return placed
    .sort((a, b) => a - b)
    .map((s) => {
      const p = pointAlong(points, path, s);
      const a = pointAlong(points, path, s - 8);
      const b = pointAlong(points, path, s + 8);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const t = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      const n = { x: -t.y, y: t.x };
      const reach = half + 1.5;
      const tip = { x: p.x + (t.x * depth) / 2, y: p.y + (t.y * depth) / 2 };
      const back = { x: p.x - (t.x * depth) / 2, y: p.y - (t.y * depth) / 2 };
      return [
        { x: back.x + n.x * reach, y: back.y + n.y * reach },
        tip,
        { x: back.x - n.x * reach, y: back.y - n.y * reach },
      ]
        .map(fmt)
        .join(" ");
    });
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const boxDistance = (p: Pt, b: Box) =>
  Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.y0 - p.y, 0, p.y - b.y1));

const boxesOverlap = (a: Box, b: Box, gap: number) =>
  a.x0 - gap < b.x1 && b.x0 - gap < a.x1 && a.y0 - gap < b.y1 && b.y0 - gap < a.y1;

const DIRECTIONS = [
  { angle: -90, penalty: 0 },
  { angle: 90, penalty: 0 },
  { angle: -45, penalty: 0.7 },
  { angle: -135, penalty: 0.7 },
  { angle: 45, penalty: 0.7 },
  { angle: 135, penalty: 0.7 },
  { angle: 0, penalty: 1.1 },
  { angle: 180, penalty: 1.1 },
].map(({ angle, penalty }) => ({
  x: Math.cos((angle * Math.PI) / 180),
  y: Math.sin((angle * Math.PI) / 180),
  penalty,
}));

const LEADERS = [20, 38, 58, 80];

/**
 * Corner numbers set off the track on leader lines. Each corner tries
 * eight directions at four leader lengths; a spot must keep its label off
 * the ribbon, inside the frame, clear of labels already placed, with a
 * leader that doesn't cross the track. Among the spots that pass, vertical
 * leaders (the printed-map convention), short ones, and the outside of the
 * bend win. The most boxed-in corners choose first.
 */
export function placeCallouts(
  corners: TelemetryCorner[],
  points: Pt[],
  path: number[],
  metres: number[],
  half: number,
  frame: { width: number; height: number; fontSize: number },
): Callout[] {
  if (corners.length === 0 || points.length < 2) return [];
  const f = frame.fontSize;
  const trackClear = half + 5;

  const specs = corners.map((corner) => {
    let k = 0;
    for (let j = 1; j < metres.length; j += 1) {
      if (Math.abs(metres[j] - corner.distance) < Math.abs(metres[k] - corner.distance)) k = j;
    }
    // The inside of a bend is where the chord between the points either
    // side of it passes; labels prefer the other side.
    const before = pointAlong(points, path, path[k] - 40);
    const after = pointAlong(points, path, path[k] + 40);
    const mid = { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 };
    const ix = mid.x - points[k].x;
    const iy = mid.y - points[k].y;
    const il = Math.hypot(ix, iy);
    const outward = il > 4 ? { x: -ix / il, y: -iy / il } : { x: 0, y: 0 };
    const w = String(corner.number).length * f * 0.46 + f * 0.2;
    const h = f * 0.78;
    return { corner, apex: points[k], outward, w, h };
  });

  type Candidate = {
    from: Pt;
    to: Pt;
    at: Pt;
    box: Box;
    cost: number;
    trackHits: number;
  };
  const candidatesFor = (spec: (typeof specs)[number]): Candidate[] => {
    const out: Candidate[] = [];
    for (const dir of DIRECTIONS) {
      for (const length of LEADERS) {
        const extent =
          Math.min(
            Math.abs(dir.x) > 1e-6 ? spec.w / 2 / Math.abs(dir.x) : Infinity,
            Math.abs(dir.y) > 1e-6 ? spec.h / 2 / Math.abs(dir.y) : Infinity,
          ) + 3;
        const from = {
          x: spec.apex.x + dir.x * (half + 3),
          y: spec.apex.y + dir.y * (half + 3),
        };
        const to = { x: from.x + dir.x * length, y: from.y + dir.y * length };
        const at = { x: to.x + dir.x * extent, y: to.y + dir.y * extent };
        const box = {
          x0: at.x - spec.w / 2,
          y0: at.y - spec.h / 2,
          x1: at.x + spec.w / 2,
          y1: at.y + spec.h / 2,
        };
        let trackHits = 0;
        if (box.x0 < 6 || box.y0 < 6 || box.x1 > frame.width - 6 || box.y1 > frame.height - 6) trackHits += 1;
        for (const q of points) {
          if (boxDistance(q, box) < trackClear) {
            trackHits += 1;
            break;
          }
        }
        for (const t of [0.35, 0.7, 1]) {
          const p = {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
          };
          if (points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < half + 2)) {
            trackHits += 1;
            break;
          }
        }
        const cost = dir.penalty + length / 30 - 1.2 * (dir.x * spec.outward.x + dir.y * spec.outward.y);
        out.push({ from, to, at, box, cost, trackHits });
      }
    }
    return out;
  };

  const withCandidates = specs.map((spec) => {
    const candidates = candidatesFor(spec);
    return {
      spec,
      candidates,
      freedom: candidates.filter((c) => c.trackHits === 0).length,
    };
  });

  const placedBoxes: Box[] = [];
  const placedLeaders: Pt[][] = [];
  const result: Callout[] = [];
  for (const { spec, candidates } of [...withCandidates].sort((a, b) => a.freedom - b.freedom)) {
    let best: Candidate | null = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      let clashes = 0;
      if (placedBoxes.some((b) => boxesOverlap(b, c.box, 6))) clashes += 1;
      const leader = [0.5, 1].map((t) => ({
        x: c.from.x + (c.to.x - c.from.x) * t,
        y: c.from.y + (c.to.y - c.from.y) * t,
      }));
      if (placedBoxes.some((b) => leader.some((p) => boxDistance(p, b) < 3))) clashes += 1;
      if (placedLeaders.some((l) => l.some((p) => boxDistance(p, c.box) < 3))) clashes += 1;
      const score = c.cost + (c.trackHits + clashes) * 50;
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (!best) continue;
    placedBoxes.push(best.box);
    placedLeaders.push(
      [0.25, 0.5, 0.75].map((t) => ({
        x: best.from.x + (best.to.x - best.from.x) * t,
        y: best.from.y + (best.to.y - best.from.y) * t,
      })),
    );
    result.push({
      number: spec.corner.number,
      from: best.from,
      to: best.to,
      at: best.at,
      fontSize: f,
    });
  }
  return result.sort((a, b) => a.number - b.number);
}
