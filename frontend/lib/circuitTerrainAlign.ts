import * as THREE from "three";
import { sampleAsphaltPoints } from "@/lib/pca";
import { alignPointClouds, type Xz } from "@/lib/pointCloudAlign";

/**
 * CircuitExplorer3D.tsx-specific wrapper around lib/pointCloudAlign.ts's
 * generic 2D point-cloud registration: extracts the terrain's real asphalt
 * vertices, hands them to {@link alignPointClouds} together with the real
 * apex-point ribbon samples, and applies the resulting similarity
 * transform to the terrain's actual THREE.js `Object3D` (including the Y
 * position, which is circuit-specific ground-level logic that has no
 * place in the generic 2D module).
 *
 * `alignment.offsetX`/`offsetZ` from `alignPointClouds` are already a
 * complete world-space translation for the source cloud's local origin —
 * they fold in both the centroid alignment and the ICP refinement — so
 * they can be used directly as `terrain.position`'s X/Z with no further
 * "distance from some other mean" arithmetic on top. (An earlier version
 * of this file recomputed a second correction from the terrain's own PCA
 * mean and added it to that offset, which double-counted the centring
 * term — a real bug that happened to be small enough for this specific
 * terrain scan not to visibly break alignment, not something to keep.)
 */

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

/**
 * Computes and applies the terrain's registration against the real
 * apex-point ribbon by searching for it, not by trusting a baked pose —
 * see lib/pointCloudAlign.ts's module doc comment for the full reasoning
 * (why a search, why full point-cloud density, why it stays fast).
 *
 * `groundY` is the terrain's own local ground level (median object-base
 * height — see CircuitExplorer3D.tsx's loader callback for why it's
 * computed that way) — circuit-specific vertical placement that has
 * nothing to do with the generic 2D X/Z alignment above it.
 */
export function registerTerrain(
  terrain: THREE.Object3D,
  ribbonSamples: Xz[],
  groundY: number,
): TerrainPose {
  const asphaltPoints = sampleAsphaltPoints(terrain);
  const alignment = alignPointClouds(asphaltPoints, ribbonSamples);
  const mirror = alignment.mirrorX ? -1 : 1;

  const position = {
    x: alignment.offsetX,
    y: -0.05 - groundY * alignment.scale,
    z: alignment.offsetZ,
  };

  terrain.scale.set(alignment.scale * mirror, alignment.scale, alignment.scale);
  terrain.rotation.y = alignment.rotationRad;
  terrain.position.set(position.x, position.y, position.z);
  terrain.updateMatrixWorld(true);

  return {
    scale: alignment.scale,
    rotationRad: alignment.rotationRad,
    mirrorX: alignment.mirrorX,
    position,
    error: alignment.error,
  };
}
