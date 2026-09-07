"use client";

import { useState } from "react";
import { QUIZ_QUESTIONS } from "@/data/f1Guide";

export function RookieQuiz() {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const question = QUIZ_QUESTIONS[index];
  const isLast = index === QUIZ_QUESTIONS.length - 1;
  const answered = selected !== null;
  const correct = answered && selected === question.correctIndex;

  const selectOption = (i: number) => {
    if (answered) return;
    setSelected(i);
    if (i === question.correctIndex) setScore((s) => s + 1);
  };

  const next = () => {
    if (isLast) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  const restart = () => {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="rounded-lg border border-paper/10 bg-asphalt/80 p-6 text-center">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Quiz complete
        </span>
        <p className="mt-2 font-display text-3xl uppercase tracking-wide text-amber">
          {score} / {QUIZ_QUESTIONS.length}
        </p>
        <p className="mt-2 text-sm text-paper-dim" aria-live="polite">
          {score === QUIZ_QUESTIONS.length
            ? "Clean sweep — you know your current rulebook."
            : "Give it another lap — every question's explanation stays up after you answer."}
        </p>
        <button
          type="button"
          onClick={restart}
          className="mt-4 rounded-full border border-amber/40 px-5 py-2 font-mono text-xs uppercase tracking-wide text-amber hover:border-amber"
        >
          Play again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-paper/10 bg-asphalt/80 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Question {index + 1} / {QUIZ_QUESTIONS.length}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Score {score}
        </span>
      </div>

      <h3 className="mt-3 font-display text-xl uppercase tracking-wide text-paper">
        {question.question}
      </h3>

      <div className="mt-4 grid gap-2">
        {question.options.map((option, i) => {
          const isCorrectOption = i === question.correctIndex;
          const isPicked = i === selected;
          let style = "border-paper/10 bg-asphalt hover:border-paper/30";
          if (answered && isCorrectOption) style = "border-amber bg-amber/10";
          else if (answered && isPicked) style = "border-brick bg-brick/10";

          return (
            <button
              key={i}
              type="button"
              onClick={() => selectOption(i)}
              disabled={answered}
              aria-pressed={isPicked}
              className={`rounded-md border px-4 py-2 text-left text-sm text-paper transition-colors disabled:cursor-default ${style}`}
            >
              {option}
              {answered && isCorrectOption ? " — Correct" : null}
              {answered && isPicked && !isCorrectOption ? " — Your answer" : null}
            </button>
          );
        })}
      </div>

      <div aria-live="polite">
        {answered ? (
          <p className={`mt-3 text-sm leading-relaxed ${correct ? "text-amber" : "text-brick"}`}>
            {correct ? "Correct. " : "Not quite. "}
            <span className="text-paper-dim">{question.explanation}</span>
          </p>
        ) : null}
      </div>

      {answered ? (
        <button
          type="button"
          onClick={next}
          className="mt-4 rounded-full border border-amber/40 px-5 py-2 font-mono text-xs uppercase tracking-wide text-amber hover:border-amber"
        >
          {isLast ? "See results" : "Next question"}
        </button>
      ) : null}
    </div>
  );
}
