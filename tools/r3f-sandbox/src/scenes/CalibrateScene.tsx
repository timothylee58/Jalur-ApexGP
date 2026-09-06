import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

const TERRAIN_SRC = "/models/sepang.glb";

/**
 * One-off calibration tool: renders the terrain at identity transform
 * (no scale/rotation/position) from a straight-down orthographic camera,
 * reports the exact world (x,z) under the mouse on hover, and logs a
 * PCA (principal-axis) fit over every non-palm vertex to the console —
 * used to find the rotation/scale/translation that actually registers
 * the terrain against the real apex centreline (see
 * CircuitExplorer3D.tsx's terrain loader), rather than the bounding-box
 * auto-fit this started with. Not part of the app's normal scenes.
 */
function logPCA(root: THREE.Object3D) {
  let n = 0;
  let sx = 0;
  let sz = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.name.startsWith("Palm")) return;
    const pos = child.geometry.getAttribute("position");
    const v = new THREE.Vector3();
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
    if (!(child instanceof THREE.Mesh) || child.name.startsWith("Palm")) return;
    const pos = child.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
      const dx = v.x - mx;
      const dz = v.z - mz;
      cxx += dx * dx;
      czz += dz * dz;
      cxz += dx * dz;
    }
  });
  cxx /= n;
  czz /= n;
  cxz /= n;

  const trace = cxx + czz;
  const det = cxx * czz - cxz * cxz;
  const l1 = trace / 2 + Math.sqrt(trace * trace / 4 - det);
  const l2 = trace / 2 - Math.sqrt(trace * trace / 4 - det);
  const angle = cxz !== 0 ? Math.atan2(l1 - cxx, cxz) : cxx >= czz ? 0 : Math.PI / 2;

  console.log("[PCA] vertex count (non-palm):", n);
  console.log("[PCA] mean:", mx.toFixed(3), mz.toFixed(3));
  console.log("[PCA] cxx,czz,cxz:", cxx.toFixed(3), czz.toFixed(3), cxz.toFixed(3));
  console.log("[PCA] eigenvalues:", l1.toFixed(3), l2.toFixed(3));
  console.log("[PCA] major axis angle rad:", angle.toFixed(4), "deg:", (angle * 180 / Math.PI).toFixed(2));
  console.log("[PCA] aspect ratio:", Math.sqrt(l1 / l2).toFixed(3));
}

function Terrain({ onHover }: { onHover: (p: { x: number; z: number } | null) => void }) {
  const { scene } = useGLTF(TERRAIN_SRC);
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.updateMatrixWorld(true);
    logPCA(scene);
  }, [scene]);

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    onHover({ x: e.point.x, z: e.point.z });
  };

  return <primitive ref={ref} object={scene} onPointerMove={handleMove} onPointerOut={() => onHover(null)} />;
}

export function CalibrateScene() {
  const [hover, setHover] = useState<{ x: number; z: number } | null>(null);
  const frustumHalf = 1200; // world units each side of center visible — generous for this model's scale

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Canvas
        orthographic
        camera={{ position: [0, 1000, 0], zoom: 1, near: 0.1, far: 5000, up: [0, 0, -1] }}
        onCreated={({ camera, size }) => {
          const cam = camera as THREE.OrthographicCamera;
          const aspect = size.width / size.height;
          cam.left = -frustumHalf * aspect;
          cam.right = frustumHalf * aspect;
          cam.top = frustumHalf;
          cam.bottom = -frustumHalf;
          cam.lookAt(0, 0, 0);
          cam.updateProjectionMatrix();
        }}
        style={{ background: "#0a0c0e" }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[0, 10, 0]} intensity={0.5} />
        <Terrain onHover={setHover} />
        <axesHelper args={[100]} />
      </Canvas>
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          background: "rgba(10,12,14,0.85)",
          border: "1px solid #2a3036",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 13,
          color: "#f5a623",
          fontFamily: "ui-monospace, monospace",
          pointerEvents: "none",
        }}
      >
        {hover ? `x: ${hover.x.toFixed(2)}  z: ${hover.z.toFixed(2)}` : "hover the terrain…"}
      </div>
    </div>
  );
}
