"use client";

import { motion, type MotionValue } from "framer-motion";
import { easeInOut, keyframes } from "@/lib/demoTimeline";
import { C, useAt, type SceneProps } from "./parts";

const CHIP_X = [40, 100, 160, 220, 280];
// Rounded, because Node and browsers can disagree in the last digit of a
// cosine — enough to fail hydration if the raw value is rendered.
const round = (v: number) => Math.round(v * 100) / 100;
const SPOKES = [0, 72, 144, 216, 288].map((a) => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)]);

const COMPOUNDS = [
  { key: "hard", colour: C.paper },
  { key: "medium", colour: C.yellow },
  { key: "soft", colour: C.red },
] as const;

/**
 * Pirelli's five compounds and the three chosen for a weekend. At a tough
 * track the Hard/Medium/Soft are C1–C3; at a street track they slide along
 * to C3–C5 — and the C3 that was the Soft is now the Hard. The names are
 * relative to the weekend, not fixed rubber.
 */
export function TyreScene({ clock, labels }: SceneProps) {
  // 0 = the tough-track selection, 1 = the street-track one.
  const shift = useAt(clock, (t) => keyframes(t, [0, 3.6, 4.4, 7.6, 8], [0, 0, 1, 1, 0], easeInOut));
  const spin = useAt(clock, (t) => t * 140);

  return (
    <g>
      {CHIP_X.map((x, j) => (
        <Chip key={j} x={x} index={j} shift={shift} />
      ))}
      {COMPOUNDS.map((compound, i) => (
        <Tyre key={compound.key} index={i} colour={compound.colour} label={labels[compound.key]} shift={shift} spin={spin} />
      ))}
    </g>
  );
}

function Chip({ x, index, shift }: { x: number; index: number; shift: MotionValue<number> }) {
  // A chip is lit when it's in the weekend's selection: C1–C3, then C3–C5.
  const lit = useAt(shift, (s) => {
    if (index === 2) return 1;
    return index < 2 ? 1 - s * 0.72 : 0.28 + s * 0.72;
  });
  // C3 is the one that changes name — ring it once it has become the Hard.
  const ring = useAt(shift, (s) => (index === 2 ? s : 0));
  return (
    <g>
      <motion.rect x={x - 20} y={10} width={40} height={20} rx={10} fill="none" stroke={C.amber} strokeWidth={1.5} style={{ opacity: ring }} />
      <motion.g style={{ opacity: lit }}>
        <rect x={x - 16} y={13} width={32} height={14} rx={7} fill={C.asphalt} stroke={C.paper} strokeOpacity={0.35} />
        <text x={x} y={23.2} textAnchor="middle" className="font-mono" fontSize={9} fill={C.paper}>
          C{index + 1}
        </text>
      </motion.g>
    </g>
  );
}

function Tyre({
  index,
  colour,
  label,
  shift,
  spin,
}: {
  index: number;
  colour: string;
  label: string;
  shift: MotionValue<number>;
  spin: MotionValue<number>;
}) {
  const x = useAt(shift, (s) => CHIP_X[index] + s * 120);
  return (
    <motion.g style={{ x, y: 88 }}>
      <line x1={0} x2={0} y1={-58} y2={-25} stroke={colour} strokeOpacity={0.45} strokeDasharray="2 3" />
      <circle r={22} fill={C.tyre} stroke="#2a3036" />
      <circle r={20.5} fill="none" stroke="#12161a" strokeWidth={2} strokeDasharray="3 2.2" />
      <circle r={16.2} fill="none" stroke={colour} strokeWidth={3} />
      <circle r={11} fill="#1d2329" stroke="#3a4047" />
      <motion.g style={{ rotate: spin }}>
        {/* The invisible disc keeps the group's box centred, so it spins
            about the hub rather than wobbling. */}
        <circle r={10.5} fill="none" />
        {SPOKES.map(([cos, sin], i) => (
          <line
            key={i}
            x1={round(cos * 3)}
            y1={round(sin * 3)}
            x2={round(cos * 10)}
            y2={round(sin * 10)}
            stroke="#5b636d"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ))}
      </motion.g>
      <circle r={2.6} fill="#3a4047" />
      <text y={37} textAnchor="middle" className="font-mono uppercase" fontSize={8.5} letterSpacing={1.2} fill={colour}>
        {label}
      </text>
    </motion.g>
  );
}
