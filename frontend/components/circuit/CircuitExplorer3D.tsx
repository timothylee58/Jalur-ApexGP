"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { circuitCorners } from "@/data/circuitCorners";
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

// Traced by eye from the circuit's published general map — a stylized
// closed loop reflecting its actual shape (pit straight, a tight hairpin
// section, a long outer sweep), not survey-grade track geometry. Same
// honesty standard the strategy engine holds itself to: this is a
// showcase model, not a simulator.
const TRACK_POINTS: Array<[number, number]> = [
  [0.0, -0.2],
  [1.0, -0.5],
  [1.8, -1.3],
  [2.6, -1.6],
  [3.3, -1.0],
  [3.5, 0.0],
  [3.2, 1.0],
  [2.5, 1.7],
  [1.5, 2.1],
  [0.3, 2.0],
  [-0.8, 1.5],
  [-1.6, 0.5],
  [-1.2, -0.4],
  [-0.5, -0.6],
];

const GRANDSTANDS: Array<{ x: number; z: number; color: number; label: string }> = [
  { x: -0.2, z: -0.9, color: 0xf5a623, label: "Main" }, // start/finish
  { x: -1.6, z: -0.9, color: 0xf5a623, label: "K1/K2" }, // hairpin
  { x: 3.6, z: -0.6, color: 0x2ec4b6, label: "G" }, // esses outer — matches the app's teal accent
  { x: 3.9, z: 1.1, color: 0x2ec4b6, label: "F" }, // T9 apex
  { x: -0.5, z: 2.6, color: 0xa39b8f, label: "C" }, // bottom sweep — matches paper-dim
  { x: -2.2, z: 1.0, color: 0xa39b8f, label: "B" },
];

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

    // Track curve + ribbon.
    const curvePoints = TRACK_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(curvePoints, true, "catmullrom", 0.5);
    const samples = curve.getSpacedPoints(240);
    const tangents = samples.map((_, i) => curve.getTangentAt(i / (samples.length - 1)));

    const ribbonWidth = 0.16;
    const positions: number[] = [];
    const indices: number[] = [];
    samples.forEach((point, i) => {
      const tangent = tangents[i];
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const left = point.clone().addScaledVector(normal, ribbonWidth / 2);
      const right = point.clone().addScaledVector(normal, -ribbonWidth / 2);
      positions.push(left.x, left.y + 0.01, left.z, right.x, right.y + 0.01, right.z);
      if (i < samples.length - 1) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    // Close the loop back to the first pair.
    const last = (samples.length - 1) * 2;
    indices.push(last, last + 1, 0, last + 1, 1, 0);

    const ribbonGeometry = new THREE.BufferGeometry();
    ribbonGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    ribbonGeometry.setIndex(indices);
    ribbonGeometry.computeVertexNormals();
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

    // Grandstand blocks — decorative, positioned near the traced ribbon.
    GRANDSTANDS.forEach(({ x, z, color }) => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.1, 0.14),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.35,
          roughness: 0.6,
        }),
      );
      box.position.set(x, 0.05, z);
      scene.add(box);
    });

    // Corner hotspots.
    const hotspotGroup = new THREE.Group();
    circuitCorners.forEach((corner) => {
      const point = curve.getPointAt(corner.t);
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
      aria-label="Interactive stylized 3D model of the Sepang International Circuit layout with all 15 corner markers"
    />
  );
}
