"use client";

import { useEffect, useState } from "react";
import { fetchStandings } from "@/lib/api";
import type { StandingsPayload } from "@/types/jolpica";

// One request per page load, shared by every component that asks: the
// standings strip, the driver card and the picks form all read the same
// table, and it only changes when a race is classified.
let pending: Promise<StandingsPayload> | null = null;

function loadStandings(): Promise<StandingsPayload> {
  pending ??= fetchStandings().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

export function useStandings(): { data: StandingsPayload | null; error: boolean } {
  const [state, setState] = useState<{ data: StandingsPayload | null; error: boolean }>({
    data: null,
    error: false,
  });

  useEffect(() => {
    let cancelled = false;
    loadStandings()
      .then((data) => {
        if (!cancelled) setState({ data, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
