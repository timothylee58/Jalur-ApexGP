import * as THREE from "three";
import sepang from "../data/sepang.json";

/**
 * Ported from frontend/lib/circuitFlyoverTrack.ts + the projection step in
 * frontend/data/sepangCircuit.ts (kept out of this sandbox's own
 * dependency graph, so no `@/` path aliases to wire up) — same real
 * apex-point centreline `CircuitExplorer3D.tsx` and `CircuitModelPreview.tsx`
 * build against, via the symlinked src/data/sepang.json. If the production
 * projection logic ever changes, re-port it here too.
 */

interface RawPoint {
  name: string;
  lat: number;
  lon: number;
  elevM?: number;
}

const RAW_POINTS: RawPoint[] = sepang.points;

const LAT0 = RAW_POINTS[0].lat;
const LON0 = RAW_POINTS[0].lon;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

export interface XY {
  x: number;
  y: number;
}

/** Real apex centreline in metres (clockwise, Start/Finish first). */
export const circuitPointsMetres: readonly XY[] = RAW_POINTS.map((p) => ({
  x: (p.lon - LON0) * M_PER_DEG_LON,
  y: -(p.lat - LAT0) * M_PER_DEG_LAT,
}));

const TARGET_SPAN = 6; // same rough scale CircuitExplorer3D/CircuitFlyoverHero use

function buildScenePoints(): THREE.Vector3[] {
  const xs = circuitPointsMetres.map((p) => p.x);
  const ys = circuitPointsMetres.map((p) => p.y);
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const scale = TARGET_SPAN / span;
  return circuitPointsMetres.map(
    (p) => new THREE.Vector3((p.x - centerX) * scale, 0, (p.y - centerY) * scale),
  );
}

/** Closed Catmull-Rom loop through the real apex centreline, lying flat on y=0. */
export function buildFlyoverCurve(): THREE.CatmullRomCurve3 {
  return new THREE.CatmullRomCurve3(buildScenePoints(), true, "catmullrom", 0.5);
}

export interface TrackRibbon {
  geometry: THREE.BufferGeometry;
}

/** Sweeps a flat ribbon of the given width along the curve. */
export function buildFlyoverRibbon(
  curve: THREE.CatmullRomCurve3,
  width: number,
  segments = 240,
): TrackRibbon {
  const samples = curve.getSpacedPoints(segments);
  const tangents = samples.map((_, i) => curve.getTangentAt(i / (samples.length - 1)));

  const positions: number[] = [];
  const indices: number[] = [];
  samples.forEach((point, i) => {
    const tangent = tangents[i];
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const left = point.clone().addScaledVector(normal, width / 2);
    const right = point.clone().addScaledVector(normal, -width / 2);
    positions.push(left.x, left.y + 0.01, left.z, right.x, right.y + 0.01, right.z);
    if (i < samples.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const last = (samples.length - 1) * 2;
  indices.push(last, last + 1, 0, last + 1, 1, 0);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry };
}
