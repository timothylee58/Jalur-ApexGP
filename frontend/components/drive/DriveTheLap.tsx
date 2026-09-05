"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildFlyoverRibbon } from "@/lib/circuitFlyoverTrack";
import { buildCornerSpeedProfile, buildDriveCurve, safeSpeedAt } from "@/lib/driveLapTrack";

const CAR_SRC = "/models/car.glb";
const STORAGE_KEY = "jalur-apexgp-drive-best-ms";

const ACCEL_KMH_S = 70; // throttle held
const MAX_SPEED_KMH = 355; // roughly a real F1 top speed on this straight — nothing else caps throttle-held acceleration
const COAST_DRAG_KMH_S = 25; // no input
const BRAKE_DECEL_KMH_S = 150; // brake held
const OVERSPEED_TOLERANCE = 1.18; // 18% over the curvature-derived "safe" speed before it counts as off-track
const PENALTY_SECONDS = 3;
const PENALTY_COOLDOWN_S = 1.2;
const POST_SPIN_SPEED_FACTOR = 0.35;

function formatLapTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—:--.---";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

/**
 * Arcade lap-time-attack: throttle/brake only, no steering — the car
 * follows the real apex-point centreline (lib/driveLapTrack.ts) at true
 * metre scale, and the skill is managing speed into each corner. Go too
 * fast past the curvature-derived "safe" speed for the corner you're in
 * and it counts as off-track: a time penalty and a speed cut, same shape
 * as a real off-track/track-limits call, not a full tyre-grip sim.
 *
 * Reuses this project's existing real 3D assets rather than adding new
 * ones: the same car.glb CircuitFlyoverHero uses, and the same real
 * apex-point centreline data (data/sepangCircuit.ts) as the 2D map and
 * sepang.glb — see lib/driveLapTrack.ts for why it rebuilds the curve at
 * metre scale instead of importing circuitFlyoverTrack.ts's rescaled
 * decorative version.
 */
export function DriveTheLap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const speedTextRef = useRef<HTMLParagraphElement>(null);
  const cornerTextRef = useRef<HTMLParagraphElement>(null);
  const timeTextRef = useRef<HTMLParagraphElement>(null);
  const bestTextRef = useRef<HTMLParagraphElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let bestMs: number | null = null;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) bestMs = Number(saved);
    } catch {
      // private mode / blocked storage — best time just won't persist
    }
    if (bestTextRef.current) {
      bestTextRef.current.textContent = bestMs ? formatLapTime(bestMs) : "—:--.---";
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0e);
    scene.fog = new THREE.Fog(0x0a0c0e, 110, 480);

    const camera = new THREE.PerspectiveCamera(
      62,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.5,
      1200,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.1);
    sun.position.set(120, 180, 60);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshStandardMaterial({ color: 0x1a2128, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    const curve = buildDriveCurve();
    const lapLengthMetres = curve.getLength();
    const profile = buildCornerSpeedProfile(curve);

    const trackWidth = 14;
    const { geometry: ribbonGeometry } = buildFlyoverRibbon(curve, trackWidth, 480);
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a3036,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    scene.add(ribbon);

    const startPoint = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0);
    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(trackWidth, 0.06, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xf4efe6 }),
    );
    startLine.position.copy(startPoint).setY(0.05);
    startLine.rotation.y = Math.atan2(startTangent.x, startTangent.z);
    scene.add(startLine);

    // Colour-coded corner markers (green/amber/red by safe speed) — a
    // heads-up on what's coming, same idea as real trackside boards, sized
    // from this project's own curvature-derived profile rather than
    // fixed at real corner positions.
    const markerDisposables: Array<{ dispose: () => void }> = [];
    const markerStep = Math.max(1, Math.floor(profile.length / 40));
    for (let i = 0; i < profile.length; i += markerStep) {
      const sample = profile[i];
      const color =
        sample.safeSpeedKmh > 260 ? 0x2ec4b6 : sample.safeSpeedKmh > 150 ? 0xf5a623 : 0xc23b22;
      const geometry = new THREE.BoxGeometry(1.4, 2.2, 0.6);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.4,
        roughness: 0.6,
      });
      markerDisposables.push(geometry, material);
      const t = i / (profile.length - 1);
      const tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const pos = sample.point.clone().addScaledVector(normal, trackWidth / 2 + 4);
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(pos.x, 1.1, pos.z);
      scene.add(marker);
    }

    let car: THREE.Object3D | null = null;
    const carDisposables: Array<{ dispose: () => void }> = [];
    new GLTFLoader().load(
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
        const carSize = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
        car.scale.setScalar(4.8 / Math.max(carSize.x, carSize.z, 0.001));
        scene.add(car);
      },
      undefined,
      () => {
        car = null;
      },
    );

    // ---- Game state (plain mutable refs — driven every animation frame,
    // not React state, so a lap doesn't cost a re-render per frame). ----
    let speedKmh = 0;
    let distanceM = 0;
    let lapStartMs = performance.now();
    let penaltySecondsThisLap = 0;
    let lastPenaltyAt = -Infinity;
    let lapNumber = 1;
    let throttle = false;
    let brake = false;
    let messageUntil = 0;

    const setMessage = (text: string, durationMs: number, color: string) => {
      messageUntil = performance.now() + durationMs;
      if (messageRef.current) {
        messageRef.current.textContent = text;
        messageRef.current.style.color = color;
      }
    };
    setMessage("Hold throttle — lap starts now", 2200, "#a39b8f");

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") throttle = true;
      if (e.code === "ArrowDown" || e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyS")
        brake = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") throttle = false;
      if (e.code === "ArrowDown" || e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyS")
        brake = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Exposed for the on-screen touch buttons rendered by the parent
    // component (outside this three.js mount) — simplest way to share
    // these mutable refs without lifting the whole game into React state.
    const controlHandle = {
      setThrottle: (v: boolean) => {
        throttle = v;
      },
      setBrake: (v: boolean) => {
        brake = v;
      },
    };
    (mount as unknown as { __driveControls?: typeof controlHandle }).__driveControls = controlHandle;

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const chasePos = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const clock = new THREE.Clock();
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();

      if (throttle) speedKmh += ACCEL_KMH_S * dt;
      else if (brake) speedKmh -= BRAKE_DECEL_KMH_S * dt;
      else speedKmh -= COAST_DRAG_KMH_S * dt;
      speedKmh = Math.min(MAX_SPEED_KMH, Math.max(0, speedKmh));

      const priorLap = lapNumber;
      distanceM += (speedKmh / 3.6) * dt;
      lapNumber = Math.floor(distanceM / lapLengthMetres) + 1;
      const t = (distanceM % lapLengthMetres) / lapLengthMetres;

      if (lapNumber !== priorLap) {
        const lapMs = now - lapStartMs + penaltySecondsThisLap * 1000;
        if (bestMs === null || lapMs < bestMs) {
          bestMs = lapMs;
          try {
            window.localStorage.setItem(STORAGE_KEY, String(Math.round(bestMs)));
          } catch {
            // ignore
          }
          if (bestTextRef.current) bestTextRef.current.textContent = formatLapTime(bestMs);
          setMessage(`New best — ${formatLapTime(lapMs)}`, 3000, "#f5a623");
        } else {
          setMessage(`Lap ${priorLap} — ${formatLapTime(lapMs)}`, 3000, "#f4efe6");
        }
        lapStartMs = now;
        penaltySecondsThisLap = 0;
      }

      const safeSpeed = safeSpeedAt(profile, t);
      if (speedKmh > safeSpeed * OVERSPEED_TOLERANCE && now - lastPenaltyAt > PENALTY_COOLDOWN_S * 1000) {
        lastPenaltyAt = now;
        penaltySecondsThisLap += PENALTY_SECONDS;
        speedKmh *= POST_SPIN_SPEED_FACTOR;
        setMessage(`Off track — +${PENALTY_SECONDS}s`, 1600, "#c23b22");
      }

      const point = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      if (car) {
        car.position.copy(point).setY(0.02);
        car.rotation.y = Math.atan2(tangent.x, tangent.z);
      }

      const behind = curve.getPointAt(((t - 7 / lapLengthMetres) % 1 + 1) % 1);
      chasePos.set(behind.x, 2.6, behind.z);
      const ahead = curve.getPointAt((t + 14 / lapLengthMetres) % 1);
      lookTarget.set(ahead.x, 0.8, ahead.z);
      camera.position.lerp(chasePos, 0.18);
      camera.lookAt(lookTarget);

      if (speedTextRef.current) speedTextRef.current.textContent = String(Math.round(speedKmh));
      if (cornerTextRef.current) cornerTextRef.current.textContent = `${Math.round(safeSpeed)} km/h`;
      if (timeTextRef.current) {
        const liveMs = now - lapStartMs + penaltySecondsThisLap * 1000;
        timeTextRef.current.textContent = formatLapTime(liveMs);
      }
      if (messageRef.current && now > messageUntil) messageRef.current.textContent = "";

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      ribbonGeometry.dispose();
      ribbonMaterial.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      startLine.geometry.dispose();
      (startLine.material as THREE.Material).dispose();
      markerDisposables.forEach((item) => item.dispose());
      carDisposables.forEach((item) => item.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  const press = (control: "throttle" | "brake", value: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    const handle = (mountRef.current as unknown as {
      __driveControls?: { setThrottle: (v: boolean) => void; setBrake: (v: boolean) => void };
    } | null)?.__driveControls;
    if (!handle) return;
    if (control === "throttle") handle.setThrottle(value);
    else handle.setBrake(value);
  };

  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-paper/10 bg-asphalt sm:aspect-[16/9]">
      <div ref={mountRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Speed</p>
          <p ref={speedTextRef} className="font-mono text-3xl leading-none text-paper sm:text-4xl">
            0
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">km/h</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Lap time</p>
          <p ref={timeTextRef} className="font-mono text-3xl leading-none text-amber sm:text-4xl">
            0:00.000
          </p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
            Best <span ref={bestTextRef}>—:--.---</span>
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-4">
        <p ref={messageRef} className="font-display text-lg uppercase tracking-wide sm:text-2xl" />
      </div>

      <div className="pointer-events-none absolute bottom-16 left-3 sm:bottom-20">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
          Corner-safe <span ref={cornerTextRef}>—</span>
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-3 sm:p-4">
        <button
          type="button"
          onPointerDown={press("brake", true)}
          onPointerUp={press("brake", false)}
          onPointerLeave={press("brake", false)}
          onPointerCancel={press("brake", false)}
          className="select-none rounded-full border border-brick/50 bg-brick/10 px-6 py-3 font-mono text-xs uppercase tracking-wide text-paper active:bg-brick/30 sm:hidden"
        >
          Brake
        </button>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim sm:block">
          Hold Space / W to accelerate · Shift / S to brake
        </p>
        <button
          type="button"
          onPointerDown={press("throttle", true)}
          onPointerUp={press("throttle", false)}
          onPointerLeave={press("throttle", false)}
          onPointerCancel={press("throttle", false)}
          className="select-none rounded-full border border-teal/50 bg-teal/10 px-6 py-3 font-mono text-xs uppercase tracking-wide text-paper active:bg-teal/30 sm:hidden"
        >
          Throttle
        </button>
      </div>
    </div>
  );
}
