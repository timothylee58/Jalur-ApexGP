import { CircuitVideoHero } from "@/components/hero/CircuitVideoHero";
import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";

export default function AppleDesignPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative">
        <div className="relative min-h-[100dvh] overflow-hidden">
          <CircuitVideoHero className="pointer-events-none absolute inset-0" />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/55 to-asphalt/20"
            aria-hidden
          />
          <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-pit-lime sm:text-xs">
              Product reveal
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-5xl uppercase tracking-wide sm:text-6xl md:text-7xl">
              Full-bleed hero
            </h1>
            <p className="mt-4 max-w-xl text-sm text-paper-dim md:text-base">
              The same background as the landing page&apos;s hero — an
              original, AI-generated clip (not real broadcast footage),
              art-directed as two separate renders for 9:16 and 16:9 rather
              than one clip stretched or letterboxed to fit. See{" "}
              <code className="text-paper">
                frontend/public/videos/README.md
              </code>{" "}
              for provenance and <code className="text-paper">docs/BRAND.md</code>
              for the checklist it was generated against.
            </p>
          </div>
        </div>
        <div className="relative z-20 mx-auto max-w-md px-4 pb-10">
          <AboutNote />
        </div>
      </main>
    </>
  );
}
