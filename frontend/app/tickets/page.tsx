import { AboutNote } from "@/components/shared/AboutNote";
import { TransitAccessPanel } from "@/components/tickets/TransitAccessPanel";
import { SiteHeader } from "@/components/site-chrome";

const SEPANG_TICKETS_URL = "https://www.sepangcircuit.com/home";

export default function TicketsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Tickets &amp; seating
        </p>
        <h1 className="mt-2 font-display text-2xl uppercase tracking-wide text-paper">
          Buy at the source
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Grandstand options, pricing, resident rates, and child policies change every year and
          belong on the official circuit site — not duplicated here where they&apos;d go stale.
        </p>

        <a
          href={SEPANG_TICKETS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block rounded-lg border border-amber/40 bg-amber/5 px-4 py-4 text-center hover:border-amber"
        >
          <span className="font-display text-lg uppercase tracking-wide text-amber">
            Sepang International Circuit →
          </span>
          <span className="mt-1 block font-mono text-[11px] text-paper-dim">
            sepangcircuit.com — official tickets &amp; seating
          </span>
        </a>

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
