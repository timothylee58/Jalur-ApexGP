import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { PicksClient } from "@/app/picks/PicksClient";

export const metadata = {
  title: "Race-day Picks — Jalur APEXGP",
  description:
    "Eight calls on the Bahrain Grand Prix in Malaysia at Sepang, locked in before qualifying and scored against the real result.",
};

export default function PicksPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 lg:max-w-6xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Race-day picks</p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper sm:text-4xl">
          Call it before lights out
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-dim">
          Eight calls on this weekend&apos;s Grand Prix at Sepang: the Bahrain Grand Prix, moved to Malaysia for 2026
          after its April date was cancelled. No login. Picks lock when qualifying starts, so nobody calls pole
          having seen the grid, and the real result decides the scores. An unofficial fan game, not an F1, FIA or
          Sepang product.
        </p>

        <PicksClient />

        <AboutNote />
      </main>
    </>
  );
}
