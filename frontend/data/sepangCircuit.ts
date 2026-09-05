/**
 * Static Sepang International Circuit geometry for the 2D SVG map.
 *
 * The lat/lon apex points come from the project's own Blender scene generator
 * (scripts/blender/sepang_circuit_scene.py) — the same 18-point centreline used
 * for the 3D work — projected here to a flat local plane and normalised into an
 * SVG viewBox. It is a close, honest centreline (not a laser-scanned survey),
 * matching the honesty standard the strategy simulator holds itself to.
 *
 * Corner `code` values match backend `referencedCorners`
 * (backend/app/services/strategy_service.py) and frontend/data/circuitCorners.ts
 * so the map can highlight exactly the corners the strategy reasoning names.
 */

interface RawPoint {
  name: string;
  lat: number;
  lon: number;
}

// From TRACK_POINTS in sepang_circuit_scene.py (clockwise, Start/Finish first).
const RAW_POINTS: RawPoint[] = [
  { name: "Start/Finish", lat: 2.7607, lon: 101.7383 },
  { name: "T1 Entry", lat: 2.76455, lon: 101.73975 },
  { name: "T1 Apex", lat: 2.7656, lon: 101.7402 },
  { name: "T2 Apex", lat: 2.76525, lon: 101.74085 },
  { name: "T3 Apex", lat: 2.7628, lon: 101.7427 },
  { name: "T4 Apex", lat: 2.7579, lon: 101.7431 },
  { name: "T5 Apex", lat: 2.7547, lon: 101.7404 },
  { name: "T6 Apex", lat: 2.75405, lon: 101.7388 },
  { name: "T7 Apex", lat: 2.7523, lon: 101.736 },
  { name: "T8 Apex", lat: 2.7525, lon: 101.7342 },
  { name: "T9 Apex", lat: 2.7562, lon: 101.7335 },
  { name: "T10 Apex", lat: 2.7578, lon: 101.7348 },
  { name: "T11 Apex", lat: 2.7592, lon: 101.7328 },
  { name: "T12 Apex", lat: 2.7575, lon: 101.7308 },
  { name: "T13 Apex", lat: 2.7563, lon: 101.7289 },
  { name: "T14 Apex", lat: 2.7582, lon: 101.7275 },
  { name: "Back Straight Mid", lat: 2.7618, lon: 101.7371 },
  { name: "T15 Hairpin", lat: 2.76495, lon: 101.73835 },
];

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

// Equirectangular projection to metres, then normalise into the viewBox. SVG y
// grows downward, so north (larger lat) is flipped to smaller y.
const projected: XY[] = RAW_POINTS.map((p) => ({
  x: (p.lon - LON0) * M_PER_DEG_LON,
  y: -(p.lat - LAT0) * M_PER_DEG_LAT,
}));

/**
 * Same 18-point centreline as `circuitPath`, in real metres (clockwise,
 * Start/Finish first) rather than normalised into the SVG viewBox — for
 * consumers that need actual world-space coordinates instead of a
 * ready-to-draw path string, e.g. a 3D scene's track curve.
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
  /** Matches backend referencedCorners; null for the start/finish marker. */
  code: string | null;
  label: string;
  x: number;
  y: number;
  note: string;
}

export const startFinish: XY = pointFor("Start/Finish");

// The four corners the strategy engine names, plus start/finish for orientation.
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
