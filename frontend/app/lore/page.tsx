import type { Metadata } from "next";
import { AboutNote } from "@/components/shared/AboutNote";
import { LoreTimeline } from "@/components/lore/LoreTimeline";
import { SiteHeader } from "@/components/site-chrome";

export const metadata: Metadata = {
  title: "Lore — Jalur APEXGP",
  description:
    "Sepang's Formula 1 history, from the 1999 opening through the 2009 monsoon red flag to the 2026 return.",
};

export default function LorePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Circuit lore
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Sepang, in four moments
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Every strategy call this app makes is shaped by what has already
          happened here. Four of those moments, and what each one changed.
        </p>

        <div className="mt-8">
          <LoreTimeline />
        </div>

        <AboutNote />
      </main>
    </>
  );
}
