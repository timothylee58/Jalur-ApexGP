"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AboutNote } from "@/components/shared/AboutNote";
import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { DriverGridScene } from "@/components/drivers/DriverGridScene";
import { StandingsStrip } from "@/components/drivers/StandingsStrip";
import { SiteHeader } from "@/components/site-chrome";
import { drivers, type DriverEra } from "@/data/drivers";
import { teams } from "@/data/teams";
import { accentForDriver } from "@/lib/driverAccent";

const ERA_LABEL: Record<DriverEra, string> = {
  "2026-grid": "2026 grid",
  "sepang-history": "Sepang history",
};

const STAT_LABELS: Array<{ key: "championships" | "wins" | "podiums" | "poles"; label: string }> = [
  { key: "championships", label: "Titles" },
  { key: "wins", label: "Wins" },
  { key: "podiums", label: "Podiums" },
  { key: "poles", label: "Poles" },
];

function DriversView() {
  const searchParams = useSearchParams();
  const paramDriverId = searchParams.get("driver");
  const paramDriver = paramDriverId ? drivers.find((driver) => driver.id === paramDriverId) : undefined;

  const [era, setEra] = useState<DriverEra>(paramDriver?.era ?? "2026-grid");
  const filtered = useMemo(() => drivers.filter((driver) => driver.era === era), [era]);
  const [selectedId, setSelectedId] = useState<string>(paramDriver?.id ?? filtered[0].id);

  // A `?driver=` link (from /teams) should win over whatever era/selection
  // was already on screen — same "param always resolves fresh" reasoning
  // /predict's session param uses, so an incoming link never silently
  // lands on stale state from a previous visit.
  useEffect(() => {
    if (paramDriver) {
      setEra(paramDriver.era);
      setSelectedId(paramDriver.id);
    }
  }, [paramDriver]);

  const selected = filtered.find((driver) => driver.id === selectedId) ?? filtered[0];
  const selectedTeam = selected ? teams.find((team) => team.driverIds.includes(selected.id)) : undefined;

  function selectEra(next: DriverEra) {
    setEra(next);
    const first = drivers.find((driver) => driver.era === next);
    if (first) setSelectedId(first.id);
  }

  return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Driver grid
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Every seat on the grid
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Real drivers, real career numbers — headshots in constructor-color
          rings with race numbers. Stats are career totals through the 2025
          season close, the season this grid enters 2026 with, not a live
          in-season feed. Markers are paired by team, not a real qualifying
          or grid order. Unofficial fan project — photos for identification
          only, not licensed merch.
        </p>

        <StandingsStrip />

        <div className="mt-5 flex gap-2" role="tablist" aria-label="Driver era">
          {(Object.keys(ERA_LABEL) as DriverEra[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={era === key}
              onClick={() => selectEra(key)}
              className={`rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                era === key
                  ? "bg-amber text-asphalt"
                  : "border border-paper/15 text-paper-dim hover:text-paper"
              }`}
            >
              {ERA_LABEL[key]}
            </button>
          ))}
        </div>

        {era === "sepang-history" ? (
          <p className="mt-3 text-xs leading-relaxed text-paper-dim">
            Three drivers, three separate years — 1999 and 2009 — never on
            one podium together. See each moment in{" "}
            <Link href="/lore" className="text-amber hover:underline">
              Circuit Lore
            </Link>
            .
          </p>
        ) : null}

        <div className="mt-6">
          <DriverGridScene drivers={filtered} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((driver) => (
            <button
              key={driver.id}
              type="button"
              onClick={() => setSelectedId(driver.id)}
              aria-pressed={selectedId === driver.id}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                selectedId === driver.id
                  ? "border-amber bg-amber/10"
                  : "border-paper/10 hover:border-paper/25"
              }`}
            >
              {(() => {
                const accent = accentForDriver(driver);
                return (
                  <DriverAvatar
                    driverId={driver.id}
                    initials={driver.initials}
                    number={driver.number}
                    accent={accent.primary}
                    accentSecondary={accent.secondary}
                    active={selectedId === driver.id}
                  />
                );
              })()}
              <span className="min-w-0">
                <span
                  className={`block truncate text-xs font-medium ${
                    selectedId === driver.id ? "text-amber" : "text-paper"
                  }`}
                >
                  {driver.name}
                </span>
                <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                  {driver.team}
                </span>
              </span>
            </button>
          ))}
        </div>

        {selected ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-lg border border-paper/10 bg-asphalt px-4 py-4"
          >
            <div className="flex items-center gap-3">
              {(() => {
                const accent = accentForDriver(selected);
                return (
                  <DriverAvatar
                    driverId={selected.id}
                    initials={selected.initials}
                    number={selected.number}
                    accent={accent.primary}
                    accentSecondary={accent.secondary}
                    active
                    size="lg"
                  />
                );
              })()}
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl uppercase tracking-wide text-paper">
                  {selected.name}
                </h2>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
                  {selected.team}
                  {selected.number !== null ? ` · #${selected.number}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-paper-dim">
                  {selected.nationality} · {selected.seasonsActive}
                </p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-paper-dim">{selected.note}</p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAT_LABELS.map(({ key, label }) => (
                <div key={key} className="rounded-md border border-paper/10 px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-lg text-paper">{selected.stats[key]}</p>
                </div>
              ))}
            </div>

            {selected.recap ? (
              <p className="mt-4 border-t border-paper/10 pt-3 text-xs leading-relaxed text-paper-dim">
                <span className="font-mono text-[10px] uppercase tracking-wide text-amber">
                  Last time out ·{" "}
                </span>
                {selected.recap}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
              {selected.loreId ? (
                <Link
                  href={`/lore#${selected.loreId}`}
                  className="font-mono text-xs uppercase tracking-wide text-amber hover:underline"
                >
                  See this moment in Circuit Lore →
                </Link>
              ) : null}
              {selectedTeam ? (
                <Link
                  href={`/teams#${selectedTeam.id}`}
                  className="font-mono text-xs uppercase tracking-wide text-amber hover:underline"
                >
                  {selectedTeam.name} team page →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <AboutNote />
      </main>
  );
}

export default function DriversPage() {
  return (
    <>
      <SiteHeader />
      <Suspense
        fallback={
          <p className="py-10 text-center font-mono text-sm text-paper-dim">Loading grid…</p>
        }
      >
        <DriversView />
      </Suspense>
    </>
  );
}
