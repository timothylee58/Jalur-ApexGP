import * as THREE from "three";
import { circuitAnchorsMetres, circuitCentrelineMetres } from "@/data/sepangCircuit";
import { SEPANG_CORNER_REFERENCE } from "@/lib/lapSim";

/**
 * The /drive lap, built from the traced Sepang centreline (a point every
 * ~20 m, so real corner radii) rather than one point per corner, lifted
 * onto the surveyed elevation of its 18 named anchors so the climb to T3
 * and the drop through T11 are really there. Resampled to a fixed step so
 * everything downstream — physics, kerbs, boards, the minimap — can index
 * it by distance. Corner speeds are the same sourced table /circuit's lap
 * simulator uses (SEPANG_CORNER_REFERENCE), so the game and the sim agree
 * on what each corner allows. Tested in track.test.ts.
 */

export interface TrackPoint {
  /** Distance from the timing line, metres. */
  s: number;
  x: number;
  /** Elevation above the lowest point on the lap, metres. */
  y: number;
  z: number;
  /** Unit heading in the ground plane. */
  tx: number;
  tz: number;
  /** Signed curvature, 1/m — positive turning right (clockwise from above). */
  curvature: number;
  /** Rise over run along the lap. */
  gradient: number;
}

export interface DriveCorner {
  turn: number;
  label: string | null;
  direction: "left" | "right";
  /** Apex position, metres from the line. */
  s: number;
  apexKmh: number;
  /** Arc spent at roughly apex speed. */
  lengthM: number;
}

export interface DriveTrack {
  length: number;
  step: number;
  points: TrackPoint[];
  corners: DriveCorner[];
  /** Where sectors 1 and 2 end (the T5 and T11 apexes, as in lapSim). */
  sectorEnds: [number, number];
  /** Distance of each named anchor ("Start/Finish", "T3 Apex", …). */
  anchorS: Record<string, number>;
  /** Interpolated point at any distance (wraps). */
  at: (s: number) => TrackPoint;
  /** The speed a corner allows at `s`, km/h. */
  safeKmh: (s: number) => number;
  /** The next corner ahead of `s` and how far away its apex is. */
  nextCorner: (s: number) => { corner: DriveCorner; distance: number };
}

/** Straight-line ceiling, km/h — above anything a car reaches here. */
export const OPEN_KMH = 350;
/** How fast the allowance opens up either side of a corner's arc, km/h per metre. */
const RAMP_KMH_PER_M = 1.6;
const STEP_M = 2;
const CURVATURE_WINDOW_M = 8;

const wrap = (s: number, length: number) => ((s % length) + length) % length;

export function buildDriveTrack(): DriveTrack {
  const dense = circuitCentrelineMetres;
  const n = dense.length;

  // Elevation: each named anchor sits exactly on the traced line; spread
  // the surveyed heights between consecutive anchors by index.
  const anchorIndex = circuitAnchorsMetres.map((a) => {
    let best = 0;
    for (let i = 1; i < n; i += 1) {
      if (Math.hypot(dense[i].x - a.x, dense[i].y - a.y) < Math.hypot(dense[best].x - a.x, dense[best].y - a.y)) best = i;
    }
    return best;
  });
  const known = circuitAnchorsMetres
    .map((a, k) => ({ index: anchorIndex[k], elev: a.elevM }))
    .filter((a): a is { index: number; elev: number } => a.elev != null)
    .sort((a, b) => a.index - b.index);
  const elevation = new Array<number>(n).fill(0);
  for (let k = 0; k < known.length; k += 1) {
    const a = known[k];
    const b = known[(k + 1) % known.length];
    const span = (b.index - a.index + n) % n || n;
    for (let j = 0; j < span; j += 1) {
      elevation[(a.index + j) % n] = a.elev + ((b.elev - a.elev) * j) / span;
    }
  }
  const lowest = Math.min(...elevation);

  const curve = new THREE.CatmullRomCurve3(
    dense.map((p, i) => new THREE.Vector3(p.x, elevation[i] - lowest, p.y)),
    true,
    "centripetal",
  );
  const length = curve.getLength();
  const count = Math.round(length / STEP_M);
  const step = length / count;

  const raw = Array.from({ length: count }, (_, i) => {
    const u = i / count;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const flat = Math.hypot(t.x, t.z) || 1;
    return { s: i * step, x: p.x, y: p.y, z: p.z, tx: t.x / flat, tz: t.z / flat, gradient: t.y / flat };
  });

  // Signed curvature from the heading change across a fixed window — the
  // traced line is dense enough that this resolves real corner radii.
  const w = Math.max(1, Math.round(CURVATURE_WINDOW_M / step));
  const points: TrackPoint[] = raw.map((p, i) => {
    const a = raw[(i - w + count) % count];
    const b = raw[(i + w) % count];
    let turn = Math.atan2(b.tz, b.tx) - Math.atan2(a.tz, a.tx);
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    return { ...p, curvature: turn / (2 * w * step) };
  });

  const nearestS = (x: number, z: number) => {
    let best = points[0];
    for (const p of points) if (Math.hypot(p.x - x, p.z - z) < Math.hypot(best.x - x, best.z - z)) best = p;
    return best.s;
  };
  const anchorS: Record<string, number> = {};
  for (const a of circuitAnchorsMetres) anchorS[a.name] = nearestS(a.x, a.y);
  anchorS["Start/Finish"] = 0;

  const corners: DriveCorner[] = SEPANG_CORNER_REFERENCE.flatMap((ref) => {
    const s = anchorS[`T${ref.turn} Apex`] ?? anchorS[`T${ref.turn} Hairpin`];
    if (s == null) return [];
    return [{ turn: ref.turn, label: ref.label, direction: ref.direction, s, apexKmh: ref.apexKmh, lengthM: ref.lengthM }];
  }).sort((a, b) => a.s - b.s);

  const at = (s: number): TrackPoint => {
    const d = wrap(s, length) / step;
    const i = Math.floor(d) % count;
    const j = (i + 1) % count;
    const f = d - Math.floor(d);
    const a = points[i];
    const b = points[j];
    const tx = a.tx + (b.tx - a.tx) * f;
    const tz = a.tz + (b.tz - a.tz) * f;
    const tl = Math.hypot(tx, tz) || 1;
    return {
      s: wrap(s, length),
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      z: a.z + (b.z - a.z) * f,
      tx: tx / tl,
      tz: tz / tl,
      curvature: a.curvature + (b.curvature - a.curvature) * f,
      gradient: a.gradient + (b.gradient - a.gradient) * f,
    };
  };

  const circular = (a: number, b: number) => {
    const d = Math.abs(wrap(a, length) - wrap(b, length));
    return Math.min(d, length - d);
  };
  const safeKmh = (s: number) => {
    let limit = OPEN_KMH;
    for (const c of corners) {
      const beyond = Math.max(0, circular(s, c.s) - c.lengthM / 2);
      limit = Math.min(limit, c.apexKmh + beyond * RAMP_KMH_PER_M);
    }
    return limit;
  };
  const nextCorner = (s: number) => {
    const here = wrap(s, length);
    let best = corners[0];
    let bestD = Infinity;
    for (const c of corners) {
      const d = wrap(c.s - here, length);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return { corner: best, distance: bestD };
  };

  return {
    length,
    step,
    points,
    corners,
    sectorEnds: [anchorS["T5 Apex"], anchorS["T11 Apex"]],
    anchorS,
    at,
    safeKmh,
    nextCorner,
  };
}
