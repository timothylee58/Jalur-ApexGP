"use client";

import { useMemo, useRef } from "react";
import { formatDelta, formatLapTime } from "@/lib/drive/timing";
import type { DriveTrack } from "@/lib/drive/track";
import { SPLIT_COLOUR, useFrame, type FrameBus } from "./bus";

/**
 * The broadcast-style HUD: timing tower top left, minimap top right, the
 * steering-wheel display bottom centre, and the next-corner card bottom
 * left. Everything numeric is written per frame from the telemetry bus;
 * the markup here renders once.
 */

type Split = keyof typeof SPLIT_COLOUR | null;

export function TimingPanel({ bus, splits, best }: { bus: FrameBus; splits: Split[]; best: number | null }) {
  const lap = useRef<HTMLParagraphElement>(null);
  const time = useRef<HTMLParagraphElement>(null);
  const delta = useRef<HTMLParagraphElement>(null);
  const sectorBars = useRef<(HTMLSpanElement | null)[]>([]);

  useFrame(bus, (t) => {
    if (lap.current) lap.current.textContent = `Lap ${t.lap}`;
    if (time.current) time.current.textContent = t.lapTime == null ? "0:00.000" : formatLapTime(t.lapTime);
    if (delta.current) {
      if (t.delta == null) {
        delta.current.style.opacity = "0";
      } else {
        delta.current.style.opacity = "1";
        delta.current.textContent = formatDelta(t.delta);
        delta.current.style.color = t.delta <= 0 ? "#2ec4b6" : "#ff5a47";
        delta.current.style.borderColor = t.delta <= 0 ? "rgba(46,196,182,0.45)" : "rgba(255,90,71,0.45)";
      }
    }
    sectorBars.current.forEach((bar, i) => {
      if (!bar) return;
      const live = i === t.sector && t.lapTime != null;
      bar.style.opacity = splits[i] || live ? "1" : "0.25";
      bar.classList.toggle("animate-pulse", live && !splits[i]);
    });
  });

  return (
    <div className="pointer-events-none rounded-md border border-paper/10 bg-pit-carbon/70 px-3 py-2 backdrop-blur-sm">
      <p ref={lap} className="font-mono text-[9px] uppercase tracking-[0.25em] text-paper-dim">
        Lap 1
      </p>
      <p ref={time} className="font-mono text-2xl leading-tight tabular-nums text-paper sm:text-3xl">
        0:00.000
      </p>
      <div className="mt-1 flex items-center gap-2">
        <p
          ref={delta}
          className="rounded-full border px-2 py-0.5 font-mono text-[11px] tabular-nums opacity-0 transition-opacity"
        >
          +0.000
        </p>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            ref={(el) => {
              sectorBars.current[i] = el;
            }}
            className="h-1 w-8 rounded-full transition-colors"
            style={{ background: splits[i] ? SPLIT_COLOUR[splits[i] as keyof typeof SPLIT_COLOUR] : "#f4efe6", opacity: 0.25 }}
          />
        ))}
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
        Best <span className="text-paper">{best == null ? "–:––.–––" : formatLapTime(best)}</span>
      </p>
    </div>
  );
}

const LED_COLOURS = [
  ...Array(5).fill("#2ee06b"),
  ...Array(5).fill("#ff3b30"),
  ...Array(5).fill("#3aa0ff"),
] as string[];

export function WheelCluster({ bus }: { bus: FrameBus }) {
  const leds = useRef<(HTMLSpanElement | null)[]>([]);
  const gear = useRef<HTMLParagraphElement>(null);
  const speed = useRef<HTMLParagraphElement>(null);
  const battery = useRef<HTMLSpanElement>(null);
  const ers = useRef<HTMLParagraphElement>(null);
  const aero = useRef<HTMLParagraphElement>(null);
  const throttle = useRef<HTMLSpanElement>(null);
  const brake = useRef<HTMLSpanElement>(null);

  useFrame(bus, (t) => {
    const lit = Math.round(t.shift * 15);
    const flash = t.shift >= 0.98 && Math.floor(performance.now() / 70) % 2 === 0;
    leds.current.forEach((led, i) => {
      if (!led) return;
      const on = flash || i < lit;
      led.style.background = on ? (flash ? "#3aa0ff" : LED_COLOURS[i]) : "rgba(244,239,230,0.08)";
      led.style.boxShadow = on ? `0 0 8px ${flash ? "#3aa0ff" : LED_COLOURS[i]}` : "none";
    });
    if (gear.current) gear.current.textContent = t.gear === 0 ? "N" : String(t.gear);
    if (speed.current) speed.current.textContent = String(Math.round(t.kmh));
    if (battery.current) {
      battery.current.style.transform = `scaleY(${t.battery.toFixed(3)})`;
      battery.current.style.background = t.deploying ? "#f5a623" : t.harvesting ? "#2ec4b6" : "#f4efe6";
    }
    if (ers.current) {
      ers.current.textContent = t.deploying ? "Boost" : t.harvesting ? "Harvest" : `${Math.round(t.battery * 100)}%`;
      ers.current.style.color = t.deploying ? "#f5a623" : t.harvesting ? "#2ec4b6" : "#a39b8f";
    }
    if (aero.current) {
      aero.current.textContent = t.straightMode ? "Straight mode" : "Corner mode";
      aero.current.style.color = t.straightMode ? "#2ec4b6" : "#a39b8f";
      aero.current.style.borderColor = t.straightMode ? "rgba(46,196,182,0.5)" : "rgba(244,239,230,0.12)";
    }
    if (throttle.current) throttle.current.style.transform = `scaleY(${t.throttle ? 1 : 0})`;
    if (brake.current) brake.current.style.transform = `scaleY(${t.brake ? 1 : 0})`;
  });

  return (
    <div className="pointer-events-none flex items-stretch gap-2 rounded-xl border border-paper/10 bg-pit-carbon/75 px-3 py-2 backdrop-blur-sm">
      <div className="flex w-1.5 items-end overflow-hidden rounded-full bg-paper/10" aria-hidden="true">
        <span ref={brake} className="block h-full w-full origin-bottom scale-y-0 bg-brick transition-transform duration-75" />
      </div>
      <div className="flex flex-col items-center">
        <div className="flex gap-[3px]" aria-hidden="true">
          {LED_COLOURS.map((_, i) => (
            <span
              key={i}
              ref={(el) => {
                leds.current[i] = el;
              }}
              className="h-1.5 w-1.5 rounded-full sm:h-2 sm:w-2"
              style={{ background: "rgba(244,239,230,0.08)" }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-end gap-3">
          <div className="text-right">
            <p ref={speed} className="font-mono text-xl leading-none tabular-nums text-paper sm:text-2xl">
              0
            </p>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper-dim">km/h</p>
          </div>
          <p ref={gear} className="font-display text-5xl leading-[0.85] text-paper sm:text-6xl">
            N
          </p>
          <div className="flex items-end gap-1.5">
            <div className="relative h-9 w-2.5 overflow-hidden rounded-sm border border-paper/20" aria-hidden="true">
              <span ref={battery} className="absolute inset-0 origin-bottom bg-paper" style={{ transform: "scaleY(0.6)" }} />
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper-dim">ERS</p>
              <p ref={ers} className="font-mono text-[10px] uppercase tracking-[0.12em]">
                60%
              </p>
            </div>
          </div>
        </div>
        <p
          ref={aero}
          className="mt-1.5 rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.2em] transition-colors sm:text-[9px]"
        >
          Corner mode
        </p>
      </div>
      <div className="flex w-1.5 items-end overflow-hidden rounded-full bg-paper/10" aria-hidden="true">
        <span ref={throttle} className="block h-full w-full origin-bottom scale-y-0 bg-teal transition-transform duration-75" />
      </div>
    </div>
  );
}

export function Minimap({ bus, track }: { bus: FrameBus; track: DriveTrack }) {
  const car = useRef<SVGCircleElement>(null);
  const ghost = useRef<SVGGElement>(null);
  const ghostLabel = useRef<SVGTextElement>(null);

  const map = useMemo(() => {
    const pts = track.points.filter((_, i) => i % 8 === 0);
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const minX = Math.min(...xs);
    const minZ = Math.min(...zs);
    const span = Math.max(Math.max(...xs) - minX, Math.max(...zs) - minZ);
    const scale = 180 / span;
    const w = (Math.max(...xs) - minX) * scale + 20;
    const h = (Math.max(...zs) - minZ) * scale + 20;
    const project = (x: number, z: number) => ({ x: 10 + (x - minX) * scale, y: 10 + (z - minZ) * scale });
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${project(p.x, p.z).x.toFixed(1)},${project(p.x, p.z).y.toFixed(1)}`).join(" ") + " Z";
    const start = project(track.points[0].x, track.points[0].z);
    return { w, h, d, project, start };
  }, [track]);

  useFrame(bus, (t) => {
    const p = map.project(t.x, t.z);
    car.current?.setAttribute("cx", p.x.toFixed(1));
    car.current?.setAttribute("cy", p.y.toFixed(1));
    if (ghost.current) {
      if (t.ghost) {
        const g = map.project(t.ghost.x, t.ghost.z);
        ghost.current.setAttribute("transform", `translate(${g.x.toFixed(1)} ${g.y.toFixed(1)})`);
        ghost.current.style.opacity = "1";
        if (ghostLabel.current) ghostLabel.current.textContent = t.ghost.label;
      } else ghost.current.style.opacity = "0";
    }
  });

  return (
    <svg
      viewBox={`0 0 ${map.w} ${map.h}`}
      className="pointer-events-none h-auto w-28 sm:w-40"
      aria-hidden="true"
    >
      <path d={map.d} fill="none" stroke="#0a0c0e" strokeOpacity={0.75} strokeWidth={7} strokeLinejoin="round" />
      <path d={map.d} fill="none" stroke="#f4efe6" strokeOpacity={0.6} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={map.start.x} cy={map.start.y} r={3} fill="#f5a623" />
      <g ref={ghost} style={{ opacity: 0 }}>
        <circle r={3.6} fill="#9fe9df" />
        <text ref={ghostLabel} x={6} y={-5} className="font-mono uppercase" fontSize={8} fill="#9fe9df" letterSpacing={1}>
          Sim
        </text>
      </g>
      <circle ref={car} r={4.4} fill="#f4efe6" stroke="#0a0c0e" strokeWidth={2} />
    </svg>
  );
}

export function NextCorner({ bus }: { bus: FrameBus }) {
  const name = useRef<HTMLParagraphElement>(null);
  const speed = useRef<HTMLParagraphElement>(null);
  const distance = useRef<HTMLParagraphElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);

  useFrame(bus, (t) => {
    const n = t.next;
    if (name.current) name.current.textContent = n.label ? `T${n.turn} · ${n.label}` : `Turn ${n.turn}`;
    if (speed.current) speed.current.textContent = String(n.apexKmh);
    if (distance.current) distance.current.textContent = `${Math.round(n.distance)} m`;
    const f = Math.max(0, Math.min(1, 1 - n.distance / 450));
    if (bar.current) {
      bar.current.style.transform = `scaleX(${f.toFixed(3)})`;
      // Over the corner's speed with little room left to shed it.
      const hot = t.kmh > n.apexKmh * 1.1 && n.distance < 160;
      bar.current.style.background = hot ? "#ff5a47" : n.distance < 250 ? "#f5a623" : "#f4efe6";
    }
    if (card.current) card.current.style.opacity = n.distance < 700 ? "1" : "0.55";
  });

  return (
    <div ref={card} className="pointer-events-none w-40 rounded-md border border-paper/10 bg-pit-carbon/70 px-3 py-2 backdrop-blur-sm transition-opacity sm:w-48">
      <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-paper-dim">Next corner</p>
      <p ref={name} className="truncate font-display text-sm uppercase tracking-wide text-paper sm:text-base">
        Turn 1
      </p>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] text-paper-dim">
          <span ref={speed} className="text-base text-paper">
            90
          </span>{" "}
          km/h
        </p>
        <p ref={distance} className="font-mono text-[10px] tabular-nums text-paper-dim">
          0 m
        </p>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-paper/10" aria-hidden="true">
        <span ref={bar} className="block h-full w-full origin-left bg-paper" style={{ transform: "scaleX(0)" }} />
      </div>
    </div>
  );
}
