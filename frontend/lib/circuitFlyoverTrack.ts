import * as THREE from "three";
import { circuitPointsMetres } from "@/data/sepangCircuit";

/**
 * 3D track curve built from the same real apex-point centreline as the 2D
 * map and `sepang.glb` — shared by the landing page's opt-in flyover
 * (components/hero/CircuitFlyoverHero.tsx) and CircuitExplorer3D.tsx's
 * corner-by-corner explorer, whose hotspot `t` values (data/circuitCorners.ts)
 * are calibrated against this exact curve via `getPoint` (raw parameter,
 * matching each corner's index among sepang.json's 18 points) — see that
 * file's doc comment.
 */

const TARGET_SPAN = 6; // scene units the longer axis should span, same rough scale CircuitExplorer3D uses

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

export interface GrandstandSpec {
  /** Fraction along the curve, 0..1. */
  t: number;
  /** Which side of the track to sit on. */
  side: 1 | -1;
  color: number;
}

// Positioned as fractions along the curve rather than fixed world
// coordinates, so they stay sensible regardless of the curve's actual shape
// (unlike CircuitExplorer3D's grandstands, hand-placed against its own
// traced points).
export const FLYOVER_GRANDSTANDS: GrandstandSpec[] = [
  { t: 0.0, side: 1, color: 0xf5a623 }, // start/finish
  { t: 0.12, side: -1, color: 0xf5a623 },
  { t: 0.3, side: 1, color: 0x2ec4b6 },
  { t: 0.5, side: -1, color: 0x2ec4b6 },
  { t: 0.68, side: 1, color: 0xa39b8f },
  { t: 0.85, side: -1, color: 0xa39b8f },
];

/** World position for a GrandstandSpec, offset to one side of the curve. */
export function grandstandPosition(
  curve: THREE.CatmullRomCurve3,
  spec: GrandstandSpec,
  offset: number,
): THREE.Vector3 {
  const point = curve.getPointAt(spec.t);
  const tangent = curve.getTangentAt(spec.t);
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return point.clone().addScaledVector(normal, spec.side * offset);
}
