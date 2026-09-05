"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { CircuitFrameSequence } from "@/components/hero/CircuitFrameSequence";
import { HeroOverlay } from "@/components/hero/HeroOverlay";
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

const EXPLORE = [
  { href: "/circuit", label: "Corner-by-corner 3D" },
  { href: "/apple-design", label: "Product reveal" },
  { href: "/lore", label: "Circuit lore" },
  { href: "/tickets", label: "Seat orientation" },
] as const;

export function LandingHero() {
  // Wraps the sticky flyover plus its scroll-spacer so ScrollFrameSequence
  // can measure this section's own pin range (see rangeRef on
  // CircuitFrameSequence) instead of the whole document — the page has
  // several more sections below that would otherwise stretch the mapping.
  const rangeRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rangeRef}>
      <div className="sticky top-0 z-10 h-[100dvh] min-h-[100svh]">
        <CircuitFrameSequence rangeRef={rangeRef} />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/60 to-transparent"
          aria-hidden
        />
        <HeroOverlay className="absolute inset-0">
          <motion.p
            custom={0.05}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="font-mono text-[10px] uppercase tracking-[0.28em] text-pit-lime sm:text-xs sm:tracking-[0.35em]"
          >
            Sepang International Circuit
          </motion.p>
          <motion.h1
            custom={0.15}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-2 max-w-2xl font-display text-[clamp(2.75rem,11vw,4.5rem)] uppercase leading-[0.92] tracking-wide sm:mt-3"
          >
            Jalur APEXGP
          </motion.h1>
          <motion.p
            custom={0.28}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-3 max-w-md text-sm leading-relaxed text-paper-dim sm:mt-4 sm:max-w-xl md:text-base"
          >
            <span className="sm:hidden">
              Pick a session for two strategy cards and a gap-time guide.
            </span>
            <span className="hidden sm:inline">
              Unofficial race-engineer read for the Sepang weekend. Scroll the
              flyover, pick a session, get two strategy cards and a gap-time
              tourism guide.
            </span>
          </motion.p>

          <motion.div
            custom={0.4}
            variants={fadeUp}
            initial="hidden"
            animate="show"
          >
            <SessionPicker className="mt-5 sm:mt-8 [@media(max-height:640px)]:mt-3" />
          </motion.div>

          <motion.div
            custom={0.5}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-4 flex flex-col gap-3 sm:mt-5 sm:gap-4 [@media(max-height:640px)]:mt-3"
          >
            <a
              href={WATCH_THIS_WEEKEND.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 w-fit items-center font-mono text-xs uppercase tracking-wide text-amber hover:text-paper"
            >
              Watch this weekend →
            </a>

            {/* Mobile: 2×2 grid so nothing clips. sm+: wrapping row. */}
            <nav
              aria-label="Explore"
              className="grid grid-cols-2 gap-x-4 gap-y-1 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2"
            >
              {EXPLORE.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-9 items-center font-mono text-[11px] uppercase tracking-wide text-paper-dim hover:text-paper sm:min-h-0 sm:text-xs"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </motion.div>

          <motion.p
            custom={0.62}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="mt-5 hidden max-w-xl text-[11px] leading-relaxed text-paper-dim/70 sm:mt-6 sm:block"
          >
            Unofficial fan project — not affiliated with, endorsed by, or an
            official partner of Formula 1, the FIA, or Sepang International
            Circuit.
          </motion.p>
        </HeroOverlay>
      </div>
      {/* Shorter scrub range on small screens so the rest of the page stays reachable. */}
      <div className="h-[50vh] sm:h-[100vh] md:h-[120vh]" aria-hidden />
    </div>
  );
}
