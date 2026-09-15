"use client";

import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { drivers as allDrivers, type Driver } from "@/data/drivers";
import { teams } from "@/data/teams";
import { logoForTeam } from "@/lib/teamAssets";

/**
 * The 2026 field as eleven constructor cards rather than twenty-two
 * identical rows.
 *
 * A flat list of 22 makes the reader do the pairing work themselves —
 * teammates are the comparison that actually matters on this page, and
 * in a three-column grid they can land in different rows entirely. Each
 * team's livery, badge and pairing in one card is the same structure
 * /teams uses, so the two pages read as one system.
 */

interface ConstructorGridProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

function DriverRow({
  driver,
  selected,
  accent,
  onSelect,
}: {
  driver: Driver;
  selected: boolean;
  accent: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(driver.id)}
      aria-pressed={selected}
      className={`flex flex-1 items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
        selected ? "bg-paper/10" : "border-transparent hover:bg-paper/5"
      }`}
      style={selected ? { borderColor: accent } : undefined}
    >
      <DriverAvatar
        driverId={driver.id}
        initials={driver.initials}
        number={driver.number}
        accent={accent}
        active={selected}
      />
      <span className="min-w-0">
        <span
          className="block truncate text-xs font-medium"
          style={{ color: selected ? accent : "#f4efe6" }}
        >
          {driver.name}
        </span>
        <span className="block font-mono text-[10px] tracking-wide text-paper-dim">
          {driver.number !== null ? `#${driver.number}` : "—"}
        </span>
      </span>
    </button>
  );
}

export function ConstructorGrid({ selectedId, onSelect }: ConstructorGridProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {teams.map((team) => {
        const roster = team.driverIds
          .map((id) => allDrivers.find((d) => d.id === id))
          .filter((d): d is Driver => Boolean(d));
        const logo = logoForTeam(team.id);
        const hasSelected = roster.some((d) => d.id === selectedId);

        return (
          <div
            key={team.id}
            className="relative overflow-hidden rounded-lg border bg-asphalt px-3 py-2.5 transition-colors"
            style={{
              borderColor: hasSelected ? team.primary : "rgba(244,239,230,0.1)",
            }}
          >
            {/* Livery stripe down the leading edge — enough to identify the
                constructor at a glance without washing out the names. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1"
              style={{ background: team.primary }}
            />
            <div className="flex items-center gap-2 pl-1.5">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- local static team badge
                <img
                  src={logo}
                  alt=""
                  draggable={false}
                  className="h-5 w-5 shrink-0 object-contain"
                />
              ) : null}
              <h3 className="font-display text-sm uppercase tracking-wide text-paper">
                {team.name}
              </h3>
              <span className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-wide text-paper-dim">
                {team.powerUnit}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1 pl-1.5">
              {roster.map((driver) => (
                <DriverRow
                  key={driver.id}
                  driver={driver}
                  selected={driver.id === selectedId}
                  accent={team.primary}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
