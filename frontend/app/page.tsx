import Link from "next/link";
import { CircuitFrameSequence } from "@/components/hero/CircuitFrameSequence";
import { SessionPicker } from "@/components/hero/SessionPicker";
import { AboutNote } from "@/components/shared/About";

export default function HomePage() {
  return (
    <main className="relative">
      <div className="sticky top-0 z-10 h-[100dvh]">
        <CircuitFrameSequence />
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col justify-end px-4 pb-20 pt-24 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-pit-lime sm:text-xs">
            Sepang International Circuit
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-5xl uppercase tracking-wide sm:text-6xl md:text-7xl">
            Jalur APEXGP
          </h1>
          <p className="mt-4 max-w-xl text-sm text-paper-dim md:text-base">
            Unofficial race-engineer read for the Sepang weekend. Scroll the
            flyover, pick a session, get two strategy cards and a gap-time
            tourism guide.
          </p>
          <SessionPicker className="mt-8" />
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs uppercase tracking-wide text-paper-dim">
            <Link href="/circuit" className="hover:text-paper">
              Corner-by-corner 3D
            </Link>
            <Link href="/apple-design" className="hover:text-paper">
              Product reveal
            </Link>
            <Link href="/lore" className="hover:text-paper">
              Circuit lore (1999 → 2026)
            </Link>
            <Link href="/tickets" className="hover:text-paper">
              Seat orientation (no prices)
            </Link>
          </div>
          <p className="mt-6 max-w-xl text-[11px] leading-relaxed text-paper-dim/70">
            Unofficial fan project — not affiliated with, endorsed by, or an
            official partner of Formula 1, the FIA, or Sepang International
            Circuit.
          </p>
        </div>
      </div>
      <div className="h-[120vh]" aria-hidden />
      <div className="relative z-20 mx-auto max-w-md px-4 pb-10">
        <AboutNote />
      </div>
    </main>
  );
}
