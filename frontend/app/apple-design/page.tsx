"use client";

import { useRef } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { ScrollFrameSequence } from "@/components/shared/ScrollFrameSequence";
import { SiteHeader } from "@/components/site-chrome";

const FRAME_COUNT = 48;

export default function AppleDesignPage() {
  // See LandingHero's identical rangeRef: wraps the sticky section plus its
  // scroll-spacer so ScrollFrameSequence measures progress against this
  // section's own pin range rather than the whole page — this page also has
  // an AboutNote section below that would otherwise stretch the mapping.
  const rangeRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <SiteHeader />
      <main className="relative">
        <div ref={rangeRef}>
          <div className="sticky top-0 z-10 h-[100dvh]">
            <ScrollFrameSequence
              framesPath="/apple-design-frames"
              frameCount={FRAME_COUNT}
              rangeRef={rangeRef}
            />
            <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-pit-lime sm:text-xs">
                Scroll-frame showcase
              </p>
              <h1 className="mt-3 max-w-2xl font-display text-5xl uppercase tracking-wide sm:text-6xl md:text-7xl">
                Product reveal
              </h1>
              <p className="mt-4 max-w-xl text-sm text-paper-dim md:text-base">
                A second scroll-scrubbed frame sequence, reusing the same
                mechanism as the landing page&apos;s circuit flyover — built
                as a standalone demo of the technique. Full detail early in
                the scroll; grayscale and mosaic-downsampled later, where the
                source clip shows a sponsor mark no official broadcast footage
                would be needed for; see{" "}
                <code className="text-paper">docs/BRAND.md</code>.
              </p>
            </div>
          </div>
          <div className="h-[120vh]" aria-hidden />
        </div>
        <div className="relative z-20 mx-auto max-w-md px-4 pb-10">
          <AboutNote />
        </div>
      </main>
    </>
  );
}
