"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-chrome";
import { useNow } from "@/hooks/usePicksWindow";
import {
  clockLabel,
  durationLabel,
  sessionWindowLabel,
  sourceLabel,
  STATE_LABEL,
  weekendSummary,
} from "@/lib/accuracyBoard";
import { fetchAccuracyWeekend } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SessionBoard, SessionState, WeekendBoard } from "@/types";

const STATE_TONE: Record<SessionState, string> = {
  upcoming: "border-paper/15 text-paper-dim",
  live: "border-teal/50 text-teal",
  awaiting: "border-amber/50 text-amber",
  scored: "border-pit-lime/40 text-pit-lime",
  unscored: "border-paper/10 text-paper-dim/70",
};

function scoreTone(value: number): string {
  return value >= 70 ? "text-pit-lime" : value < 40 ? "text-brick" : "text-amber";
}

function StateChip({ state }: { state: SessionState }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em]",
        STATE_TONE[state],
      )}
    >
      {state === "live" || state === "awaiting" ? (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", state === "live" ? "animate-pulse bg-teal" : "animate-pulse bg-amber")}
          aria-hidden
        />
      ) : null}
      {STATE_LABEL[state]}
    </span>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">{label}</p>
      <div className="mt-1 text-sm text-paper">{children}</div>
    </div>
  );
}

function SessionRow({ row, now }: { row: SessionBoard; now: Date }) {
  const start = new Date(row.start);
  const end = new Date(row.end);
  const { prediction, outcome } = row;
  const isRace = row.session === "Race";
  const winner = (outcome?.detail?.pit as { winner?: string } | undefined)?.winner;

  return (
    <li className="rounded-lg border border-paper/10 bg-asphalt px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-xl uppercase tracking-wide text-paper">{row.session}</h3>
          <span className="font-mono text-[11px] text-paper-dim">{sessionWindowLabel(row)}</span>
        </div>
        <StateChip state={row.state} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Column label={row.state === "upcoming" ? "Latest read · locks at the start" : "Locked read"}>
          {prediction ? (
            <>
              <span className="font-display text-lg uppercase tracking-wide">
                {prediction.rainProbability.toFixed(0)}% rain
              </span>
              <span className="ml-1.5 text-xs text-paper-dim">{prediction.condition}</span>
              <p className="mt-0.5 font-mono text-[11px] text-paper-dim">
                {isRace
                  ? `Pit · Cons L${prediction.pitWindowConservative.startLap}–${prediction.pitWindowConservative.endLap} · Aggr L${prediction.pitWindowAggressive.startLap}–${prediction.pitWindowAggressive.endLap}`
                  : `Confidence · Cons ${prediction.confidenceConservative.toFixed(0)} · Aggr ${prediction.confidenceAggressive.toFixed(0)}`}
              </p>
              <p className="font-mono text-[10px] text-paper-dim/70">
                {sourceLabel(prediction.source)} · {clockLabel(prediction.madeAt)}
              </p>
            </>
          ) : (
            <span className="text-xs leading-relaxed text-paper-dim">
              {row.state === "upcoming"
                ? "Locked automatically in the hours before the start."
                : "No read was captured before this session, so it can't be scored."}
            </span>
          )}
        </Column>

        <Column label="What happened">
          {outcome ? (
            <>
              <span className={cn("font-display text-lg uppercase tracking-wide", outcome.rainOccurred ? "text-teal" : "text-paper")}>
                {outcome.rainOccurred ? "Rain" : "Dry"}
              </span>
              {isRace ? (
                <p className="mt-0.5 font-mono text-[11px] text-paper-dim">
                  {outcome.pitSource
                    ? outcome.actualPitLap !== null
                      ? `Winner${winner ? ` (${winner.replace(/_/g, " ")})` : ""} first stopped on lap ${outcome.actualPitLap}`
                      : "Winner didn't stop"
                    : "Pit stop: waiting for the classified result"}
                </p>
              ) : (
                <p className="mt-0.5 font-mono text-[11px] text-paper-dim">Pit window: race only</p>
              )}
              <p className="font-mono text-[10px] text-paper-dim/70">{sourceLabel(outcome.rainSource)}</p>
            </>
          ) : (
            <span className="text-xs leading-relaxed text-paper-dim">
              {now < start
                ? `Starts in ${durationLabel(start.getTime() - now.getTime())}.`
                : now < end
                  ? `Running — ${durationLabel(end.getTime() - now.getTime())} to go.`
                  : `Ended ${durationLabel(now.getTime() - end.getTime())} ago — the track's weather data usually lands within half an hour.`}
            </span>
          )}
        </Column>

        <Column label="Score">
          {row.scores.length > 0 ? (
            <dl className="space-y-0.5 font-mono text-xs">
              {row.scores.map((score) => (
                <div key={score.variant} className="flex items-baseline justify-between gap-2">
                  <dt className="capitalize text-paper-dim">{score.variant}</dt>
                  <dd className={cn("font-display text-lg leading-none", scoreTone(score.compositeScore))}>
                    {score.compositeScore.toFixed(0)}
                    <span className="text-[11px] text-paper-dim">/100</span>
                  </dd>
                </div>
              ))}
              {isRace && row.scores[0].pitWindowHit !== null ? (
                <p className="pt-0.5 text-[10px] text-paper-dim">
                  Pit window: {row.scores.map((s) => (s.pitWindowHit ? "hit" : "miss")).join(" · ")}
                </p>
              ) : null}
            </dl>
          ) : (
            <span className="text-xs text-paper-dim">
              {row.state === "unscored" ? "—" : "Scores when the outcome lands."}
            </span>
          )}
        </Column>
      </div>
    </li>
  );
}

export default function AccuracyPage() {
  const [board, setBoard] = useState<WeekendBoard | null>(null);
  const [error, setError] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const now = useNow(1000);

  const load = useCallback(async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setRefreshing(true);
    let wait = 60;
    try {
      const next = await fetchAccuracyWeekend();
      setBoard(next);
      setError(false);
      setLoadedAt(Date.now());
      wait = next.nextCheckSeconds;
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
    // Polls on the server's own cadence: fast while a session is live or
    // its outcome is pending, slow otherwise; paused in a background tab.
    timerRef.current = window.setTimeout(() => {
      if (!document.hidden) void load();
    }, wait * 1000);
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [load]);

  const summary = board ? weekendSummary(board) : null;
  const fast = board ? board.nextCheckSeconds <= 60 : false;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Track record</p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Prediction accuracy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Before each session the engine&apos;s read is locked in. When the session ends, what actually happened
          is pulled from real data — the circuit&apos;s own weather station for rain, the timing sheet for the
          race&apos;s pit stop — and the call is scored. Nobody types results in.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-paper/10 px-3 py-2">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim">
            <span className={cn("h-1.5 w-1.5 rounded-full", fast ? "animate-pulse bg-teal" : "bg-paper-dim")} aria-hidden />
            {board ? (fast ? "Live · checking every 30s" : "Checking every 5 min") : "Connecting…"}
            {loadedAt && now ? ` · updated ${durationLabel(now.getTime() - loadedAt)} ago` : ""}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="rounded-full border border-paper/15 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim transition-colors hover:border-amber hover:text-amber disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            {refreshing ? "Checking…" : "Refresh"}
          </button>
        </div>

        {error && !board ? (
          <Card className="mt-4 p-4 text-sm text-paper-dim" role="alert">
            Couldn&apos;t load the accuracy record right now. It retries on its own every minute.
          </Card>
        ) : null}

        {board && summary ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {summary.variants.map((v) => (
                <Card key={v.variant} className="min-w-0 p-3 sm:p-4">
                  <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim sm:text-[10px] sm:tracking-[0.25em]">
                    {v.variant}
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-display text-3xl uppercase tracking-wide sm:text-4xl",
                      v.mean === null ? "text-paper-dim" : scoreTone(v.mean),
                    )}
                  >
                    {v.mean === null ? "—" : v.mean.toFixed(0)}
                    {v.mean === null ? null : <span className="text-base text-paper-dim sm:text-lg">/100</span>}
                  </p>
                  <p className="truncate font-mono text-[10px] text-paper-dim">
                    Rain call {v.rainMean === null ? "—" : `${v.rainMean.toFixed(0)}`}
                  </p>
                </Card>
              ))}
              <Card className="min-w-0 p-3 sm:p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim sm:text-[10px] sm:tracking-[0.25em]">
                  Scored
                </p>
                <p className="mt-1 font-display text-3xl uppercase tracking-wide text-paper sm:text-4xl">
                  {summary.scored}
                  <span className="text-base text-paper-dim sm:text-lg">/{board.sessions.length}</span>
                </p>
                <p className="truncate font-mono text-[10px] text-paper-dim">Round {board.round}</p>
              </Card>
            </div>

            <ol className="mt-4 space-y-2" aria-live="polite">
              {board.sessions.map((row) => (
                <SessionRow key={row.session} row={row} now={now ?? new Date(board.generatedAt)} />
              ))}
            </ol>
          </>
        ) : !error ? (
          <div className="mt-4 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-paper/5" />
            ))}
          </div>
        ) : null}

        <details className="mt-5 rounded-lg border border-paper/10 px-4 py-3 text-xs leading-relaxed text-paper-dim">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
            How the scoring works
          </summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>
              <strong className="text-paper">Locked read.</strong> The last unmodified prediction before the start —
              from live traffic or the scheduler, which reads every session in the three hours before it. Nothing can
              change it once the session begins.
            </li>
            <li>
              <strong className="text-paper">Rain call.</strong> A Brier score on the predicted rain probability,
              rescaled so 100 is a perfect call. Rain is read from the circuit&apos;s weather station via OpenF1; if
              that hasn&apos;t published 75 minutes after the flag, modelled rainfall from Open-Meteo stands in.
            </li>
            <li>
              <strong className="text-paper">Pit window.</strong> Race only — a hit if the winner&apos;s first stop
              (from Jolpica&apos;s timing sheet) falls inside the predicted window. Practice and qualifying pit for
              reasons that aren&apos;t a race strategy, so they&apos;re scored on the rain call alone.
            </li>
          </ul>
        </details>

        <AboutNote />
      </main>
    </>
  );
}
