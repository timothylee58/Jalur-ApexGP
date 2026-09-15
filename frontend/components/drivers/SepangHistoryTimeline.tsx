"use client";

import Link from "next/link";
import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { drivers as allDrivers, type Driver } from "@/data/drivers";
import { loreEntries } from "@/data/lore";
import { accentForDriver } from "@/lib/driverAccent";

/**
 * Sepang-history drivers grouped under the moment that put them here,
 * rather than laid out as if they were a grid.
 *
 * These three are not a field — they're two race results a decade apart,
 * and `Driver.loreId` already records which. Reusing the 2026 grid's
 * picker flattened that: three unrelated cards in a row, no year, no
 * sense that Irvine and Schumacher finished first and second in the same
 * afternoon. Grouping by `loreId` uses the relationship the data already
 * carries.
 */

interface SepangHistoryTimelineProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SepangHistoryTimeline({
  selectedId,
  onSelect,
}: SepangHistoryTimelineProps) {
  const historyDrivers = allDrivers.filter((d) => d.era === "sepang-history");

  // Keep lore's own chronological order rather than the driver array's.
  const moments = loreEntries
    .map((entry) => ({
      entry,
      cast: historyDrivers.filter((d) => d.loreId === entry.id),
    }))
    .filter((moment) => moment.cast.length > 0);

  return (
    <ol className="relative space-y-5 border-l border-paper/15 pl-5">
      {moments.map(({ entry, cast }) => {
        const active = cast.some((d) => d.id === selectedId);
        return (
          <li key={entry.id} className="relative">
            {/* Timeline node, filled while one of this moment's drivers is
                the selected one. */}
            <span
              aria-hidden
              className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 transition-colors ${
                active ? "border-amber bg-amber" : "border-paper/30 bg-asphalt"
              }`}
            />
            <div className="flex items-baseline gap-2">
              <span
                className={`font-display text-2xl leading-none tracking-wide transition-colors ${
                  active ? "text-amber" : "text-paper"
                }`}
              >
                {entry.year}
              </span>
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
                {entry.title}
              </h3>
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-paper-dim/70">{entry.date}</p>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {cast.map((driver) => (
                <HistoryDriverCard
                  key={driver.id}
                  driver={driver}
                  selected={driver.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-paper-dim">{entry.body}</p>
            <Link
              href={`/lore#${entry.id}`}
              className="mt-1.5 inline-block font-mono text-[10px] uppercase tracking-wide text-amber hover:underline"
            >
              Read this moment in Circuit Lore →
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function HistoryDriverCard({
  driver,
  selected,
  onSelect,
}: {
  driver: Driver;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const accent = accentForDriver(driver);
  return (
    <button
      type="button"
      onClick={() => onSelect(driver.id)}
      aria-pressed={selected}
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
        selected ? "bg-paper/10" : "border-paper/10 hover:border-paper/30"
      }`}
      style={selected ? { borderColor: accent.primary } : undefined}
    >
      <DriverAvatar
        driverId={driver.id}
        initials={driver.initials}
        number={driver.number}
        accent={accent.primary}
        accentSecondary={accent.secondary}
        active={selected}
      />
      <span className="min-w-0">
        <span
          className="block truncate text-xs font-medium"
          style={{ color: selected ? accent.primary : "#f4efe6" }}
        >
          {driver.name}
        </span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-paper-dim">
          {driver.team}
        </span>
      </span>
    </button>
  );
}
