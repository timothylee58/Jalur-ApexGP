"use client";

interface CircuitVideoHeroProps {
  className?: string;
}

/**
 * Full-bleed looping background video — muted, autoplaying, no controls
 * (behaves like a GIF, not a video player). Original synthetic footage
 * (see frontend/public/videos/README.md for provenance and the one frame
 * region that needed blurring), not real broadcast footage, per
 * docs/BRAND.md.
 *
 * Uses <source media> art-direction rather than CSS-cropping one clip:
 * two actually-different renders (a 9:16 crop for narrow viewports, the
 * native 16:9 otherwise), so a phone gets a composition made for its
 * aspect ratio instead of a letterboxed or over-cropped 16:9. The browser
 * picks a source once at load, same as <picture> — it won't re-pick on
 * resize, which is the standard, acceptable trade-off for a hero video.
 */
export function CircuitVideoHero({
  className = "pointer-events-none absolute inset-0",
}: CircuitVideoHeroProps) {
  return (
    <div className={className}>
      <video
        className="h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden
      >
        <source src="/videos/hero-9x16.mp4" media="(max-width: 639px)" type="video/mp4" />
        <source src="/videos/hero-16x9.mp4" type="video/mp4" />
      </video>
    </div>
  );
}
