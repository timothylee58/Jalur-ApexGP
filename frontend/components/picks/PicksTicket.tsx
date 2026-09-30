import { DriverAvatar } from "@/components/drivers/DriverAvatar";
import { DNF_BAND_OPTIONS, PICK_QUESTIONS } from "@/data/pickQuestions";
import { driverById, teamById, teamOfDriver } from "@/lib/pickRoster";
import { logoForTeam } from "@/lib/teamAssets";
import type { PickAnswers } from "@/types/picks";

interface PicksTicketProps {
  displayName: string;
  picks: PickAnswers | null;
  /** Null until the race is scored. */
  score?: number | null;
}

function Answer({ questionKey, picks }: { questionKey: keyof PickAnswers; picks: PickAnswers }) {
  const value = picks[questionKey];
  if (questionKey === "dnfBand") {
    const band = DNF_BAND_OPTIONS.find((option) => option.id === value);
    return <span className="text-sm text-paper">{band ? `${band.label} · ${band.detail}` : value}</span>;
  }
  if (questionKey === "topConstructor") {
    const team = teamById(value);
    const logo = team ? logoForTeam(team.id) : null;
    return (
      <span className="flex min-w-0 items-center gap-2">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- local static team badge
          <img src={logo} alt="" className="h-5 w-5 shrink-0 object-contain" draggable={false} />
        ) : null}
        <span className="truncate text-sm text-paper">{team?.name ?? value}</span>
      </span>
    );
  }
  const driver = driverById(value);
  const team = teamOfDriver(value);
  if (!driver || !team) return <span className="text-sm text-paper">{value}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <DriverAvatar
        driverId={driver.id}
        initials={driver.initials}
        number={driver.number}
        accent={team.primary}
        accentSecondary={team.secondary}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm text-paper">{driver.name}</span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-wide text-paper-dim">{team.name}</span>
      </span>
    </span>
  );
}

/** The fan's submitted picks, laid out like the slip they'd keep in a
 * pocket until Sunday. */
export function PicksTicket({ displayName, picks, score = null }: PicksTicketProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-amber/40 bg-asphalt" aria-labelledby="ticket-heading">
      <div className="flex items-end justify-between gap-3 border-b border-dashed border-amber/30 bg-amber/10 px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">Picks locked in</p>
          <h2 id="ticket-heading" className="mt-1 truncate font-display text-2xl uppercase tracking-wide text-paper">
            {displayName}
          </h2>
        </div>
        <p className="shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
          {score === null ? (
            "Scored after the race"
          ) : (
            <>
              <span className="block font-display text-3xl leading-none text-amber">{score}</span>
              of {PICK_QUESTIONS.length * 10}
            </>
          )}
        </p>
      </div>
      {picks ? (
        <dl className="grid gap-px bg-paper/10 sm:grid-cols-2">
          {PICK_QUESTIONS.map((question) => (
            <div key={question.key} className="flex items-center justify-between gap-3 bg-asphalt px-4 py-2.5 sm:px-5">
              <dt className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
                {question.short}
              </dt>
              <dd className="min-w-0">
                <Answer questionKey={question.key} picks={picks} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-4 py-4 text-sm text-paper-dim sm:px-6">Your row is highlighted on the leaderboard.</p>
      )}
    </section>
  );
}
