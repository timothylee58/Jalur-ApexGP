import * as THREE from "three";
import { circuitPointsMetres } from "@/data/sepangCircuit";

/**
 * Closed loop through the same real apex-point centreline as the 2D map,
 * `sepang.glb`, and `circuitFlyoverTrack.ts` — but at true metre scale
 * rather than that file's TARGET_SPAN=6 rescale for its small decorative
 * scene. `/drive` needs real distances: lap time and km/h only read as
 * sensible numbers if a lap is actually a few thousand metres long.
 */
export function buildDriveCurve(): THREE.CatmullRomCurve3 {
  const points = circuitPointsMetres.map((p) => new THREE.Vector3(p.x, 0, p.y));
  return new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.5);
}

export interface CornerSpeedSample {
  /** World point at this sample, for placing corner-warning markers. */
  point: THREE.Vector3;
  safeSpeedKmh: number;
}

const MAX_SAFE_KMH = 330; // straight-line cap
const MIN_SAFE_KMH = 65; // tightest-hairpin floor
// Not a real friction-circle constant — tuned so the tightest apex on this
// 18-point apex approximation of Sepang (the final hairpin) reads in the
// 70-90 km/h band real onboard laps show there.
const GRIP_TUNING = 1150;
// Half-width, in metres, of the arc-length window used to measure how much
// the tangent rotates at each sample — see the curvature note below for
// why this has to be small and fixed, not derived from sample spacing.
const CURVATURE_WINDOW_M = 9;

/**
 * Curvature-derived "safe" cornering speed around the whole lap, sampled
 * at a fixed resolution — used both for the HUD's upcoming-corner readout
 * and for deciding whether the player's actual speed counts as an
 * off-track moment. Approximate by construction (curvature from a
 * discrete sample of a smoothed curve, not a real tyre model) — good
 * enough for "did you lift for this corner," not a physics sim.
 *
 * Measures curvature as tangent rotation across a small *fixed* arc-length
 * window (curve.getTangentAt at t ± CURVATURE_WINDOW_M), not the angle
 * between adjacent stored samples. That first approach was tried and
 * measurably broken: with only 18 real apex points ~370m apart on
 * average, adjacent-sample spacing at any usable sample count is
 * dominated by the long straight either side of a corner, so the turn
 * angle gets divided by a segment length far bigger than the actual
 * corner — every real corner except the start/finish kink came out
 * within a few km/h of the 330 straight-line cap (verified by sampling
 * the built profile, not assumed from the formula). A small fixed window
 * measures the tangent's actual rotation rate at that point on the curve
 * regardless of how far apart the stored samples are, and reproduces a
 * recognizable speed trace: ~250 km/h at the real first corner, ~85 at
 * the final hairpin, several corners still reading as flat-out because an
 * 18-point spline genuinely doesn't resolve every real corner — a real
 * limitation of this data, not of the measurement.
 */
export function buildCornerSpeedProfile(
  curve: THREE.CatmullRomCurve3,
  samples = 480,
): CornerSpeedSample[] {
  const lapLength = curve.getLength();
  const windowT = CURVATURE_WINDOW_M / lapLength;
  const profile: CornerSpeedSample[] = [];

  for (let i = 0; i < samples; i += 1) {
    const t = i / samples;
    const tA = ((t - windowT) % 1 + 1) % 1;
    const tB = (t + windowT) % 1;
    const tanA = curve.getTangentAt(tA);
    const tanB = curve.getTangentAt(tB);
    const v1 = new THREE.Vector2(tanA.x, tanA.z);
    const v2 = new THREE.Vector2(tanB.x, tanB.z);
    const turn = Math.abs(v1.angleTo(v2));
    const curvature = turn / (2 * CURVATURE_WINDOW_M);
    const radius = curvature > 1e-6 ? 1 / curvature : 1e5;
    const safeSpeedKmh = Math.min(
      MAX_SAFE_KMH,
      Math.max(MIN_SAFE_KMH, Math.sqrt(radius * GRIP_TUNING)),
    );
    profile.push({ point: curve.getPointAt(t), safeSpeedKmh });
  }
  return profile;
}

/** Safe speed at a given lap fraction (0..1, wraps), nearest-sample. */
export function safeSpeedAt(profile: CornerSpeedSample[], t: number): number {
  const wrapped = ((t % 1) + 1) % 1;
  const idx = Math.min(profile.length - 1, Math.round(wrapped * (profile.length - 1)));
  return profile[idx].safeSpeedKmh;
}
