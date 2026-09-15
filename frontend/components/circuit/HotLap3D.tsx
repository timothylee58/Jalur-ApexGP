"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { registerTerrain } from "@/lib/circuitTerrainAlign";
import { buildFlyoverCurve } from "@/lib/circuitFlyoverTrack";
import {
  buildHotLapProjection,
  buildSpeedRibbon,
  makeLabelSprite,
  segmentPoints,
  speedColor,
} from "@/lib/hotLapTrack";
import { sampleAtTime, simulateLap, type LapSample } from "@/lib/lapSim";

const TERRAIN_SRC = "/models/sepang.glb";
const DRACO_DECODER_PATH = "/draco/";

/** Sector accents — distinct enough to read the three splits apart at a glance. */
const SECTOR_COLOR = ["#f5a623", "#2ec4b6", "#c8ff00"] as const;

export type CameraMode = "orbit" | "chase";

export interface SeekRequest {
  /** Seconds into the lap to jump to. */
  t: number;
  /** Bumped by the caller to re-trigger a seek to the same time. */
  nonce: number;
}

interface HotLap3DProps {
  playing: boolean;
  cameraMode: CameraMode;
  /** Highlighted corner, by turn number. */
  focusTurn: number | null;
  seek: SeekRequest | null;
  /**
   * Throttled to ~12 Hz. The scene runs its own clock at full frame rate;
   * lifting that into React state to drive the HUD would re-render the tree
   * 60 times a second for a readout the eye cannot follow that fast.
   */
  onSample: (sample: LapSample) => void;
}

export function HotLap3D({ playing, cameraMode, focusTurn, seek, onSample }: HotLap3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // Live props read inside the animation loop — kept in refs so changing
  // them never tears down and rebuilds the whole WebGL scene.
  const stateRef = useRef({ playing, cameraMode, focusTurn, seek, onSample });
  stateRef.current = { playing, cameraMode, focusTurn, seek, onSample };
  const cornerMarkersRef = useRef<Map<number, THREE.Object3D[]>>(new Map());

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const lap = simulateLap();
    const projection = buildHotLapProjection(lap);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0e);
    scene.fog = new THREE.Fog(0x0a0c0e, 14, 34);

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.05,
      100,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.95);
    sun.position.set(4, 6, 2);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const grid = new THREE.GridHelper(24, 48, 0x2a3036, 0x1c2126);
    scene.add(grid);

    const disposables: Array<{ dispose: () => void }> = [];

    // --- The racing line, coloured by solved speed ------------------------
    const ribbonGeometry = buildSpeedRibbon(lap, projection, 0.042);
    const ribbon = new THREE.Mesh(
      ribbonGeometry,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    );
    scene.add(ribbon);
    disposables.push(ribbonGeometry);

    // Braking zones ride just above the ribbon as a brighter red overlay —
    // the single most useful thing to see on a circuit map, so it gets to
    // sit on top of the speed colouring rather than blend into it.
    for (const zone of lap.brakingZones) {
      const points = segmentPoints(lap, projection, zone.startS, zone.endS, 0.028);
      if (points.length < 2) continue;
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0xff3b1f, transparent: true, opacity: 0.95 }),
      );
      scene.add(line);
      disposables.push(geometry);
    }

    // --- Sector gates ------------------------------------------------------
    const [split1, split2] = lap.sectorSplitsM;
    [0, split1, split2].forEach((s, index) => {
      const at = lap.samples.reduce((best, sample) =>
        Math.abs(sample.s - s) < Math.abs(best.s - s) ? sample : best,
      );
      const atIndex = lap.samples.indexOf(at);
      const next = lap.samples[(atIndex + 4) % lap.samples.length];
      const here = projection.toScene(at);
      const ahead = projection.toScene(next);
      const tangent = ahead.clone().sub(here).normalize();

      const gate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.13, 0.09),
        new THREE.MeshBasicMaterial({
          color: SECTOR_COLOR[index],
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      gate.position.copy(here).setY(0.045);
      gate.rotation.y = Math.atan2(tangent.x, tangent.z);
      scene.add(gate);

      const label = makeLabelSprite(index === 0 ? "S/F" : `S${index + 1}`, SECTOR_COLOR[index]);
      label.position.copy(here).setY(0.2);
      scene.add(label);
    });

    // --- Corner apex markers with their speeds ----------------------------
    for (const corner of lap.corners) {
      const sample = lap.samples.reduce((best, s) =>
        Math.abs(s.s - corner.s) < Math.abs(best.s - corner.s) ? s : best,
      );
      const position = projection.toScene(sample);
      const accent = SECTOR_COLOR[corner.sector - 1];

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 14, 14),
        new THREE.MeshBasicMaterial({ color: accent }),
      );
      dot.position.copy(position).setY(0.055);

      const label = makeLabelSprite(
        `${corner.code}  ${Math.round(corner.apexSpeedKmh)}`,
        accent,
      );
      label.position.copy(position).setY(0.16);
      label.visible = false;

      scene.add(dot, label);
      cornerMarkersRef.current.set(corner.turn, [dot, label]);
    }

    // --- The car -----------------------------------------------------------
    const car = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    car.position.copy(projection.toScene(lap.samples[0])).setY(0.06);
    scene.add(car);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.07, 0.1, 28),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    scene.add(halo);

    // Short fading trail behind the car, recoloured each frame by the speed
    // it was doing at each point — so the trail reads as a live speed trace
    // rather than just a motion smear.
    const TRAIL = 40;
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array(TRAIL * 3).fill(0), 3),
    );
    trailGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(new Array(TRAIL * 3).fill(1), 3),
    );
    const trail = new THREE.Line(
      trailGeometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
    );
    scene.add(trail);
    disposables.push(trailGeometry);

    // --- Real terrain ------------------------------------------------------
    // Registered against the flyover curve, which buildHotLapProjection is
    // built to coincide with (see lib/hotLapTrack's docstring).
    const flyoverCurve = buildFlyoverCurve();
    // sepang.glb is large enough that navigating away mid-load is normal.
    // Without this the callback still runs, mutating a scene whose
    // geometries and renderer the cleanup below has already disposed.
    let cancelled = false;
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.load(
      TERRAIN_SRC,
      (gltf) => {
        if (cancelled) return;
        const terrain = gltf.scene;
        terrain.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = child.material as THREE.MeshStandardMaterial | undefined;
            if (!material?.map) {
              child.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.7,
                metalness: 0.05,
                side: THREE.DoubleSide,
              });
            }
            disposables.push(child.geometry);
          }
        });

        const objectBaseYs: number[] = [];
        terrain.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.name.startsWith("Palm")) {
            objectBaseYs.push(new THREE.Box3().setFromObject(child).min.y);
          }
        });
        objectBaseYs.sort((a, b) => a - b);
        const groundY = objectBaseYs[Math.floor(objectBaseYs.length / 2)] ?? 0;

        const ribbonSamples = flyoverCurve.getSpacedPoints(240).map((p) => ({ x: p.x, z: p.z }));
        registerTerrain(terrain, ribbonSamples, groundY);
        scene.add(terrain);
        ground.visible = false;
        grid.visible = false;
      },
      undefined,
      () => {
        // Terrain missing — the grid fallback above stays visible and the
        // racing line still reads fine on its own.
      },
    );

    // --- Camera ------------------------------------------------------------
    let azimuth = Math.PI * 0.28;
    let autoRotate = true;
    let dragging = false;
    let lastX = 0;
    const orbitRadius = projection.radius * 2.6;
    const chaseTarget = new THREE.Vector3();

    const applyOrbitCamera = () => {
      camera.position.set(
        Math.cos(azimuth) * orbitRadius,
        orbitRadius * 0.62,
        Math.sin(azimuth) * orbitRadius,
      );
      camera.lookAt(0, 0, 0);
    };
    applyOrbitCamera();

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      autoRotate = false;
      lastX = event.clientX;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || stateRef.current.cameraMode !== "orbit") return;
      azimuth += (event.clientX - lastX) * 0.005;
      lastX = event.clientX;
      applyOrbitCamera();
    };
    const onPointerUp = () => {
      dragging = false;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const speedRange = Math.max(1, lap.topSpeedKmh - lap.minSpeedKmh);
    let frameId = 0;
    let lapTime = 0;
    let lastFrame = performance.now();
    let lastReport = 0;
    let lastSeenNonce = stateRef.current.seek?.nonce ?? -1;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      // Real elapsed time, clamped so a backgrounded tab doesn't resume by
      // teleporting the car several laps forward.
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;

      const { cameraMode: mode, seek, playing: isPlaying, onSample: report } = stateRef.current;

      if (seek && seek.nonce !== lastSeenNonce) {
        lastSeenNonce = seek.nonce;
        lapTime = seek.t;
      } else if (isPlaying) {
        lapTime = (lapTime + dt) % lap.lapTimeS;
      }

      const sample = sampleAtTime(lap, lapTime);
      if (now - lastReport > 80) {
        lastReport = now;
        report(sample);
      }
      const position = projection.toScene(sample).setY(0.06);
      car.position.copy(position);
      halo.position.copy(position).setY(0.02);

      const carColor = speedColor((sample.speedKmh - lap.minSpeedKmh) / speedRange);
      (car.material as THREE.MeshBasicMaterial).color.copy(carColor);
      (halo.material as THREE.MeshBasicMaterial).color.copy(carColor);
      // Braking pulses the halo — the one channel worth seeing peripherally
      // while you're reading the numbers in the HUD.
      halo.scale.setScalar(sample.braking ? 1.45 : 1);

      const positions = trailGeometry.getAttribute("position") as THREE.BufferAttribute;
      const colors = trailGeometry.getAttribute("color") as THREE.BufferAttribute;
      for (let i = 0; i < TRAIL; i += 1) {
        const back = sampleAtTime(lap, lapTime - i * 0.055);
        const p = projection.toScene(back).setY(0.05);
        positions.setXYZ(i, p.x, p.y, p.z);
        const c = speedColor((back.speedKmh - lap.minSpeedKmh) / speedRange);
        const fade = 1 - i / TRAIL;
        colors.setXYZ(i, c.r * fade, c.g * fade, c.b * fade);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;

      if (mode === "chase") {
        const ahead = sampleAtTime(lap, lapTime + 0.35);
        const aheadPoint = projection.toScene(ahead);
        const back = position.clone().sub(aheadPoint).normalize().multiplyScalar(0.62);
        camera.position.copy(position).add(back).setY(0.36);
        chaseTarget.lerpVectors(position, aheadPoint, 1.6);
        camera.lookAt(chaseTarget);
      } else {
        if (autoRotate) {
          azimuth += 0.0016;
        }
        applyOrbitCamera();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      cornerMarkersRef.current.clear();
      disposables.forEach((item) => item.dispose());
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      dracoLoader.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // Built once: everything that changes per-frame or per-prop is read
    // through stateRef inside the loop instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only the focused corner shows its speed label — all 15 at once is
  // unreadable at this zoom.
  useEffect(() => {
    cornerMarkersRef.current.forEach(([dot, label], turn) => {
      const active = turn === focusTurn;
      label.visible = active;
      dot.scale.setScalar(active ? 1.8 : 1);
    });
  }, [focusTurn]);

  return (
    <div
      ref={mountRef}
      className="h-[46vh] w-full cursor-grab overflow-hidden rounded-lg border border-paper/10 bg-pit-carbon active:cursor-grabbing sm:h-[56vh]"
      role="img"
      aria-label="3D model of Sepang International Circuit showing a simulated hot lap: the racing line is coloured by speed, braking zones are marked in red, and the three timing sectors are gated at their split points."
    />
  );
}
