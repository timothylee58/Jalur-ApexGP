"use client";

import { useId } from "react";
import { useNow } from "@/hooks/usePicksWindow";
import { countdown, formatMyt } from "@/lib/picksWindow";
import {
  directionsUrl,
  RAIL_ROUTES,
  SHUTTLE_FACTS,
  SHUTTLE_PICKUPS,
  SHUTTLE_SOURCES,
  shuttleStatus,
} from "@/lib/raceShuttle";

function StatusChip() {
  // Client clock only: the server can't know the viewer's "now", and a
  // chip that flips after hydration is better than one that mismatches.
  const now = useNow(30_000);
  if (!now) return <span className="min-h-7" aria-hidden />;

  const status = shuttleStatus(now);
  let dot = "bg-paper-dim";
  let text: string;
  let tail: string | null = null;
  if (status.kind === "running") {
    dot = "bg-teal animate-pulse";
    text = `Running now · every ${SHUTTLE_FACTS.frequency}`;
  } else if (status.kind === "upcoming") {
    const left = countdown(now, status.nextStart);
    const inText = left.days > 0 ? `${left.days}d ${left.hours}h` : `${left.hours}h ${left.minutes}m`;
    dot = "bg-amber";
    text = `First bus ${formatMyt(status.nextStart)} ·`;
    tail = `in ${inText}`;
  } else if (status.kind === "overnight") {
    dot = "bg-amber";
    text = `Paused overnight · resumes ${formatMyt(status.nextStart)}`;
  } else {
    text = "Race-weekend service has ended";
  }

  return (
    <span
      role="status"
      className="inline-flex min-h-7 max-w-full items-center gap-2 self-start rounded-xl border border-paper/15 bg-asphalt px-3 py-1 font-mono text-[10px] uppercase leading-snug tracking-[0.12em] text-paper sm:shrink-0 sm:rounded-full"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span>
        {text}
        {tail ? <span className="whitespace-nowrap"> {tail}</span> : null}
      </span>
    </span>
  );
}

export function ShuttleGuide() {
  const headingId = useId();
  const facts = [
    { label: "When", value: SHUTTLE_FACTS.dates, sub: SHUTTLE_FACTS.days },
    { label: "Hours", value: SHUTTLE_FACTS.hours, sub: "All three days" },
    { label: "Every", value: `${SHUTTLE_FACTS.frequency}*`, sub: "On a loop" },
  ];

  return (
    <section aria-labelledby={headingId} className="mt-6 rounded-lg border border-paper/10 bg-asphalt/80 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Getting there · official
          </p>
          <h2 id={headingId} className="mt-1 font-display text-xl uppercase tracking-wide text-paper sm:text-2xl">
            Free Rapid KL shuttle to the circuit
          </h2>
        </div>
        <StatusChip />
      </div>

      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim">
        Rapid KL and Sepang International Circuit are running {SHUTTLE_FACTS.buses} free buses on a
        loop to the circuit all race weekend, from three pick-up points. Inside the grounds, more
        shuttles link the key areas — the general map above marks Shuttle bays 1 and 2.
      </p>

      <dl className="mt-4 grid grid-cols-3 divide-x divide-paper/10 rounded-md border border-paper/10">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0 px-2.5 py-2.5 sm:px-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">{fact.label}</dt>
            <dd className="mt-0.5 font-display text-sm uppercase tracking-wide text-amber sm:text-lg">
              {fact.value}
            </dd>
            <dd className="font-mono text-[10px] text-paper-dim">{fact.sub}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Pick-up points</h3>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {SHUTTLE_PICKUPS.map((pickup, i) => (
          <li key={pickup.id} className="flex flex-col rounded-md border border-paper/10 bg-asphalt px-3 py-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-paper-dim">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="mt-1 font-display text-base uppercase tracking-wide text-paper">{pickup.name}</span>
            <span className="mt-0.5 font-mono text-xs text-amber">{pickup.spot}</span>
            {pickup.note ? <span className="mt-2 text-xs leading-relaxed text-paper-dim">{pickup.note}</span> : null}
            <a
              href={directionsUrl(pickup)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center gap-1 self-start pt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim underline-offset-4 transition-colors hover:text-amber hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            >
              Directions ↗<span className="sr-only"> to {pickup.name} (opens Google Maps)</span>
            </a>
          </li>
        ))}
      </ol>

      <h3 className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Coming by train</h3>
      <ul className="mt-2 divide-y divide-paper/10 rounded-md border border-paper/10">
        {RAIL_ROUTES.map((route) => (
          <li key={route.lines[0].name} className="flex flex-col gap-1.5 px-3 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="flex shrink-0 flex-wrap gap-x-3 gap-y-1 sm:w-56">
              {route.lines.map((line) => (
                <span key={line.name} className="inline-flex items-center gap-1.5 font-mono text-xs text-paper">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} aria-hidden />
                  {line.name}
                </span>
              ))}
            </span>
            <span className="text-xs leading-relaxed text-paper-dim">{route.steps}</span>
          </li>
        ))}
        <li className="flex flex-col gap-1.5 bg-amber/5 px-3 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
          <span className="font-mono text-xs uppercase tracking-wide text-amber sm:w-56">KLIA 2 → circuit</span>
          <span className="text-xs leading-relaxed text-paper">
            Free Rapid KL shuttle from the Level 1 Bus Hub, Bays B1–B3.
          </span>
        </li>
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <p className="rounded-md border border-paper/10 px-3 py-2.5 text-xs leading-relaxed text-paper-dim">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-paper">Rail pass</span>
          KLIA Ekspres sells a Sepang Race Train Pass: return trips on all three days for RM200.
        </p>
        <p className="rounded-md border border-brick/40 px-3 py-2.5 text-xs leading-relaxed text-paper-dim">
          <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-paper">Driving to KLIA?</span>
          KLIA warns parking at Terminal 1 and its Long Term Car Park is extremely limited and will fill
          early each day. Get to the airport by ERL or e-hailing instead.
        </p>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-paper-dim/70">
        *Frequency is subject to traffic. Sources:{" "}
        {SHUTTLE_SOURCES.map((source, i) => (
          <span key={source.href}>
            <a href={source.href} target="_blank" rel="noopener noreferrer" className="underline hover:text-paper-dim">
              {source.label}
            </a>
            {i < SHUTTLE_SOURCES.length - 1 ? "; " : "."}
          </span>
        ))}{" "}
        Check Rapid KL&apos;s own channels on the day.
      </p>
    </section>
  );
}
