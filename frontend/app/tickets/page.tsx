import Link from "next/link";
import { AboutNote } from "@/components/shared/AboutNote";
import { GrandstandCard } from "@/components/tickets/GrandstandCard";
import { grandstands, ticketPolicy } from "@/data/ticketinfo";

export default function TicketsPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-lg uppercase tracking-wide text-paper">
          <Link href="/">Jalur APEXGP</Link>
        </h1>
        <Link
          href="/predict"
          className="rounded-full bg-amber px-3 py-1.5 font-mono text-xs text-asphalt"
        >
          Predict
        </Link>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        Seat orientation
      </p>
      <p className="mt-2 text-sm text-paper-dim">{ticketPolicy.duration}</p>

      <div className="mt-5 space-y-3">
        {grandstands.map((stand) => (
          <GrandstandCard key={stand.id} stand={stand} />
        ))}
      </div>

      <section className="mt-6 space-y-3 text-sm text-paper-dim">
        <p>{ticketPolicy.residentPricing}</p>
        <p>{ticketPolicy.childPolicy}</p>
        <p className="text-[11px] leading-relaxed">{ticketPolicy.disclaimer}</p>
      </section>

      <AboutNote />
    </main>
  );
}
