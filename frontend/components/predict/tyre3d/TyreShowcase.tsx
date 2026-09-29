"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TyreOption } from "@/components/predict/TyreArt";
import { TYRE_COLOR } from "@/components/predict/TyreArt";
import { buildGhostTyre, buildTyre, type TyreModel } from "./buildTyre";
import { createRenderer, createStage } from "./stage";

// Rolling speeds, rad/s. Selecting a compound spins it up hard, then it
// settles to a slow constant roll — the same motion the SVG picker had.
const IDLE_SPIN = 0.32;
const KICK_SPIN = 16;
const SETTLE_S = 0.32;
// How long a dragged tyre takes to swing back to the composed angle.
const YAW_RETURN_S = 1.4;

/**
 * The selected starting tyre as a live 3D model. Drag to turn it; it eases
 * back to the three-quarter view on release. Pauses offscreen. With
 * prefers-reduced-motion it neither rolls nor spins up — it simply changes.
 * If WebGL is unavailable, `fallback` renders instead.
 */
export function TyreShowcase({
  option,
  fallback,
  onReady,
}: {
  option: TyreOption;
  fallback: ReactNode;
  /** Called once the first frame is on screen (or WebGL has failed and the
   * fallback is showing), so the host can stop showing its placeholder. */
  onReady?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionRef = useRef(option);
  const kickRef = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  optionRef.current = option;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const renderer = createRenderer(canvas);
    if (!renderer) {
      setFailed(true);
      readyRef.current?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const stage = createStage(renderer);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const models = new Map<TyreOption, TyreModel>();
    const modelFor = (o: TyreOption) => {
      let m = models.get(o);
      if (!m) {
        m = o === "Auto" ? buildGhostTyre() : buildTyre(o);
        models.set(o, m);
      }
      return m;
    };

    let current: TyreModel | null = null;
    let shown: TyreOption | null = null;
    let roll = -0.35;
    let spin = reduce ? 0 : IDLE_SPIN;
    let yaw = 0;
    let heat = 0;

    const show = (o: TyreOption) => {
      if (current) stage.scene.remove(current.root);
      current = modelFor(o);
      stage.scene.add(current.root);
      shown = o;
      if (o === "Auto") {
        stage.heat.intensity = 0;
        heat = 0;
      } else {
        stage.heat.color.set(TYRE_COLOR[o]);
        heat = reduce ? 1.4 : 7;
      }
    };

    kickRef.current = () => {
      if (!reduce) spin = KICK_SPIN;
    };

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      stage.camera.aspect = width / height;
      stage.camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Drag to turn about the vertical axis.
    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw = Math.max(-1.3, Math.min(1.3, yaw + (e.clientX - lastX) * 0.012));
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // The loop only runs while the stage is on screen and the tab is
    // visible: off screen, no frames are scheduled at all.
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let announced = false;
    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (shown !== optionRef.current) show(optionRef.current);
      if (current) {
        const idle = reduce ? 0 : IDLE_SPIN;
        spin = idle + (spin - idle) * Math.exp(-dt / SETTLE_S);
        roll -= spin * dt;
        // Under reduced motion a released tyre snaps square instead of
        // easing back.
        if (!dragging) yaw = reduce ? 0 : yaw + (0 - yaw) * (1 - Math.exp(-dt / YAW_RETURN_S));
        const target = shown === "Auto" ? 0 : reduce ? 1.4 : 1.2;
        heat = target + (heat - target) * Math.exp(-dt / 0.6);
        stage.heat.intensity = heat;

        current.wheel.rotation.z = roll;
        current.root.rotation.y = yaw;
        renderer.render(stage.scene, stage.camera);
        if (!announced) {
          announced = true;
          readyRef.current?.();
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      start();
    });
    io.observe(host);
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      models.forEach((m) => m.dispose());
      stage.dispose();
      renderer.dispose();
    };
  }, []);

  // A new selection spins the tyre up; the frame loop picks up the swap.
  useEffect(() => {
    kickRef.current();
  }, [option]);

  if (failed) return <>{fallback}</>;

  return (
    <div ref={hostRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
      />
    </div>
  );
}
