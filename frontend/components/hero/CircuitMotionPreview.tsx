"use client";

import { useEffect, useState } from "react";

// Source clip showed a real circuit, a real team's livery colors, and
// legible sponsor decals (Pirelli, Orlen) — every one of those is ruled out
// by docs/BRAND.md ("no team liveries, no sponsor logos, anywhere"; hero
// footage is "originally captured/extracted... never official broadcast
// footage"). Desaturated and downsampled to a coarse mosaic before
// upscaling — verified frame-by-frame that this destroys every decal's
// legibility, not just softens it, while still reading as a car in motion.
// GIFs can't be paused once playing, so this only plays the loop once
// prefers-reduced-motion is confirmed off; a static poster frame covers
// both SSR and the reduced-motion case. Checked via matchMedia in an effect
// rather than framer-motion's useReducedMotion(): that hook's SSR value and
// its own pre-effect client value aren't the same, which hydration-mismatches
// on this exact "swap the src based on it" pattern — a plain useState(false)
// keeps the server HTML and the client's first paint identical, and the
// effect only flips it after hydration.
export function CircuitMotionPreview() {
  const [showMotion, setShowMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setShowMotion(!query.matches);
    const onChange = () => setShowMotion(!query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="relative z-20 mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">
        Lap preview
      </p>
      <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-paper">
        The lap, stylized
      </h2>
      <p className="mt-2 max-w-xl text-sm text-paper-dim">
        A treated loop, not real broadcast footage — colors and sponsor
        marks stripped so nothing here reads as an official team livery.
      </p>

      <div className="relative mt-6 overflow-hidden rounded-lg border border-paper/10 bg-asphalt">
        <img
          src={showMotion ? "/hero/circuit-motion.gif" : "/hero/circuit-motion-poster.webp"}
          alt="Stylized, desaturated mosaic loop of a car braking and cornering — treated so no sponsor marks or team colors are legible"
          width={480}
          height={276}
          className="w-full"
        />
      </div>
    </section>
  );
}
