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

type Rgb = { r: number; g: number; b: number };

/** Mid-gray, low-chroma — asphalt (and similar tarmac) in the Sepang scan. */
function isAsphaltRgb(c: Rgb): boolean {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const mean = (c.r + c.g + c.b) / 3;
  return mean > 40 && mean < 130 && max - min < 25;
}

/**
 * Sample a texture map at UV into an 8-bit RGB triple. Returns null when
 * the map has no drawable image yet (or canvas read fails — e.g. tainted).
 */
function sampleMapRgb(
  map: THREE.Texture,
  u: number,
  v: number,
  cache: Map<THREE.Texture, { w: number; h: number; data: Uint8ClampedArray }>,
): Rgb | null {
  let entry = cache.get(map);
  if (!entry) {
    const img = map.image as { width?: number; height?: number } | undefined;
    if (!img?.width || !img?.height) return null;
    const w = Math.min(img.width, 256);
    const h = Math.min(img.height, 256);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(img as CanvasImageSource, 0, 0, w, h);
    } catch {
      return null;
    }
    entry = { w, h, data: ctx.getImageData(0, 0, w, h).data };
    cache.set(map, entry);
  }
  const x = Math.floor((((u % 1) + 1) % 1) * (entry.w - 1));
  const y = Math.floor((1 - (((v % 1) + 1) % 1)) * (entry.h - 1));
  const i = (y * entry.w + x) * 4;
  return { r: entry.data[i], g: entry.data[i + 1], b: entry.data[i + 2] };
}

/**
 * PCA over asphalt-coloured vertices only (texture-sampled mid-gray, or
 * vertex-color gray when there is no map). Registering the ribbon against
 * this cloud — rather than every non-palm vertex — keeps buildings and
 * runoff from inflating the footprint, so the yellow centreline lands on
 * the tarmac without a large hand-tuned scale fudge.
 *
 * Falls back to {@link meshPointCloudPCA} if too few asphalt samples are
 * found (e.g. textures not decoded yet).
 */
export function meshAsphaltPointCloudPCA(
  root: THREE.Object3D,
  skipPrefix = "Palm",
  minSamples = 800,
): PlanarPCA {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const mapCache = new Map<THREE.Texture, { w: number; h: number; data: Uint8ClampedArray }>();
  const points: Array<{ x: number; z: number }> = [];

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name.startsWith(skipPrefix)) return;
    const pos = child.geometry.getAttribute("position");
    const uv = child.geometry.getAttribute("uv");
    const color = child.geometry.getAttribute("color");
    const material = child.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
    const mat = Array.isArray(material) ? material[0] : material;
    const map = mat?.map ?? null;
    // Cap per-mesh contribution so dense paddock meshes don't dominate.
    const step = Math.max(1, Math.floor(pos.count / 8000));
    for (let i = 0; i < pos.count; i += step) {
      let rgb: Rgb | null = null;
      if (map && uv) {
        rgb = sampleMapRgb(map, uv.getX(i), uv.getY(i), mapCache);
      } else if (color) {
        // glTF vertex colours may be linear float 0–1.
        const cr = color.getX(i);
        const cg = color.getY(i);
        const cb = color.getZ(i);
        rgb = {
          r: cr <= 1 ? Math.round(cr * 255) : cr,
          g: cg <= 1 ? Math.round(cg * 255) : cg,
          b: cb <= 1 ? Math.round(cb * 255) : cb,
        };
      }
      if (!rgb || !isAsphaltRgb(rgb)) continue;
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
      points.push({ x: v.x, z: v.z });
    }
  });

  if (points.length < minSamples) {
    return meshPointCloudPCA(root, skipPrefix);
  }
  return planarPCA(points);
}
