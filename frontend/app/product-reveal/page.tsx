import Link from "next/link";
import { CircuitVideoHero } from "@/components/hero/CircuitVideoHero";
import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";

export default function ProductRevealPage() {
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
