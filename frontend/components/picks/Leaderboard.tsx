"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard } from "@/lib/api";
import type { LeaderboardResponse } from "@/types/picks";

function entries(count: number): string {
  return `${count} entr${count === 1 ? "y" : "ies"}`;
}

export function Leaderboard({ viewerId }: { viewerId: string | null }) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(viewerId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  let body: React.ReactNode;
  if (error) {
    body = <p className="text-sm text-paper-dim">Couldn&apos;t load the leaderboard right now — try refreshing.</p>;
  } else if (!data) {
    body = (
      <div className="space-y-1.5" role="status">
        {[0, 1, 2].map((i) => (
          <span key={i} className="block h-9 animate-pulse rounded-md bg-paper/5" />
        ))}
        <span className="sr-only">Loading leaderboard…</span>
      </div>
    );
  } else if (data.totalEntries === 0) {
    body = (
      <p className="rounded-md border border-dashed border-paper/15 px-4 py-5 text-center text-sm text-paper-dim">
        No picks yet. Lock yours in and you&apos;re top of the board.
      </p>
    );
  } else {
    body = (
      <>
        <p className="text-xs text-paper-dim">
          {data.isScored
            ? `${entries(data.totalEntries)}, scored against the real result.`
            : `${entries(data.totalEntries)} so far. Scores land once the race is classified.`}
        </p>
        <ol className="mt-3 grid gap-1.5">
          {data.entries.map((row) => (
            <li
              key={`${row.rank}-${row.displayName}`}
              className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                row.isYou ? "border-amber bg-amber/10" : "border-paper/10 bg-asphalt"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3 text-paper">
                <span className="w-6 shrink-0 font-mono text-xs text-paper-dim">{row.rank}</span>
                <span className="truncate">
                  {row.displayName}
                  {row.isYou ? <span className="font-mono text-[10px] uppercase text-amber"> · you</span> : null}
                </span>
              </span>
              <span className="shrink-0 font-mono text-amber">{row.score ?? "—"}</span>
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <section className="rounded-lg border border-paper/10 bg-asphalt px-4 py-4" aria-labelledby="leaderboard-heading">
      <h2 id="leaderboard-heading" className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        Leaderboard
      </h2>
      <div className="mt-3">{body}</div>
    </section>
  );
}
