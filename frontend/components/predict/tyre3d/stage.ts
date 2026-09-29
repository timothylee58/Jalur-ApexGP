import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { contactShadow } from "./buildTyre";

/**
 * Shared lighting and camera for every tyre render, live or snapshot, so the
 * picker thumbnails and the showcase are the same photograph. Lit like the
 * display case in the reference: a neutral studio environment for
 * reflections, a key from above-front, and a cool rim light behind.
 */
export interface TyreStage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Compound-coloured under-glow; intensity 0 when nothing is selected. */
  heat: THREE.PointLight;
  dispose: () => void;
}

export function createStage(renderer: THREE.WebGLRenderer): TyreStage {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.5, 4, 3.5);
  scene.add(key);
  const rimLight = new THREE.DirectionalLight(0x7d8cff, 1.6);
  rimLight.position.set(-3, 1.5, -2.5);
  scene.add(rimLight);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  const heat = new THREE.PointLight(0xffffff, 0, 4, 1.6);
  heat.position.set(0.3, -1.05, 1.1);
  scene.add(heat);

  const shadow = contactShadow();
  scene.add(shadow);

  // Three-quarter view, like standing in front of the display: the outer
  // sidewall faces the camera, the tread turns away to the right.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(2.45, 0.6, 4.3);
  camera.lookAt(0.1, -0.06, 0);

  return {
    scene,
    camera,
    heat,
    dispose: () => {
      env.dispose();
      pmrem.dispose();
      room.dispose();
      shadow.geometry.dispose();
      const material = shadow.material as THREE.MeshBasicMaterial;
      material.map?.dispose();
      material.dispose();
    },
  };
}

export function createRenderer(canvas?: HTMLCanvasElement, preserve = false): THREE.WebGLRenderer | null {
  try {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: preserve,
      powerPreference: "low-power",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    return renderer;
  } catch {
    return null;
  }
}
