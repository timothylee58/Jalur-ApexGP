"use client";

import { motion } from "framer-motion";
import { easeInOut, keyframes, windowed } from "@/lib/demoTimeline";
import { C, CarTop, Chequer, Label, Road, useAt, type SceneProps } from "./parts";

const DETECTION = 40;
const ZONE = { from: 98, to: 300 };
const inZone = (x: number) => x > ZONE.from && x < ZONE.to;

/**
 * 2026 overtaking, as two separate systems. The chasing car crosses the
 * detection point 0.8 s behind (34 units at 42.5 units/s) — inside a
 * second — so Overtake Mode is armed for the lap that starts at the line.
 * On the straight *both* cars switch to Straight Mode (every car flattens
 * its wings there); only the chaser carries the extra electric power, and
 * that's what gets it by.
 */
export function OvertakeScene({ clock, labels }: SceneProps) {
  const leadX = useAt(clock, (t) => keyframes(t, [0, 3, 7.4], [-20, 107.5, 349.5]));
  const chaseX = useAt(clock, (t) => keyframes(t, [0, 3, 3.3, 7.4], [-54, 73.5, 86.25, 434.75]));
  const chaseY = useAt(clock, (t) => keyframes(t, [3.2, 3.8], [80, 56], easeInOut));
  const leadWing = useAt(leadX, (x) => (inZone(x) ? C.teal : "#8a929c"));
  const chaseWing = useAt(chaseX, (x) => (inZone(x) ? C.teal : C.paper));
  const boost = useAt(clock, (t) => windowed(t, 2.25, 6.9, 0.3));
  const flicker = useAt(clock, (t) => 0.55 + 0.45 * Math.abs(Math.sin(t * 13)));
  const gapShown = useAt(clock, (t) => windowed(t, 2.25, 3.8, 0.2));
  const zoneLit = useAt(clock, (t) => 0.35 + 0.65 * windowed(t, 3.0, 6.9, 0.3));

  return (
    <g>
      <Road y={44} h={48} />
      <Chequer x={60} y={44} cols={2} rows={12} size={4} />

      <line x1={DETECTION} x2={DETECTION} y1={38} y2={98} stroke={C.dim} strokeOpacity={0.7} strokeDasharray="3 3" />
      <Label x={DETECTION} y={110} anchor="middle">
        {labels.detection}
      </Label>
      <motion.g style={{ opacity: gapShown }}>
        <rect x={DETECTION - 20} y={22} width={40} height={15} rx={7.5} fill={C.bg} stroke={C.amber} />
        <text x={DETECTION} y={32.5} textAnchor="middle" className="font-mono" fontSize={9} fill={C.amber}>
          0.8 s
        </text>
      </motion.g>

      <motion.g style={{ opacity: zoneLit }}>
        <line x1={ZONE.from} x2={ZONE.to} y1={98} y2={98} stroke={C.teal} strokeWidth={2} />
        <line x1={ZONE.from} x2={ZONE.from} y1={94} y2={102} stroke={C.teal} strokeWidth={2} />
        <line x1={ZONE.to} x2={ZONE.to} y1={94} y2={102} stroke={C.teal} strokeWidth={2} />
        <Label x={ZONE.from} y={112} fill={C.teal}>
          {labels.straight}
        </Label>
      </motion.g>

      <CarTop x={leadX} y={80} colour="#8a929c" wing={leadWing} />

      {/* Overtake Mode: extra electric power, the chaser's alone. */}
      <motion.g style={{ x: chaseX, y: chaseY, opacity: boost }}>
        <motion.g style={{ opacity: flicker }}>
          <line x1={-17} x2={-40} y1={-3} y2={-3} stroke={C.amber} strokeWidth={1.6} strokeLinecap="round" />
          <line x1={-17} x2={-32} y1={0} y2={0} stroke={C.amber} strokeWidth={1.6} strokeLinecap="round" />
          <line x1={-17} x2={-44} y1={3} y2={3} stroke={C.amber} strokeWidth={1.6} strokeLinecap="round" />
        </motion.g>
        <ellipse cx={0} cy={0} rx={20} ry={10} fill={C.amber} fillOpacity={0.14} />
      </motion.g>
      <CarTop x={chaseX} y={chaseY} colour={C.paper} wing={chaseWing} />
      <motion.g style={{ x: chaseX, y: chaseY, opacity: boost }}>
        <rect x={-28} y={-27} width={56} height={14} rx={7} fill={C.bg} stroke={C.amber} />
        <text x={0} y={-17.2} textAnchor="middle" className="font-mono uppercase" fontSize={8} letterSpacing={1} fill={C.amber}>
          {labels.overtake}
        </text>
      </motion.g>
    </g>
  );
}
