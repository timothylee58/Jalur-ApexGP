/**
 * Static Sepang International Circuit geometry for the 2D SVG map and 3D
 * consumers. Points load from `data/sepang.json` — the same centreline
 * `scripts/generate_circuit_models.py` sweeps into `sepang.glb` (Orbit Sepang)
 * and CircuitFlyoverHero uses via circuitPointsMetres.
 */

import sepang from "@/data/sepang.json";

interface RawPoint {
  name: string;
  lat: number;
  lon: number;
  elevM?: number;
}

const RAW_POINTS: RawPoint[] = sepang.points.map((p) => ({
  name: p.name,
  lat: p.lat,
  lon: p.lon,
  elevM: p.elevM,
}));

const VIEW = 1000;
const PADDING = 90;

const LAT0 = RAW_POINTS[0].lat;
const LON0 = RAW_POINTS[0].lon;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

export interface XY {
  x: number;
  y: number;
}

const projected: XY[] = RAW_POINTS.map((p) => ({
  x: (p.lon - LON0) * M_PER_DEG_LON,
  y: -(p.lat - LAT0) * M_PER_DEG_LAT,
}));

/**
 * Same 18-point centreline as `circuitPath`, in real metres (clockwise,
 * Start/Finish first) — for 3D consumers that need world-space coords.
 */
export const circuitPointsMetres: readonly XY[] = projected;

const xs = projected.map((p) => p.x);
const ys = projected.map((p) => p.y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const spanX = maxX - minX || 1;
const spanY = maxY - minY || 1;
const scale = (VIEW - 2 * PADDING) / Math.max(spanX, spanY);
const offsetX = PADDING + (VIEW - 2 * PADDING - spanX * scale) / 2;
const offsetY = PADDING + (VIEW - 2 * PADDING - spanY * scale) / 2;

const points: XY[] = projected.map((p) => ({
  x: offsetX + (p.x - minX) * scale,
  y: offsetY + (p.y - minY) * scale,
}));

function pointFor(name: string): XY {
  const index = RAW_POINTS.findIndex((p) => p.name === name);
  return points[index];
}

/**
 * Public lookup by apex-point name (e.g. "T3 Apex", "Start/Finish") in the
 * same projected SVG-space coordinates as `circuitPath` — for consumers
 * that need to place something against a specific real point rather than
 * just the 4 curated `circuitMarkers` (e.g. a grandstand position, which
 * doesn't necessarily land on one of those 4 strategy-relevant corners).
 * Returns undefined for an unrecognized name rather than throwing, so a
 * typo shows up as "nothing rendered" during development, not a crash.
 */
export function pointForName(name: string): XY | undefined {
  const index = RAW_POINTS.findIndex((p) => p.name === name);
  return index === -1 ? undefined : points[index];
}

/** Center of `circuitViewBox` — the projection centers the track within
 * it by construction, so this is a reasonable "outward" reference point
 * for offsetting a label away from the track line rather than computing
 * a true centroid. */
export const circuitCenter: XY = { x: VIEW / 2, y: VIEW / 2 };

/** Catmull-Rom → cubic-bézier smoothing for a closed loop. */
function closedSmoothPath(pts: XY[]): string {
  const n = pts.length;
  const at = (i: number) => pts[((i % n) + n) % n];
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }
  return `${d}Z`;
}

export const circuitViewBox = `0 0 ${VIEW} ${VIEW}`;
export const circuitPath = closedSmoothPath(points);

export interface CircuitMarker {
  code: string | null;
  label: string;
  x: number;
  y: number;
  note: string;
}

export const startFinish: XY = pointFor("Start/Finish");

export const circuitMarkers: CircuitMarker[] = [
  {
    code: "T1",
    label: "T1",
    ...pointFor("T1 Apex"),
    note: "First braking zone off the pit straight — the wet-race box-call reference.",
  },
  {
    code: "T5–T7",
    label: "T5–7",
    ...pointFor("T6 Apex"),
    note: "The esses. Heat soak builds through here before the back straight.",
  },
  {
    code: "T9",
    label: "T9",
    ...pointFor("T9 Apex"),
    note: "Closing-radius left — the storm-call reference (box before it closes up).",
  },
  {
    code: "T15",
    label: "T15",
    ...pointFor("T15 Hairpin"),
    note: "Final hairpin onto the pit straight; out-lap traffic here costs a flying lap.",
  },
];
