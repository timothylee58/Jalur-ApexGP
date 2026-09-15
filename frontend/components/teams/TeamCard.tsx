import Link from "next/link";
import type { Team } from "@/data/teams";
import { drivers } from "@/data/drivers";
import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { carForTeam, logoForTeam } from "@/lib/teamAssets";

// Carries the constructor's own identity — accent wash, badge and car
// render — rather than the neutral sheet this used to be. See
// docs/BRAND.md Imagery: a neutral /teams was an earlier convention, and
// leaning into team identity is now the preference on both /teams and
// /fan. Assets are the local, already-in-repo ones under public/, not
// fetched or re-sourced here.
export function TeamCard({ team }: { team: Team }) {
  const roster = team.driverIds.map(
    (id) => drivers.find((driver) => driver.id === id) ?? null,
  );
  const logo = logoForTeam(team.id);
  const car = carForTeam(team.id);

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-paper/10 bg-asphalt px-4 py-4"
      style={{ borderTop: `2px solid ${team.primary}` }}
    >
      {/* Livery wash — the team's own two accents, kept faint enough that
          mono data text over it still hits contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-[0.16]"
        style={{
          background: `linear-gradient(135deg, ${team.primary} 0%, ${team.secondary} 55%, transparent 100%)`,
        }}
      />
      {car ? (
        // eslint-disable-next-line @next/next/no-img-element -- local static car render
        <img
          src={car}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute -right-5 top-7 h-16 w-auto object-contain opacity-25"
        />
      ) : null}

      <div className="relative flex items-center gap-3">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local static team badge
          <img
            src={logo}
            alt=""
            className="h-8 w-8 shrink-0 object-contain"
            draggable={false}
          />
        ) : null}
        <h2 className="font-display text-xl uppercase tracking-wide text-paper">{team.name}</h2>
      </div>
      {/* Meta sits under the name rather than opposite it: the car render
          occupies the top-right of the card, and a right-aligned title
          count was landing on top of the bodywork. */}
      <p className="relative mt-1 max-w-[60%] text-xs text-paper-dim">
        {team.base} · {team.powerUnit} power unit · Est. {team.founded}
      </p>
      <p className="relative mt-0.5 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
        {team.constructorTitles > 0
          ? `${team.constructorTitles} constructors' title${team.constructorTitles === 1 ? "" : "s"}`
          : "No constructors' title yet"}
      </p>

      <div className="relative mt-3 grid grid-cols-2 gap-2">
        {roster.map((driver, index) =>
          driver ? (
            <Link
              key={driver.id}
              href={`/drivers?driver=${driver.id}`}
              className="flex items-center gap-2 rounded-md border border-paper/10 px-2.5 py-2 text-left transition-colors hover:border-paper/25"
            >
              <DriverAvatar
                driverId={driver.id}
                initials={driver.initials}
                number={driver.number}
                accent={team.primary}
                accentSecondary={team.secondary}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-paper">
                  {driver.name}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-wide text-paper-dim">
                  {driver.number !== null ? `#${driver.number}` : "—"}
                </span>
              </span>
            </Link>
          ) : (
            <div key={index} className="rounded-md border border-paper/10 px-2.5 py-2 text-paper-dim">
              <span className="text-xs">Unlisted</span>
            </div>
          ),
        )}
      </div>

      <p className="relative mt-3 border-t border-paper/10 pt-3 text-xs leading-relaxed text-paper-dim">
        <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: team.primary }}>
          Last time out ·{" "}
        </span>
        {team.recap}
      </p>
    </div>
  );
}
