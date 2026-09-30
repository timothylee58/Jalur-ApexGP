"use client";

import { useCallback, useEffect, useState } from "react";
import { Leaderboard } from "@/components/picks/Leaderboard";
import { LockCountdown } from "@/components/picks/LockCountdown";
import { PickForm } from "@/components/picks/PickForm";
import { FormGuide, ScoringNote } from "@/components/picks/PicksSidebar";
import { PicksTicket } from "@/components/picks/PicksTicket";
import { usePicksWindow, useNow } from "@/hooks/usePicksWindow";
import { useStandings } from "@/hooks/useStandings";
import { fetchMyPick } from "@/lib/api";
import { picksPhase } from "@/lib/picksWindow";
import { getEntryId, saveEntryId } from "@/lib/picksStorage";
import type { PickAnswers, PickSubmitted } from "@/types/picks";

type Confirmed = { id: string; displayName: string; picks: PickAnswers | null; score: number | null };
// "checking" = still looking; "none" = confirmed no saved entry, show the
// form; "error" = the lookup itself failed (network/502/503) — distinct
// from "none" on purpose: showing the pristine form here risked a second,
// duplicate submission from someone who'd already locked in picks.
type CheckState = Confirmed | "checking" | "none" | "error";

export function PicksClient() {
  const picksWindow = usePicksWindow();
  const now = useNow();
  const phase = now ? picksPhase(picksWindow, now) : null;
  const locked = phase !== null && phase !== "open";
  const { data: standings } = useStandings();
  const [state, setState] = useState<CheckState>("checking");

  // Stable across renders (only reaches module-level getEntryId/fetchMyPick
  // and the setState setter, both stable) — listed as the effect's real
  // dependency below instead of the empty array pretending there is none.
  const checkExisting = useCallback(() => {
    const existingId = getEntryId();
    if (!existingId) {
      setState("none");
      return;
    }
    setState("checking");
    fetchMyPick(existingId)
      .then((mine) =>
        setState(
          mine ? { id: mine.id, displayName: mine.displayName, picks: mine.picks, score: mine.score } : "none",
        ),
      )
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    checkExisting();
  }, [checkExisting]);

  const handleSubmitted = (submitted: PickSubmitted, picks: PickAnswers) => {
    saveEntryId(submitted.id);
    setState({ id: submitted.id, displayName: submitted.displayName, picks, score: null });
  };

  const confirmed = typeof state === "object" ? state : null;

  let main: React.ReactNode;
  if (state === "checking") {
    main = (
      <div className="space-y-3" role="status">
        <span className="block h-12 animate-pulse rounded-lg bg-paper/5" />
        <span className="block h-64 animate-pulse rounded-lg bg-paper/5" />
        <span className="sr-only">Checking for a saved entry…</span>
      </div>
    );
  } else if (state === "error") {
    main = (
      <div className="rounded-lg border border-brick/40 bg-brick/10 p-5">
        <p className="text-sm text-paper">Couldn&apos;t confirm whether you&apos;ve already submitted picks on this browser.</p>
        <p className="mt-1 text-xs text-paper-dim">
          Retry before submitting again — resubmitting while this is unconfirmed could create a second entry.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={checkExisting}
            className="rounded-full border border-amber/40 px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-amber hover:border-amber"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => setState("none")}
            className="rounded-full border border-paper/20 px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-paper-dim hover:border-paper/40 hover:text-paper"
          >
            Never picked before — enter picks
          </button>
        </div>
      </div>
    );
  } else if (confirmed) {
    main = <PicksTicket displayName={confirmed.displayName} picks={confirmed.picks} score={confirmed.score} />;
  } else {
    main = <PickForm onSubmitted={handleSubmitted} standings={standings} locked={locked} />;
  }

  return (
    <div className="mt-6">
      <LockCountdown picksWindow={picksWindow} now={now} phase={phase} />

      {/* Desktop: the form on the left, what you're playing for on the
          right. Below lg: one column, form first. */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <div>{main}</div>
        <aside className="mt-8 grid gap-4 lg:sticky lg:top-6 lg:mt-0">
          <Leaderboard viewerId={confirmed ? confirmed.id : null} />
          <ScoringNote />
          <FormGuide />
        </aside>
      </div>
    </div>
  );
}
