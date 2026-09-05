"use client";

import { useEffect, useState } from "react";
import { fetchStandings } from "@/lib/api";
import type { StandingsPayload } from "@/types/jolpica";

/**
 * Compact 2025 championship table from Jolpica/Ergast — the same open
 * results feed the Sepang weekend schedule now comes from. Career totals
 * on each driver card stay as the static through-2025 snapshot in
 * `data/drivers.ts`; this strip is the season-close table those numbers
 * sit next to, fetched live rather than hand-copied.
 */
export function StandingsStrip() {
  const [data, setData] = useState<StandingsPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStandings()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        2025 standings unavailable — Jolpica feed didn&apos;t respond.
      </p>
    );
  }

  if (!data) {
    return (
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        Loading 2025 standings…
      </p>
    );
  }

  const topDrivers = data.drivers.slice(0, 5);
  const topConstructors = data.constructors.slice(0, 5);

  return (
    <section className="mt-5 rounded-lg border border-paper/10 bg-asphalt px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        {data.season} championship · round {data.round} · via Jolpica
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-amber">Drivers</p>
          <ol className="mt-2 space-y-1.5">
            {topDrivers.map((row) => (
              <li
                key={row.driverId}
                className="flex items-baseline justify-between gap-3 font-mono text-xs text-paper"
              >
                <span>
                  <span className="text-paper-dim">{row.position}.</span>{" "}
                  {row.givenName[0]}. {row.familyName}
                </span>
                <span className="text-paper-dim">{row.points} pts</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-amber">
            Constructors
          </p>
          <ol className="mt-2 space-y-1.5">
            {topConstructors.map((row) => (
              <li
                key={row.constructorId}
                className="flex items-baseline justify-between gap-3 font-mono text-xs text-paper"
              >
                <span>
                  <span className="text-paper-dim">{row.position}.</span> {row.name}
                </span>
                <span className="text-paper-dim">{row.points} pts</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
