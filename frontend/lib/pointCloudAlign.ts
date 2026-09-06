import { planarPCA, type PlanarPCA } from "@/lib/pca";

/**
 * Generic 2D (X/Z) point-cloud registration: given two point clouds that
 * represent the same real-world shape from two independent, unrelated
 * coordinate systems (no shared origin, orientation, or scale), find the
 * similarity transform (rotation + optional mirror + scale + translation)
 * that best overlays `source` onto `target`.
 *
 * Built for CircuitExplorer3D.tsx's real-terrain-scan-vs-real-apex-survey
 * problem (see lib/circuitTerrainAlign.ts, the one THREE.js-aware,
 * circuit-specific caller), but has no dependency on THREE.js, meshes, or
 * anything circuit-specific — any future "align two real-world point sets
 * with no shared coordinate system" problem in this app can call
 * {@link alignPointClouds} directly with its own two point arrays.
 *
 * Why a search, not a formula: PCA (lib/pca.ts) gives each cloud's own
 * centroid and spread cheaply, but its rotation angle is only defined mod
 * 180° (a line has no inherent direction), and PCA can't separately rule
 * out one cloud being mirrored (opposite handedness) relative to the
 * other — both are ambiguities plain PCA math cannot resolve on its own.
 * This resolves them the way a person eyeballing the two shapes would: try
 * candidates and keep whichever one actually measures closest, via a
 * coarse-then-fine search scored by real mean nearest-point distance after
 * an ICP-style translation refinement.
 *
 * Internals use flat typed arrays and integer-keyed grid buckets rather
 * than arrays of {x,z} objects and string-keyed maps, and each candidate
 * builds its spatial index exactly once regardless of ICP iteration count
 * (see {@link icpTranslate}'s comment) — an object/string-keyed,
 * per-iteration-rebuilding version of this algorithm was measurably slower
 * (allocation and string hashing dominated its cost, not the distance
 * math): full point-cloud density at real candidate counts was multiple
 * seconds with that version, and is well under a second with this one.
 */

export type Xz = { x: number; z: number };

export interface AlignmentOptions {
  /** Also search mirrored (reflected) candidates. Set `false` only when
   * you know the two clouds share handedness (e.g. both already in a
   * right-handed convention with no possibility of a flip) — halves the
   * search. Default `true`. */
  allowMirror?: boolean;
  /** Multiplicative corrections tried around the raw PCA std-ratio scale —
   * that ratio alone is rarely exact (e.g. kerbs/runoff can bias one
   * cloud's apparent spread relative to the other's). Default a handful
   * of small corrections around 1.0. */
  scaleFactors?: number[];
  /** ICP-style translation-refinement iterations per candidate. Default 5. */
  icpIterations?: number;
  /** Spatial-index cell size, in `source`/`target`'s own units. Left
   * unset, it's derived from the data itself (typical nearest-neighbour
   * spacing of `source`, scaled by the PCA-implied size ratio to `target`
   * — see `estimateGridCell`) rather than a fixed constant: a cell size
   * tuned for one dense point cloud (thousands of vertices a few units
   * across) silently breaks on a sparser or differently-scaled one — a
   * fixed default this module shipped with initially only worked for its
   * first caller's data and was wrong by an order of magnitude for
   * synthetic test data at a different scale. Only override this if the
   * auto-derived value is a poor fit for your own data's density. */
  gridCell?: number;
  /** Stage 1 sweeps the *entire* rotation range at this resolution (degrees)
   * — deliberately not just "near the raw PCA angle": relying on that
   * angle being roughly right is itself an assumption this search is
   * built to avoid needing. Default 12°. */
  coarseStepDeg?: number;
  /** Stage 2 searches this many degrees on either side of stage 1's best
   * candidate, at fine resolution — refines the coarse winner rather than
   * re-exploring the whole range. Rotation and scale are refined one at a
   * time (see {@link alignPointClouds}'s doc comment), not as a full
   * cross-product, so widening this span costs one extra rotation pass'
   * worth of candidates, not that times `scaleFactors.length`. Default
   * span 15°, step 1°. */
  fineSpanDeg?: number;
  fineStepDeg?: number;
}

export interface PointCloudAlignment {
  rotationRad: number;
  mirrorX: boolean;
  scale: number;
  offsetX: number;
  offsetZ: number;
  /** Mean nearest-neighbour distance from `source` (after this transform)
   * to `target` — lower is a tighter fit. Report this to callers rather
   * than just trusting the search; it's the same number the search itself
   * minimises, so it's a meaningful fit-quality signal, not a formality. */
  error: number;
}

const DEFAULT_SCALE_FACTORS = [0.92, 0.96, 1, 1.04, 1.08];
const DEFAULT_COARSE_STEP_DEG = 18;
const DEFAULT_FINE_SPAN_DEG = 15;
const DEFAULT_FINE_STEP_DEG = 1;

// ---- flat point cloud (avoids a {x,z} object allocation per point per
// candidate — see this module's doc comment) --------------------------

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

function centroidOf(cloud: Cloud): Xz {
  let sx = 0;
  let sz = 0;
  for (let i = 0; i < cloud.length; i++) {
    sx += cloud.x[i];
    sz += cloud.z[i];
  }
  return { x: sx / cloud.length, z: sz / cloud.length };
}

// ---- fast nearest-neighbour lookup -----------------------------------

// Packs (ix, iz) into one integer key for a numeric-keyed Map — string
// template keys (`${ix},${iz}`) were a real cost at this call volume.
// Safe for any cell index a reasonable scene scale could produce (well
// under ±50,000 cells from center) without colliding.
const GRID_KEY_SPAN = 100000;

function gridKey(ix: number, iz: number): number {
  return ix * GRID_KEY_SPAN + iz;
}

/** Bucket a cloud's point *indices* into a uniform grid once, so a batch
 * of nearest-point queries against the same cloud doesn't re-bucket it
 * per query. */
function buildGrid(cloud: Cloud, cell: number): Map<number, number[]> {
  const buckets = new Map<number, number[]>();
  for (let i = 0; i < cloud.length; i++) {
    const key = gridKey(Math.floor(cloud.x[i] / cell), Math.floor(cloud.z[i] / cell));
    const bucket = buckets.get(key);
    if (bucket) bucket.push(i);
    else buckets.set(key, [i]);
  }
  return buckets;
}

/** Index of the nearest point in `cloud` to (qx, qz), or -1 if the 7×7
 * cell neighbourhood around the query is empty. */
function queryNearest(grid: Map<number, number[]>, cloud: Cloud, cell: number, qx: number, qz: number): number {
  const cx = Math.floor(qx / cell);
  const cz = Math.floor(qz / cell);
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

/** Mean target-to-nearest-source distance, as if `source` were additionally
 * shifted by (offsetX, offsetZ) — without needing to move `source` or
 * rebuild `grid`. Shifting the query by the negation instead is an exact
 * equivalent (nearest-neighbour relationships are translation-invariant),
 * and is what lets {@link icpTranslate} reuse one grid across all its
 * iterations instead of rebuilding it every time the cloud moves. */
function meanNearestDistance(
  target: Cloud,
  source: Cloud,
  grid: Map<number, number[]>,
  cell: number,
  offsetX = 0,
  offsetZ = 0,
): number {
  let total = 0;
  let n = 0;
  for (let i = 0; i < target.length; i++) {
    const hit = queryNearest(grid, source, cell, target.x[i] - offsetX, target.z[i] - offsetZ);
    if (hit < 0) continue;
    total += Math.hypot(target.x[i] - (source.x[hit] + offsetX), target.z[i] - (source.z[hit] + offsetZ));
    n++;
  }
  return n > 0 ? total / n : Infinity;
}

/**
 * ICP-style translation refinement: repeatedly nudge a running (offsetX,
 * offsetZ) by the mean vector from each target point to its current
 * nearest point in `source`, until that mean vector settles near zero.
 * This is what a real transform actually needs on top of a raw centroid
 * alignment — whatever residual translation the similarity transform
 * leaves behind, this walks it out against the real geometry, rather than
 * needing a hand-tuned offset constant.
 *
 * `source` and `grid` are never modified or rebuilt: shifting the *query*
 * by the running offset instead of physically translating the cloud (see
 * {@link meanNearestDistance}) is mathematically equivalent to rebuilding
 * the grid every iteration, but needs it built exactly once per candidate.
 */
function icpTranslate(
  target: Cloud,
  source: Cloud,
  grid: Map<number, number[]>,
  cell: number,
  iterations: number,
): { offsetX: number; offsetZ: number } {
  let offsetX = 0;
  let offsetZ = 0;
  for (let iter = 0; iter < iterations; iter++) {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (let i = 0; i < target.length; i++) {
      const hit = queryNearest(grid, source, cell, target.x[i] - offsetX, target.z[i] - offsetZ);
      if (hit < 0) continue;
      sx += target.x[i] - (source.x[hit] + offsetX);
      sz += target.z[i] - (source.z[hit] + offsetZ);
      n++;
    }
    if (n < target.length * 0.5) break;
    const ox = sx / n;
    const oz = sz / n;
    if (Math.abs(ox) < 1e-4 && Math.abs(oz) < 1e-4) break;
    offsetX += ox;
    offsetZ += oz;
  }
  return { offsetX, offsetZ };
}

// ---- similarity transform ----------------------------------------------

interface Knobs {
  rotationRad: number;
  scaleMultiplier: number;
  mirrorX: boolean;
}

/** Rotation matching THREE's `object3D.rotation.y = theta` convention
 * (equivalent to `Matrix4.makeRotationY`) — the one caller that applies
 * this to an actual THREE.js object (lib/circuitTerrainAlign.ts) needs
 * scoring and application to agree on this, so it's centralised here
 * rather than reimplemented at each call site (an earlier version of that
 * caller scored candidates with one rotation sign and applied the winner
 * with the opposite one). */
function rotateXZ(x: number, z: number, theta: number): Xz {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

function scaleFor(knobs: Knobs, sourceStats: PlanarPCA, targetStats: PlanarPCA): number {
  return (targetStats.majorStd / sourceStats.majorStd) * knobs.scaleMultiplier;
}

/** Transforms `local` (source's own untransformed space) into `out`
 * (target's coordinate space, for one candidate pose) in place — `out`
 * must be pre-sized to match `local`. */
function transformInto(
  local: Cloud,
  out: Cloud,
  knobs: Knobs,
  sourceStats: PlanarPCA,
  targetStats: PlanarPCA,
): void {
  const scale = scaleFor(knobs, sourceStats, targetStats);
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
  target: Cloud,
  targetCentre: Xz,
  local: Cloud,
  scratch: Cloud,
  sourceStats: PlanarPCA,
  targetStats: PlanarPCA,
  knobs: Knobs,
  gridCell: number,
  icpIterations: number,
): { offsetX: number; offsetZ: number; error: number } {
  transformInto(local, scratch, knobs, sourceStats, targetStats);
  const sourceCentre = centroidOf(scratch);
  const centringX = targetCentre.x - sourceCentre.x;
  const centringZ = targetCentre.z - sourceCentre.z;
  for (let i = 0; i < scratch.length; i++) {
    scratch.x[i] += centringX;
    scratch.z[i] += centringZ;
  }

  const grid = buildGrid(scratch, gridCell);
  const icp = icpTranslate(target, scratch, grid, gridCell, icpIterations);
  const error = meanNearestDistance(target, scratch, grid, gridCell, icp.offsetX, icp.offsetZ);
  return { offsetX: centringX + icp.offsetX, offsetZ: centringZ + icp.offsetZ, error };
}

/** Rough "typical nearest-neighbour spacing" for a point set: bounding-box
 * area divided by point count, square-rooted. Good enough to size a
 * spatial-index cell from (doesn't need to be a precise density estimate,
 * just the right order of magnitude) without assuming any particular
 * physical scale or point count up front. */
function estimateSpacing(points: Xz[]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const width = Math.max(maxX - minX, 1e-9);
  const height = Math.max(maxZ - minZ, 1e-9);
  return Math.sqrt((width * height) / Math.max(points.length, 1));
}

/**
 * Auto-derives a spatial-index cell size from the data itself, used
 * whenever {@link AlignmentOptions.gridCell} isn't supplied: `source`'s
 * own typical point spacing, scaled by the same size ratio the search
 * applies to positions (PCA's std ratio), so the estimate reflects
 * `source`'s density *once transformed into target's coordinate space* —
 * where nearest-neighbour queries actually happen — not its raw spacing.
 * A small safety multiplier keeps the search radius (a fixed 7×7 cells)
 * comfortably wider than typical gaps between points without blurring
 * genuinely distinct nearby features together.
 */
function estimateGridCell(source: Xz[], sourceStats: PlanarPCA, targetStats: PlanarPCA): number {
  const sizeRatio = targetStats.majorStd / sourceStats.majorStd || 1;
  return estimateSpacing(source) * sizeRatio * 1.5;
}

/**
 * Finds the similarity transform (rotation + optional mirror + scale +
 * translation) that best overlays `source` onto `target`.
 *
 * Search: a coarse pass sweeps the *entire* rotation range (every
 * `coarseStepDeg`, both mirror states if `allowMirror`) at a single scale
 * to find the right general vicinity — full-range on purpose, not just
 * around the raw PCA angle: PCA's angle is only correct mod 180° anyway,
 * and a full sweep needs no assumption about which half it lands in, or
 * that it's even close. A fine pass then refines rotation and scale one at
 * a time around the coarse winner — rotation first (at unit scale), then
 * `scaleFactors` at that rotation, then a narrow rotation re-check at the
 * winning scale to catch any interaction — rather than the full
 * rotation×scale cross-product: at the small correction magnitudes this
 * stage deals in (a handful of degrees, a few percent scale), the two
 * knobs are only weakly coupled, so alternating between them lands on
 * essentially the same answer as scoring every combination, for a
 * fraction of the candidates (this was the dominant cost of the search —
 * widening stage 1 to a full 360° sweep barely moved total time next to
 * this stage's cost). Every candidate is scored against the *full* point
 * clouds — no subsampling —
 * because an earlier version of this search that subsampled for speed
 * measurably changed which pose won (a worse-fitting candidate can look
 * artificially competitive once real point density is thinned out); what
 * actually keeps this fast is each candidate needing only one spatial-
 * index build (see {@link icpTranslate}), not the loss of any data.
 *
 * `source` and `target` need at least a few points each; degenerate
 * inputs (e.g. every point identical) will report `Infinity` scale or
 * error rather than throwing.
 */
export function alignPointClouds(source: Xz[], target: Xz[], options: AlignmentOptions = {}): PointCloudAlignment {
  const {
    allowMirror = true,
    scaleFactors = DEFAULT_SCALE_FACTORS,
    icpIterations = 5,
    coarseStepDeg = DEFAULT_COARSE_STEP_DEG,
    fineSpanDeg = DEFAULT_FINE_SPAN_DEG,
    fineStepDeg = DEFAULT_FINE_STEP_DEG,
  } = options;

  const sourceStats = planarPCA(source);
  const targetStats = planarPCA(target);
  const gridCell = options.gridCell ?? estimateGridCell(source, sourceStats, targetStats);
  const sourceCloud = toCloud(source);
  const scratch = cloneCloud(sourceCloud);
  const targetCloud = toCloud(target);
  const targetCentre = centroidOf(targetCloud);
  const mirrorOptions = allowMirror ? [false, true] : [false];

  // Stage 1: coarse, full rotation sweep at a single scale.
  let coarseBest: { rotationRad: number; mirrorX: boolean; error: number } | null = null;
  for (const mirrorX of mirrorOptions) {
    for (let deg = 0; deg < 360; deg += coarseStepDeg) {
      const rotationRad = (deg * Math.PI) / 180;
      const knobs: Knobs = { rotationRad, scaleMultiplier: 1, mirrorX };
      const scored = scoreCandidate(
        targetCloud,
        targetCentre,
        sourceCloud,
        scratch,
        sourceStats,
        targetStats,
        knobs,
        gridCell,
        icpIterations,
      );
      if (!coarseBest || scored.error < coarseBest.error) {
        coarseBest = { rotationRad, mirrorX, error: scored.error };
      }
    }
  }
  // coarseBest is never null: the loops above always run at least once.
  const coarse = coarseBest as { rotationRad: number; mirrorX: boolean; error: number };

  // Stage 2: fine local refinement around the coarse winner — rotation and
  // scale refined one at a time rather than as a full cross-product (see
  // this function's doc comment for why that's a safe simplification here).
  const fineSpanRad = (fineSpanDeg * Math.PI) / 180;
  const fineStepRad = (fineStepDeg * Math.PI) / 180;
  type Scored = Knobs & { offsetX: number; offsetZ: number; error: number };
  let best: Scored | null = null;

  // 2a: refine rotation at unit scale, across the full fine span.
  for (let rot = coarse.rotationRad - fineSpanRad; rot <= coarse.rotationRad + fineSpanRad; rot += fineStepRad) {
    const knobs: Knobs = { rotationRad: rot, scaleMultiplier: 1, mirrorX: coarse.mirrorX };
    const scored = scoreCandidate(targetCloud, targetCentre, sourceCloud, scratch, sourceStats, targetStats, knobs, gridCell, icpIterations);
    if (!best || scored.error < best.error) best = { ...knobs, ...scored };
  }
  // best is never null: the loop above always runs at least once.
  const rotationAfter2a = (best as Scored).rotationRad;

  // 2b: refine scale at that rotation.
  for (const scaleMultiplier of scaleFactors) {
    const knobs: Knobs = { rotationRad: rotationAfter2a, scaleMultiplier, mirrorX: coarse.mirrorX };
    const scored = scoreCandidate(targetCloud, targetCentre, sourceCloud, scratch, sourceStats, targetStats, knobs, gridCell, icpIterations);
    if (!best || scored.error < best.error) best = { ...knobs, ...scored };
  }
  const scaleAfter2b = (best as Scored).scaleMultiplier;

  // 2c: narrow rotation re-check at the winning scale, in case scale
  // shifted the optimum slightly — a small span is enough since 2a already
  // found the right neighbourhood.
  const narrowSpanRad = fineStepRad * 3;
  for (let rot = rotationAfter2a - narrowSpanRad; rot <= rotationAfter2a + narrowSpanRad; rot += fineStepRad) {
    const knobs: Knobs = { rotationRad: rot, scaleMultiplier: scaleAfter2b, mirrorX: coarse.mirrorX };
    const scored = scoreCandidate(targetCloud, targetCentre, sourceCloud, scratch, sourceStats, targetStats, knobs, gridCell, icpIterations);
    if (!best || scored.error < best.error) best = { ...knobs, ...scored };
  }

  // best is never null: stage 2a always runs at least once.
  const winner = best as Scored;

  return {
    rotationRad: winner.rotationRad,
    mirrorX: winner.mirrorX,
    scale: scaleFor(winner, sourceStats, targetStats),
    offsetX: winner.offsetX,
    offsetZ: winner.offsetZ,
    error: winner.error,
  };
}

/**
 * Maps one point from `source`'s local space into `target`'s space using
 * an already-computed alignment — for a caller that needs to place
 * individual points (not a whole mesh/object) consistently with a
 * transform {@link alignPointClouds} found. `alignment.offsetX`/`offsetZ`
 * are already a complete world-space translation for the source cloud's
 * local origin, so this needs no separate centroid-based correction on
 * top: `applyAlignment({x:0,z:0}, alignment)` is exactly
 * `{x: alignment.offsetX, z: alignment.offsetZ}`.
 */
export function applyAlignment(point: Xz, alignment: PointCloudAlignment): Xz {
  const mirror = alignment.mirrorX ? -1 : 1;
  const rotated = rotateXZ(point.x * alignment.scale * mirror, point.z * alignment.scale, alignment.rotationRad);
  return { x: rotated.x + alignment.offsetX, z: rotated.z + alignment.offsetZ };
}
