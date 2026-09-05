"use client";

import { useEffect, useState } from "react";
import { getLiveOrNextSession, getLiveSessionWindow } from "@/lib/sepangSchedule";
import type { Session } from "@/types";

// Generic, schedule-derived markers — not real telemetry (this app has no
// live-timing feed to draw one from; see README's "Note on AI" for the
// same honesty stance applied to the strategy engine). Race gets its own
// wording ("lights out", "chequered flag") since that's race-specific
// terminology a practice/quali session wouldn't use.
const RACE_MARKERS: Array<{ at: number; label: string }> = [
  { at: 0, label: "Lights out — race underway" },
  { at: 0.25, label: "Opening stint underway" },
  { at: 0.5, label: "Midway through the race distance" },
  { at: 0.75, label: "Closing laps approaching" },
  { at: 0.92, label: "Chequered flag imminent" },
];
const SESSION_MARKERS: Array<{ at: number; label: string }> = [
  { at: 0, label: "Session green-flagged" },
  { at: 0.33, label: "Track evolving, times still dropping" },
  { at: 0.7, label: "Into the closing runs" },
  { at: 0.92, label: "Chequered flag imminent" },
];

function markerFor(session: Session, progress: number): string {
  const list = session === "Race" ? RACE_MARKERS : SESSION_MARKERS;
  let label = list[0].label;
  for (const entry of list) {
    if (progress >= entry.at) label = entry.label;
  }
  return label;
}

interface TickerState {
  live: false;
  nextSession: Session;
}
type LiveTickerState = TickerState | { live: true; session: Session; label: string };

function computeState(): LiveTickerState {
  const now = new Date();
  const window = getLiveSessionWindow(now);
  if (!window) return { live: false, nextSession: getLiveOrNextSession(now) };
  const progress = Math.min(
    1,
    Math.max(0, (now.getTime() - window.startMs) / (window.endMs - window.startMs)),
  );
  return { live: true, session: window.session, label: markerFor(window.session, progress) };
}

/**
 * Session-clock ticker for the fixed April 2026 Sepang weekend
 * (`lib/sepangSchedule.ts`). Only ever shows the "live" branch while `now`
 * genuinely falls inside one of that weekend's hardcoded windows — for the
 * overwhelming majority of real visits (any date outside those three days,
 * this app's own "today" included) it shows the honest fallback instead of
 * pretending a fixed demo date is still happening.
 */
export function LiveSessionTicker() {
  const [state, setState] = useState<LiveTickerState | null>(null);

  useEffect(() => {
    setState(computeState());
    const interval = setInterval(() => setState(computeState()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Render nothing until mounted rather than guessing — `now` genuinely
  // differs between server render and client hydration here.
  if (!state) return null;

  if (state.live) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-pit-lime/30 bg-pit-lime/10 px-3 py-1.5">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pit-lime opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-pit-lime" />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-pit-lime">
          Live · {state.session}
        </p>
        <p className="text-xs text-paper-dim">{state.label}</p>
      </div>
    );
  }

  return (
    <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
      Sepang weekend (fixed Apr 11–13, 2026) isn&apos;t live right now — next up: {state.nextSession}
    </p>
  );
}
