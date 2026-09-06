import * as THREE from "three";

/**
 * 2D (X/Z) principal-component fit — used by CircuitExplorer3D.tsx to
 * register the real terrain scan against the real apex-point centreline
 * by matching each one's own major axis, rather than just auto-fitting
 * bounding boxes. Prototyped and verified in tools/r3f-sandbox before
 * porting here — see that sandbox's src/lib/pca.ts for the live-tunable
 * version this was developed against.
 */
export interface PlanarPCA {
  mean: THREE.Vector2;
  /** Angle (radians) of the major axis — only defined mod π (PCA can't
   * tell "this way" from "the opposite way" along the same line). */
  majorAngle: number;
  /** Standard deviation along the major axis — a scale-comparable "size". */
  majorStd: number;
  aspectRatio: number;
}

function fromMoments(n: number, sx: number, sz: number, cxxAccum: number, czzAccum: number, cxzAccum: number): PlanarPCA {
  const mx = sx / n;
  const mz = sz / n;
  const cxx = cxxAccum / n;
  const czz = czzAccum / n;
  const cxz = cxzAccum / n;
  const trace = cxx + czz;
  const det = cxx * czz - cxz * cxz;
  const l1 = trace / 2 + Math.sqrt(Math.max(trace * trace / 4 - det, 0));
  const l2 = trace / 2 - Math.sqrt(Math.max(trace * trace / 4 - det, 0));
  const angle = cxz !== 0 ? Math.atan2(l1 - cxx, cxz) : cxx >= czz ? 0 : Math.PI / 2;
  return {
    mean: new THREE.Vector2(mx, mz),
    majorAngle: angle,
    majorStd: Math.sqrt(l1),
    aspectRatio: Math.sqrt(l1 / Math.max(l2, 1e-9)),
  };
}

/** PCA over a flat point list (already in the plane you care about). */
export function planarPCA(points: Array<{ x: number; z: number }>): PlanarPCA {
  let sx = 0;
  let sz = 0;
  for (const p of points) {
    sx += p.x;
    sz += p.z;
  }
  const n = points.length;
  const mx = sx / n;
  const mz = sz / n;
  let cxx = 0;
  let czz = 0;
  let cxz = 0;
  for (const p of points) {
    const dx = p.x - mx;
    const dz = p.z - mz;
    cxx += dx * dx;
    czz += dz * dz;
    cxz += dx * dz;
  }
  return fromMoments(n, sx, sz, cxx, czz, cxz);
}

/**
 * PCA over every vertex of every mesh under `root` (world-space X/Z),
 * skipping any object whose name starts with `skipPrefix` — excludes the
 * procedurally-scattered palm trees, which would otherwise skew the
 * footprint's orientation/spread away from the actual track+buildings
 * layout the real apex centreline should register against.
 */
export function meshPointCloudPCA(root: THREE.Object3D, skipPrefix = "Palm"): PlanarPCA {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();

  let n = 0;
  let sx = 0;
  let sz = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name.startsWith(skipPrefix)) return;
    const pos = child.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
      sx += v.x;
      sz += v.z;
      n++;
    }
  });
  const mx = sx / n;
  const mz = sz / n;

  let cxx = 0;
  let czz = 0;
  let cxz = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name.startsWith(skipPrefix)) return;
    const pos = child.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
      const dx = v.x - mx;
      const dz = v.z - mz;
      cxx += dx * dx;
      czz += dz * dz;
      cxz += dx * dz;
    }
  });
  return fromMoments(n, sx, sz, cxx, czz, cxz);
}
