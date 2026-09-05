"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AboutNote } from "@/components/shared/AboutNote";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-chrome";
import { fetchAccuracy, submitOutcome } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SESSIONS, type AccuracyResponse, type AccuracySummary, type Session } from "@/types";

function ScoreCard({ summary, label }: { summary: AccuracySummary; label: string }) {
  return (
    <Card className="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">{label}</p>
      <p className="mt-2 font-display text-4xl uppercase tracking-wide text-paper">
        {summary.meanCompositeScore.toFixed(0)}
        <span className="text-lg text-paper-dim">/100</span>
      </p>
      <dl className="mt-3 space-y-1 font-mono text-xs text-paper-dim">
        <div className="flex justify-between">
          <dt>Rain call</dt>
          <dd className="text-paper">{summary.meanRainCallScore.toFixed(0)}/100</dd>
        </div>
        <div className="flex justify-between">
          <dt>Pit window hit rate</dt>
          <dd className="text-paper">
            {summary.pitWindowHitRate === null ? "—" : `${summary.pitWindowHitRate.toFixed(0)}%`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Sessions scored</dt>
          <dd className="text-paper">{summary.sampleSize}</dd>
        </div>
      </dl>
    </Card>
  );
}

export default function AccuracyPage() {
  const [session, setSession] = useState<Session>("Race");
  const [accuracy, setAccuracy] = useState<AccuracyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [rainOccurred, setRainOccurred] = useState(false);
  const [actualPitLap, setActualPitLap] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const loadAccuracy = useCallback((forSession: Session) => {
    setLoading(true);
    setError(false);
    fetchAccuracy(forSession)
      .then((result) => setAccuracy(result))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAccuracy(session);
  }, [session, loadAccuracy]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      await submitOutcome({
        session,
        rainOccurred,
        actualPitLap: actualPitLap.trim() ? Number(actualPitLap) : null,
      });
      setSubmitMessage("Outcome logged — scoring now includes today's session.");
      setActualPitLap("");
      loadAccuracy(session);
    } catch {
      setSubmitMessage("Couldn't log that outcome. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Track record
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Prediction accuracy
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Every prediction the engine makes gets logged. Report what actually
          happened after a session and this scoreboard tracks how the rain
          call and pit-window call held up — a real accuracy loop, not a
          self-reported confidence number.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {SESSIONS.map((item) => (
            <Button
              key={item}
              type="button"
              variant={session === item ? "default" : "outline"}
              size="sm"
              onClick={() => setSession(item)}
              aria-pressed={session === item}
            >
              {item}
            </Button>
          ))}
        </div>

        <div className="mt-6">
          {loading ? (
            <p className="py-8 text-center font-mono text-sm text-paper-dim">Scoring…</p>
          ) : error ? (
            <p className="py-8 text-center font-mono text-sm text-brick">
              Couldn&apos;t load the scoreboard. Try again.
            </p>
          ) : accuracy ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ScoreCard summary={accuracy.conservative} label="Conservative" />
              <ScoreCard summary={accuracy.aggressive} label="Aggressive" />
            </div>
          ) : (
            <Card className="p-4 text-sm leading-relaxed text-paper-dim">
              No scored {session} sessions yet. A prediction has to be
              generated and an outcome logged for the same day before this
              fills in — log one below once a real {session} happens.
            </Card>
          )}
        </div>

        {accuracy && accuracy.recent.length > 0 ? (
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
              Recent scores
            </p>
            <ul className="mt-2 space-y-1.5">
              {accuracy.recent.map((score, i) => (
                <li
                  key={`${score.variant}-${score.date}-${i}`}
                  className="flex items-center justify-between rounded-md border border-paper/10 bg-asphalt px-3 py-2 font-mono text-xs"
                >
                  <span className="text-paper-dim">
                    {score.date} · {score.variant}
                  </span>
                  <span
                    className={cn(
                      "text-paper",
                      score.compositeScore >= 70
                        ? "text-pit-lime"
                        : score.compositeScore < 40
                          ? "text-brick"
                          : "text-amber",
                    )}
                  >
                    {score.compositeScore.toFixed(0)}/100
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Card className="mt-6 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Log today&apos;s {session} result
          </p>
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-paper">
              <input
                type="checkbox"
                checked={rainOccurred}
                onChange={(event) => setRainOccurred(event.target.checked)}
                className="h-4 w-4 rounded border-paper/30 bg-asphalt accent-amber"
              />
              Rain actually occurred
            </label>
            <label className="block text-sm text-paper">
              Actual pit lap (leader/reference car, optional)
              <input
                type="number"
                min={1}
                value={actualPitLap}
                onChange={(event) => setActualPitLap(event.target.value)}
                placeholder="e.g. 18"
                className="mt-1 w-full rounded-md border border-paper/10 bg-asphalt px-3 py-2 text-sm text-paper outline-none focus-visible:border-amber"
              />
            </label>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Logging…" : "Log outcome"}
            </Button>
            {submitMessage ? (
              <p role="status" className="text-xs text-paper-dim">
                {submitMessage}
              </p>
            ) : null}
          </form>
        </Card>

        <AboutNote />
      </main>
    </>
  );
}
