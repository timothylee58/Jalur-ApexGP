import { AboutNote } from "@/components/shared/AboutNote";
import { TransitAccessPanel } from "@/components/tickets/TransitAccessPanel";
import { SiteHeader } from "@/components/site-chrome";
import { SeatFinder } from "@/components/tickets/SeatFinder";

export const metadata = {
  title: "Tickets & seating — Jalur APEXGP",
  description:
    "Find a Sepang grandstand view for the 2026 Formula 1 Gulf Air Bahrain Grand Prix — pricing and seat picker, tickets sold via the organiser.",
};

export default function TicketsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-5xl">
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
