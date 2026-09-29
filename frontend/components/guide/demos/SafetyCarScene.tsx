"use client";

import { motion, type MotionValue } from "framer-motion";
import { easeInOut, easeOut, keyframes, linear, windowed } from "@/lib/demoTimeline";
import { C, CarTop, Label, Road, useAt, type SceneProps } from "./parts";

const TRACK = 40;
const PIT = 78;
const RACING = [262, 206, 150, 98, 42];
const QUEUE = [228, 194, 160, 126, 92];
const YOU = 2;

/**
 * Why a safety car makes pit stops cheap. The field is strung out at race
 * pace; the safety car comes out and everyone closes up behind it at low
 * speed. A stop now drops the car back through a slow, tight queue instead
 * of a full-speed field — so it costs roughly half the usual time.
 */
export function SafetyCarScene({ clock, labels }: SceneProps) {
  // The pack's speed, as scroll of the track: race pace, then SC pace.
  // The total is a whole number of dash repeats, so the loop is seamless.
  const travel = useAt(clock, (t) => keyframes(t, [0, 1.6, 2.6, 10], [0, 144, 206, 462], [linear, easeOut, linear]));
  const scX = useAt(clock, (t) => keyframes(t, [1.4, 2.6, 4.6], [360, 300, 264], [easeOut, easeInOut]));
  // The light bar's two lamps alternate, five flashes a second.
  const beaconA = useAt(clock, (t): number => (Math.floor(t * 5) % 2 === 0 ? 1 : 0.15));
  const beaconB = useAt(clock, (t): number => (Math.floor(t * 5) % 2 === 0 ? 0.15 : 1));
  const bars = useAt(clock, (t) => windowed(t, 7.4, 9.6, 0.3));
  const barGrow = useAt(clock, (t) => keyframes(t, [7.3, 8.1], [0, 1], easeInOut));
  const fadeAll = useAt(clock, (t) => Math.max(0, Math.min(1, t / 0.3, (9.9 - t) / 0.3)));

  return (
    <g>
      <Road y={24} h={32} travel={travel} />
      <Road y={70} h={16} travel={travel} fill="#15191e" />
      <motion.g style={{ opacity: fadeAll }}>
        {RACING.map((_, i) => (
          <FieldCar key={i} index={i} clock={clock} />
        ))}
        <motion.g style={{ x: scX, y: TRACK }}>
          <rect x={-15} y={-6.5} width={30} height={13} rx={4} fill="#c9c2b6" />
          <path d="M3,-5 L9,-4 L9,4 L3,5 Z" fill={C.bg} fillOpacity={0.75} />
          <path d="M-9,-5 L-4,-5 L-4,5 L-9,5 Z" fill={C.bg} fillOpacity={0.55} />
          <motion.rect x={-2.5} y={-6} width={3} height={5} rx={1} fill={C.amber} style={{ opacity: beaconA }} />
          <motion.rect x={-2.5} y={1} width={3} height={5} rx={1} fill={C.amber} style={{ opacity: beaconB }} />
          <rect x={-10} y={-22} width={20} height={12} rx={3} fill={C.amber} />
          <text y={-13} textAnchor="middle" className="font-mono" fontSize={8} fontWeight={700} fill={C.bg}>
            {labels.sc}
          </text>
        </motion.g>
      </motion.g>

      <motion.g style={{ opacity: bars }}>
        <Label x={312} y={100} anchor="end" size={7}>
          {labels.pitLoss}
        </Label>
        <Label x={8} y={113} size={7.5}>
          {labels.green}
        </Label>
        <Label x={8} y={126} size={7.5} fill={C.amber}>
          {labels.underSc}
        </Label>
        <Bar y={106} width={216} colour="#8a929c" grow={barGrow} />
        <Bar y={119} width={108} colour={C.amber} grow={barGrow} />
      </motion.g>
    </g>
  );
}

function FieldCar({ index, clock }: { index: number; clock: MotionValue<number> }) {
  const x = useAt(clock, (t) => {
    const bunched = keyframes(t, [1.8, 4.6], [RACING[index], QUEUE[index]], easeInOut);
    if (index === YOU) return keyframes(t, [0, 1.8, 4.6, 5.2, 5.7, 6.8, 7.3], [RACING[YOU], RACING[YOU], QUEUE[YOU], QUEUE[YOU], 154, 98, 92], easeInOut);
    // The cars behind move up a place when "you" peel off into the pits.
    if (index > YOU && t > 5.6) return keyframes(t, [5.6, 6.6], [QUEUE[index], QUEUE[index - 1]], easeInOut);
    return bunched;
  });
  const y = useAt(clock, (t) => (index === YOU ? keyframes(t, [5.2, 5.7, 6.8, 7.3], [TRACK, PIT, PIT, TRACK], easeInOut) : TRACK));
  return <CarTop x={x} y={y} colour={index === YOU ? C.paper : "#8a929c"} />;
}

function Bar({ y, width, colour, grow }: { y: number; width: number; colour: string; grow: MotionValue<number> }) {
  return (
    <g>
      <rect x={96} y={y} width={216} height={8} rx={4} fill={C.paper} fillOpacity={0.06} />
      <motion.rect x={96} y={y} width={width} height={8} rx={4} fill={colour} style={{ scaleX: grow, originX: 0 }} />
    </g>
  );
}
