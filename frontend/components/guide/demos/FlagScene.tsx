"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { easeInOut, easeOut, keyframes, windowed } from "@/lib/demoTimeline";
import { C, CarTop, Chequer, Road, useAt, type SceneProps } from "./parts";

const PHASE = 2.5;
const phaseOf = (t: number) => Math.min(3, Math.floor(t / PHASE));
const local = (t: number) => t - phaseOf(t) * PHASE;

/** Flag cloth as a waving outline: the free edge swings more than the
 * edge at the pole, and the wave travels outward. */
function clothPath(t: number): string {
  const n = 10;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= n; i += 1) {
    const f = i / n;
    const x = 31 + 62 * f;
    const dy = 4.2 * f * Math.sin(2 * Math.PI * f * 1.15 - t * 6.5);
    top.push(`${x.toFixed(1)},${(18 + dy).toFixed(1)}`);
    bottom.push(`${x.toFixed(1)},${(56 + dy * 1.1).toFixed(1)}`);
  }
  return `M${top.join(" L")} L${bottom.reverse().join(" L")} Z`;
}

/** Visible only during phase `p`, with a short fade at each end. */
const during = (p: number) => (t: number) => (phaseOf(t) === p ? windowed(local(t), 0.15, PHASE - 0.2, 0.15) : 0);

/**
 * The four flags a newcomer sees most, each with what it makes the cars
 * do: yellow — slow, no passing near the stranded car; red — everyone
 * stops; blue — the lapped car moves aside for the leader; chequered —
 * across the line, done.
 */
export function FlagScene({ clock }: SceneProps) {
  const pattern = useId();
  const d = useAt(clock, clothPath);
  const fill = useAt(clock, (t) => [C.yellow, C.red, "#38a8ff", `url(#${pattern})`][phaseOf(t)]);

  // Yellow: two cars trundle through, the follower staying behind.
  const yellow = useAt(clock, during(0));
  const yellowA = useAt(clock, (t) => 150 + local(t) * 34);
  const yellowB = useAt(yellowA, (x) => x - 36);
  // Red: both cars brake to a standstill.
  const red = useAt(clock, during(1));
  const redA = useAt(clock, (t) => keyframes(local(t), [0, 1.7], [168, 238], easeOut));
  const redB = useAt(redA, (x) => x - 38);
  // Blue: the lapped car pulls over, the leader goes by.
  const blue = useAt(clock, during(2));
  const lappedX = useAt(clock, (t) => 214 + local(t) * 12);
  const lappedY = useAt(clock, (t) => keyframes(local(t), [0.2, 0.8], [98, 80], easeInOut));
  const leaderX = useAt(clock, (t) => 116 + local(t) * 92);
  // Chequered: over the line and done.
  const cheq = useAt(clock, during(3));
  const finisher = useAt(clock, (t) => keyframes(local(t), [0, 1.3, 2.4], [150, 258, 296], [easeInOut, easeOut]));

  return (
    <g>
      <defs>
        <pattern id={pattern} width={10} height={10} patternUnits="userSpaceOnUse">
          <rect width={10} height={10} fill={C.paper} />
          <rect width={5} height={5} fill={C.bg} />
          <rect x={5} y={5} width={5} height={5} fill={C.bg} />
        </pattern>
      </defs>

      <line x1={30} x2={30} y1={14} y2={124} stroke={C.dim} strokeWidth={2} strokeLinecap="round" />
      <circle cx={30} cy={13} r={2.4} fill={C.dim} />
      <motion.path d={d} style={{ fill }} stroke={C.bg} strokeOpacity={0.4} strokeWidth={0.8} />

      <Road x={112} w={208} y={70} h={40} />

      <motion.g style={{ opacity: yellow }}>
        {/* The stranded car the yellow is for, on the verge. */}
        <g transform="translate(266 58) rotate(-24)">
          <CarTop x={0} y={0} colour="#5b636d" />
        </g>
        <polygon points="238,46 246,60 230,60" fill="none" stroke={C.yellow} strokeWidth={1.6} strokeLinejoin="round" />
        <line x1={238} x2={238} y1={51} y2={55.5} stroke={C.yellow} strokeWidth={1.4} strokeLinecap="round" />
        <circle cx={238} cy={57.6} r={0.8} fill={C.yellow} />
        <CarTop x={yellowB} y={98} colour="#8a929c" />
        <CarTop x={yellowA} y={98} colour={C.paper} />
      </motion.g>

      <motion.g style={{ opacity: red }}>
        <CarTop x={redB} y={98} colour="#8a929c" />
        <CarTop x={redA} y={98} colour={C.paper} />
      </motion.g>

      <motion.g style={{ opacity: blue }}>
        <CarTop x={lappedX} y={lappedY} colour="#5b636d" />
        <CarTop x={leaderX} y={98} colour={C.paper} />
      </motion.g>

      <motion.g style={{ opacity: cheq }}>
        <Chequer x={254} y={70} cols={2} rows={10} size={4} />
        <CarTop x={finisher} y={90} colour={C.paper} />
      </motion.g>
    </g>
  );
}
