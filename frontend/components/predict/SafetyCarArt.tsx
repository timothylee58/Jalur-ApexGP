"use client";

import { useId } from "react";

/**
 * The safety car, as the real photo (public/safety-car/safety-car.webp,
 * transparent background, 936x453), with light and motion layered on top in
 * the photo's own coordinate space so every overlay stays pinned to the car at
 * any size.
 *
 * Only what the real car does is animated:
 *   - the two halves of the amber light bar in the windscreen alternate, as
 *     they do while the car is leading the field
 *   - the car arrives from the right and decelerates, the way mass arrives
 *   - air streaks peel off behind it
 *
 * The green lights stay dark: on the real car green means "about to peel off
 * into the pits", which is not the state this control represents. Parked, the
 * photo is desaturated and dimmed with no overlays, so the off state reads
 * completely when frozen — as it is under prefers-reduced-motion. Keyframes
 * live in globals.css (`sc-*`).
 */

const SRC = "/safety-car/safety-car.webp";
const W = 936;
const H = 453;

// Light-bar halves and headlamp, measured on the source photo.
const BEACON_A = { x: 620, y: 94 };
const BEACON_B = { x: 642, y: 94 };
const HEADLAMP = { x: 352, y: 246 };

export function SafetyCarArt({ deployed }: { deployed: boolean }) {
  // Gradient ids must be unique per instance or two cars on one page would
  // resolve each other's defs.
  const uid = useId().replace(/:/g, "");
  const ids = {
    beacon: `sc-beacon-${uid}`,
    wash: `sc-wash-${uid}`,
    lamp: `sc-lamp-${uid}`,
    shadow: `sc-shadow-${uid}`,
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full overflow-visible"
      aria-hidden="true"
      data-state={deployed ? "deployed" : "parked"}
    >
      <defs>
        <radialGradient id={ids.beacon} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff1c9" stopOpacity={1} />
          <stop offset="18%" stopColor="#ffb13b" stopOpacity={0.95} />
          <stop offset="55%" stopColor="#f5a623" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={ids.wash} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5a623" stopOpacity={0.32} />
          <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={ids.lamp} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4fbff" stopOpacity={0.75} />
          <stop offset="40%" stopColor="#cfe6ff" stopOpacity={0.22} />
          <stop offset="100%" stopColor="#cfe6ff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={ids.shadow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000" stopOpacity={0.75} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Re-keyed per state so the arrival replays each time it's sent out. */}
      <g key={deployed ? "on" : "off"} className={deployed ? "sc-enter" : undefined}>
        {deployed ? (
          <g className="sc-streaks" stroke="#f4efe6" strokeLinecap="round">
            <line x1={880} y1={150} x2={1010} y2={150} strokeOpacity={0.3} strokeWidth={3} strokeDasharray="90 260" />
            <line x1={900} y1={228} x2={1040} y2={228} strokeOpacity={0.2} strokeWidth={2.5} strokeDasharray="70 300" />
            <line x1={870} y1={318} x2={1020} y2={318} strokeOpacity={0.26} strokeWidth={2.5} strokeDasharray="110 240" />
          </g>
        ) : null}

        <ellipse cx={470} cy={432} rx={470} ry={26} fill={`url(#${ids.shadow})`} />

        <image
          href={SRC}
          x={0}
          y={0}
          width={W}
          height={H}
          preserveAspectRatio="xMidYMid meet"
          className={deployed ? undefined : "sc-parked"}
        />

        {deployed ? (
          <g style={{ mixBlendMode: "screen" }}>
            <ellipse cx={632} cy={96} rx={150} ry={70} fill={`url(#${ids.wash})`} className="sc-beacon-a" />
            <ellipse cx={632} cy={96} rx={150} ry={70} fill={`url(#${ids.wash})`} className="sc-beacon-b" />
            <ellipse cx={BEACON_A.x} cy={BEACON_A.y} rx={44} ry={22} fill={`url(#${ids.beacon})`} className="sc-beacon-a" />
            <ellipse cx={BEACON_B.x} cy={BEACON_B.y} rx={44} ry={22} fill={`url(#${ids.beacon})`} className="sc-beacon-b" />
            <ellipse cx={HEADLAMP.x} cy={HEADLAMP.y} rx={120} ry={46} fill={`url(#${ids.lamp})`} />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
