"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { circuitCorners } from "@/data/circuitCorners";
import {
  buildFlyoverCurve,
  buildFlyoverRibbon,
  FLYOVER_GRANDSTANDS,
  grandstandPosition,
} from "@/lib/circuitFlyoverTrack";
import { progressFractionAt } from "@/lib/telemetry";
import type { TelemetrySample } from "@/types/telemetry";

const CAR_SRC = "/models/car.glb";
// Seconds for one lap of the traced curve — arbitrary showcase pacing, used
// whenever `realLap` isn't supplied (or hasn't loaded yet), not derived
// from any real lap time.
const LAP_SECONDS = 14;

export interface RealLapPacing {
  samples: TelemetrySample[];
  /** Same length/order as samples — see lib/telemetry.ts's buildDistanceProgress. */
  distanceProgress: number[];
  /** Seconds into the real lap right now, driven by a playback clock the
   * caller owns (e.g. useTelemetryPlayback) — read every animation frame
   * via a ref, not by re-running this component's three.js setup effect. */
  currentTime: number;
}

interface CircuitExplorer3DProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** When present, paces the car by a real lap's actual speed rhythm
   * instead of the arbitrary constant-time loop — see the module-level
   * RealLapPacing doc comment. */
  realLap?: RealLapPacing | null;
}

export function CircuitExplorer3D({ selectedId, onSelect, realLap = null }: CircuitExplorer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  // Read inside the rAF loop below rather than closed over at effect-setup
  // time — that effect only runs once (empty dep array, same as the rest
  // of this component's setup), so a plain closure would freeze whatever
  // realLap was on first mount.
  const realLapRef = useRef(realLap);
  realLapRef.current = realLap;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

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

    // Lighting — soft ambient plus a single raking directional light so the
    // track ribbon reads with some depth without needing shadow maps.
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    sun.position.set(4, 6, 2);
    scene.add(sun);

    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const grid = new THREE.GridHelper(20, 40, 0x2a3036, 0x1c2126);
    scene.add(grid);

    // Track curve + ribbon — the real apex-point centreline
    // (data/sepang.json via lib/circuitFlyoverTrack), the same source
    // CircuitFlyoverHero builds its own curve from, rather than a
    // separately traced-by-eye loop. circuitCorners.ts's hotspot `t`
    // values are calibrated against this exact curve's point ordering.
    const ribbonWidth = 0.16;
    const curve = buildFlyoverCurve();
    const { geometry: ribbonGeometry } = buildFlyoverRibbon(curve, ribbonWidth);
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    scene.add(ribbon);

    // Start/finish line marker.
    const startPoint = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0);
    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(ribbonWidth, 0.02, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xf5a623 }),
    );
    startLine.position.copy(startPoint).setY(0.02);
    startLine.rotation.y = Math.atan2(startTangent.x, startTangent.z);
    scene.add(startLine);

    // Grandstand blocks — decorative, positioned as fractions along the
    // curve (same spec CircuitFlyoverHero uses) rather than hand-placed
    // world coordinates, so they stay sensible against this real geometry.
    const grandstandOffset = ribbonWidth * 1.4;
    FLYOVER_GRANDSTANDS.forEach((spec) => {
      const position = grandstandPosition(curve, spec, grandstandOffset);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.1, 0.14),
        new THREE.MeshStandardMaterial({
          color: spec.color,
          emissive: spec.color,
          emissiveIntensity: 0.35,
          roughness: 0.6,
        }),
      );
      box.position.set(position.x, 0.05, position.z);
      scene.add(box);
    });

    // Corner hotspots — placed with getPoint (raw parameter), not getPointAt
    // (arc-length): circuitCorners.ts's `t` values are each corner's exact
    // index among the curve's real apex control points, so the un-remapped
    // parameter lands exactly on that point. getPointAt is reserved for the
    // car's pacing below, where constant-speed arc-length traversal is what
    // actually matters.
    const hotspotGroup = new THREE.Group();
    circuitCorners.forEach((corner) => {
      const point = curve.getPoint(corner.t);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xf5a623 }),
      );
      dot.position.copy(point).setY(0.08);
      dot.userData.cornerId = corner.id;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.09, 0.12, 24),
        new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(point).setY(0.03);
      hotspotGroup.add(dot, ring);
      hotspotMeshesRef.current.set(corner.id, dot);
    });
    scene.add(hotspotGroup);

    // Animated car — a generic, unbranded model (see
    // scripts/generate_circuit_models.py) run around the traced curve at
    // an arbitrary showcase pace, purely decorative. Loaded async, so it
    // simply never appears if the GLB is missing rather than blocking the
    // rest of the scene.
    let car: THREE.Object3D | null = null;
    const carDisposables: Array<{ dispose: () => void }> = [];
    const carLoader = new GLTFLoader();
    carLoader.load(
      CAR_SRC,
      (gltf) => {
        car = gltf.scene;
        car.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            carDisposables.push(child.geometry);
            if (Array.isArray(child.material)) child.material.forEach((m) => carDisposables.push(m));
            else carDisposables.push(child.material);
          }
        });
        // Same auto-scale approach as CircuitModelPreview's track model —
        // this component's own units are small (the curve spans a few
        // units), so a car authored at roughly real-world scale needs
        // normalizing down rather than assuming any particular size.
        const carBox = new THREE.Box3().setFromObject(car);
        const carSize = carBox.getSize(new THREE.Vector3());
        const carScale = ribbonWidth * 3.2 / Math.max(carSize.x, carSize.z, 0.001);
        car.scale.setScalar(carScale);
        scene.add(car);
      },
      undefined,
      () => {
        car = null;
      },
    );

    // Camera framing — isometric-ish, orbiting around the ribbon's bounding
    // box center rather than the world origin (the traced loop isn't
    // centered at 0,0).
    const box = new THREE.Box3().setFromObject(ribbon);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() * 0.62;

    let azimuth = Math.PI * 0.28;
    const elevation = 0.62;
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
      const hits = raycaster.intersectObjects(Array.from(hotspotMeshesRef.current.values()));
      if (hits.length > 0) {
        const id = hits[0].object.userData.cornerId as string;
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

    const clock = new THREE.Clock();
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotate) {
        azimuth += 0.0018;
        applyCamera();
      }
      if (car) {
        const active = realLapRef.current;
        const t = active
          ? progressFractionAt(active.samples, active.distanceProgress, active.currentTime)
          : (clock.getElapsedTime() % LAP_SECONDS) / LAP_SECONDS;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        car.position.copy(point).setY(0.02);
        car.rotation.y = Math.atan2(tangent.x, tangent.z);
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
      ribbonGeometry.dispose();
      ribbonMaterial.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      carDisposables.forEach((item) => item.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Reflect the externally-selected corner (from clicking the list, not
  // just the canvas) onto the hotspot dots' scale/color.
  useEffect(() => {
    hotspotMeshesRef.current.forEach((mesh, id) => {
      const active = id === selectedId;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.set(active ? 0xffffff : 0xf5a623);
      const scale = active ? 1.6 : 1;
      mesh.scale.setScalar(scale);
    });
  }, [selectedId]);

  return (
    <div
      ref={mountRef}
      className="h-[52vh] w-full cursor-grab overflow-hidden rounded-lg border border-paper/10 bg-asphalt active:cursor-grabbing sm:h-[60vh]"
      role="img"
      aria-label="Interactive 3D model of the Sepang International Circuit layout, built from the circuit's real apex-point centreline, with all 15 corner markers"
    />
  );
}
