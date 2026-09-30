"use client";

import { countdown, formatLocal, formatMyt, type PicksPhase, type PicksWindow } from "@/lib/picksWindow";

interface LockCountdownProps {
  picksWindow: PicksWindow;
  now: Date | null;
  phase: PicksPhase | null;
}

const PHASE_COPY: Record<Exclude<PicksPhase, "open">, { title: string; body: string }> = {
  locked: {
    title: "Picks are locked",
    body: "Qualifying has started, so the grid is no secret any more. See you at lights out.",
  },
  racing: {
    title: "Race in progress",
    body: "Picks are locked. Scores land once the result is officially classified.",
  },
  "awaiting-result": {
    title: "Chequered flag",
    body: "Scores land once the official classification is published — usually within a few hours.",
  },
};

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="font-display text-4xl leading-none tabular-nums text-paper sm:text-5xl">
        {String(value).padStart(2, "0")}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">{label}</span>
    </span>
  );
}

/**
 * The one number that decides whether this page is still worth filling
 * in. Times are given on Sepang's clock (and the viewer's, when that
 * differs) because "Saturday afternoon" means different things in
 * Kuala Lumpur and London.
 */
export function LockCountdown({ picksWindow, now, phase }: LockCountdownProps) {
  const lockText = formatMyt(picksWindow.lockAt);
  const localText = now ? formatLocal(picksWindow.lockAt) : null;

  if (phase && phase !== "open") {
    const copy = PHASE_COPY[phase];
    return (
      <section className="rounded-lg border border-paper/15 bg-asphalt px-4 py-4 sm:px-5" aria-live="polite">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-brick">{copy.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
          {copy.body} Locked {lockText}.
        </p>
      </section>
    );
  }

  const left = now ? countdown(now, picksWindow.lockAt) : null;
  const urgent = left !== null && left.days === 0 && left.hours < 3;

  return (
    <section
      className={`rounded-lg border px-4 py-4 sm:px-5 ${urgent ? "border-brick/50 bg-brick/5" : "border-amber/35 bg-amber/5"}`}
      aria-labelledby="picks-lock-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
            Round {picksWindow.round} · {picksWindow.raceName}
          </p>
          <p
            id="picks-lock-heading"
            className={`mt-3 font-mono text-[10px] uppercase tracking-[0.25em] ${urgent ? "text-brick" : "text-amber"}`}
          >
            Picks lock in
          </p>
          {/* The ticking digits are hidden from screen readers (a live
              region re-announcing every second is noise); the lock time
              below says the same thing once. */}
          <div className="mt-2 flex gap-4" aria-hidden="true">
            {left ? (
              <>
                {left.days > 0 ? <Unit value={left.days} label="d" /> : null}
                <Unit value={left.hours} label="h" />
                <Unit value={left.minutes} label="m" />
                <Unit value={left.seconds} label="s" />
              </>
            ) : (
              <span className="font-display text-4xl leading-none text-paper-dim sm:text-5xl">— — —</span>
            )}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-paper-dim sm:text-right">
          <span className="block font-mono text-paper">{lockText}</span>
          {localText ? <span className="block">{localText} your time</span> : null}
          <span className="block">Start of qualifying</span>
        </p>
      </div>
    </section>
  );
}
