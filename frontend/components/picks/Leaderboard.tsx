"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard } from "@/lib/api";
import type { LeaderboardResponse } from "@/types/picks";

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

  if (error) {
    return (
      <p className="text-sm text-paper-dim">
        Couldn&apos;t load the leaderboard right now — try refreshing.
      </p>
    );
  }

  if (!data) {
    return <p className="text-sm text-paper-dim">Loading leaderboard…</p>;
  }

  if (data.totalEntries === 0) {
    return (
      <p className="text-sm text-paper-dim">
        No picks submitted yet — be the first to lock yours in.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-paper-dim">
        {data.isScored
          ? `${data.totalEntries} entr${data.totalEntries === 1 ? "y" : "ies"}, scored against the real round-16 result.`
          : `${data.totalEntries} entr${data.totalEntries === 1 ? "y" : "ies"} so far — scores land once the race is classified.`}
      </p>
      <ol className="mt-3 grid gap-2">
        {data.entries.map((row) => (
          <li
            key={`${row.rank}-${row.displayName}`}
            className={`flex items-center justify-between rounded-md border px-4 py-2 text-sm ${
              row.isYou ? "border-amber bg-amber/10" : "border-paper/10 bg-asphalt"
            }`}
          >
            <span className="text-paper">
              <span className="font-mono text-paper-dim">#{row.rank}</span>{" "}
              {row.displayName}
              {row.isYou ? " (you)" : ""}
            </span>
            <span className="font-mono text-amber">{data.isScored ? row.score : "—"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
