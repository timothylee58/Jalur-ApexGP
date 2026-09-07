"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DNF_BAND_OPTIONS,
  DRIVER_OPTIONS,
  PICK_QUESTIONS,
  TEAM_OPTIONS,
  teamIdForDriver,
} from "@/data/pickQuestions";
import { PicksClosedError, submitPicks } from "@/lib/api";
import { clearDraft, loadDraft, saveDraft, saveEntryId } from "@/lib/picksStorage";
import type { PickAnswers, PickSubmitted } from "@/types/picks";

const REQUIRED_KEYS = PICK_QUESTIONS.map((q) => q.key);

function isComplete(answers: Partial<PickAnswers>): answers is PickAnswers {
  return REQUIRED_KEYS.every((key) => Boolean(answers[key]));
}

export function PickForm({ onSubmitted }: { onSubmitted: (submitted: PickSubmitted) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [answers, setAnswers] = useState<Partial<PickAnswers>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft restores on mount only — localStorage isn't available during SSR,
  // and re-reading it on every render would clobber in-progress edits.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) setAnswers(draft);
  }, []);

  useEffect(() => {
    if (Object.keys(answers).length > 0) saveDraft(answers);
  }, [answers]);

  const complete = useMemo(() => isComplete(answers) && displayName.trim().length > 0, [
    answers,
    displayName,
  ]);

  const setAnswer = (key: keyof PickAnswers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!isComplete(answers) || displayName.trim().length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const beatsTeammateOf = teamIdForDriver(answers.beatsTeammatePick);
      if (!beatsTeammateOf) throw new Error("Couldn't resolve that driver's team — try again.");

      const submitted = await submitPicks({
        displayName: displayName.trim(),
        picks: { ...answers, beatsTeammateOf },
      });
      saveEntryId(submitted.id);
      clearDraft();
      onSubmitted(submitted);
    } catch (err) {
      if (err instanceof PicksClosedError) {
        setError(err.message);
      } else {
        setError("Couldn't save your picks — check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-paper/10 bg-asphalt/80 p-4 sm:p-6">
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Your name
        </span>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
          placeholder="Shown on the leaderboard"
          maxLength={40}
          className="mt-1 w-full rounded-md border border-paper/10 bg-asphalt px-3 py-2 text-sm text-paper placeholder:text-paper-dim/50 focus:border-amber/50 focus:outline-none"
        />
      </label>

      <div className="mt-6 grid gap-6">
        {PICK_QUESTIONS.map((question) => (
          <div key={question.key}>
            <h3 className="font-display text-lg uppercase tracking-wide text-paper">
              {question.prompt}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-paper-dim">{question.helper}</p>

            {question.type === "band" ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {DNF_BAND_OPTIONS.map((option) => {
                  const active = answers.dnfBand === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAnswer("dnfBand", option.id)}
                      aria-pressed={active}
                      className={`rounded-md border px-3 py-2 text-left text-sm text-paper transition-colors ${
                        active
                          ? "border-amber bg-amber/10"
                          : "border-paper/10 bg-asphalt hover:border-paper/30"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <select
                value={answers[question.key] ?? ""}
                onChange={(e) => setAnswer(question.key, e.target.value)}
                className="mt-3 w-full rounded-md border border-paper/10 bg-asphalt px-3 py-2 text-sm text-paper focus:border-amber/50 focus:outline-none"
              >
                <option value="" disabled>
                  Choose one…
                </option>
                {(question.type === "team" ? TEAM_OPTIONS : DRIVER_OPTIONS).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <div aria-live="polite">
        {error ? <p className="mt-4 text-sm text-brick">{error}</p> : null}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!complete || submitting}
        className="mt-6 w-full rounded-full border border-amber/40 px-5 py-3 font-mono text-xs uppercase tracking-wide text-amber transition-colors hover:border-amber disabled:cursor-not-allowed disabled:border-paper/10 disabled:text-paper-dim"
      >
        {submitting ? "Saving…" : "Lock in your picks"}
      </button>
    </div>
  );
}
