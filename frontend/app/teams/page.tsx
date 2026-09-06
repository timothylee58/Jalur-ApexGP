import Link from "next/link";
import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { TeamCard } from "@/components/teams/TeamCard";
import { teams } from "@/data/teams";

export default function TeamsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Constructors
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          All 11 teams
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Base, power unit, and constructors&apos; title count for the 2026
          grid&apos;s eleven teams — neutral engineer sheets here; colored
          fan cards live on{" "}
          <Link href="/fan" className="text-amber hover:underline">
            /fan
          </Link>
          . Seat-level career numbers stay on{" "}
          <Link href="/drivers" className="text-amber hover:underline">
            /drivers
          </Link>
          .
        </p>

        <div className="mt-6 space-y-4">
          {teams.map((team) => (
            <div key={team.id} id={team.id} className="scroll-mt-20">
              <TeamCard team={team} />
            </div>
          ))}
        </div>

        <AboutNote />
      </main>
    </>
  );
}
