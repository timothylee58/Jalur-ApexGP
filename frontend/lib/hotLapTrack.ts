import * as THREE from "three";
import { circuitPointsMetres } from "@/data/sepangCircuit";
import type { LapSample, LapSimResult } from "@/lib/lapSim";

/**
 * Places the solved lap (lib/lapSim) into the same scene space the
 * circuit's terrain and flyover curve already live in.
 *
 * The terrain is registered against `buildFlyoverCurve`, so anything drawn
 * here has to land in exactly that curve's space or it visibly slides off
 * the track surface. Two things have to line up for that:
 *
 *   1. lapSim bakes a length normalisation (~0.87x) into its sample
 *      coordinates so the loop measures the circuit's real length. That is
 *      undone here before fitting.
 *   2. The fit is computed from `circuitPointsMetres` — the same control
 *      points buildFlyoverCurve uses — never from the lap samples. A spline
 *      overshoots the hull of its control points, so fitting to the samples
 *      produces a slightly different centre and scale, which is enough to
 *      push the racing line off the terrain by a visible margin.
 */

/** Must match circuitFlyoverTrack's TARGET_SPAN, or the two curves desync. */
const TARGET_SPAN = 6;

export interface HotLapProjection {
  /** Scene-space point for a lap sample, on the y = 0 plane. */
  toScene: (sample: Pick<LapSample, "x" | "y">) => THREE.Vector3;
  /** Scene units per real metre — for sizing markers against real distances. */
  unitsPerMetre: number;
  centre: THREE.Vector3;
  /** Half the longer axis, for camera framing. */
  radius: number;
}

export function buildHotLapProjection(lap: LapSimResult): HotLapProjection {
  // Fit from the *control points*, exactly as buildFlyoverCurve does —
  // not from the lap's own sample bounds. A spline overshoots the hull of
  // its control points, so fitting to the samples yields a slightly
  // different centre and scale, and the racing line ends up visibly
  // sliding off the terrain that was registered against the flyover curve.
  const xs = circuitPointsMetres.map((p) => p.x);
  const ys = circuitPointsMetres.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = TARGET_SPAN / span;

  // Samples carry lapSim's length normalisation baked into their
  // coordinates; undo it to get back to the unscaled metres this fit expects.
  const unscale = 1 / lap.coordScale;

  return {
    toScene: (s) =>
      new THREE.Vector3(
        (s.x * unscale - centreX) * scale,
        0,
        (s.y * unscale - centreY) * scale,
      ),
    unitsPerMetre: scale * unscale,
    centre: new THREE.Vector3(0, 0, 0),
    radius: TARGET_SPAN / 2,
  };
}

/**
 * Speed-to-colour ramp for the racing line: hot orange-red where the car is
 * slowest, through amber, to near-white at terminal speed. Reads as "heat"
 * rather than as an arbitrary palette, and keeps the slow corners — the
 * parts that actually decide a lap — as the visually loudest thing on the
 * track.
 */
export function speedColor(ramp: number): THREE.Color {
  const t = Math.min(1, Math.max(0, ramp));
  const slow = new THREE.Color(0xc23b22);
  const mid = new THREE.Color(0xf5a623);
  const fast = new THREE.Color(0xf4efe6);
  return t < 0.5
    ? slow.clone().lerp(mid, t * 2)
    : mid.clone().lerp(fast, (t - 0.5) * 2);
}

/**
 * Ribbon swept along the lap, coloured per-vertex by speed. One geometry
 * for the whole lap rather than a mesh per segment — 1200 samples would
 * otherwise mean 1200 draw calls.
 */
export function buildSpeedRibbon(
  lap: LapSimResult,
  projection: HotLapProjection,
  widthUnits: number,
): THREE.BufferGeometry {
  const { samples } = lap;
  const n = samples.length;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const range = Math.max(1, lap.topSpeedKmh - lap.minSpeedKmh);

  for (let i = 0; i < n; i += 1) {
    const cur = projection.toScene(samples[i]);
    const next = projection.toScene(samples[(i + 1) % n]);
    const tangent = next.clone().sub(cur).normalize();
    // Flat track, so the ribbon normal is just the tangent rotated 90deg
    // in the ground plane — no need for a full Frenet frame.
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);

    const left = cur.clone().addScaledVector(normal, widthUnits / 2);
    const right = cur.clone().addScaledVector(normal, -widthUnits / 2);
    positions.push(left.x, 0.012, left.z, right.x, 0.012, right.z);

    const c = speedColor((samples[i].speedKmh - lap.minSpeedKmh) / range);
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);

    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Contiguous scene-space polyline for one arc-length span of the lap. */
export function segmentPoints(
  lap: LapSimResult,
  projection: HotLapProjection,
  startS: number,
  endS: number,
  y: number,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (const sample of lap.samples) {
    const inSpan =
      startS <= endS
        ? sample.s >= startS && sample.s <= endS
        : sample.s >= startS || sample.s <= endS;
    if (inSpan) out.push(projection.toScene(sample).setY(y));
  }
  return out;
}

/**
 * Text drawn to a canvas and hung in the scene as a camera-facing sprite.
 * Cheaper and far more legible at this scale than extruded 3D text, and it
 * stays readable from any orbit angle.
 */
export function makeLabelSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const scaleFactor = 4;
  const fontSize = 28;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Sprite();

  ctx.font = `700 ${fontSize}px ui-monospace, monospace`;
  const width = Math.ceil(ctx.measureText(text).width) + 24;
  const height = fontSize + 20;
  canvas.width = width * scaleFactor;
  canvas.height = height * scaleFactor;

  const c = canvas.getContext("2d");
  if (!c) return new THREE.Sprite();
  c.scale(scaleFactor, scaleFactor);
  c.fillStyle = "rgba(10,12,14,0.82)";
  c.beginPath();
  c.roundRect(0, 0, width, height, 6);
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.stroke();
  c.font = `700 ${fontSize}px ui-monospace, monospace`;
  c.fillStyle = color;
  c.textBaseline = "middle";
  c.fillText(text, 12, height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set((width / height) * 0.17, 0.17, 1);
  return sprite;
}
