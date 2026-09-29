"use client";

import { motion, useAnimationFrame, useMotionValue, useTransform, type MotionValue } from "framer-motion";
import { useCallback, useRef } from "react";

/** Every scene draws into the same 320×132 box. */
export const W = 320;
export const H = 132;

export const C = {
  bg: "#0a0c0e",
  asphalt: "#1a1f25",
  kerb: "#262c33",
  tyre: "#050607",
  paper: "#f4efe6",
  dim: "#a39b8f",
  grey: "#6b7480",
  amber: "#f5a623",
  teal: "#2ec4b6",
  brick: "#c23b22",
  yellow: "#ffd200",
  red: "#e0301f",
  blue: "#2f6fe0",
  green: "#43b02a",
};

export interface SceneProps {
  clock: MotionValue<number>;
  labels: Record<string, string>;
  variant: number;
}

/**
 * One looping clock per demo, in seconds. It advances on animation frames
 * only while `playing`; `seek` jumps it anywhere (the step buttons use it),
 * which is also how a paused or reduced-motion demo shows a chosen moment.
 */
export function useDemoClock(period: number, playing: boolean, start: number) {
  const clock = useMotionValue(start);
  const time = useRef(start);
  useAnimationFrame((_, delta) => {
    if (!playing) return;
    // A long gap (a background tab) mustn't jump the scene forward.
    time.current = (time.current + Math.min(delta, 100) / 1000) % period;
    clock.set(time.current);
  });
  const seek = useCallback(
    (to: number) => {
      time.current = to;
      clock.set(to);
    },
    [clock],
  );
  return { clock, seek };
}

/** Shorthand for a motion value derived from the clock (or from another
 * value derived from it). Numbers are rounded to 1e-4: the first frame is
 * rendered on the server too, and Node and browsers can disagree in the
 * last digit of a sine — enough to fail hydration. */
export function useAt<T>(source: MotionValue<number>, fn: (t: number) => T): MotionValue<T> {
  return useTransform(source, (t) => {
    const v = fn(t);
    return (typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v) as T;
  });
}

/** A strip of track. `travel` scrolls the centre dashes, so a scene can hold
 * the cars still in frame and still read as moving. */
export function Road({
  y,
  h,
  travel,
  x = 0,
  w = W,
  fill = C.asphalt,
}: {
  y: number;
  h: number;
  travel?: MotionValue<number>;
  x?: number;
  w?: number;
  fill?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} />
      <line x1={x} x2={x + w} y1={y + 0.75} y2={y + 0.75} stroke={C.paper} strokeOpacity={0.16} strokeWidth={1.5} />
      <line x1={x} x2={x + w} y1={y + h - 0.75} y2={y + h - 0.75} stroke={C.paper} strokeOpacity={0.16} strokeWidth={1.5} />
      <motion.line
        x1={x}
        x2={x + w}
        y1={y + h / 2}
        y2={y + h / 2}
        stroke={C.paper}
        strokeOpacity={0.14}
        strokeWidth={1.2}
        strokeDasharray="10 12"
        style={travel ? { strokeDashoffset: travel } : undefined}
      />
    </g>
  );
}

/**
 * A top-down Formula 1 car, nose to the right, 30 units long: wings,
 * four exposed wheels, sidepods tapering to the nose, and the cockpit.
 * `wing` colours both wings, which is how Straight Mode is shown.
 */
export function CarTop({
  x,
  y,
  colour,
  wing,
  opacity,
}: {
  x: MotionValue<number> | number;
  y: MotionValue<number> | number;
  colour: string;
  wing?: MotionValue<string> | string;
  opacity?: MotionValue<number> | number;
}) {
  const wingFill = wing ?? colour;
  return (
    <motion.g style={{ x, y, opacity }}>
      <motion.rect x={-15} y={-5.5} width={3} height={11} rx={0.8} style={{ fill: wingFill }} />
      <rect x={-12.5} y={-6.8} width={5.5} height={3.2} rx={1} fill={C.tyre} stroke="#2a3036" strokeWidth={0.6} />
      <rect x={-12.5} y={3.6} width={5.5} height={3.2} rx={1} fill={C.tyre} stroke="#2a3036" strokeWidth={0.6} />
      <path d="M-12,-3 L-3,-4.3 L3,-2.4 L13,-1.1 L13,1.1 L3,2.4 L-3,4.3 L-12,3 Z" fill={colour} />
      <ellipse cx={-2.6} cy={0} rx={2.3} ry={1.5} fill={C.bg} />
      <rect x={5} y={-6.2} width={4.6} height={2.7} rx={1} fill={C.tyre} stroke="#2a3036" strokeWidth={0.6} />
      <rect x={5} y={3.5} width={4.6} height={2.7} rx={1} fill={C.tyre} stroke="#2a3036" strokeWidth={0.6} />
      <motion.rect x={12.6} y={-6.6} width={2.4} height={13.2} rx={0.8} style={{ fill: wingFill }} />
    </motion.g>
  );
}

/** A chequered band, `cols`×`rows` squares of `size`. */
export function Chequer({ x, y, cols, rows, size }: { x: number; y: number; cols: number; rows: number; size: number }) {
  const cells = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x + c * size}
          y={y + r * size}
          width={size}
          height={size}
          fill={(r + c) % 2 === 0 ? C.paper : C.bg}
        />,
      );
    }
  }
  return <g>{cells}</g>;
}

/** Scene text: small, mono, uppercase — the dashboard's own voice. Moving
 * text sits inside a `motion.g` that carries the movement. */
export function Label({
  x,
  y,
  children,
  fill = C.dim,
  anchor = "start",
  size = 8.5,
  opacity,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  size?: number;
  opacity?: MotionValue<number> | number;
}) {
  return (
    <motion.text
      x={x}
      y={y}
      textAnchor={anchor}
      className="font-mono uppercase"
      fontSize={size}
      letterSpacing={1.2}
      fill={fill}
      style={{ opacity }}
    >
      {children}
    </motion.text>
  );
}
