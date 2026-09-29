"use client";

import { useId } from "react";

/**
 * Side-profile safety car, drawn to the proportions of the current
 * Mercedes-AMG GT Black Series safety car: long bonnet, cabin set well back,
 * fastback roof, and the tall rear wing that makes the silhouette readable
 * at 60px wide. In the red it actually runs.
 *
 * Motion follows the rule in docs/design/instrument-light.md — something
 * moves only because the real thing moves:
 *
 *   - beacon halves alternate on a fixed beat, as the real light bar does
 *   - wheels turn, the road passes beneath, air streaks off the tail
 *   - on deploy the car decelerates into frame, the way mass arrives
 *
 * Parked, all of that stops and the car desaturates: the "off" state has to
 * read completely while frozen, because under prefers-reduced-motion it is
 * the only state anyone sees. Keyframes live in globals.css (`sc-*`).
 */

const REAR_WHEEL = { x: 98, y: 110 };
const FRONT_WHEEL = { x: 304, y: 110 };
const SPOKES = 5;

function Wheel({
  cx,
  cy,
  spinning,
  ids,
}: {
  cx: number;
  cy: number;
  spinning: boolean;
  ids: { rim: string; tyre: string };
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={22} fill={`url(#${ids.tyre})`} />
      <circle cx={cx} cy={cy} r={19.5} fill="none" stroke="#262c32" strokeWidth={0.8} />
      <circle cx={cx} cy={cy} r={15} fill={`url(#${ids.rim})`} />
      {/* Brake caliper stays put while the wheel turns — it is bolted to
          the upright, not the wheel. That contrast is what sells rotation. */}
      <path
        d={`M ${cx - 10.5} ${cy - 7} A 12.6 12.6 0 0 1 ${cx + 2} ${cy - 12.4}`}
        stroke="#d7261e"
        strokeWidth={3.2}
        strokeLinecap="round"
        fill="none"
      />
      <g
        className={spinning ? "sc-wheel-spin" : undefined}
        style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "view-box" }}
      >
        {Array.from({ length: SPOKES }, (_, i) => (
          <rect
            key={i}
            x={cx - 1.4}
            y={cy - 13.6}
            width={2.8}
            height={10}
            rx={1.2}
            fill="#0e1114"
            transform={`rotate(${(360 / SPOKES) * i} ${cx} ${cy})`}
          />
        ))}
        <circle cx={cx} cy={cy} r={3.6} fill="#0e1114" />
        <circle cx={cx} cy={cy} r={1.5} fill="#8b949c" />
      </g>
    </g>
  );
}

export function SafetyCarArt({ deployed }: { deployed: boolean }) {
  // Gradient ids must be unique per instance or two cars on one page would
  // resolve each other's defs.
  const uid = useId().replace(/:/g, "");
  const ids = {
    body: `sc-body-${uid}`,
    sheen: `sc-sheen-${uid}`,
    glass: `sc-glass-${uid}`,
    rim: `sc-rim-${uid}`,
    tyre: `sc-tyre-${uid}`,
    glow: `sc-glow-${uid}`,
    beam: `sc-beam-${uid}`,
    shadow: `sc-shadow-${uid}`,
  };

  return (
    <svg
      viewBox="0 0 400 150"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
      data-state={deployed ? "deployed" : "parked"}
    >
      <defs>
        <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6a4a" />
          <stop offset="38%" stopColor="#e0301f" />
          <stop offset="78%" stopColor="#a8170f" />
          <stop offset="100%" stopColor="#6d0d08" />
        </linearGradient>
        <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity={0} />
          <stop offset="45%" stopColor="#fff" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <linearGradient id={ids.glass} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#3b4750" />
          <stop offset="100%" stopColor="#07090b" />
        </linearGradient>
        <radialGradient id={ids.rim} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#c9d0d6" />
          <stop offset="55%" stopColor="#5d666e" />
          <stop offset="100%" stopColor="#23282d" />
        </radialGradient>
        <radialGradient id={ids.tyre} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#15181b" />
          <stop offset="100%" stopColor="#050607" />
        </radialGradient>
        <radialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb13b" stopOpacity={0.95} />
          <stop offset="45%" stopColor="#f5a623" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={ids.beam} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff4dc" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#fff4dc" stopOpacity={0} />
        </linearGradient>
        <radialGradient id={ids.shadow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Road. Dashes and air streaks only run while deployed. */}
      {/* Road runs past the viewBox so it spans the whole stage however wide
          the container letterboxes the car. */}
      <line x1={-600} y1={134} x2={1000} y2={134} stroke="#2a3036" strokeWidth={1} />
      <line
        x1={-600}
        y1={141}
        x2={1000}
        y2={141}
        stroke="#f4efe6"
        strokeOpacity={deployed ? 0.28 : 0.12}
        strokeWidth={1.6}
        strokeDasharray="22 26"
        className={deployed ? "sc-road" : undefined}
      />
      {deployed ? (
        <g className="sc-streaks" stroke="#f4efe6" strokeLinecap="round">
          <line x1={-10} y1={62} x2={30} y2={62} strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="40 120" />
          <line x1={-10} y1={84} x2={24} y2={84} strokeOpacity={0.22} strokeWidth={1.2} strokeDasharray="30 140" />
          <line x1={-10} y1={102} x2={34} y2={102} strokeOpacity={0.28} strokeWidth={1.2} strokeDasharray="44 110" />
        </g>
      ) : null}

      <ellipse cx={200} cy={133} rx={170} ry={6} fill={`url(#${ids.shadow})`} />

      {/* Everything that is the car moves together on deploy. Re-keyed per
          state so the entrance replays each time the car is sent out. */}
      <g key={deployed ? "on" : "off"} className={deployed ? "sc-enter" : undefined}>
        {deployed ? (
          <path d="M 362 86 L 410 66 L 410 110 Z" fill={`url(#${ids.beam})`} />
        ) : null}

        <g className={deployed ? undefined : "sc-parked"}>
          {/* Rear wing — the silhouette's signature. */}
          <path d="M 66 78 L 62 57 L 66 57 L 71 77 Z" fill="#14181b" />
          <path d="M 86 74 L 82 57 L 86 57 L 90 73 Z" fill="#14181b" />
          <path d="M 44 54 C 58 52, 80 51, 97 52 L 97 58 C 80 57, 58 58, 46 60 Z" fill="#1c2126" />
          <path d="M 44 54 L 46 60 L 43 62 L 41 55 Z" fill="#0e1114" />

          {/* Body shell, arches cut to the wheel centres. */}
          <path
            d="M 40 110 L 38 96 C 38 86, 44 80, 56 78 L 84 74 C 110 66, 136 52, 170 46
               C 188 43, 204 44, 218 50 L 244 62 C 276 64, 316 68, 346 76
               C 360 80, 370 88, 371 98 L 372 110 L 331 110
               A 27 27 0 0 0 277 110 L 125 110 A 27 27 0 0 0 71 110 Z"
            fill={`url(#${ids.body})`}
          />

          {/* Shoulder crease + single specular pass: the whole of the
              "photographed paint" effect, and no more. */}
          <path d="M 58 86 C 140 80, 250 78, 352 82" stroke="#ff9a7e" strokeOpacity={0.5} strokeWidth={0.9} fill="none" />
          <path d="M 96 72 C 150 58, 210 52, 300 66" stroke={`url(#${ids.sheen})`} strokeWidth={2.4} fill="none" strokeLinecap="round" />

          {/* Carbon sill between the arches, splitter and diffuser. */}
          <path d="M 125 110 L 125 103 C 180 101, 230 101, 277 103 L 277 110 Z" fill="#101316" />
          <path d="M 338 110 L 374 110 L 377 114 L 336 114 Z" fill="#0b0d0f" />
          <path d="M 40 110 L 62 110 L 60 115 L 42 114 Z" fill="#0b0d0f" />

          {/* Glasshouse with B-pillar. */}
          <path d="M 128 70 C 146 60, 160 53, 176 51 L 212 53 C 222 56, 230 62, 236 68 L 128 72 Z" fill={`url(#${ids.glass})`} />
          <path d="M 190 52 L 193 71" stroke="#b81d12" strokeWidth={3} />
          <path d="M 150 60 C 164 55, 176 53, 188 53" stroke="#fff" strokeOpacity={0.18} strokeWidth={1.2} fill="none" />

          {/* Door shut line and mirror. */}
          <path d="M 200 73 C 202 86, 202 96, 200 104" stroke="#7a110b" strokeWidth={0.8} fill="none" />
          <path d="M 232 66 L 244 64 L 245 69 L 234 70 Z" fill="#1c2126" />

          {/* Lamps. */}
          <path
            d="M 350 82 L 365 86 L 363 90 L 348 86 Z"
            fill={deployed ? "#fff8ea" : "#5b6167"}
            className={deployed ? "sc-headlamp" : undefined}
          />
          <path d="M 38 88 L 47 86 L 47 92 L 38 94 Z" fill={deployed ? "#ff3b1f" : "#5a1a14"} />
        </g>

        {/* Beacon bar. Two halves on an alternating beat; glow sits
            behind the housing so the lamps themselves stay crisp. */}
        {deployed ? (
          <>
            <circle cx={176} cy={39} r={22} fill={`url(#${ids.glow})`} className="sc-beacon-a" />
            <circle cx={202} cy={39} r={22} fill={`url(#${ids.glow})`} className="sc-beacon-b" />
          </>
        ) : null}
        <rect x={166} y={36} width={46} height={7} rx={2.5} fill="#0e1114" />
        <rect x={170} y={43} width={4} height={3} fill="#0e1114" />
        <rect x={204} y={43} width={4} height={3} fill="#0e1114" />
        {[0, 1, 2, 3].map((i) => {
          const half = i < 2 ? "a" : "b";
          return (
            <rect
              key={i}
              x={168.5 + i * 10.6}
              y={37.4}
              width={9}
              height={4.2}
              rx={1.4}
              fill={deployed ? "#ffb13b" : "#3a4046"}
              className={deployed ? `sc-beacon-${half}` : undefined}
            />
          );
        })}

        <Wheel cx={REAR_WHEEL.x} cy={REAR_WHEEL.y} spinning={deployed} ids={ids} />
        <Wheel cx={FRONT_WHEEL.x} cy={FRONT_WHEEL.y} spinning={deployed} ids={ids} />
      </g>
    </svg>
  );
}
