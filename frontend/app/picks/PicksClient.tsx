"use client";

import { useCallback, useEffect, useState } from "react";
import { Leaderboard } from "@/components/picks/Leaderboard";
import { PickForm } from "@/components/picks/PickForm";
import { fetchMyPick } from "@/lib/api";
import { getEntryId } from "@/lib/picksStorage";
import type { PickSubmitted } from "@/types/picks";

type Confirmed = { id: string; displayName: string };
// "checking" = still looking; "none" = confirmed no saved entry, show the
// form; "error" = the lookup itself failed (network/502/503) — distinct
// from "none" on purpose: showing the pristine form here risked a second,
// duplicate submission from someone who'd already locked in picks.
type CheckState = Confirmed | "checking" | "none" | "error";

export function PicksClient() {
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
      .then((mine) => setState(mine ? { id: mine.id, displayName: mine.displayName } : "none"))
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    checkExisting();
  }, [checkExisting]);

  const handleSubmitted = (submitted: PickSubmitted) => {
    setState({ id: submitted.id, displayName: submitted.displayName });
  };

  const confirmed = typeof state === "object" ? state : null;

  return (
    <div className="mt-6 grid gap-8">
      {state === "checking" ? (
        <p className="text-sm text-paper-dim">Checking for a saved entry…</p>
      ) : state === "error" ? (
        <div className="rounded-lg border border-brick/40 bg-brick/10 p-5">
          <p className="text-sm text-paper">
            Couldn&apos;t confirm whether you&apos;ve already submitted picks on this browser.
          </p>
          <p className="mt-1 text-xs text-paper-dim">
            Retry before submitting again — resubmitting while this is unconfirmed could create a
            second entry.
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
      ) : confirmed ? (
        <div className="rounded-lg border border-amber/40 bg-amber/10 p-5">
          <p className="font-display text-xl uppercase tracking-wide text-amber">
            Picks locked in, {confirmed.displayName}
          </p>
          <p className="mt-1 text-sm text-paper-dim">
            You&apos;re on the board below. Scores land once round 16 is classified.
          </p>
        </div>
      ) : (
        <PickForm onSubmitted={handleSubmitted} />
      )}

      <div>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Leaderboard
        </span>
        <div className="mt-2">
          <Leaderboard viewerId={confirmed ? confirmed.id : null} />
        </div>
      </div>
    </div>
  );
}
