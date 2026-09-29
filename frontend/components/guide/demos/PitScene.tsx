"use client";

import { motion, type MotionValue } from "framer-motion";
import { easeInOut, keyframes, linear, windowed } from "@/lib/demoTimeline";
import { C, CarTop, Label, Road, useAt, type SceneProps } from "./parts";

const TRACK = 40;
const PIT = 94;

/**
 * A pit stop in a frame that moves with the pack: cars on track hold
 * their spacing, while a car in the pit lane drifts backwards — slowly
 * under the speed limit, fast while it's stationary in the box — which is
 * exactly the time a stop costs. Returns x and y keyframes for one stop.
 */
function stop(at: number, x: number) {
  const times = [at, at + 0.5, at + 0.9, at + 1.6, at + 2.0, at + 2.5];
  const xs = [x, x - 10, x - 22, x - 64, x - 74, x - 80];
  return { times, xs, y: { times: [at, at + 0.5, at + 2.0, at + 2.5], values: [TRACK, PIT, PIT, TRACK] } };
}

/** Pieces a car's path together: a pit stop plus straight-line runs. */
function pathX(t: number, keys: [number, number][]) {
  return keyframes(
    t,
    keys.map(([k]) => k),
    keys.map(([, v]) => v),
    linear,
  );
}

const UNDERCUT = (() => {
  const you = stop(1.2, 170);
  const rival = stop(6.0, 216);
  return {
    youX: [[0, 170], ...you.times.map((k, i) => [k, you.xs[i]]), [6.0, 178], [8.5, 190]] as [number, number][],
    youY: you.y,
    rivalX: [[0, 216], ...rival.times.map((k, i) => [k, rival.xs[i]])] as [number, number][],
    rivalY: rival.y,
    tag: { from: 3.9, to: 6.0 },
  };
})();

const OVERCUT = (() => {
  const rival = stop(1.2, 216);
  const you = stop(6.0, 246);
  return {
    // The rival's stop drops them in behind the slow car at 130.
    rivalX: [[0, 216], ...rival.times.map((k, i) => [k, rival.xs[i] - 40 * (i / 5)]), [6, 96], [9, 100]] as [
      number,
      number,
    ][],
    rivalY: rival.y,
    youX: [[0, 170], [3.9, 170], [6.0, 246], ...you.times.slice(1).map((k, i) => [k, you.xs[i + 1]])] as [
      number,
      number,
    ][],
    youY: you.y,
    tag: { from: 3.9, to: 6.0 },
  };
})();

/**
 * Undercut and overcut, the same two cars each time — you a second behind
 * your rival. Undercut: stop first, lap faster on fresh tyres, and be ahead
 * once they stop. Overcut: they stop first and rejoin on cold tyres behind
 * a slower car; you push in clean air, stop a lap later, and come out ahead.
 */
export function PitScene({ clock, labels, variant }: SceneProps) {
  const plan = variant === 1 ? OVERCUT : UNDERCUT;
  const travel = useAt(clock, (t) => t * 60);
  const youX = useAt(clock, (t) => pathX(t, plan.youX));
  const youY = useAt(clock, (t) => keyframes(t, plan.youY.times, plan.youY.values, easeInOut));
  const rivalX = useAt(clock, (t) => pathX(t, plan.rivalX));
  const rivalY = useAt(clock, (t) => keyframes(t, plan.rivalY.times, plan.rivalY.values, easeInOut));
  const tagShown = useAt(clock, (t) => windowed(t, plan.tag.from, plan.tag.to, 0.25));
  const result = useAt(clock, (t) => windowed(t, 8.6, 10.1, 0.25));
  // Fade in from the loop's start and out before it wraps.
  const fadeAll = useAt(clock, (t) => Math.max(0, Math.min(1, t / 0.3, (10.8 - t) / 0.4)));
  const traffic = variant === 1 ? 1 : 0;

  return (
    <g>
      <Road y={24} h={32} travel={travel} />
      <Road y={84} h={20} travel={travel} fill="#15191e" />
      <line x1={0} x2={320} y1={70} y2={70} stroke={C.paper} strokeOpacity={0.06} />
      <Label x={8} y={122}>
        {labels.pit}
      </Label>
      <motion.g style={{ opacity: fadeAll }}>
        {traffic ? <CarTop x={130} y={TRACK} colour="#4b535c" /> : null}
        <Tagged x={rivalX} y={rivalY} text={labels.rival} colour="#8a929c" />
        <Tagged x={youX} y={youY} text={labels.you} colour={C.paper} />

        {/* What the stint is doing for each car. */}
        <motion.g style={{ x: youX, opacity: tagShown }}>
          <Pill y={66} text={variant === 1 ? labels.cleanAir : labels.fresh} colour={C.teal} />
        </motion.g>
        {variant === 1 ? (
          <motion.g style={{ x: rivalX, opacity: tagShown }}>
            <Pill y={66} text={labels.cold} colour={C.brick} />
          </motion.g>
        ) : null}

        <motion.g style={{ x: youX, opacity: result }}>
          <Pill y={4} text={variant === 1 ? labels.overcut : labels.undercut} colour={C.amber} solid />
        </motion.g>
      </motion.g>
    </g>
  );
}

function Tagged({ x, y, text, colour }: { x: MotionValue<number>; y: MotionValue<number>; text: string; colour: string }) {
  return (
    <g>
      <CarTop x={x} y={y} colour={colour} />
      <motion.g style={{ x, y }}>
        <text y={-11} textAnchor="middle" className="font-mono uppercase" fontSize={7.5} letterSpacing={1} fill={colour}>
          {text}
        </text>
      </motion.g>
    </g>
  );
}

function Pill({ y, text, colour, solid = false }: { y: number; text: string; colour: string; solid?: boolean }) {
  const w = Math.max(40, text.length * 5.6 + 14);
  return (
    <g>
      <rect x={-w / 2} y={y} width={w} height={14} rx={7} fill={solid ? colour : C.bg} stroke={colour} />
      <text
        y={y + 10}
        textAnchor="middle"
        className="font-mono uppercase"
        fontSize={8}
        letterSpacing={1}
        fill={solid ? C.bg : colour}
      >
        {text}
      </text>
    </g>
  );
}
