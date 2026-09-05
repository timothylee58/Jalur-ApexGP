import Link from "next/link";
import type { Team } from "@/data/teams";
import { drivers } from "@/data/drivers";

// Same neutral card for all 11 teams, deliberately — see the comment atop
// data/teams.ts on why there's no per-team color coding here.
export function TeamCard({ team }: { team: Team }) {
  const roster = team.driverIds.map(
    (id) => drivers.find((driver) => driver.id === id) ?? null,
  );

  return (
    <div className="rounded-lg border border-paper/10 bg-asphalt px-4 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl uppercase tracking-wide text-paper">{team.name}</h2>
        <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
          {team.constructorTitles > 0
            ? `${team.constructorTitles} constructors' title${team.constructorTitles === 1 ? "" : "s"}`
            : "No constructors' title yet"}
        </p>
      </div>
      <p className="mt-1 text-xs text-paper-dim">
        {team.base} · {team.powerUnit} power unit · Est. {team.founded}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {roster.map((driver, index) =>
          driver ? (
            <Link
              key={driver.id}
              href={`/drivers?driver=${driver.id}`}
              className="rounded-md border border-paper/10 px-2.5 py-2 text-left transition-colors hover:border-paper/25"
            >
              <span className="block truncate text-xs font-medium text-paper">{driver.name}</span>
              <span className="block font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                {driver.number !== null ? `#${driver.number}` : "—"}
              </span>
            </Link>
          ) : (
            <div key={index} className="rounded-md border border-paper/10 px-2.5 py-2 text-paper-dim">
              <span className="text-xs">Unlisted</span>
            </div>
          ),
        )}
      </div>

      <p className="mt-3 border-t border-paper/10 pt-3 text-xs leading-relaxed text-paper-dim">
        <span className="font-mono text-[10px] uppercase tracking-wide text-amber">
          Last time out ·{" "}
        </span>
        {team.recap}
      </p>
    </div>
  );
}
