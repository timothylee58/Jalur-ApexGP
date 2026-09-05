"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Driver } from "@/data/drivers";
import { accentForDriver, hexToThree, inkForAccent } from "@/lib/driverAccent";

interface DriverGridSceneProps {
  drivers: Driver[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface MarkerEntry {
  group: THREE.Group;
  shell: THREE.Mesh;
  base: THREE.Mesh;
  primary: number;
}

// Layout only — never a stand-in for a real grid or podium. "2026-grid"
// pairs by team (2 per constructor); "sepang-history" is a single row.
function layoutPosition(index: number, era: Driver["era"]): { x: number; z: number } {
  if (era === "sepang-history") {
    return { x: (index - 1) * 1.05, z: 0 };
  }
  const teamIndex = Math.floor(index / 2);
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x: side * 0.38,
    z: teamIndex * 0.62 - 3.1 + side * 0.06,
  };
}

function badgeTexture(
  label: string,
  primaryHex: string,
  secondaryHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);

  const gradient = ctx.createLinearGradient(40, 20, 220, 230);
  gradient.addColorStop(0, primaryHex);
  gradient.addColorStop(1, secondaryHex);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(128, 128, 100, 110, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0a0c0e";
  ctx.beginPath();
  ctx.ellipse(128, 108, 72, 38, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = inkForAccent(primaryHex);
  ctx.font = "700 64px 'Geist Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 128, 168);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildHelmet(
  primary: number,
  secondary: number,
  label: string,
  primaryHex: string,
  secondaryHex: string,
  disposables: Array<{ dispose: () => void }>,
): { group: THREE.Group; shell: THREE.Mesh; base: THREE.Mesh } {
  const group = new THREE.Group();

  const baseGeo = new THREE.CylinderGeometry(0.15, 0.17, 0.035, 28);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e22,
    emissive: primary,
    emissiveIntensity: 0.22,
    roughness: 0.7,
    metalness: 0.15,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.018;
  group.add(base);
  disposables.push(baseGeo, baseMat);

  // Pedestal stem
  const stemGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.1, 12);
  const stemMat = new THREE.MeshStandardMaterial({
    color: secondary,
    roughness: 0.45,
    metalness: 0.4,
  });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.085;
  group.add(stem);
  disposables.push(stemGeo, stemMat);

  // Helmet shell — slightly flattened sphere
  const shellGeo = new THREE.SphereGeometry(0.12, 32, 24);
  shellGeo.scale(1.05, 0.92, 1.12);
  const shellMat = new THREE.MeshStandardMaterial({
    color: primary,
    emissive: primary,
    emissiveIntensity: 0.14,
    roughness: 0.28,
    metalness: 0.4,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  shell.position.y = 0.22;
  group.add(shell);
  disposables.push(shellGeo, shellMat);

  // Dark visor band
  const visorGeo = new THREE.TorusGeometry(0.085, 0.028, 10, 28, Math.PI * 1.15);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x050608,
    roughness: 0.12,
    metalness: 0.85,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.rotation.x = Math.PI / 2.15;
  visor.position.set(0, 0.215, 0.04);
  group.add(visor);
  disposables.push(visorGeo, visorMat);

  // Chin bar
  const chinGeo = new THREE.BoxGeometry(0.11, 0.035, 0.07);
  const chinMat = new THREE.MeshStandardMaterial({
    color: primary,
    roughness: 0.35,
    metalness: 0.3,
  });
  const chin = new THREE.Mesh(chinGeo, chinMat);
  chin.position.set(0, 0.145, 0.07);
  group.add(chin);
  disposables.push(chinGeo, chinMat);

  // Rear aero ridge
  const ridgeGeo = new THREE.BoxGeometry(0.04, 0.035, 0.08);
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: secondary,
    roughness: 0.4,
    metalness: 0.35,
  });
  const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
  ridge.position.set(0, 0.28, -0.08);
  ridge.rotation.x = -0.35;
  group.add(ridge);
  disposables.push(ridgeGeo, ridgeMat);

  // Number plate on cheek
  const texture = badgeTexture(label, primaryHex, secondaryHex);
  const plateMat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), plateMat);
  plate.position.set(0.09, 0.2, 0.06);
  plate.rotation.y = Math.PI / 2.6;
  group.add(plate);
  disposables.push(texture, plateMat, plate.geometry);

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    opacity: 0.95,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.y = 0.4;
  sprite.scale.set(0.22, 0.22, 1);
  group.add(sprite);
  disposables.push(spriteMat);

  return { group, shell, base };
}

export function DriverGridScene({ drivers, selectedId, onSelect }: DriverGridSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(new Map());
  const pickablesRef = useRef<THREE.Object3D[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || drivers.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080a0c);
    scene.fog = new THREE.Fog(0x080a0c, 6, 16);

    const camera = new THREE.PerspectiveCamera(
      40,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc8d0d8, 0x1a1410, 0.55));
    const key = new THREE.DirectionalLight(0xfff0d8, 1.05);
    key.position.set(5, 8, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ec8ff, 0.35);
    rim.position.set(-4, 3, -5);
    scene.add(rim);

    const groundGeo = new THREE.CircleGeometry(7.5, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x12161a,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    const laneMat = new THREE.MeshStandardMaterial({
      color: 0xf4efe6,
      emissive: 0xf4efe6,
      emissiveIntensity: 0.15,
      roughness: 0.8,
    });
    const laneGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 11; i += 1) {
      const laneGeo = new THREE.BoxGeometry(0.95, 0.008, 0.05);
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.position.set(0, 0.001, i * 0.62 - 3.1);
      scene.add(lane);
      laneGeos.push(laneGeo);
    }

    const disposables: Array<{ dispose: () => void }> = [
      groundGeo,
      groundMat,
      laneMat,
      ...laneGeos,
    ];
    const markerRoot = new THREE.Group();
    markersRef.current = new Map();
    pickablesRef.current = [];

    drivers.forEach((driver, index) => {
      const { x, z } = layoutPosition(index, driver.era);
      const accent = accentForDriver(driver);
      const primary = hexToThree(accent.primary);
      const secondary = hexToThree(accent.secondary);
      const label =
        driver.number !== null ? String(driver.number) : driver.initials.slice(0, 2);

      const { group, shell, base } = buildHelmet(
        primary,
        secondary,
        label,
        accent.primary,
        accent.secondary,
        disposables,
      );
      group.position.set(x, 0, z);
      shell.userData.driverId = driver.id;
      base.userData.driverId = driver.id;

      markerRoot.add(group);
      markersRef.current.set(driver.id, { group, shell, base, primary });
      pickablesRef.current.push(shell, base);
    });
    scene.add(markerRoot);

    const loader = new GLTFLoader();
    let carRoot: THREE.Object3D | null = null;
    loader.load(
      "/models/car.glb",
      (gltf) => {
        carRoot = gltf.scene;
        carRoot.scale.setScalar(0.45);
        carRoot.position.set(0, 0.02, -3.85);
        carRoot.rotation.y = Math.PI;
        carRoot.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x2a3036,
              roughness: 0.45,
              metalness: 0.55,
            });
          }
        });
        scene.add(carRoot);
      },
      undefined,
      () => {
        // Optional scale reference — helmets work without it.
      },
    );

    const box = new THREE.Box3().setFromObject(markerRoot);
    const center = box.getCenter(new THREE.Vector3());
    const extent = box.getSize(new THREE.Vector3()).length();
    const radius = Math.max(extent * 1.15, 2.4);

    let azimuth = Math.PI * 0.28;
    const elevation = 0.52;
    let autoRotate = true;
    let dragging = false;
    let lastX = 0;
    const clock = new THREE.Clock();

    const applyCamera = () => {
      camera.position.set(
        center.x + radius * Math.cos(azimuth),
        radius * elevation,
        center.z + radius * Math.sin(azimuth),
      );
      camera.lookAt(center.x, 0.2, center.z);
    };
    applyCamera();

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      autoRotate = false;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      azimuth += (event.clientX - lastX) * 0.005;
      lastX = event.clientX;
      applyCamera();
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownAt = { x: 0, y: 0 };
    const onPointerDownTrack = (event: PointerEvent) => {
      pointerDownAt = { x: event.clientX, y: event.clientY };
    };
    const onClick = (event: MouseEvent) => {
      const dx = event.clientX - pointerDownAt.x;
      const dy = event.clientY - pointerDownAt.y;
      if (dx * dx + dy * dy > 36) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickablesRef.current, false);
      if (hits.length > 0) {
        const id = hits[0].object.userData.driverId as string;
        onSelectRef.current(id);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerdown", onPointerDownTrack);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (autoRotate) {
        azimuth += 0.0014;
        applyCamera();
      }
      markersRef.current.forEach((entry, id) => {
        const active = id === selectedRef.current;
        const shellMat = entry.shell.material as THREE.MeshStandardMaterial;
        const baseMat = entry.base.material as THREE.MeshStandardMaterial;
        if (active) {
          entry.group.position.y = Math.sin(t * 3) * 0.03 + 0.04;
          entry.group.scale.setScalar(1.18);
          shellMat.emissive.setHex(0xf5a623);
          shellMat.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.12;
          baseMat.emissive.setHex(0xf5a623);
          baseMat.emissiveIntensity = 0.5;
        } else {
          entry.group.position.y = 0;
          entry.group.scale.setScalar(1);
          shellMat.emissive.setHex(entry.primary);
          shellMat.emissiveIntensity = 0.12;
          baseMat.emissive.setHex(entry.primary);
          baseMat.emissiveIntensity = 0.18;
        }
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerdown", onPointerDownTrack);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      if (carRoot) scene.remove(carRoot);
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [drivers]);

  return (
    <div
      ref={mountRef}
      className="h-[48vh] w-full cursor-grab overflow-hidden rounded-lg border border-paper/10 bg-[#080a0c] active:cursor-grabbing sm:h-[56vh]"
      role="img"
      aria-label="Interactive 3D grid of stylized helmet markers paired by team. Drag to orbit, click a helmet to select that driver."
    />
  );
}
