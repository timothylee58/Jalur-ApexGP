import { useMemo } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { useControls } from "leva";

const MODEL_SRC = "/models/sepang.glb";

/**
 * Live-tunable port of CircuitModelPreview.tsx's "Orbit Sepang" scene.
 * Drag a slider here, see the change instantly — once a value feels
 * right, copy it back into that component's own constants.
 */
function Model({ targetSize, marginFactor }: { targetSize: number; marginFactor: number }) {
  const { scene } = useGLTF(MODEL_SRC);

  const { positioned, groundRadius, groundY } = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = targetSize / Math.max(size.x, size.y, size.z, 0.001);
    const lowestY = (box.min.y - center.y) * scale;

    root.scale.setScalar(scale);
    root.position.sub(center.multiplyScalar(scale));

    root.traverse((child) => {
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
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const footprintRadius = 0.5 * Math.hypot(size.x * scale, size.z * scale) * marginFactor;
    return { positioned: root, groundRadius: footprintRadius, groundY: lowestY - 0.02 };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the tuned knobs change
  }, [scene, targetSize, marginFactor]);

  return (
    <>
      <primitive object={positioned} />
      <mesh position={[0, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[groundRadius, 64]} />
        <shadowMaterial opacity={0.45} />
      </mesh>
    </>
  );
}

export function OrbitSepangScene() {
  const { targetSize, marginFactor, ambientIntensity, sunIntensity, autoRotateSpeed } = useControls(
    "Orbit Sepang",
    {
      targetSize: { value: 4, min: 1, max: 10, step: 0.1 },
      marginFactor: { value: 1.15, min: 1, max: 2, step: 0.01, label: "ground margin" },
      ambientIntensity: { value: 0.55, min: 0, max: 2, step: 0.05 },
      sunIntensity: { value: 1.4, min: 0, max: 4, step: 0.1 },
      autoRotateSpeed: { value: 0.6, min: 0, max: 3, step: 0.1 },
    },
  );

  return (
    <Canvas
      shadows
      camera={{ position: [-4.5, 4.5, 5.5], fov: 40, near: 0.1, far: 200 }}
      style={{ background: "#0a0c0e" }}
    >
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={[5, 8, 3]}
        intensity={sunIntensity}
        color={0xfff4e0}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      <Model targetSize={targetSize} marginFactor={marginFactor} />
      <OrbitControls autoRotate autoRotateSpeed={autoRotateSpeed} maxPolarAngle={Math.PI * 0.49} enableDamping />
    </Canvas>
  );
}
