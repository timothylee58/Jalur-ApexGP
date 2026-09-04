"use client";

import { useEffect, useState } from "react";

// Source clip (a regenerated take, closer to brand but still not clean)
// paints a fake sponsor decal ("FORLEN" + an F1 logo mark) onto the rear
// wing, legible from ~5.5s to the end — same AI-hallucinated-branding
// problem docs/BRAND.md rules out, just smaller than the first take's. The
// first ~5.5s never shows it (wide/side/wheel shots), so instead of
// mosaic-ing the whole clip, only the risky window gets the coarse
// downsample-then-upscale treatment (verified against the worst-case —
// closest, sharpest — frame that legibility is destroyed, not softened);
// the clean window stays full detail, blended between the two with a
// short crossfade rather than a hard cut. GIFs can't be paused once playing, so this only plays the loop once
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
          height={270}
          className="w-full"
        />
      </div>
    </section>
  );
}
