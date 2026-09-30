"use client";

import { useEffect, useState } from "react";
import { DriverPicker } from "@/components/picks/DriverPicker";
import { TeamPicker } from "@/components/picks/TeamPicker";
import {
  DNF_BAND_OPTIONS,
  PICK_QUESTIONS,
  podiumConflicts,
  teamIdForDriver,
  ticketComplete,
  type PickQuestionKey,
} from "@/data/pickQuestions";
import { PicksClosedError, PicksRejectedError, PicksUnavailableError, submitPicks } from "@/lib/api";
import { driverById, teamOfDriver } from "@/lib/pickRoster";
import { clearDraft, loadDraft, saveDraft } from "@/lib/picksStorage";
import type { StandingsPayload } from "@/types/jolpica";
import type { PickAnswers, PickSubmitted } from "@/types/picks";

interface PickFormProps {
  onSubmitted: (submitted: PickSubmitted, picks: PickAnswers) => void;
  standings: StandingsPayload | null;
  /** Past the deadline: the form stays readable but can't be sent. */
  locked: boolean;
}

type Answers = Partial<Record<PickQuestionKey, string>>;

function teammateNote(driverId: string | undefined): string | null {
  const team = teamOfDriver(driverId);
  const teammate = driverById(team?.driverIds.find((id) => id !== driverId));
  return teammate ? `Up against ${teammate.name} in the other ${team!.name}.` : null;
}

export function PickForm({ onSubmitted, standings, locked }: PickFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [openKey, setOpenKey] = useState<PickQuestionKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft restores on mount only — localStorage isn't available during SSR,
  // and re-reading it on every render would clobber in-progress edits.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setAnswers(draft as Answers);
  }, []);

  useEffect(() => {
    if (Object.keys(answers).length > 0) saveDraft(answers as Partial<PickAnswers>);
  }, [answers]);

  const answered = PICK_QUESTIONS.filter((q) => Boolean(answers[q.key])).length;
  const nameOk = displayName.trim().length > 0;
  const complete = ticketComplete(answers) && nameOk;

  const setAnswer = (key: PickQuestionKey, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!complete || locked) return;
    const picks = answers as unknown as Omit<PickAnswers, "beatsTeammateOf">;
    setSubmitting(true);
    setError(null);
    try {
      const beatsTeammateOf = teamIdForDriver(picks.beatsTeammatePick);
      if (!beatsTeammateOf) throw new Error("Couldn't resolve that driver's team — try again.");

      const full: PickAnswers = { ...picks, beatsTeammateOf };
      const submitted = await submitPicks({ displayName: displayName.trim(), picks: full });
      clearDraft();
      onSubmitted(submitted, full);
    } catch (err) {
      if (err instanceof PicksClosedError || err instanceof PicksUnavailableError || err instanceof PicksRejectedError) {
        setError(err.message);
      } else {
        setError("Couldn't save your picks — check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const status = locked
    ? "Picks are locked"
    : complete
      ? "Ready to lock in"
      : !nameOk && answered === PICK_QUESTIONS.length
        ? "Add a name for the leaderboard"
        : `${answered} of ${PICK_QUESTIONS.length} picked`;

  return (
    <div className="rounded-lg border border-paper/10 bg-asphalt/80 p-4 sm:p-6">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Your name</span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
          placeholder="Shown on the leaderboard"
          maxLength={40}
          disabled={locked}
          autoComplete="nickname"
          className="mt-1 w-full rounded-md border border-paper/10 bg-asphalt px-3 py-2 text-sm text-paper placeholder:text-paper-dim/50 focus:border-amber/50 focus:outline-none disabled:opacity-60"
        />
      </label>

      <ol className="mt-6 grid gap-7">
        {PICK_QUESTIONS.map((question, index) => {
          const headingId = `pick-${question.key}`;
          const value = answers[question.key];
          return (
            <li key={question.key}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                    value ? "bg-amber text-asphalt" : "border border-paper/20 text-paper-dim"
                  }`}
                >
                  {value ? "✓" : index + 1}
                </span>
                <div className="min-w-0">
                  <h3 id={headingId} className="font-display text-lg uppercase leading-tight tracking-wide text-paper">
                    {question.prompt}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-paper-dim">{question.helper}</p>
                </div>
              </div>

              <div className="sm:pl-8">
                {question.type === "band" ? (
                  <div role="group" aria-labelledby={headingId} className="mt-3 grid grid-cols-3 gap-1.5">
                    {DNF_BAND_OPTIONS.map((option) => {
                      const active = value === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAnswer("dnfBand", option.id)}
                          aria-pressed={active}
                          disabled={locked}
                          className={`rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:cursor-not-allowed disabled:opacity-60 ${
                            active ? "border-amber bg-amber/10" : "border-paper/10 bg-asphalt hover:border-paper/30"
                          }`}
                        >
                          <span className="block font-display text-lg uppercase leading-none text-paper">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-[11px] leading-snug text-paper-dim">{option.detail}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : question.type === "team" ? (
                  <TeamPicker
                    label={question.prompt}
                    value={value}
                    onChange={(id) => setAnswer(question.key, id)}
                    standings={standings}
                    disabled={locked}
                  />
                ) : (
                  <DriverPicker
                    label={question.prompt}
                    value={value}
                    onChange={(id) => setAnswer(question.key, id)}
                    unavailable={podiumConflicts(question.key, answers)}
                    standings={standings}
                    open={openKey === question.key}
                    onOpenChange={(open) => setOpenKey(open ? question.key : null)}
                    disabled={locked}
                  />
                )}
                {question.key === "beatsTeammatePick" && value ? (
                  <p className="mt-2 text-xs text-paper-dim">{teammateNote(value)}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 border-t border-paper/10 pt-5">
        <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
          <span aria-live="polite">{status}</span>
          <span>{PICK_QUESTIONS.length * 10} pts on offer</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper/10" aria-hidden="true">
          <div
            className="h-full rounded-full bg-amber transition-[width] duration-300"
            style={{ width: `${(answered / PICK_QUESTIONS.length) * 100}%` }}
          />
        </div>

        <div aria-live="polite">{error ? <p className="mt-4 text-sm text-brick">{error}</p> : null}</div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!complete || submitting || locked}
          className="mt-4 w-full rounded-full bg-amber px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-asphalt transition-colors hover:bg-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt disabled:cursor-not-allowed disabled:bg-paper/10 disabled:text-paper-dim"
        >
          {locked ? "Picks locked" : submitting ? "Saving…" : "Lock in your picks"}
        </button>
      </div>
    </div>
  );
}
