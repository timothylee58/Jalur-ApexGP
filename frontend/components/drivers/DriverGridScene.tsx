"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { Driver } from "@/data/drivers";

interface DriverGridSceneProps {
  drivers: Driver[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Position layout only — never a stand-in for a real grid or podium result.
// "2026-grid" pairs markers by team (2 per constructor, in the order
// data/drivers.ts lists them) with a slight stagger for a starting-grid
// look; "sepang-history" spreads its three drivers in a single row, since
// they raced in three separate years and were never on one podium
// together. Page copy makes both of those points explicit.
function layoutPosition(index: number, era: Driver["era"]): { x: number; z: number } {
  if (era === "sepang-history") {
    return { x: (index - 1) * 0.9, z: 0 };
  }
  const teamIndex = Math.floor(index / 2);
  const side = index % 2 === 0 ? -1 : 1;
  return {
    x: side * 0.3,
    z: teamIndex * 0.55 - 2.75 + side * 0.08,
  };
}

function initialsTexture(initials: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4efe6";
  ctx.font = "700 52px 'Geist Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function DriverGridScene({ drivers, selectedId, onSelect }: DriverGridSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const padMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || drivers.length === 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0e);

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    sun.position.set(4, 6, 2);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    scene.add(new THREE.GridHelper(20, 40, 0x2a3036, 0x1c2126));

    const disposables: Array<{ dispose: () => void }> = [];
    const markerGroup = new THREE.Group();
    padMeshesRef.current = new Map();

    drivers.forEach((driver, index) => {
      const { x, z } = layoutPosition(index, driver.era);
      const group = new THREE.Group();
      group.position.set(x, 0, z);

      const padGeometry = new THREE.CylinderGeometry(0.11, 0.13, 0.03, 20);
      const padMaterial = new THREE.MeshStandardMaterial({
        color: 0xa39b8f,
        emissive: 0xa39b8f,
        emissiveIntensity: 0.2,
        roughness: 0.7,
      });
      const pad = new THREE.Mesh(padGeometry, padMaterial);
      pad.userData.driverId = driver.id;
      pad.position.y = 0.015;
      group.add(pad);
      disposables.push(padGeometry, padMaterial);

      const poleGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8);
      const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.9 });
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.y = 0.14;
      group.add(pole);
      disposables.push(poleGeometry, poleMaterial);

      const texture = initialsTexture(driver.initials);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.y = 0.34;
      sprite.scale.set(0.22, 0.22, 1);
      sprite.userData.driverId = driver.id;
      group.add(sprite);
      disposables.push(texture, spriteMaterial);

      markerGroup.add(group);
      padMeshesRef.current.set(driver.id, pad);
    });
    scene.add(markerGroup);

    const box = new THREE.Box3().setFromObject(markerGroup);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const radius = Math.max(size * 1.3, 2.1);

    let azimuth = Math.PI * 0.32;
    const elevation = 0.6;
    let autoRotate = true;
    let dragging = false;
    let lastX = 0;

    const applyCamera = () => {
      const x = center.x + radius * Math.cos(azimuth);
      const z = center.z + radius * Math.sin(azimuth);
      const y = radius * elevation;
      camera.position.set(x, y, z);
      camera.lookAt(center);
    };
    applyCamera();

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      autoRotate = false;
      lastX = event.clientX;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      azimuth += (event.clientX - lastX) * 0.005;
      lastX = event.clientX;
      applyCamera();
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(Array.from(padMeshesRef.current.values()));
      if (hits.length > 0) {
        const id = hits[0].object.userData.driverId as string;
        onSelectRef.current(id);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
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
      if (autoRotate) {
        azimuth += 0.0016;
        applyCamera();
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [drivers]);

  // Reflect externally-driven selection (from the list below, not just the
  // canvas) onto the pad meshes' scale/color — same pattern as the corner
  // hotspots in CircuitExplorer3D.
  useEffect(() => {
    padMeshesRef.current.forEach((mesh, id) => {
      const active = id === selectedId;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.set(active ? 0xf5a623 : 0xa39b8f);
      material.emissive.set(active ? 0xf5a623 : 0xa39b8f);
      material.emissiveIntensity = active ? 0.6 : 0.2;
      mesh.scale.setScalar(active ? 1.35 : 1);
    });
  }, [selectedId]);

  return (
    <div
      ref={mountRef}
      className="h-[46vh] w-full cursor-grab overflow-hidden rounded-lg border border-paper/10 bg-asphalt active:cursor-grabbing sm:h-[52vh]"
      role="img"
      aria-label="Interactive 3D layout of driver markers, arranged by team or by era. Select a driver here or from the list below to see their stats."
    />
  );
}
