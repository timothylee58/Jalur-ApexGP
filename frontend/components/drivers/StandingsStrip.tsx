"use client";

import { useState } from "react";
import Link from "next/link";
import { drivers } from "@/data/drivers";
import { teams } from "@/data/teams";
import { appDriverId, appTeamId } from "@/lib/standings";
import type { StandingsPayload } from "@/types/jolpica";

interface StandingsStripProps {
  data: StandingsPayload | null;
  error: boolean;
  selectedId: string;
  onSelect: (driverId: string) => void;
}

const COLLAPSED_ROWS = 10;
const TEAM_COLOUR: Record<string, string> = Object.fromEntries(teams.map((team) => [team.id, team.primary]));
const TEAM_NAME: Record<string, string> = Object.fromEntries(teams.map((team) => [team.id, team.name]));
const DRIVER_TEAM: Record<string, string> = Object.fromEntries(
  teams.flatMap((team) => team.driverIds.map((id) => [id, team.id])),
);
const DRIVER_NAME: Record<string, string> = Object.fromEntries(drivers.map((driver) => [driver.id, driver.name]));

/**
 * The live 2026 championship from Jolpica/Ergast, refetched every few
 * minutes server-side (see jolpica_service.py's _STANDINGS_CACHE_TTL_SECONDS),
 * joined to this app's own drivers and teams so names and liveries match
 * every other page (Jolpica says "RB F1 Team"; this site says Racing
 * Bulls). A driver row selects that driver's card. Career totals on the
 * card stay the static through-2025 snapshot in `data/drivers.ts`.
 */
export function StandingsStrip({ data, error, selectedId, onSelect }: StandingsStripProps) {
  const [expanded, setExpanded] = useState(false);

  if (error) {
    return (
      <p className="mt-5 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        Live standings unavailable — the Jolpica feed didn&apos;t respond.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="mt-5 h-40 animate-pulse rounded-lg bg-paper/5" role="status">
        <span className="sr-only">Loading live standings…</span>
      </div>
    );
  }

  const leader = data.drivers[0]?.points ?? 0;
  const driverRows = expanded ? data.drivers : data.drivers.slice(0, COLLAPSED_ROWS);

  return (
    <section className="mt-5 rounded-lg border border-paper/10 bg-asphalt px-4 py-4" aria-labelledby="standings-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="standings-heading" className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          {data.season} championship · after round {data.round} · live via Jolpica
        </h2>
        <Link href="/picks" className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber hover:underline">
          Race-day picks →
        </Link>
      </div>

      <div className="mt-3 grid gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-amber">Drivers</p>
          <ol className="mt-2 space-y-0.5">
            {driverRows.map((row) => {
              const id = appDriverId(row);
              const teamId = id ? DRIVER_TEAM[id] : undefined;
              const colour = teamId ? TEAM_COLOUR[teamId] : "#a39b8f";
              const name = id ? DRIVER_NAME[id] : `${row.givenName} ${row.familyName}`;
              const gap = row.points - leader;
              const content = (
                <>
                  <span className="w-6 shrink-0 text-right text-paper-dim">{row.position}</span>
                  <span aria-hidden="true" className="h-3 w-1 shrink-0 rounded-full" style={{ background: colour }} />
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  <span className="w-12 shrink-0 text-right text-paper-dim">{gap === 0 ? "" : gap}</span>
                  <span className="w-14 shrink-0 text-right">{row.points} pts</span>
                </>
              );
              const rowClass = "flex w-full items-center gap-2 rounded px-1.5 py-1 font-mono text-xs text-paper";
              return (
                <li key={row.driverId}>
                  {id ? (
                    <button
                      type="button"
                      onClick={() => onSelect(id)}
                      aria-pressed={selectedId === id}
                      className={`${rowClass} text-left transition-colors hover:bg-paper/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber ${
                        selectedId === id ? "bg-paper/10" : ""
                      }`}
                    >
                      {content}
                    </button>
                  ) : (
                    <span className={`${rowClass} text-paper-dim`}>{content}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {data.drivers.length > COLLAPSED_ROWS ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim hover:text-amber"
            >
              {expanded ? "Show top 10" : `Show all ${data.drivers.length}`}
            </button>
          ) : null}
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-amber">Constructors</p>
          <ol className="mt-2 space-y-0.5">
            {data.constructors.map((row) => {
              const id = appTeamId(row);
              return (
                <li
                  key={row.constructorId}
                  className="flex items-center gap-2 px-1.5 py-1 font-mono text-xs text-paper"
                >
                  <span className="w-6 shrink-0 text-right text-paper-dim">{row.position}</span>
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 shrink-0 rounded-full"
                    style={{ background: id ? TEAM_COLOUR[id] : "#a39b8f" }}
                  />
                  <span className="min-w-0 flex-1 truncate">{id ? TEAM_NAME[id] : row.name}</span>
                  <span className="shrink-0">{row.points} pts</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
