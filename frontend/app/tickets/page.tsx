import { AboutNote } from "@/components/shared/AboutNote";
import { TransitAccessPanel } from "@/components/tickets/TransitAccessPanel";
import { SiteHeader } from "@/components/site-chrome";
import { SeatFinder } from "@/components/tickets/SeatFinder";
import { ShuttleGuide } from "@/components/tickets/ShuttleGuide";

export const metadata = {
  title: "Tickets & seating — Jalur APEXGP",
  description:
    "Find a Sepang grandstand view for the 2026 Formula 1 Gulf Air Bahrain Grand Prix — pricing, seat picker, the 2026 general map and the free Rapid KL shuttle to the circuit.",
};

export default function TicketsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Find your view
        </p>
        <h1 className="mt-2 font-display text-2xl uppercase tracking-wide text-paper sm:text-4xl">
          Your seat. Your Sepang.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-dim">
          Three days · 2–4 October · illustrative MyKad pricing, last checked against the
          organiser&apos;s public listings. Tickets are sold by the circuit, not here — pick a
          stand below to see what it looks over, then continue to the organiser to book.
        </p>

        <SeatFinder />

        <ShuttleGuide />

        <TransitAccessPanel />

        <p className="mt-6 text-[11px] leading-relaxed text-paper-dim/70">
          Jalur APEXGP is an independent fan project — not affiliated with, endorsed by, or an
          official partner of Formula 1, the FIA, or Sepang International Circuit. No tickets are
          sold here.
        </p>

        <AboutNote />
      </main>
    </>
  );
}
