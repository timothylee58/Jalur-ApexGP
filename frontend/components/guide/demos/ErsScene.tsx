"use client";

import { motion, type MotionValue } from "framer-motion";
import { easeIn, easeOut, keyframes, linear, windowed } from "@/lib/demoTimeline";
import { C, CarTop, Label, Road, useAt, type SceneProps } from "./parts";

const TIMES = [0, 3.2, 3.8, 7.2, 8];
const CAR = { x: 118, y: 80 };
const BATTERY = { x: 268, y: 22, w: 30, h: 76 };
const PARTICLES = 7;

const speed = (t: number) => keyframes(t, TIMES, [312, 96, 96, 318, 312], [easeOut, linear, easeIn, linear]);
const charge = (t: number) => keyframes(t, TIMES, [0.28, 0.72, 0.72, 0.3, 0.28]);
const harvesting = (t: number) => windowed(t, 0.2, 3.0, 0.2);
const deploying = (t: number) => windowed(t, 4.0, 7.0, 0.2);

/** Point `s` (0–1) along the arc from the car's rear axle to the battery. */
function arc(s: number) {
  const a = { x: CAR.x - 8, y: CAR.y - 8 };
  const b = { x: BATTERY.x + BATTERY.w / 2, y: BATTERY.y + BATTERY.h * 0.55 };
  const c = { x: 190, y: 8 };
  const u = 1 - s;
  return { x: u * u * a.x + 2 * u * s * c.x + s * s * b.x, y: u * u * a.y + 2 * u * s * c.y + s * s * b.y };
}

/**
 * The 2026 ERS loop in one lap-in-miniature. Braking: the MGU-K turns the
 * car's speed into charge, and the battery fills. The straight: the same
 * charge flows back to the rear axle as power, and the speed climbs while
 * the battery drains. The track scrolls at the car's speed throughout.
 */
export function ErsScene({ clock, labels }: SceneProps) {
  // Distance covered, integrated by hand so the scroll matches the speed
  // readout: slowing, a slow apex, then accelerating. A whole number of
  // dash repeats, so the loop is seamless.
  const travel = useAt(clock, (t) => keyframes(t, TIMES, [0, 440, 488, 1012, 1100], [easeOut, linear, easeIn, linear]));
  const readout = useAt(clock, (t) => `${Math.round(speed(t))}`);
  const level = useAt(clock, charge);
  const harvest = useAt(clock, harvesting);
  const deploy = useAt(clock, deploying);
  const brakeGlow = useAt(clock, (t) => harvesting(t) * (0.6 + 0.4 * Math.abs(Math.sin(t * 9))));

  return (
    <g>
      <Road y={64} h={32} travel={travel} />

      <Label x={10} y={20}>
        km/h
      </Label>
      <motion.text x={10} y={44} className="font-mono" fontSize={20} fill={C.paper}>
        {readout}
      </motion.text>

      {/* Brake discs glowing under braking. */}
      <motion.g style={{ opacity: brakeGlow }}>
        <circle cx={CAR.x + 7.3} cy={CAR.y - 4.9} r={4.2} fill={C.brick} />
        <circle cx={CAR.x + 7.3} cy={CAR.y + 4.9} r={4.2} fill={C.brick} />
        <circle cx={CAR.x - 9.8} cy={CAR.y - 5.2} r={4.2} fill={C.brick} />
        <circle cx={CAR.x - 9.8} cy={CAR.y + 5.2} r={4.2} fill={C.brick} />
      </motion.g>
      <CarTop x={CAR.x} y={CAR.y} colour={C.paper} />
      <Label x={CAR.x - 9} y={112} anchor="middle" size={7}>
        MGU-K
      </Label>

      {Array.from({ length: PARTICLES }, (_, k) => (
        <Particle key={k} index={k} clock={clock} />
      ))}
      <motion.g style={{ opacity: harvest }}>
        <Label x={186} y={58} anchor="middle" fill={C.teal}>
          {labels.harvest} →
        </Label>
      </motion.g>
      <motion.g style={{ opacity: deploy }}>
        <Label x={186} y={58} anchor="middle" fill={C.amber}>
          ← {labels.deploy}
        </Label>
      </motion.g>

      <Battery level={level} />
      <Label x={BATTERY.x + BATTERY.w / 2} y={116} anchor="middle" size={7.5}>
        {labels.battery}
      </Label>
    </g>
  );
}

/** Energy in flight: teal towards the battery while harvesting, amber back
 * to the axle while deploying. */
function Particle({ index, clock }: { index: number; clock: MotionValue<number> }) {
  const progress = (t: number) => (t * 0.85 + index / PARTICLES) % 1;
  const at = (t: number) => arc(harvesting(t) > 0 ? progress(t) : 1 - progress(t));
  const x = useAt(clock, (t) => at(t).x);
  const y = useAt(clock, (t) => at(t).y);
  const opacity = useAt(clock, (t) => Math.max(harvesting(t), deploying(t)) * Math.sin(Math.PI * progress(t)));
  const fill = useAt(clock, (t) => (harvesting(t) > 0 ? C.teal : C.amber));
  return <motion.circle r={2.4} style={{ x, y, opacity, fill }} />;
}

function Battery({ level }: { level: MotionValue<number> }) {
  const { x, y, w, h } = BATTERY;
  const inner = { x: x + 4, y: y + 4, w: w - 8, h: h - 8 };
  const fill = useAt(level, (l) => (l > 0.5 ? C.teal : l > 0.3 ? C.paper : C.amber));
  return (
    <g>
      <rect x={x + w / 2 - 6} y={y - 5} width={12} height={5} rx={1.5} fill={C.dim} />
      <rect x={x} y={y} width={w} height={h} rx={5} fill={C.bg} stroke={C.dim} strokeWidth={1.5} />
      <motion.rect
        x={inner.x}
        y={inner.y}
        width={inner.w}
        height={inner.h}
        rx={2.5}
        style={{ scaleY: level, originY: 1, fill }}
      />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={x + 4} x2={x + w - 4} y1={y + h * f} y2={y + h * f} stroke={C.bg} strokeWidth={1.2} />
      ))}
    </g>
  );
}
