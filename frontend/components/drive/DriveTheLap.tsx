"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveTrack } from "@/lib/drive/track";
import { formatDelta, formatLapTime } from "@/lib/drive/timing";
import type { CameraMode, DriveGame, GhostMode, LapResult, Phase } from "./engine/game";
import { SPLIT_COLOUR, useFrameBus } from "./hud/bus";
import { Minimap, NextCorner, TimingPanel, WheelCluster } from "./hud/Hud";
import { LIVERIES } from "./scene/liveries";

type Split = keyof typeof SPLIT_COLOUR | null;

interface Message {
  id: number;
  kind: "off" | "jump" | "reaction" | "info";
  text: string;
}

const CAMERAS: { id: CameraMode; label: string }[] = [
  { id: "chase", label: "Chase" },
  { id: "tcam", label: "T-cam" },
  { id: "tv", label: "TV" },
];
const GHOSTS: { id: GhostMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "best", label: "Your best" },
  { id: "sim", label: "Sim lap" },
  { id: "off", label: "Off" },
];

/**
 * Time attack at Sepang in a 2026 car. Throttle, brake and Boost — the car
 * follows the real centreline, so the craft is where you brake, when you
 * spend the battery, and how much speed you carry into each corner. The
 * game itself (engine/game.ts) owns the loop; this component is the HUD,
 * the overlays that choreograph the start and each lap, and the controls.
 */
export function DriveTheLap() {
  const frame = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<DriveGame | null>(null);
  const bus = useFrameBus();
  const reduce = useReducedMotion() ?? false;

  const [track, setTrack] = useState<DriveTrack | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase | "loading">("loading");
  const [lights, setLights] = useState<{ lit: number; out: boolean }>({ lit: 0, out: false });
  const [splits, setSplits] = useState<Split[]>([null, null, null]);
  const [best, setBest] = useState<number | null>(null);
  const [lapCard, setLapCard] = useState<LapResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [camera, setCamera] = useState<CameraMode>("chase");
  const [ghost, setGhost] = useState<GhostMode>("auto");
  const [livery, setLivery] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const messageId = useRef(0);

  const say = useCallback((kind: Message["kind"], text: string) => {
    const id = (messageId.current += 1);
    setMessages((list) => [...list.slice(-2), { id, kind, text }]);
    window.setTimeout(() => setMessages((list) => list.filter((m) => m.id !== id)), 2200);
  }, []);

  // --- Game lifecycle --------------------------------------------------------
  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let cancelled = false;
    let instance: DriveGame | null = null;
    const lite =
      window.matchMedia("(max-width: 768px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    import("./engine/game")
      .then(({ DriveGame }) => {
        if (cancelled) return;
        try {
          instance = new DriveGame(el, {
            reducedMotion: reduce,
            lite,
            events: {
              phase: (p) => setPhase(p),
              lights: (lit, out) => setLights({ lit, out }),
              sector: (i, _t, colour) =>
                setSplits((s) => {
                  const next = i === 0 ? [null, null, null] : [...s];
                  next[i] = colour;
                  return next as Split[];
                }),
              lap: (result) => {
                setLapCard(result);
                setBest(result.bestTime);
                window.setTimeout(() => setLapCard((c) => (c === result ? null : c)), 4200);
              },
              message: say,
              frame: (t) => bus.current.forEach((fn) => fn(t)),
            },
          });
        } catch {
          setFailed(true);
          return;
        }
        game.current = instance;
        setTrack(instance.track);
        // A handle for driving the game from browser tests in development.
        if (process.env.NODE_ENV !== "production") (window as unknown as { __drive?: DriveGame }).__drive = instance;
        try {
          const stored = window.localStorage.getItem("jalur-apexgp-drive-best-ms");
          if (stored) setBest(Number(stored) / 1000);
        } catch {
          // No storage: no remembered best.
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      instance?.dispose();
      game.current = null;
    };
    // The game is built once; reduced motion is read at start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Keyboard, only while the game is on screen ---------------------------
  useEffect(() => {
    let onScreen = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.intersectionRatio > 0.4;
        // Mostly on screen: let the site's floating buttons step aside
        // (phones only — see globals.css).
        document.body.dataset.immersive = entry.intersectionRatio > 0.6 ? "true" : "false";
      },
      { threshold: [0, 0.4, 0.6, 1] },
    );
    if (frame.current) observer.observe(frame.current);
    const map: Record<string, "throttle" | "brake" | "boost"> = {
      KeyW: "throttle",
      ArrowUp: "throttle",
      Space: "throttle",
      KeyS: "brake",
      ArrowDown: "brake",
      ShiftLeft: "boost",
      ShiftRight: "boost",
      KeyE: "boost",
    };
    const down = (e: KeyboardEvent) => {
      if (!onScreen || !game.current) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      const control = map[e.code];
      if (control) {
        e.preventDefault();
        game.current.setInput({ [control]: true });
      } else if (e.code === "KeyR") game.current.restart();
      else if (e.code === "KeyP" || e.code === "Escape") game.current.togglePause();
      else if (e.code === "KeyC") {
        setCamera((c) => {
          const next = CAMERAS[(CAMERAS.findIndex((x) => x.id === c) + 1) % CAMERAS.length].id;
          game.current?.setCamera(next);
          return next;
        });
      }
    };
    const up = (e: KeyboardEvent) => {
      const control = map[e.code];
      if (control && game.current) game.current.setInput({ [control]: false });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      observer.disconnect();
      delete document.body.dataset.immersive;
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const hold = (control: "throttle" | "brake" | "boost") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      game.current?.setInput({ [control]: true });
    },
    onPointerUp: () => game.current?.setInput({ [control]: false }),
    onPointerCancel: () => game.current?.setInput({ [control]: false }),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void frame.current?.requestFullscreen?.().catch(() => undefined);
  };

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
      active ? "bg-paper text-pit-carbon" : "text-paper-dim hover:text-paper"
    }`;

  const racing = phase === "racing" || phase === "lights" || phase === "paused";

  return (
    <div>
      <div
        ref={frame}
        className={`relative w-full overflow-hidden bg-pit-carbon ${
          fullscreen ? "h-full" : "aspect-[3/4] rounded-lg border border-paper/10 sm:aspect-[16/9]"
        }`}
      >
        <div ref={mount} className="absolute inset-0" />

        {/* Cinematic vignette. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 55%, transparent 55%, rgba(0,0,0,0.45) 100%)" }}
        />

        {phase === "loading" || failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <p className="font-display text-xl uppercase tracking-wide text-paper">
              {failed ? "3D isn't available here" : "Building Sepang…"}
            </p>
            <p className="max-w-xs text-xs text-paper-dim">
              {failed
                ? "This browser couldn't start WebGL, which the game needs. Try another browser or device."
                : "Laying 5.5 km of asphalt, the grandstands and a few thousand palms."}
            </p>
          </div>
        ) : null}

        {/* Intro: letterbox bars and the title card over the drone shot. */}
        <AnimatePresence>
          {phase === "intro" ? (
            <motion.div key="intro" className="pointer-events-none absolute inset-0" exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              <motion.div className="absolute inset-x-0 top-0 h-[9%] bg-black" initial={{ y: "-100%" }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
              <motion.div className="absolute inset-x-0 bottom-0 h-[9%] bg-black" initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
              <div className="absolute bottom-[13%] left-5 sm:left-8">
                <motion.p
                  className="font-mono text-[10px] uppercase tracking-[0.35em] text-amber"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                >
                  Time attack · 2026 car
                </motion.p>
                <motion.p
                  className="mt-1 font-display text-3xl uppercase leading-none tracking-wide text-paper sm:text-5xl"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  Sepang International Circuit
                </motion.p>
                <motion.p
                  className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.6 }}
                >
                  5.543 km · 15 turns · Selangor, Malaysia · press throttle to skip
                </motion.p>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {track && racing ? (
          <>
            <div className="absolute left-2 top-2 sm:left-4 sm:top-4">
              <TimingPanel bus={bus} splits={splits} best={best} />
            </div>
            <div className="absolute right-2 top-2 rounded-md border border-paper/10 bg-pit-carbon/60 p-1.5 backdrop-blur-sm sm:right-4 sm:top-4">
              <Minimap bus={bus} track={track} />
            </div>
            <div className="absolute right-2 top-[7.4rem] sm:bottom-4 sm:left-4 sm:right-auto sm:top-auto">
              <NextCorner bus={bus} />
            </div>
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 sm:bottom-4">
              <WheelCluster bus={bus} />
            </div>
          </>
        ) : null}

        {/* The five red lights. */}
        <AnimatePresence>
          {phase === "lights" ? (
            <motion.div
              key="lights"
              className="pointer-events-none absolute left-1/2 top-[46%] flex -translate-x-1/2 gap-2 rounded-xl sm:top-[18%] border border-paper/10 bg-black/70 px-3 py-2 sm:gap-3"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              role="img"
              aria-label={`Start lights: ${lights.lit} of 5 lit`}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  {[0, 1].map((row) => (
                    <span
                      key={row}
                      className="block h-5 w-5 rounded-full transition-all duration-75 sm:h-7 sm:w-7"
                      style={{
                        background: i < lights.lit ? "#ff2410" : "#2a0806",
                        boxShadow: i < lights.lit ? "0 0 18px 4px rgba(255,36,16,0.65)" : "inset 0 0 4px rgba(0,0,0,0.8)",
                      }}
                    />
                  ))}
                </div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {phase === "racing" && lights.out ? (
            <motion.p
              key="go"
              className="pointer-events-none absolute left-1/2 top-[48%] -translate-x-1/2 whitespace-nowrap font-display text-5xl sm:top-[20%] uppercase tracking-wider text-paper sm:text-7xl"
              initial={{ opacity: 1, scale: 0.9 }}
              animate={{ opacity: 0, scale: 1.25 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              onAnimationComplete={() => setLights((l) => ({ ...l, out: false }))}
            >
              Lights out
            </motion.p>
          ) : null}
        </AnimatePresence>

        {/* Race-control messages. */}
        <div className="pointer-events-none absolute inset-x-0 top-[46%] flex flex-col items-center gap-2 sm:top-[34%]" aria-live="polite">
          <AnimatePresence>
            {messages.map((m) => (
              <motion.p
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className={`rounded-md border px-4 py-1.5 font-display text-lg uppercase tracking-wider backdrop-blur-sm sm:text-2xl ${
                  m.kind === "off" || m.kind === "jump"
                    ? "border-brick/60 bg-brick/25 text-paper"
                    : "border-paper/15 bg-pit-carbon/70 text-paper"
                }`}
              >
                {m.text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>

        {/* Lap complete. */}
        <AnimatePresence>
          {lapCard ? (
            <motion.div
              key={lapCard.lap}
              className="pointer-events-none absolute left-1/2 top-[28%] w-[min(92%,26rem)] sm:top-[40%] -translate-x-1/2 rounded-xl border border-paper/15 bg-pit-carbon/85 px-4 py-3 text-center backdrop-blur"
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">
                Lap {lapCard.lap}
                {lapCard.best ? <span className="text-[#b138dd]"> · Personal best</span> : null}
              </p>
              <p className="mt-1 font-mono text-3xl tabular-nums text-paper">{formatLapTime(lapCard.time)}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
                {lapCard.penalties ? `incl. +${lapCard.penalties} s penalties · ` : ""}
                {lapCard.delta != null ? `${formatDelta(lapCard.delta)} vs ghost` : "clean lap"}
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {lapCard.sectors.map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    className="rounded-md bg-paper/5 px-2 py-1"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">S{i + 1}</p>
                    <p className="font-mono text-sm tabular-nums" style={{ color: SPLIT_COLOUR[lapCard.sectorColours[i]] }}>
                      {t.toFixed(3)}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {phase === "paused" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
            <p className="font-display text-3xl uppercase tracking-wider text-paper">Paused</p>
            <button
              type="button"
              onClick={() => game.current?.togglePause()}
              className="rounded-full border border-amber/60 px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-amber hover:bg-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            >
              Resume
            </button>
          </div>
        ) : null}

        {/* Touch controls. */}
        {track ? (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 sm:hidden">
            <button
              type="button"
              {...hold("brake")}
              className="h-20 w-28 touch-none select-none rounded-2xl border border-brick/50 bg-brick/20 font-mono text-xs uppercase tracking-[0.2em] text-paper active:bg-brick/40"
            >
              Brake
            </button>
            <button
              type="button"
              {...hold("boost")}
              className="h-12 flex-1 touch-none select-none rounded-2xl border border-amber/50 bg-amber/10 font-mono text-[10px] uppercase tracking-[0.2em] text-amber active:bg-amber/30"
            >
              Boost
            </button>
            <button
              type="button"
              {...hold("throttle")}
              className="h-20 w-28 touch-none select-none rounded-2xl border border-teal/50 bg-teal/20 font-mono text-xs uppercase tracking-[0.2em] text-paper active:bg-teal/40"
            >
              Throttle
            </button>
          </div>
        ) : null}

        {fullscreen ? (
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-paper/15 bg-pit-carbon/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim backdrop-blur-sm hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            Exit full screen
          </button>
        ) : null}
      </div>

      {/* Settings and controls under the frame. */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Livery" className="flex items-center gap-1.5">
            {LIVERIES.map((l, i) => (
              <button
                key={l.name}
                type="button"
                role="radio"
                aria-checked={livery === i}
                aria-label={`${l.name} livery`}
                title={l.name}
                onClick={() => {
                  setLivery(i);
                  game.current?.setLivery(l);
                }}
                className={`h-6 w-6 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                  livery === i ? "scale-110 border-paper" : "border-transparent hover:scale-105"
                }`}
                style={{ background: `linear-gradient(135deg, ${l.primary} 0 55%, ${l.secondary} 55% 78%, ${l.accent} 78%)` }}
              />
            ))}
          </div>
          <div role="group" aria-label="Camera" className="inline-flex rounded-full border border-paper/15 p-0.5">
            {CAMERAS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={camera === c.id}
                onClick={() => {
                  setCamera(c.id);
                  game.current?.setCamera(c.id);
                }}
                className={pill(camera === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim">
            Ghost
            <select
              value={ghost}
              onChange={(e) => {
                const g = e.target.value as GhostMode;
                setGhost(g);
                game.current?.setGhost(g);
              }}
              className="rounded-full border border-paper/15 bg-pit-carbon px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            >
              {GHOSTS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => game.current?.restart()}
            className="rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim hover:border-amber hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            Restart
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full border border-paper/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim hover:border-amber hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            Full screen
          </button>
        </div>
      </div>
      <p className="mt-3 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim sm:block">
        W / ↑ / Space throttle · S / ↓ brake · Shift / E boost · C camera · R restart · P pause
      </p>
    </div>
  );
}
