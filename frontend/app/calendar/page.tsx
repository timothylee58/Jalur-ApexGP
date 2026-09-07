import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { REGIONAL_EVENTS, TRAVEL_NOTE } from "@/data/regionalCalendar";

export const metadata = {
  title: "Regional calendar — Jalur APEXGP",
  description:
    "This app's Sepang weekend alongside the real Singapore Grand Prix — two race weekends, five days apart.",
};

export default function CalendarPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Regional calendar
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Two race weekends, one region
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          This app is built around Sepang — but it isn&apos;t the only Formula 1 weekend in the
          region this October. Singapore&apos;s Marina Bay round runs the following week, five
          days after Sepang wraps.
        </p>

        <div className="mt-6 grid gap-4">
          {REGIONAL_EVENTS.map((event) => (
            <div
              key={event.id}
              className={`rounded-lg border p-5 ${
                event.isThisAppsWeekend
                  ? "border-amber/40 bg-amber/5"
                  : "border-paper/10 bg-asphalt/80"
              }`}
            >
              {event.isThisAppsWeekend ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
                  This app&apos;s weekend
                </span>
              ) : null}
              <h2 className="mt-1 font-display text-xl uppercase tracking-wide text-paper">
                {event.circuit}
              </h2>
              <p className="text-sm text-paper-dim">{event.name}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-wide text-paper-dim">
                {event.location} · {event.dateRange}
              </p>
              <ul className="mt-3 grid gap-1.5">
                {event.facts.map((fact) => (
                  <li key={fact} className="flex gap-2 text-sm leading-relaxed text-paper-dim">
                    <span aria-hidden className="text-paper-dim/50">
                      —
                    </span>
                    {fact}
                  </li>
                ))}
              </ul>
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-xs text-amber hover:underline"
              >
                {event.isThisAppsWeekend ? "Source" : "Official site & tickets"} ·{" "}
                {event.sourceLabel} ↗
              </a>
            </div>
          ))}
        </div>

        <p className="mt-6 rounded-md border border-paper/10 bg-asphalt px-4 py-3 text-xs leading-relaxed text-paper-dim">
          {TRAVEL_NOTE}
        </p>

        <p className="mt-6 text-[11px] leading-relaxed text-paper-dim/70">
          Jalur APEXGP is an independent fan project. Singapore GP details here are for planning
          only — tickets are sold by the Singapore GP organiser, not here, and this app is not
          affiliated with, endorsed by, or an official partner of Formula 1, the FIA, Sepang
          International Circuit, or Singapore GP Pte Ltd.
        </p>

        <AboutNote />
      </main>
    </>
  );
}
