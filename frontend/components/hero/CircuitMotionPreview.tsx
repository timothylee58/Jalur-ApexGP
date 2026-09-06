"use client";

import { useRef } from "react";
import { HeroOverlay } from "@/components/hero/HeroOverlay";
import { ScrollFrameSequence } from "@/components/shared/ScrollFrameSequence";

const FRAME_COUNT = 48;

// Full-bleed scroll-scrubbed hero, same mechanism as the landing page's own
// circuit flyover above it — reusing the pattern rather than the old
// compact GIF card this section used to be. Source clip is a generic,
// unbranded single-seater (matte livery, no team name, sponsor marks, or
// number) filmed at Sepang from a chase drone; verified frame-by-frame that
// nothing on the car reads as branding. Genuinely clean, so this one skips
// scripts/extract-frames.py's --stylize entirely — but the source clip
// carries a burned-in speed/turn-number telemetry HUD in one corner
// throughout, which does need removing (docs/BRAND.md rules out live
// telemetry overlays same as broadcast graphics); see
// frontend/public/lap-preview-frames/README.md for how it was masked out
// and verified.
//
// 9:16 frames (frontend/public/lap-preview-frames-9x16/) are a separate
// centered-crop extraction, not the same frames stretched — same idea as
// CircuitVideoHero's `<source media>` art direction, picked once at mount
// by ScrollFrameSequence.
export function CircuitMotionPreview() {
  // See LandingHero's identical rangeRef: this wraps the sticky section
  // plus its scroll-spacer so ScrollFrameSequence measures progress against
  // this section's own pin range, not the whole page.
  const rangeRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rangeRef} className="w-full">
      <div className="sticky top-0 z-10 h-[100dvh] min-h-[100svh] w-full overflow-hidden">
        <ScrollFrameSequence
          framesPath="/lap-preview-frames"
          mobileFramesPath="/lap-preview-frames-9x16"
          frameCount={FRAME_COUNT}
          rangeRef={rangeRef}
        />
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/55 to-transparent"
          aria-hidden
        />
        <HeroOverlay className="absolute inset-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-pit-lime sm:text-xs">
            Lap preview
          </p>
          <h2 className="mt-2 max-w-2xl font-display text-[clamp(2.5rem,min(10vw,14vh),4.5rem)] uppercase leading-[0.95] tracking-wide sm:mt-3">
            The lap
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper-dim sm:mt-4 md:text-base [@media(max-height:640px)]:mt-2 [@media(max-height:640px)]:text-xs">
            A generic single-seater in motion at the circuit — not real
            broadcast footage, and no team livery or sponsor marks to strip
            out this time.
          </p>
        </HeroOverlay>
      </div>
      <div className="h-[50vh] sm:h-[100vh] md:h-[120vh]" aria-hidden />
    </div>
  );
}
