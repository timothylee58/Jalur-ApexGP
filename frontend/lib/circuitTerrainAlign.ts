import * as THREE from "three";
import { sampleAsphaltPoints, type PlanarPCA } from "@/lib/pca";

/**
 * Computes the terrain's similarity transform (rotation + mirror + scale +
 * translation) against the real apex-point ribbon, by actually searching
 * for and scoring candidates rather than trusting a hand-tuned pose baked
 * in once and never re-derived. See {@link registerTerrain}'s doc comment
 * for why a search is needed at all (PCA alone can't resolve rotation or
 * handedness) and how it stays fast enough to run live at terrain-load
 * time without giving up full point-cloud density or full candidate
 * coverage — an earlier version of this search tried subsampling the
 * point cloud for speed and it measurably changed which pose won, so the
 * actual fix was making full-density scoring itself cheap (see below),
 * not scoring less data.
 *
 * Internals use flat typed arrays and integer-keyed grid buckets rather
 * than arrays of {x,z} objects and string-keyed maps, and each candidate
 * builds its spatial index exactly once (see icpTranslate's comment) —
 * profiling an object/string-keyed, per-iteration-rebuilding version of
 * this file showed allocation, string hashing, and redundant grid rebuilds
 * dominated its cost, not the actual distance math: ~100 candidates ×
 * full point-cloud density was several seconds with that version, and is
 * a few hundred milliseconds with this one.
 */

type Xz = { x: number; z: number };

/** Flat, mutable point cloud — avoids allocating a {x,z} object per point
 * per candidate, which is what made the object-based version of this
 * search slow at full density. */
interface Cloud {
  x: Float64Array;
  z: Float64Array;
  length: number;
}

function toCloud(points: Xz[]): Cloud {
  const x = new Float64Array(points.length);
  const z = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    x[i] = points[i].x;
    z[i] = points[i].z;
  }
  return { x, z, length: points.length };
}

function cloneCloud(c: Cloud): Cloud {
  return { x: c.x.slice(), z: c.z.slice(), length: c.length };
}

// ---- fast nearest-neighbour lookup -----------------------------------

const GRID_CELL = 0.07;
// Packs (ix, iz) into one integer key for a numeric-keyed Map — string
// template keys (`${ix},${iz}`) were a real cost at this call volume.
// Safe for any cell index this app's scene scale could produce (well
// under ±50,000 cells from center) without colliding.
const GRID_KEY_SPAN = 100000;

function gridKey(ix: number, iz: number): number {
  return ix * GRID_KEY_SPAN + iz;
}

/** Bucket a cloud's point *indices* into a uniform grid once, so a batch
 * of nearest-point queries against the same cloud doesn't re-bucket it
 * per query. */
function buildGrid(cloud: Cloud): Map<number, number[]> {
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < cloud.length; i++) {
    const key = gridKey(Math.floor(cloud.x[i] / GRID_CELL), Math.floor(cloud.z[i] / GRID_CELL));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  return buckets;
}

/** Index of the nearest point in `cloud` to (qx, qz), or -1 if the 7×7
 * cell neighbourhood around the query is empty. */
function queryNearest(grid: Map<number, number[]>, cloud: Cloud, qx: number, qz: number): number {
  const cx = Math.floor(qx / GRID_CELL);
  const cz = Math.floor(qz / GRID_CELL);
  let best = Infinity;
  let hit = -1;
  for (let dx = -3; dx <= 3; dx++) {
    for (let dz = -3; dz <= 3; dz++) {
      const bucket = grid.get(gridKey(cx + dx, cz + dz));
      if (!bucket) continue;
      for (const i of bucket) {
        const ddx = qx - cloud.x[i];
        const ddz = qz - cloud.z[i];
        const d = ddx * ddx + ddz * ddz;
        if (d < best) {
          best = d;
          hit = i;
        }
      }
    }
  }
  return hit;
}

function centroidOf(cloud: Cloud): Xz {
  let sx = 0;
  let sz = 0;
  for (let i = 0; i < cloud.length; i++) {
    sx += cloud.x[i];
    sz += cloud.z[i];
  }
  return { x: sx / cloud.length, z: sz / cloud.length };
}

/** Mean ribbon-to-nearest-target distance, as if `target` were additionally
 * shifted by (offsetX, offsetZ) — without needing to move `target` or
 * rebuild `grid`. Shifting the query by the negation instead is an exact
 * equivalent (nearest-neighbour relationships are translation-invariant),
 * and is what lets {@link icpTranslate} below reuse one grid across all
 * its iterations instead of rebuilding it every time the cloud moves. */
function meanNearestDistance(
  ribbon: Cloud,
  target: Cloud,
  grid: Map<number, number[]>,
  offsetX = 0,
  offsetZ = 0,
): number {
  let total = 0;
  let n = 0;
  for (let i = 0; i < ribbon.length; i++) {
    const hit = queryNearest(grid, target, ribbon.x[i] - offsetX, ribbon.z[i] - offsetZ);
    if (hit < 0) continue;
    total += Math.hypot(ribbon.x[i] - (target.x[hit] + offsetX), ribbon.z[i] - (target.z[hit] + offsetZ));
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

/**
 * ICP-style translation refinement: repeatedly nudge a running (offsetX,
 * offsetZ) by the mean vector from each ribbon point to its current
 * nearest point in `cloud`, until that mean vector settles near zero.
 * This is what removes the need for a hand-tuned offset constant —
 * whatever residual translation the similarity transform leaves behind,
 * this walks it out against the real geometry.
 *
 * `cloud` and `grid` are never modified or rebuilt — an earlier version
 * physically translated the cloud each iteration and rebuilt its spatial
 * index from scratch every time, which was the single largest cost in
 * this whole search (a grid rebuild per iteration × 5 iterations × ~100
 * candidates). Shifting the *query* by the running offset instead (see
 * {@link meanNearestDistance}) is mathematically equivalent and needs the
 * grid built exactly once per candidate.
 */
function icpTranslate(
  ribbon: Cloud,
  cloud: Cloud,
  grid: Map<number, number[]>,
  iterations = 5,
): { offsetX: number; offsetZ: number } {
  let offsetX = 0;
  let offsetZ = 0;
  for (let iter = 0; iter < iterations; iter++) {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (let i = 0; i < ribbon.length; i++) {
      const hit = queryNearest(grid, cloud, ribbon.x[i] - offsetX, ribbon.z[i] - offsetZ);
      if (hit < 0) continue;
      sx += ribbon.x[i] - (cloud.x[hit] + offsetX);
      sz += ribbon.z[i] - (cloud.z[hit] + offsetZ);
      n++;
    }
    if (n < ribbon.length * 0.5) break;
    const ox = sx / n;
    const oz = sz / n;
    if (Math.abs(ox) < 1e-4 && Math.abs(oz) < 1e-4) break;
    offsetX += ox;
    offsetZ += oz;
  }
  return { offsetX, offsetZ };
}

// ---- similarity transform ----------------------------------------------

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

export interface TerrainPose {
  scale: number;
  rotationRad: number;
  mirrorX: boolean;
  position: { x: number; y: number; z: number };
  /** Mean ribbon-sample-to-nearest-asphalt-vertex distance at this pose —
   * lower is a tighter fit. Logged by the caller so the fit quality is
   * inspectable, not just trusted. */
  error: number;
}

/** Rotation matching THREE's `object3D.rotation.y = theta` convention
 * (equivalent to `Matrix4.makeRotationY`) — used for both scoring
 * candidates and applying the winning one, so the two can never disagree.
 * An earlier version of this file scored candidates with one rotation
 * sign and applied the winner with the opposite one. */
function rotateXZ(x: number, z: number, theta: number): Xz {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

function scaleFor(knobs: TerrainRegistrationKnobs, ctx: TerrainRegistrationContext): number {
  return (ctx.ribbonPCA.majorStd / ctx.terrainPCA.majorStd) * knobs.scaleMultiplier;
}

/** Transforms `local` (terrain-local space) into `out` (world-space, for
 * one candidate pose) in place — `out` must be pre-sized to match `local`. */
function transformInto(local: Cloud, out: Cloud, knobs: TerrainRegistrationKnobs, ctx: TerrainRegistrationContext): void {
  const scale = scaleFor(knobs, ctx);
  const mirror = knobs.mirrorX ? -1 : 1;
  const cos = Math.cos(knobs.rotationRad);
  const sin = Math.sin(knobs.rotationRad);
  for (let i = 0; i < local.length; i++) {
    const sx = local.x[i] * scale * mirror;
    const sz = local.z[i] * scale;
    out.x[i] = sx * cos + sz * sin;
    out.z[i] = -sx * sin + sz * cos;
  }
}

/**
 * Scores one candidate pose against the real geometry: transform → align
 * centroids → build one spatial index → ICP-refine translation against it
 * → mean residual distance. Returns the full translation (centring + ICP)
 * so the winner's offset doesn't need recomputing.
 */
function scoreCandidate(
  ribbon: Cloud,
  ribbonCentre: Xz,
  local: Cloud,
  scratch: Cloud,
  ctx: TerrainRegistrationContext,
  knobs: TerrainRegistrationKnobs,
): { offsetX: number; offsetZ: number; error: number } {
  transformInto(local, scratch, knobs, ctx);
  const asphaltCentre = centroidOf(scratch);
  const centringX = ribbonCentre.x - asphaltCentre.x;
  const centringZ = ribbonCentre.z - asphaltCentre.z;
  for (let i = 0; i < scratch.length; i++) {
    scratch.x[i] += centringX;
    scratch.z[i] += centringZ;
  }

  const grid = buildGrid(scratch);
  const icp = icpTranslate(ribbon, scratch, grid);
  const error = meanNearestDistance(ribbon, scratch, grid, icp.offsetX, icp.offsetZ);
  return { offsetX: centringX + icp.offsetX, offsetZ: centringZ + icp.offsetZ, error };
}

/**
 * Computes and applies the terrain's registration against the real
 * apex-point ribbon by searching for it, not by trusting a baked pose.
 *
 * PCA (see lib/pca.ts) gives the terrain's and the ribbon's own centroid
 * and spread, but its rotation angle is only defined mod 180° (a line has
 * no inherent direction), and PCA can't separately rule out the terrain
 * being mirrored (opposite handedness) rather than rotated — two
 * ambiguities pure PCA math cannot resolve on its own. Both are resolved
 * here the same way a person eyeballing the scene would: try the
 * candidates and keep whichever one actually lands the ribbon on asphalt,
 * measured by real mean ribbon-to-asphalt distance after an ICP-style
 * translation refinement — not by rendering it and looking.
 *
 * Search scope: a handful of rotation/scale steps around each of the 2
 * rotation branches (the 180° ambiguity above) × 2 mirror states — around
 * 100 candidates, every one scored against the full asphalt point cloud
 * (no subsampling — see this file's module doc comment for why that
 * matters here). What keeps ~100 full-density candidate evaluations fast
 * is each one doing O(1) spatial-index builds instead of O(iterations):
 * see {@link icpTranslate}.
 */
export function registerTerrain(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
  ctx: TerrainRegistrationContext,
): TerrainPose {
  const localAsphalt = toCloud(sampleAsphaltPoints(terrain));
  const scratch = cloneCloud(localAsphalt);
  const ribbon = toCloud(ribbonSamples);
  const ribbonCentre = centroidOf(ribbon);

  const rawAngle = ctx.ribbonPCA.majorAngle - ctx.terrainPCA.majorAngle;
  const rotationSeeds = [rawAngle, rawAngle + Math.PI];
  const scaleFactors = [0.92, 0.96, 1, 1.04, 1.08];
  const ROT_SPAN = (6 * Math.PI) / 180;
  const ROT_STEP = (3 * Math.PI) / 180;

  let best: (TerrainRegistrationKnobs & { offsetX: number; offsetZ: number; error: number }) | null = null;
  for (const mirrorX of [false, true]) {
    for (const seedRot of rotationSeeds) {
      for (let rot = seedRot - ROT_SPAN; rot <= seedRot + ROT_SPAN; rot += ROT_STEP) {
        for (const scaleMultiplier of scaleFactors) {
          const knobs: TerrainRegistrationKnobs = { rotationRad: rot, scaleMultiplier, mirrorX };
          const scored = scoreCandidate(ribbon, ribbonCentre, localAsphalt, scratch, ctx, knobs);
          if (!best || scored.error < best.error) best = { ...knobs, ...scored };
        }
      }
    }
  }
  // best is never null: the loops above always run at least once.
  const winner = best as TerrainRegistrationKnobs & { offsetX: number; offsetZ: number; error: number };

  const scale = scaleFor(winner, ctx);
  const mirror = winner.mirrorX ? -1 : 1;
  const rotatedMean = rotateXZ(ctx.terrainPCA.mean.x * scale * mirror, ctx.terrainPCA.mean.y * scale, winner.rotationRad);
  const position = {
    x: ctx.ribbonPCA.mean.x - rotatedMean.x + winner.offsetX,
    y: -0.05 - ctx.groundY * scale,
    z: ctx.ribbonPCA.mean.y - rotatedMean.z + winner.offsetZ,
  };

  terrain.scale.set(scale * mirror, scale, scale);
  terrain.rotation.y = winner.rotationRad;
  terrain.position.set(position.x, position.y, position.z);
  terrain.updateMatrixWorld(true);

  return { scale, rotationRad: winner.rotationRad, mirrorX: winner.mirrorX, position, error: winner.error };
}
