"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CircuitFrameSequence } from "@/components/hero/CircuitFrameSequence";
import { SessionPicker } from "@/components/hero/SessionPicker";

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
  return (
    <div className="sticky top-0 z-10 h-[100dvh]">
      <CircuitFrameSequence />
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/55 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6">
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
          Unofficial race-engineer read for the Sepang weekend. Scroll the
          flyover, pick a session, get two strategy cards and a gap-time
          tourism guide.
        </motion.p>
        <motion.div
          custom={0.4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
        >
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
            Seat orientation (no prices)
          </Link>
        </motion.div>
        <motion.p
          custom={0.62}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-6 max-w-xl text-[11px] leading-relaxed text-paper-dim/70"
        >
          Unofficial fan project — not affiliated with, endorsed by, or an
          official partner of Formula 1, the FIA, or Sepang International
          Circuit.
        </motion.p>
      </div>
    </div>
  );
}
