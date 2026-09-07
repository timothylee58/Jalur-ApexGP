/**
 * Shared shape every dictionary (en/ms/zh) must satisfy — TypeScript
 * catches a missing translation key at compile time rather than a blank
 * string shipping silently.
 *
 * Scope is deliberate, not an oversight: only the global nav chrome and
 * /guide's own content are translated (v1). Everything else — /circuit,
 * /lore, /picks, backend-generated strategy reasoning, etc. — stays
 * English regardless of the language switcher, since those aren't
 * translated yet. AboutNote (shared across nearly every page) is
 * likewise left out on purpose: translating it would make non-/guide
 * pages look partially translated, which is worse than consistently
 * English.
 */

export type Lang = "en" | "ms" | "zh";

export interface GuideCardText {
  id: string;
  title: string;
  body: string;
}

export interface QuizQuestionText {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Dictionary {
  nav: {
    predict: string;
    picks: string;
    circuit: string;
    accuracy: string;
    drivers: string;
    teams: string;
    fan: string;
    news: string;
    telemetry: string;
    drive: string;
    reveal: string;
    lore: string;
    guide: string;
    seats: string;
    calendar: string;
  };
  guide: {
    kicker: string;
    title: string;
    intro: string;
    quizLabel: string;
    disclaimer: string;
    cards: GuideCardText[];
    quiz: QuizQuestionText[];
  };
  quizUi: {
    questionOf: string; // "Question {current} / {total}" — {current}/{total} replaced at render
    score: string;
    correct: string;
    notQuite: string;
    correctSuffix: string;
    yourAnswerSuffix: string;
    nextQuestion: string;
    seeResults: string;
    quizComplete: string;
    cleanSweep: string;
    tryAgain: string;
    playAgain: string;
  };
}
