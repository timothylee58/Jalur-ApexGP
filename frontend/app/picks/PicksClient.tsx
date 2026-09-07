"use client";

import { useEffect, useState } from "react";
import { Leaderboard } from "@/components/picks/Leaderboard";
import { PickForm } from "@/components/picks/PickForm";
import { fetchMyPick } from "@/lib/api";
import { getEntryId } from "@/lib/picksStorage";
import type { PickSubmitted } from "@/types/picks";

type Confirmed = { id: string; displayName: string };

export function PicksClient() {
  // null = still checking localStorage/the backend for an existing entry;
  // undefined = checked, nothing found — show the form.
  const [confirmed, setConfirmed] = useState<Confirmed | null | undefined>(null);

  useEffect(() => {
    const existingId = getEntryId();
    if (!existingId) {
      setConfirmed(undefined);
      return;
    }
    fetchMyPick(existingId)
      .then((mine) => setConfirmed(mine ? { id: mine.id, displayName: mine.displayName } : undefined))
      .catch(() => setConfirmed(undefined));
  }, []);

  const handleSubmitted = (submitted: PickSubmitted) => {
    setConfirmed({ id: submitted.id, displayName: submitted.displayName });
  };

  return (
    <div className="mt-6 grid gap-8">
      {confirmed === null ? (
        <p className="text-sm text-paper-dim">Checking for a saved entry…</p>
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
