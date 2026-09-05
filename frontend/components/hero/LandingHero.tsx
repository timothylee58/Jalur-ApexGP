"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SepangCircuitMap } from "@/components/circuit/SepangCircuitMap";
import { CircuitFlyoverHero } from "@/components/hero/CircuitFlyoverHero";
import { SessionPicker } from "@/components/hero/SessionPicker";
import { WATCH_THIS_WEEKEND } from "@/data/news";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease },
  }),
};

export function LandingHero() {
  // Static SVG map is the default backdrop (see SepangCircuitMap below) —
  // the landing hero's earlier scroll-scrubbed video flyover was retired
  // for good reasons (see README). This 3D flyover is a from-scratch,
  // opt-in alternative built on the same real apex-point centreline as
  // sepang.glb and the map itself, not video, so none of those reasons
  // apply to it — off by default so the calmer static map stays what
  // visitors see first.
  const [show3D, setShow3D] = useState(false);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <AnimatePresence initial={false}>
          {show3D ? (
            <motion.div
              key="flyover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              <CircuitFlyoverHero className="pointer-events-none absolute inset-0" />
            </motion.div>
          ) : (
            <motion.div
              key="map"
              className="flex h-full items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <SepangCircuitMap muted className="h-[80%] max-h-[720px] w-auto opacity-30" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/55 to-asphalt/20"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6">
        <motion.p
          custom={0.05}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="font-mono text-[10px] uppercase tracking-[0.35em] text-pit-lime sm:text-xs"
        >
          Sepang International Circuit
        </motion.p>
        <motion.h1
          custom={0.15}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-3 max-w-2xl font-display text-5xl uppercase tracking-wide sm:text-6xl md:text-7xl"
        >
          Jalur APEXGP
        </motion.h1>
        <motion.p
          custom={0.28}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-4 max-w-xl text-sm text-paper-dim md:text-base"
        >
          Unofficial race-engineer strategy simulator for the Sepang weekend. Pick a session, get
          conservative vs aggressive reads from a live weather blend, then run your own what-if
          scenarios.
        </motion.p>
        <motion.div custom={0.4} variants={fadeUp} initial="hidden" animate="show">
          <SessionPicker className="mt-8" />
        </motion.div>
        <motion.div
          custom={0.52}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wide text-paper-dim"
        >
          <Link href="/circuit" className="hover:text-paper">
            Corner-by-corner 3D
          </Link>
          <Link href="/lore" className="hover:text-paper">
            Circuit lore (1999 → 2026)
          </Link>
          <Link href="/tickets" className="hover:text-paper">
            Tickets &amp; seating
          </Link>
          <button
            type="button"
            onClick={() => setShow3D((prev) => !prev)}
            aria-pressed={show3D}
            className="hover:text-paper"
          >
            {show3D ? "Static map" : "3D flyover"}
          </button>
        </motion.div>
        <motion.p
          custom={0.62}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-6 max-w-xl text-[11px] leading-relaxed text-paper-dim/70"
        >
          Unofficial fan project — not affiliated with, endorsed by, or an official partner of
          Formula 1, the FIA, or Sepang International Circuit.
        </motion.p>
      </div>
    </div>
  );
}
