"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Clapperboard, Map as MapIcon, Rotate3d, Target, Ticket, type LucideIcon } from "lucide-react";
import { CircuitFlyoverHero } from "@/components/hero/CircuitFlyoverHero";
import { CircuitVideoHero } from "@/components/hero/CircuitVideoHero";
import { HeroOverlay } from "@/components/hero/HeroOverlay";
import { SessionPicker } from "@/components/hero/SessionPicker";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Dictionary } from "@/lib/i18n/types";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease },
  }),
};

const LINKS: { href: string; key: Exclude<keyof Dictionary["hero"]["links"], "flyover" | "lapVideo">; Icon: LucideIcon }[] = [
  { href: "/circuit", key: "circuit", Icon: MapIcon },
  { href: "/accuracy", key: "accuracy", Icon: Target },
  { href: "/lore", key: "lore", Icon: BookOpen },
  { href: "/tickets", key: "tickets", Icon: Ticket },
];

// Chips, not bare text links: a visible edge and a 36px+ target tell the
// eye these are tappable, which uppercase grey text on video did not.
const chipClass =
  "group inline-flex min-h-9 items-center gap-1.5 rounded-full border border-paper/15 bg-pit-carbon/55 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-paper/85 backdrop-blur-sm transition-colors hover:border-paper/40 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt";

export function LandingHero() {
  const { t } = useLanguage();
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
          <SessionPicker className="mt-5 sm:mt-7" />
        </motion.div>
        <motion.div
          custom={0.52}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="mt-4 flex flex-wrap gap-2 sm:mt-5"
        >
          {LINKS.map(({ href, key, Icon }) => (
            <Link key={href} href={href} className={chipClass}>
              <Icon aria-hidden="true" className="h-3.5 w-3.5 text-paper-dim transition-colors group-hover:text-amber" />
              {t.hero.links[key]}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setShow3D((prev) => !prev)}
            aria-pressed={show3D}
            className={`${chipClass} ${show3D ? "border-amber/60 text-amber" : ""}`}
          >
            {show3D ? (
              <Clapperboard aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Rotate3d aria-hidden="true" className="h-3.5 w-3.5 text-paper-dim transition-colors group-hover:text-amber" />
            )}
            {show3D ? t.hero.links.lapVideo : t.hero.links.flyover}
          </button>
        </motion.div>
      </HeroOverlay>
    </div>
  );
}
