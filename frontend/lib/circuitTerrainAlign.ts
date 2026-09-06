import * as THREE from "three";
import type { PlanarPCA } from "@/lib/pca";

type Xz = { x: number; z: number };

type Rgb = { r: number; g: number; b: number };

/** Mid-gray, low-chroma tarmac in the Sepang photogrammetry scan. */
function isAsphaltRgb(c: Rgb): boolean {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const mean = (c.r + c.g + c.b) / 3;
  return mean > 35 && mean < 135 && max - min < 28;
}

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
 * World-space X/Z samples of asphalt-coloured terrain vertices (texture-
 * sampled mid-gray). Used to nudge the terrain root so the yellow ribbon
 * sits on tarmac rather than on grass.
 */
export function sampleTerrainAsphaltXZ(
  terrain: THREE.Object3D,
  skipPrefix = "Palm",
): Xz[] {
  terrain.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const mapCache = new Map<THREE.Texture, { w: number; h: number; data: Uint8ClampedArray }>();
  const points: Xz[] = [];

  terrain.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name.startsWith(skipPrefix)) return;
    const pos = child.geometry.getAttribute("position");
    const uv = child.geometry.getAttribute("uv");
    if (!uv) return;
    const material = child.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
    const mat = Array.isArray(material) ? material[0] : material;
    if (!mat?.map) return;
    child.updateMatrixWorld(true);
    const step = Math.max(1, Math.floor(pos.count / 6000));
    for (let i = 0; i < pos.count; i += step) {
      const rgb = sampleMapRgb(mat.map!, uv.getX(i), uv.getY(i), mapCache);
      if (!rgb || !isAsphaltRgb(rgb)) continue;
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
      points.push({ x: v.x, z: v.z });
    }
  });

  return points;
}

function nearestAsphalt(asphalt: Xz[], query: Xz, cell = 0.07): Xz | null {
  const grid = new Map<string, Xz[]>();
  const key = (ix: number, iz: number) => `${ix},${iz}`;
  for (const p of asphalt) {
    const ix = Math.floor(p.x / cell);
    const iz = Math.floor(p.z / cell);
    const k = key(ix, iz);
    const bucket = grid.get(k);
    if (bucket) bucket.push(p);
    else grid.set(k, [p]);
  }

  const ix = Math.floor(query.x / cell);
  const iz = Math.floor(query.z / cell);
  let best = Infinity;
  let hit: Xz | null = null;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const bucket = grid.get(key(ix + dx, iz + dz));
      if (!bucket) continue;
      for (const p of bucket) {
        const d = (query.x - p.x) ** 2 + (query.z - p.z) ** 2;
        if (d < best) {
          best = d;
          hit = p;
        }
      }
    }
  }
  return hit;
}

/** Mean world-space distance from each ribbon sample to nearest asphalt vertex. */
export function meanRibbonToAsphaltDistance(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
): number {
  const asphalt = sampleTerrainAsphaltXZ(terrain);
  if (asphalt.length < 200) return Infinity;

  let total = 0;
  let n = 0;
  for (const ribbon of ribbonSamples) {
    const hit = nearestAsphalt(asphalt, ribbon);
    if (!hit) continue;
    total += Math.hypot(ribbon.x - hit.x, ribbon.z - hit.z);
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

/**
 * One-shot shift: align asphalt centroid to ribbon centroid after rotation
 * and scale. Full-mesh PCA centroid matching leaves a large parallel offset
 * because buildings/runoff pull the mesh mean away from the tarmac loop.
 */
export function alignAsphaltCentroidToRibbon(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
): { offsetX: number; offsetZ: number } {
  const asphalt = sampleTerrainAsphaltXZ(terrain);
  if (asphalt.length < 200) return { offsetX: 0, offsetZ: 0 };

  let ax = 0;
  let az = 0;
  for (const p of asphalt) {
    ax += p.x;
    az += p.z;
  }
  ax /= asphalt.length;
  az /= asphalt.length;

  let rx = 0;
  let rz = 0;
  for (const p of ribbonSamples) {
    rx += p.x;
    rz += p.z;
  }
  rx /= ribbonSamples.length;
  rz /= ribbonSamples.length;

  const ox = rx - ax;
  const oz = rz - az;
  terrain.position.x += ox;
  terrain.position.z += oz;
  terrain.updateMatrixWorld(true);
  return { offsetX: ox, offsetZ: oz };
}

/**
 * After PCA + sandbox rotation/scale place the terrain, centroid matching
 * still leaves a parallel offset (ribbon vs asphalt). Iterative
 * "move terrain by mean(ribbon − nearest asphalt)" pulls the scan onto the
 * fixed yellow centreline without hand-tuned offset knobs.
 */
export function refineTerrainTranslationToRibbon(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
  iterations = 5,
): { offsetX: number; offsetZ: number } {
  let totalX = 0;
  let totalZ = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const asphalt = sampleTerrainAsphaltXZ(terrain);
    if (asphalt.length < 200) break;

    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const ribbon of ribbonSamples) {
      const hit = nearestAsphalt(asphalt, ribbon);
      if (!hit) continue;
      sx += ribbon.x - hit.x;
      sz += ribbon.z - hit.z;
      n++;
    }
    if (n < ribbonSamples.length * 0.5) break;

    const ox = sx / n;
    const oz = sz / n;
    if (Math.abs(ox) < 1e-4 && Math.abs(oz) < 1e-4) break;

    terrain.position.x += ox;
    terrain.position.z += oz;
    terrain.updateMatrixWorld(true);
    totalX += ox;
    totalZ += oz;
  }

  return { offsetX: totalX, offsetZ: totalZ };
}

export interface TerrainRegistrationKnobs {
  rotationRad: number;
  scaleMultiplier: number;
  mirrorX: boolean;
}

export interface TerrainRegistrationContext {
  terrainPCA: PlanarPCA;
  ribbonPCA: PlanarPCA;
  groundY: number;
}

/** Asphalt vertices in terrain-local space (sampled once before any transform). */
export interface LocalAsphaltCloud {
  points: Xz[];
}

export function buildLocalAsphaltCloud(terrain: THREE.Object3D): LocalAsphaltCloud {
  resetTerrainTransform(terrain);
  const world = sampleTerrainAsphaltXZ(terrain);
  return { points: world.map((p) => ({ x: p.x, z: p.z })) };
}

function transformLocalAsphalt(
  local: LocalAsphaltCloud,
  knobs: TerrainRegistrationKnobs,
  ctx: TerrainRegistrationContext,
): Xz[] {
  const scale = (ctx.ribbonPCA.majorStd / ctx.terrainPCA.majorStd) * knobs.scaleMultiplier;
  const mirror = knobs.mirrorX ? -1 : 1;
  const cos = Math.cos(knobs.rotationRad);
  const sin = Math.sin(knobs.rotationRad);
  const tx =
    ctx.ribbonPCA.mean.x -
    (ctx.terrainPCA.mean.x * scale * mirror * cos - ctx.terrainPCA.mean.y * scale * sin);
  const tz =
    ctx.ribbonPCA.mean.y -
    (ctx.terrainPCA.mean.x * scale * mirror * sin + ctx.terrainPCA.mean.y * scale * cos);

  return local.points.map((p) => {
    const sx = p.x * scale * mirror;
    const sz = p.z * scale;
    return {
      x: sx * cos - sz * sin + tx,
      z: sx * sin + sz * cos + tz,
    };
  });
}

function meanRibbonToAsphaltCloud(ribbonSamples: Xz[], asphalt: Xz[]): number {
  if (asphalt.length < 200) return Infinity;
  let total = 0;
  let n = 0;
  for (const ribbon of ribbonSamples) {
    const hit = nearestAsphalt(asphalt, ribbon);
    if (!hit) continue;
    total += Math.hypot(ribbon.x - hit.x, ribbon.z - hit.z);
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

function refineTranslationOnCloud(
  ribbonSamples: Xz[],
  asphalt: Xz[],
  iterations = 5,
): Xz[] {
  const shifted = asphalt.map((p) => ({ x: p.x, z: p.z }));
  for (let iter = 0; iter < iterations; iter++) {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const ribbon of ribbonSamples) {
      const hit = nearestAsphalt(shifted, ribbon);
      if (!hit) continue;
      sx += ribbon.x - hit.x;
      sz += ribbon.z - hit.z;
      n++;
    }
    if (n < ribbonSamples.length * 0.5) break;
    const ox = sx / n;
    const oz = sz / n;
    if (Math.abs(ox) < 1e-4 && Math.abs(oz) < 1e-4) break;
    for (const p of shifted) {
      p.x += ox;
      p.z += oz;
    }
  }
  return shifted;
}

function alignCentroidOnCloud(ribbonSamples: Xz[], asphalt: Xz[]): void {
  let ax = 0;
  let az = 0;
  for (const p of asphalt) {
    ax += p.x;
    az += p.z;
  }
  ax /= asphalt.length;
  az /= asphalt.length;
  let rx = 0;
  let rz = 0;
  for (const p of ribbonSamples) {
    rx += p.x;
    rz += p.z;
  }
  rx /= ribbonSamples.length;
  rz /= ribbonSamples.length;
  const ox = rx - ax;
  const oz = rz - az;
  for (const p of asphalt) {
    p.x += ox;
    p.z += oz;
  }
}

function scoreRegistration(
  ribbonSamples: Xz[],
  localAsphalt: LocalAsphaltCloud,
  ctx: TerrainRegistrationContext,
  knobs: TerrainRegistrationKnobs,
): number {
  const asphalt = transformLocalAsphalt(localAsphalt, knobs, ctx);
  alignCentroidOnCloud(ribbonSamples, asphalt);
  const refined = refineTranslationOnCloud(ribbonSamples, asphalt);
  return meanRibbonToAsphaltCloud(ribbonSamples, refined);
}

function resetTerrainTransform(terrain: THREE.Object3D): void {
  terrain.scale.set(1, 1, 1);
  terrain.rotation.set(0, 0, 0);
  terrain.position.set(0, 0, 0);
  terrain.updateMatrixWorld(true);
}

function computeTranslationRefinement(
  ribbonSamples: Xz[],
  localAsphalt: LocalAsphaltCloud,
  knobs: TerrainRegistrationKnobs,
  ctx: TerrainRegistrationContext,
): { offsetX: number; offsetZ: number; error: number } {
  const asphalt = transformLocalAsphalt(localAsphalt, knobs, ctx);

  let ax = 0;
  let az = 0;
  for (const p of asphalt) {
    ax += p.x;
    az += p.z;
  }
  ax /= asphalt.length;
  az /= asphalt.length;
  let rx = 0;
  let rz = 0;
  for (const p of ribbonSamples) {
    rx += p.x;
    rz += p.z;
  }
  rx /= ribbonSamples.length;
  rz /= ribbonSamples.length;
  let totalX = rx - ax;
  let totalZ = rz - az;
  for (const p of asphalt) {
    p.x += totalX;
    p.z += totalZ;
  }

  for (let iter = 0; iter < 5; iter++) {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const ribbon of ribbonSamples) {
      const hit = nearestAsphalt(asphalt, ribbon);
      if (!hit) continue;
      sx += ribbon.x - hit.x;
      sz += ribbon.z - hit.z;
      n++;
    }
    if (n < ribbonSamples.length * 0.5) break;
    const ox = sx / n;
    const oz = sz / n;
    if (Math.abs(ox) < 1e-4 && Math.abs(oz) < 1e-4) break;
    for (const p of asphalt) {
      p.x += ox;
      p.z += oz;
    }
    totalX += ox;
    totalZ += oz;
  }

  return {
    offsetX: totalX,
    offsetZ: totalZ,
    error: meanRibbonToAsphaltCloud(ribbonSamples, asphalt),
  };
}

/** Apply PCA similarity transform + asphalt-centroid shift + ICP refinement. */
export function applyTerrainRegistration(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
  ctx: TerrainRegistrationContext,
  knobs: TerrainRegistrationKnobs,
): number {
  resetTerrainTransform(terrain);

  const scale = (ctx.ribbonPCA.majorStd / ctx.terrainPCA.majorStd) * knobs.scaleMultiplier;
  const mirror = knobs.mirrorX ? -1 : 1;
  const rotMat = new THREE.Matrix4().makeRotationY(knobs.rotationRad);
  const scaledMean = new THREE.Vector3(
    ctx.terrainPCA.mean.x * scale * mirror,
    0,
    ctx.terrainPCA.mean.y * scale,
  ).applyMatrix4(rotMat);

  terrain.scale.set(scale * mirror, scale, scale);
  terrain.rotation.y = knobs.rotationRad;
  terrain.position.set(
    ctx.ribbonPCA.mean.x - scaledMean.x,
    -0.05 - ctx.groundY * scale,
    ctx.ribbonPCA.mean.y - scaledMean.z,
  );
  terrain.updateMatrixWorld(true);

  const localAsphalt = buildLocalAsphaltCloud(terrain);
  const { offsetX, offsetZ, error } = computeTranslationRefinement(
    ribbonSamples,
    localAsphalt,
    knobs,
    ctx,
  );
  terrain.position.x += offsetX;
  terrain.position.z += offsetZ;
  terrain.updateMatrixWorld(true);

  return error;
}

/**
 * Coarse grid search around sandbox seed knobs (rotation, scale, mirror).
 * Runs once at terrain load — ~40 candidates — to pick the pose that
 * minimises ribbon→asphalt distance after automatic translation refinement.
 */
export function searchTerrainRegistration(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
  ctx: TerrainRegistrationContext,
  seed: TerrainRegistrationKnobs,
): TerrainRegistrationKnobs & { error: number } {
  const localAsphalt = buildLocalAsphaltCloud(terrain);
  const rotStep = (2.5 * Math.PI) / 180;
  const rotSpan = (10 * Math.PI) / 180;
  const scaleFactors = [0.88, 0.94, 1, 1.06, 1.12];

  let best: TerrainRegistrationKnobs & { error: number } = {
    ...seed,
    error: Infinity,
  };

  for (const mirrorX of [false, true] as const) {
    for (let rot = seed.rotationRad - rotSpan; rot <= seed.rotationRad + rotSpan; rot += rotStep) {
      for (const sf of scaleFactors) {
        const knobs: TerrainRegistrationKnobs = {
          rotationRad: rot,
          scaleMultiplier: seed.scaleMultiplier * sf,
          mirrorX,
        };
        const error = scoreRegistration(ribbonSamples, localAsphalt, ctx, knobs);
        if (error < best.error) {
          best = { ...knobs, error };
        }
      }
    }
  }

  applyTerrainRegistration(terrain, ribbonSamples, ctx, best);
  return best;
}
