import { AboutNote } from "@/components/shared/AboutNote";
import { SiteHeader } from "@/components/site-chrome";
import { GuideCards } from "@/components/guide/GuideCards";
import { RookieQuiz } from "@/components/guide/RookieQuiz";

export const metadata = {
  title: "New to F1? — Jalur APEXGP",
  description:
    "A plain-English guide to F1's current rules — Overtake Mode, tyre compounds, flags, pit strategy — plus a quiz to test what stuck.",
};

export default function GuidePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          New to F1?
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          The rules, plainly
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Six current-season rules explained in plain English, then a quiz to test what stuck.
          Every fact here is checked against real sources — including F1&apos;s 2026 rule
          changes, not last decade&apos;s.
        </p>

        <div className="mt-6">
          <GuideCards />
        </div>

        <div className="mt-8">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Rookie quiz
          </span>
          <div className="mt-2">
            <RookieQuiz />
          </div>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-paper-dim/70">
          Jalur APEXGP is an independent fan project — not affiliated with, endorsed by, or an
          official partner of Formula 1, the FIA, or Sepang International Circuit.
        </p>

        <AboutNote />
      </main>
    </>
  );
}
