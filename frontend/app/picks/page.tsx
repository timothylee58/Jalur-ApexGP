import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { PicksClient } from "@/app/picks/PicksClient";

export const metadata = {
  title: "Race-day Picks — Jalur APEXGP",
  description:
    "8 predictions for round 16, locked in before qualifying, scored against the real result once it's classified.",
};

export default function PicksPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Race-day picks
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Call it before lights out
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          8 questions, no login. Picks lock when qualifying starts — no locking in a
          pole guess once you&apos;ve seen the grid. This round is a real one on the calendar
          (round 16), relocated to Sepang in this app&apos;s fiction — so once it&apos;s actually
          run, real results decide the scores. Not an official F1, FIA, or Sepang product.
        </p>

        <PicksClient />

        <AboutNote />
      </main>
    </>
  );
}
