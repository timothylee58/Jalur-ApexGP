import Link from "next/link";
import { FanDeck } from "@/components/fan/FanDeck";
import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";

export const metadata = {
  title: "Fan cards — Jalur APEXGP",
  description:
    "Pick your 2026 constructor. Unofficial fan cards with driver photos, team logos, and race cars — not licensed merch.",
};

export default function FanPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Fan deck
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper sm:text-4xl">
          Constructor cards
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-paper-dim">
          Eleven fan cards for the 2026 grid — driver headshots, team marks,
          race cars, and accent colors. Pick-your-team stays in this browser.
          Unofficial fan project, not team or Formula 1 merch. Neutral
          engineer sheets stay on{" "}
          <Link href="/teams" className="text-amber hover:underline">
            /teams
          </Link>
          .
        </p>

        <div className="mt-6">
          <FanDeck />
        </div>

        <AboutNote />
      </main>
    </>
  );
}
