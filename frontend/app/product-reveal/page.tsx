import Link from "next/link";
import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";

export default function ProductRevealPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative">
        <div className="relative min-h-[100dvh] overflow-hidden">
          {/* Real aerial photo, not the CircuitVideoHero clip this page used
              before — owner-supplied, used here at their explicit direction
              (see PR discussion). Unlike the rest of this project's imagery,
              this one hasn't cleared docs/BRAND.md's signage/rights checklist
              (the grandstand roof reads "SEPANG CIRCUIT", and the source
              file's own name matches a motorsport photo agency's press-file
              pattern) — a deliberate, acknowledged exception for this single
              image, not a change to that checklist for anything else. */}
          <img
            src="/product-reveal/sepang-aerial.jpg"
            alt="Aerial view of the Sepang International Circuit"
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            decoding="async"
            fetchPriority="high"
          />
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-asphalt via-asphalt/55 to-asphalt/20"
            aria-hidden
          />
          <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-5xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-pit-lime sm:text-xs">
              Product reveal
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-5xl uppercase tracking-wide sm:text-6xl md:text-7xl">
              Sepang, full-bleed
            </h1>
            <p className="mt-4 max-w-xl text-sm text-paper-dim md:text-base">
              Same weekend, three ways to see it: a live strategy read, a
              corner-by-corner 3D circuit, and real telemetry pulled off the
              car. Pick one below.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wide text-paper-dim">
              <Link href="/predict" className="hover:text-paper">
                Strategy simulator →
              </Link>
              <Link href="/circuit" className="hover:text-paper">
                Corner-by-corner 3D →
              </Link>
              <Link href="/drivers" className="hover:text-paper">
                Driver grid →
              </Link>
              <Link href="/telemetry" className="hover:text-paper">
                Real telemetry →
              </Link>
              <Link href="/drive" className="hover:text-paper">
                Drive the lap →
              </Link>
            </div>
          </div>
        </div>
        <div className="relative z-20 mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
          <AboutNote />
        </div>
      </main>
    </>
  );
}
