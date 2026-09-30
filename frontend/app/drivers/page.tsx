"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AboutNote } from "@/components/shared/AboutNote";
import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { ConstructorGrid } from "@/components/drivers/ConstructorGrid";
import { DriverGridScene } from "@/components/drivers/DriverGridScene";
import { SepangHistoryTimeline } from "@/components/drivers/SepangHistoryTimeline";
import { StandingsStrip } from "@/components/drivers/StandingsStrip";
import { SiteHeader } from "@/components/site-chrome";
import { drivers, type DriverEra } from "@/data/drivers";
import { teams } from "@/data/teams";
import { useStandings } from "@/hooks/useStandings";
import { accentForDriver } from "@/lib/driverAccent";
import { driverStanding } from "@/lib/standings";

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

  const standings = useStandings();
  const season = selected ? driverStanding(standings.data, selected.id) : null;
  const cardRef = useRef<HTMLDivElement>(null);

  // Below lg the card sits above the team grid and the standings table sits
  // above both, so a pick made further down the page can change a card
  // that's scrolled out of view. Bring it back into view; on desktop the
  // card is pinned beside the grid and never leaves.
  function selectAndReveal(id: string) {
    setSelectedId(id);
    const driver = drivers.find((d) => d.id === id);
    if (driver && driver.era !== era) setEra(driver.era);
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() =>
      cardRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }),
    );
  }

  return (
      <main className="mx-auto w-full max-w-3xl px-4 py-6 lg:max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Driver grid
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Every seat on the grid
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-paper-dim">
          Real drivers in their constructor&apos;s colours. The championship table and each
          driver&apos;s 2026 line are live from Jolpica; career totals run to the 2025 season
          close. The 3D view lines them up in grid formation <em>by team</em>, a layout choice
          rather than a qualifying result, so who sits on pole there means nothing. Unofficial
          fan project — photos for identification only, not licensed merch.
        </p>

        <StandingsStrip
          data={standings.data}
          error={standings.error}
          selectedId={selectedId}
          onSelect={selectAndReveal}
        />

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
            Three drivers, two Sepang afternoons a decade apart — the 1999
            opener and the 2009 monsoon. Each sits with the moment that put
            it here; the full story is in{" "}
            <Link href="/lore" className="text-amber hover:underline">
              Circuit Lore
            </Link>
            .
          </p>
        ) : null}

        {/* Mobile: scene, card, then the grid. Desktop: scene over grid on
            the left, the card pinned on the right as you browse. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
          <div className="order-1 lg:order-none lg:col-start-1 lg:row-start-1">
            <DriverGridScene drivers={filtered} selectedId={selectedId} onSelect={setSelectedId} />
          </div>

          <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
            {era === "2026-grid" ? (
              <ConstructorGrid selectedId={selectedId} onSelect={selectAndReveal} />
            ) : (
              <SepangHistoryTimeline selectedId={selectedId} onSelect={selectAndReveal} />
            )}
          </div>

        {selected ? (
          <div
            ref={cardRef}
            role="status"
            aria-live="polite"
            className="order-2 scroll-mt-4 self-start rounded-lg border border-paper/10 bg-asphalt px-4 py-4 lg:sticky lg:top-6 lg:order-none lg:col-start-2 lg:row-span-2 lg:row-start-1"
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

            {season ? (
              <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-amber/30 bg-amber/5 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
                  {standings.data?.season} so far
                </span>
                <span className="font-mono text-sm text-paper">
                  P{season.position} · {season.points} pts · {season.wins} {season.wins === 1 ? "win" : "wins"}
                </span>
              </div>
            ) : null}

            <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
              {selected.era === "2026-grid" ? "Career, to the end of 2025" : "Career"}
            </p>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        </div>

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
