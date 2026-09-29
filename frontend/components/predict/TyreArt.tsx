"use client";

import { useId } from "react";
import type { Compound } from "@/types";

/**
 * A tyre seen face-on, the way it sits on a pit-lane blanket: rubber
 * shoulder, the compound's coloured sidewall ring, then rim and centre-lock.
 *
 * Every visual difference between compounds is a real one:
 *   - the ring colour is the compound's sidewall colour
 *   - only Intermediate and Wet carry tread, and Wet's is deeper and denser
 *   - slicks are smooth, because slicks are smooth
 *
 * "Auto" is not a tyre. It is drawn as a dashed outline of one — the slot the
 * strategy engine will fill — so it reads as a choice being deferred, not as a
 * sixth compound.
 *
 * Motion (keyframes `tyre-*` in globals.css): hovering turns the wheel
 * slowly; selecting spins it up and then lets it settle, with a heat bloom in
 * the compound colour behind it — the blanket-warm glow of a tyre ready to
 * fit. Frozen, the selected tyre still reads as selected via the bloom and
 * the lit ring.
 */

export type TyreOption = Compound | "Auto";

export const TYRE_COLOR: Record<Compound, string> = {
  Hard: "#f4efe6",
  Medium: "#ffd200",
  Soft: "#e0301f",
  Intermediate: "#43b02a",
  Wet: "#2f6fe0",
};

type Tread = { count: number; depth: number; width: number; sweep: number };

// `sweep` slants the groove: wet tread is angled to pump water out sideways.
const TREAD: Partial<Record<Compound, Tread>> = {
  Intermediate: { count: 24, depth: 5, width: 2.2, sweep: 0 },
  Wet: { count: 36, depth: 8, width: 2.4, sweep: 2.2 },
};

function treadGroove({ depth, width, sweep }: Tread) {
  const top = 4;
  const half = width / 2;
  return `M ${50 - half} ${top} L ${50 + half} ${top} L ${50 + half - sweep} ${top + depth} L ${
    50 - half - sweep
  } ${top + depth} Z`;
}

const SPOKES = 10;

export function TyreArt({
  option,
  selected,
}: {
  option: TyreOption;
  selected: boolean;
}) {
  const uid = useId().replace(/:/g, "");

  if (option === "Auto") {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true">
        <circle
          cx={50}
          cy={50}
          r={45}
          fill="none"
          stroke={selected ? "#f5a623" : "#a39b8f"}
          strokeOpacity={selected ? 0.9 : 0.55}
          strokeWidth={1.5}
          strokeDasharray="4 4.4"
          className={selected ? "tyre-auto-orbit" : undefined}
          style={{ transformOrigin: "50px 50px" }}
        />
        <circle
          cx={50}
          cy={50}
          r={30}
          fill="none"
          stroke={selected ? "#f5a623" : "#a39b8f"}
          strokeOpacity={selected ? 0.5 : 0.3}
          strokeWidth={1}
          strokeDasharray="2 3.2"
        />
        {/* Four cardinal ticks: the engine's crosshair, not a rim. */}
        {[0, 90, 180, 270].map((a) => (
          <line
            key={a}
            x1={50}
            y1={13}
            x2={50}
            y2={20}
            stroke={selected ? "#f5a623" : "#a39b8f"}
            strokeOpacity={selected ? 0.9 : 0.5}
            strokeWidth={1.4}
            strokeLinecap="round"
            transform={`rotate(${a} 50 50)`}
          />
        ))}
        <circle cx={50} cy={50} r={3} fill={selected ? "#f5a623" : "#a39b8f"} fillOpacity={selected ? 1 : 0.6} />
      </svg>
    );
  }

  const colour = TYRE_COLOR[option];
  const tread = TREAD[option];
  const ids = {
    rubber: `ty-rubber-${uid}`,
    rim: `ty-rim-${uid}`,
    heat: `ty-heat-${uid}`,
  };

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id={ids.rubber} cx="50%" cy="50%" r="50%">
          <stop offset="58%" stopColor="#1d2226" />
          <stop offset="86%" stopColor="#121518" />
          <stop offset="100%" stopColor="#060708" />
        </radialGradient>
        <radialGradient id={ids.rim} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#6b747c" />
          <stop offset="60%" stopColor="#2a3036" />
          <stop offset="100%" stopColor="#101316" />
        </radialGradient>
        <radialGradient id={ids.heat} cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor={colour} stopOpacity={0.45} />
          <stop offset="100%" stopColor={colour} stopOpacity={0} />
        </radialGradient>
      </defs>

      {selected ? (
        <circle cx={50} cy={50} r={60} fill={`url(#${ids.heat})`} className="tyre-heat" />
      ) : null}

      <g
        className={selected ? "tyre-spinup" : "tyre-idle"}
        style={{ transformOrigin: "50px 50px" }}
      >
        <circle cx={50} cy={50} r={46} fill={`url(#${ids.rubber})`} />

        {tread
          ? Array.from({ length: tread.count }, (_, i) => (
              <path
                key={i}
                d={treadGroove(tread)}
                fill="#050607"
                transform={`rotate(${(360 / tread.count) * i} 50 50)`}
              />
            ))
          : null}

        {/* Sidewall compound band — the one colour on the object. */}
        <circle
          cx={50}
          cy={50}
          r={35.5}
          fill="none"
          stroke={colour}
          strokeWidth={3}
          strokeOpacity={selected ? 1 : 0.72}
        />
        <circle cx={50} cy={50} r={32.2} fill="none" stroke="#000" strokeOpacity={0.5} strokeWidth={0.6} />

        <circle cx={50} cy={50} r={27} fill={`url(#${ids.rim})`} />
        {Array.from({ length: SPOKES }, (_, i) => (
          <path
            key={i}
            d="M 48.6 44 L 47.4 26.5 L 52.6 26.5 L 51.4 44 Z"
            fill="#0b0d0f"
            transform={`rotate(${(360 / SPOKES) * i} 50 50)`}
          />
        ))}
        <circle cx={50} cy={50} r={27} fill="none" stroke="#89929a" strokeOpacity={0.35} strokeWidth={0.7} />

        {/* Centre-lock nut: hexagon, plus a colour-matched retaining clip. */}
        <path
          d="M 50 42.5 L 56.5 46.25 L 56.5 53.75 L 50 57.5 L 43.5 53.75 L 43.5 46.25 Z"
          fill="#1a1f23"
          stroke="#5c656d"
          strokeWidth={0.6}
        />
        <circle cx={50} cy={50} r={2.4} fill={colour} fillOpacity={selected ? 1 : 0.6} />
      </g>

      {/* Specular arc stays fixed while the tyre turns under it — light
          comes from the room, not the wheel. */}
      <path
        d="M 18 30 A 38 38 0 0 1 42 10"
        stroke="#fff"
        strokeOpacity={0.16}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
