"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { CircuitFlyoverHero } from "@/components/hero/CircuitFlyoverHero";
import { CircuitVideoHero } from "@/components/hero/CircuitVideoHero";
import { HeroOverlay } from "@/components/hero/HeroOverlay";
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
  // Original synthetic video is the default backdrop (CircuitVideoHero) —
  // the landing hero's earlier *real* scroll-scrubbed flyover was retired
  // for good reasons (see README/BRAND.md): real broadcast/aerial footage
  // twice failed the brand-safety bar. This clip is AI-generated against
  // that same checklist instead, so none of those reasons apply to it.
  // The 3D flyover stays as an opt-in alternate view, built on the same
  // real apex-point centreline as sepang.glb and the 2D map.
  const [show3D, setShow3D] = useState(false);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden">
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
              key="video"
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <CircuitVideoHero className="pointer-events-none absolute inset-0" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/55 to-asphalt/20"
        aria-hidden
      />
      <HeroOverlay className="relative min-h-[100dvh]">
        <motion.p
          custom={0.05}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="font-mono text-sm uppercase tracking-[0.35em] text-pit-lime sm:text-base"
        >
          Sepang International Circuit
        </motion.p>
        <motion.h1
          custom={0.15}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-2 max-w-3xl sm:mt-3"
        >
          <img
            src="/brand/jalur-apexgp.png"
            alt="Jalur APEXGP"
            width={460}
            height={180}
            className="h-auto w-[min(100%,24rem)] object-contain object-left sm:w-[min(100%,36rem)] md:w-[min(100%,44rem)]"
            decoding="async"
            fetchPriority="high"
          />
        </motion.h1>
        <motion.div custom={0.4} variants={fadeUp} initial="hidden" animate="show">
          <SessionPicker className="mt-5 sm:mt-8" />
        </motion.div>
        <motion.div
          custom={0.52}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-3 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wide text-paper-dim sm:mt-4"
        >
          <Link href="/circuit" className="hover:text-paper">
            Corner-by-corner 3D
          </Link>
          <Link href="/accuracy" className="hover:text-paper">
            Prediction accuracy
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
            {show3D ? "Lap video" : "3D flyover"}
          </button>
        </motion.div>
      </HeroOverlay>
    </div>
  );
}
