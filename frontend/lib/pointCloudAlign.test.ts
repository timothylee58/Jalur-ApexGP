import { describe, expect, test } from "vitest";
import { alignPointClouds, applyAlignment, type Xz } from "@/lib/pointCloudAlign";

/**
 * A deliberately asymmetric "loop with a tail" — like a real racing
 * circuit, a bare ellipse would be a poor test bed: an axis-aligned
 * ellipse is symmetric under X-reflection at rotation 0 (mirrorX(rotate(
 * ellipse, θ)) == rotate(ellipse, -θ) for *any* θ), so mirroring it can
 * always be reproduced by a plain rotation alone — no test built on an
 * ellipse (even with a small notch) can reliably distinguish "mirrored"
 * from "rotated the other way". The tail — a run of points extending
 * diagonally away from one specific point on the loop, matching neither
 * X- nor Z-axis symmetry — breaks that ambiguity decisively.
 */
function makeAsymmetricLoop(): Xz[] {
  const points: Xz[] = [];
  const n = 32;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    points.push({ x: Math.cos(t) * 3, z: Math.sin(t) * 1.2 });
  }
  for (let i = 0; i < 8; i++) {
    points.push({ x: 3 + i * 0.35, z: 1.8 + i * 0.25 });
  }
  return points;
}

/** A near-degenerate, highly-elongated shape (line-like) with one small
 * asymmetric feature — stresses the 180°-ambiguity case a real PCA major
 * axis has no inherent direction, and a normal-aspect-ratio shape mostly
 * sidesteps. */
function makeElongatedShape(): Xz[] {
  const points: Xz[] = [];
  for (let i = 0; i <= 40; i++) {
    points.push({ x: -5 + (i / 40) * 10, z: 0 });
  }
  // Asymmetric bump near one end only.
  points.push({ x: 4.5, z: 0.4 });
  points.push({ x: 4.7, z: 0.6 });
  return points;
}

function rotateDeg(p: Xz, deg: number): Xz {
  const theta = (deg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  // Same convention pointCloudAlign.ts's rotateXZ uses internally.
  return { x: p.x * cos + p.z * sin, z: -p.x * sin + p.z * cos };
}

/** Builds a synthetic `target` by applying a known mirror/scale/rotation/
 * translation to `source` — the ground truth `alignPointClouds` should
 * recover (up to floating-point and search-grid precision). */
function transform(source: Xz[], opts: { mirror?: boolean; scale?: number; rotationDeg?: number; offsetX?: number; offsetZ?: number }): Xz[] {
  const mirror = opts.mirror ? -1 : 1;
  const scale = opts.scale ?? 1;
  const rotationDeg = opts.rotationDeg ?? 0;
  const offsetX = opts.offsetX ?? 0;
  const offsetZ = opts.offsetZ ?? 0;
  return source.map((p) => {
    const scaled = { x: p.x * scale * mirror, z: p.z * scale };
    const rotated = rotateDeg(scaled, rotationDeg);
    return { x: rotated.x + offsetX, z: rotated.z + offsetZ };
  });
}

function dist(a: Xz, b: Xz): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe("alignPointClouds", () => {
  test.each([
    { rotationDeg: 0, mirror: false, scale: 1, offsetX: 0, offsetZ: 0 },
    { rotationDeg: 37, mirror: false, scale: 1, offsetX: 2, offsetZ: -1 },
    { rotationDeg: 145, mirror: false, scale: 1.6, offsetX: -3, offsetZ: 4 },
    { rotationDeg: 200, mirror: true, scale: 0.7, offsetX: 5, offsetZ: 5 },
    { rotationDeg: 333, mirror: true, scale: 2.2, offsetX: -1.5, offsetZ: -2.5 },
  ])(
    "recovers a known rotation=$rotationDeg° mirror=$mirror scale=$scale transform",
    ({ rotationDeg, mirror, scale, offsetX, offsetZ }) => {
      const source = makeAsymmetricLoop();
      const target = transform(source, { rotationDeg, mirror, scale, offsetX, offsetZ });

      const alignment = alignPointClouds(source, target);

      expect(alignment.mirrorX).toBe(mirror);
      expect(alignment.scale).toBeCloseTo(scale, 1);
      // The real correctness criterion: applying the found alignment to
      // `source` should land close to `target` — sidesteps angle-wraparound
      // comparison entirely (e.g. -160° vs 200° both being "correct").
      for (let i = 0; i < source.length; i += 7) {
        const mapped = applyAlignment(source[i], alignment);
        expect(dist(mapped, target[i])).toBeLessThan(0.05);
      }
      expect(alignment.error).toBeLessThan(0.05);
    },
  );

  test("resolves the 180°-rotation ambiguity on a near-degenerate elongated shape", () => {
    const source = makeElongatedShape();
    // 180° apart from a "no-op" rotation — the case a naive PCA-angle-only
    // approach is most likely to get backwards on a line-like shape.
    const target = transform(source, { rotationDeg: 180, offsetX: 1, offsetZ: -1 });

    const alignment = alignPointClouds(source, target);

    for (let i = 0; i < source.length; i += 5) {
      const mapped = applyAlignment(source[i], alignment);
      expect(dist(mapped, target[i])).toBeLessThan(0.1);
    }
  });

  test("allowMirror: false never returns a mirrored candidate, even when mirroring would fit better", () => {
    const source = makeAsymmetricLoop();
    const target = transform(source, { rotationDeg: 60, mirror: true });

    const alignment = alignPointClouds(source, target, { allowMirror: false });

    expect(alignment.mirrorX).toBe(false);
    // Forced into the wrong handedness, so this should fit noticeably
    // worse than the matching-handedness cases above — a sanity check
    // that the option actually constrains the search, not a precise bound.
    expect(alignment.error).toBeGreaterThan(0.1);
  });

  test("near-perfect alignment of identical clouds reports near-zero error", () => {
    const cloud = makeAsymmetricLoop();
    const alignment = alignPointClouds(cloud, cloud);

    expect(alignment.mirrorX).toBe(false);
    expect(alignment.scale).toBeCloseTo(1, 1);
    expect(alignment.error).toBeLessThan(0.05);
  });
});

describe("applyAlignment", () => {
  test("maps the source's local origin directly to (offsetX, offsetZ)", () => {
    const source = makeAsymmetricLoop();
    const target = transform(source, { rotationDeg: 25, scale: 1.3, offsetX: 4, offsetZ: -2 });
    const alignment = alignPointClouds(source, target);

    const mapped = applyAlignment({ x: 0, z: 0 }, alignment);
    expect(mapped.x).toBeCloseTo(alignment.offsetX, 9);
    expect(mapped.z).toBeCloseTo(alignment.offsetZ, 9);
  });
});
