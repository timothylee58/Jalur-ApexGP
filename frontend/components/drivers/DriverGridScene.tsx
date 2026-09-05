"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Driver } from "@/data/drivers";
import { accentForDriver, hexToThree, inkForAccent } from "@/lib/driverAccent";
import { photoForDriver } from "@/lib/driverPhotos";

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

function numberBadgeTexture(label: string, primaryHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = primaryHex;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inkForAccent(primaryHex);
  ctx.font = "700 52px 'Geist Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 64, 68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function initialsFallbackTexture(
  initials: string,
  primaryHex: string,
  secondaryHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 256, 256);
  gradient.addColorStop(0, primaryHex);
  gradient.addColorStop(1, secondaryHex);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = inkForAccent(primaryHex);
  ctx.font = "700 72px 'Geist Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials.slice(0, 2).toUpperCase(), 128, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildPhotoMarker(
  primary: number,
  secondary: number,
  label: string,
  primaryHex: string,
  secondaryHex: string,
  initials: string,
  photoUrl: string | null,
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

  const stemGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.08, 12);
  const stemMat = new THREE.MeshStandardMaterial({
    color: secondary,
    roughness: 0.45,
    metalness: 0.4,
  });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.075;
  group.add(stem);
  disposables.push(stemGeo, stemMat);

  // Team-color ring behind the portrait
  const ringGeo = new THREE.RingGeometry(0.115, 0.145, 40);
  const ringMat = new THREE.MeshStandardMaterial({
    color: primary,
    emissive: primary,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2.4;
  ring.position.y = 0.2;
  group.add(ring);
  disposables.push(ringGeo, ringMat);

  const fallback = initialsFallbackTexture(initials, primaryHex, secondaryHex);
  const portraitMat = new THREE.MeshStandardMaterial({
    map: fallback,
    roughness: 0.55,
    metalness: 0.05,
  });
  const portraitGeo = new THREE.CircleGeometry(0.12, 40);
  const shell = new THREE.Mesh(portraitGeo, portraitMat);
  shell.rotation.x = -Math.PI / 2.4;
  shell.position.y = 0.205;
  group.add(shell);
  disposables.push(portraitGeo, portraitMat, fallback);

  if (photoUrl) {
    const loader = new THREE.TextureLoader();
    loader.load(
      photoUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        portraitMat.map = texture;
        portraitMat.needsUpdate = true;
        disposables.push(texture);
      },
      undefined,
      () => {
        // Keep initials fallback if the headshot fails.
      },
    );
  }

  const badge = numberBadgeTexture(label, primaryHex);
  const badgeMat = new THREE.SpriteMaterial({
    map: badge,
    transparent: true,
    depthWrite: false,
  });
  const badgeSprite = new THREE.Sprite(badgeMat);
  badgeSprite.position.set(0.11, 0.12, 0.08);
  badgeSprite.scale.set(0.11, 0.11, 1);
  group.add(badgeSprite);
  disposables.push(badge, badgeMat);

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

      const photoUrl = photoForDriver(driver.id);
      const { group, shell, base } = buildPhotoMarker(
        primary,
        secondary,
        label,
        accent.primary,
        accent.secondary,
        driver.initials,
        photoUrl,
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
