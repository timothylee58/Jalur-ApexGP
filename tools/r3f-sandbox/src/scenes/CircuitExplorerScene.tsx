import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useControls } from "leva";
import { buildFlyoverCurve, buildFlyoverRibbon } from "../lib/circuitTrack";
import { meshPointCloudPCA, planarPCA } from "../lib/pca";

const TERRAIN_SRC = "/models/sepang.glb";

/**
 * Live-tunable port of CircuitExplorer3D.tsx's terrain + racing-line
 * overlay. Registers the terrain against the real apex centreline by
 * matching each one's own principal axis (PCA over every non-palm
 * terrain vertex vs. PCA over the ribbon's sample points) — an actual
 * similarity transform, not a bounding-box auto-fit. PCA only
 * determines the axis up to a 180° flip and can't rule out a mirror
 * (opposite handedness), so `rotationDeg`/`mirrorX` are exposed to pick
 * the correct one visually, and `scaleMultiplier`/`offsetX`/`offsetZ`
 * fine-tune on top of the automatic fit.
 */
function Ribbon({ width, color, emissiveIntensity, opacity }: RibbonProps) {
  const geometry = useMemo(() => {
    const curve = buildFlyoverCurve();
    return buildFlyoverRibbon(curve, width).geometry;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only width affects the sweep
  }, [width]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.4}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

interface RibbonProps {
  width: number;
  color: string;
  emissiveIntensity: number;
  opacity: number;
}

interface TerrainProps {
  rotationDeg: number;
  mirrorX: boolean;
  scaleMultiplier: number;
  offsetX: number;
  offsetZ: number;
  yOffset: number;
}

function Terrain({ rotationDeg, mirrorX, scaleMultiplier, offsetX, offsetZ, yOffset }: TerrainProps) {
  const { scene } = useGLTF(TERRAIN_SRC);

  const positioned = useMemo(() => {
    const terrain = scene.clone(true);

    terrain.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial | undefined;
        if (!material?.map) {
          child.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.65,
            metalness: 0.05,
            side: THREE.DoubleSide,
          });
        }
      }
    });

    // Everything below reads the terrain's own untransformed local space —
    // must happen before any scale/rotation/position is applied to `terrain`.
    const terrainPCA = meshPointCloudPCA(terrain);

    const objectBaseYs: number[] = [];
    terrain.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        objectBaseYs.push(new THREE.Box3().setFromObject(child).min.y);
      }
    });
    objectBaseYs.sort((a, b) => a - b);
    const groundY = objectBaseYs[Math.floor(objectBaseYs.length / 2)] ?? 0;

    const curve = buildFlyoverCurve();
    const samples = curve.getSpacedPoints(240).map((p) => ({ x: p.x, z: p.z }));
    const ribbonPCA = planarPCA(samples);

    const scale = (ribbonPCA.majorStd / terrainPCA.majorStd) * scaleMultiplier;
    const mirror = mirrorX ? -1 : 1;
    const rotationRad = THREE.MathUtils.degToRad(rotationDeg);

    const rotY = new THREE.Matrix4().makeRotationY(rotationRad);
    const scaledMean = new THREE.Vector3(terrainPCA.mean.x * scale * mirror, 0, terrainPCA.mean.y * scale).applyMatrix4(rotY);

    terrain.scale.set(scale * mirror, scale, scale);
    terrain.rotation.y = rotationRad;
    terrain.position.set(
      ribbonPCA.mean.x - scaledMean.x + offsetX,
      yOffset - groundY * scale,
      ribbonPCA.mean.y - scaledMean.z + offsetZ,
    );
    // Raw PCA angle delta (before rotationDeg's own value is applied) —
    // handy when re-deriving rotationDeg after the source assets change:
    // ribbonPCA.majorAngle - terrainPCA.majorAngle, then try that and
    // that-minus-180° as your two starting candidates (see this file's
    // top comment on why there are two).
    console.log(
      "[PCA] raw angle delta (deg):",
      (((ribbonPCA.majorAngle - terrainPCA.majorAngle) * 180) / Math.PI).toFixed(1),
      " candidates:",
      (((ribbonPCA.majorAngle - terrainPCA.majorAngle) * 180) / Math.PI).toFixed(1),
      "or",
      (((ribbonPCA.majorAngle - terrainPCA.majorAngle) * 180) / Math.PI - 180).toFixed(1),
    );
    return terrain;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fit whenever any tuned knob changes
  }, [scene, rotationDeg, mirrorX, scaleMultiplier, offsetX, offsetZ, yOffset]);

  return <primitive object={positioned} />;
}

export function CircuitExplorerScene() {
  const { ribbonWidth, ribbonColor, ribbonEmissiveIntensity, ribbonOpacity } = useControls("Racing line", {
    ribbonWidth: { value: 0.05, min: 0.01, max: 0.3, step: 0.01 },
    ribbonColor: { value: "#f5a623" },
    ribbonEmissiveIntensity: { value: 0.5, min: 0, max: 2, step: 0.05 },
    ribbonOpacity: { value: 0.85, min: 0, max: 1, step: 0.05 },
  });
  const { rotationDeg, mirrorX, scaleMultiplier, offsetX, offsetZ, yOffset } = useControls("Terrain registration", {
    rotationDeg: { value: -32.6, min: -180, max: 180, step: 0.1 },
    mirrorX: false,
<<<<<<< HEAD
    scaleMultiplier: { value: 0.65, min: 0.3, max: 2, step: 0.01 },
=======
    scaleMultiplier: { value: 0.7475, min: 0.3, max: 2, step: 0.01 },
>>>>>>> 11d518f (fix: align Sepang terrain to yellow ribbon via asphalt calibration)
    offsetX: { value: 0, min: -2, max: 2, step: 0.01 },
    offsetZ: { value: 0, min: -2, max: 2, step: 0.01 },
    yOffset: { value: -0.05, min: -3, max: 0.5, step: 0.01 },
  });
  const { autoRotateSpeed } = useControls("Camera", {
    autoRotateSpeed: { value: 0, min: 0, max: 3, step: 0.1 },
  });

  return (
    <Canvas camera={{ position: [4, 3.5, 4], fov: 42, near: 0.1, far: 100 }} style={{ background: "#0a0c0e" }}>
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 6, 2]} intensity={0.9} color={0xfff4e0} />
      <Terrain
        rotationDeg={rotationDeg}
        mirrorX={mirrorX}
        scaleMultiplier={scaleMultiplier}
        offsetX={offsetX}
        offsetZ={offsetZ}
        yOffset={yOffset}
      />
      <Ribbon width={ribbonWidth} color={ribbonColor} emissiveIntensity={ribbonEmissiveIntensity} opacity={ribbonOpacity} />
      <OrbitControls autoRotate autoRotateSpeed={autoRotateSpeed} enableDamping />
    </Canvas>
  );
}
