"use client";

import { rosterByStanding } from "@/lib/pickRoster";
import { teamStanding } from "@/lib/standings";
import { logoForTeam } from "@/lib/teamAssets";
import type { StandingsPayload } from "@/types/jolpica";

interface TeamPickerProps {
  label: string;
  value: string | undefined;
  onChange: (teamId: string) => void;
  standings: StandingsPayload | null;
  disabled?: boolean;
}

/** Eleven constructors fit on screen at once, so this one stays open:
 * badge, livery edge and live championship points on each. */
export function TeamPicker({ label, value, onChange, standings, disabled = false }: TeamPickerProps) {
  return (
    <div role="group" aria-label={label} className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {rosterByStanding(standings).map(({ team }) => {
        const pressed = value === team.id;
        const row = teamStanding(standings, team.id);
        const logo = logoForTeam(team.id);
        return (
          <button
            key={team.id}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(team.id)}
            className={`flex min-w-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-60 ${
              pressed ? "bg-paper/10" : "border-paper/10 bg-asphalt hover:border-paper/30"
            }`}
            style={{
              boxShadow: `inset 3px 0 0 ${team.primary}`,
              ...(pressed ? { borderColor: team.primary } : {}),
            }}
          >
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local static team badge
              <img src={logo} alt="" className="h-5 w-5 shrink-0 object-contain" draggable={false} />
            ) : null}
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-paper">{team.name}</span>
              <span className="block font-mono text-[10px] text-paper-dim">
                {row ? `P${row.position} · ${row.points} pts` : "—"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
