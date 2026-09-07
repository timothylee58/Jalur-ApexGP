/**
 * Beginner-facing F1 content for /guide — a glossary of longer explainer
 * cards (companion to data/glossary.ts's short tap-to-define tooltips, not
 * a replacement: this is for someone reading start to finish, that's for
 * someone mid-strategy-card who just wants one term explained) plus a
 * general-knowledge quiz. Every fact here is current-rules, WebSearch-
 * verified against real sources — including catching a real bug this file's
 * addition surfaced: docs/BRAND.md's "no invented facts" standard applies
 * here exactly as it does to driver/team stats elsewhere in this app.
 *
 * Notably: DRS (Drag Reduction System, 2011-2025) is retired for the 2026
 * season this app models, replaced by "Overtake Mode" under F1's new
 * active-aero regulations — see driver61.com and Sky Sports' 2026
 * regulation coverage. This also fixed a real bug: backend/app/services/
 * strategy_service.py's race-strategy reasoning text and this app's own
 * glossary.ts both referred to DRS in the present tense before this file
 * was added.
 */

export interface GuideCard {
  id: string;
  title: string;
  body: string;
}

export const GUIDE_CARDS: GuideCard[] = [
  {
    id: "overtake-mode",
    title: "Overtake Mode (DRS's replacement)",
    body: "F1 retired the 14-year-old Drag Reduction System — a single rear-wing flap — after the 2025 season. From 2026, overtaking help comes from a fully active-aero system adjusting both front and rear wings. The fairness rule stays the same as DRS's: a driver has to be within one second of the car ahead at a track's detection point to unlock it in the following zone.",
  },
  {
    id: "tyre-compounds",
    title: "Tyre compounds",
    body: "Pirelli brings five dry compounds each season, C1 (hardest) through C5 (softest), and picks three for each race weekend — labelled Hard (white sidewall), Medium (yellow), and Soft (red) for that event only. \"Soft\" at one track can be a physically harder compound than \"Soft\" at another; the letters are relative to that weekend's selection, not a fixed rubber recipe.",
  },
  {
    id: "flags",
    title: "Flags",
    body: "Yellow: slow down, no overtaking — a hazard ahead. Red: the session is stopped entirely. Blue: a lapped car is told to let a faster one through. Chequered: the session is over.",
  },
  {
    id: "pit-strategy",
    title: "Undercut vs. overcut",
    body: "An undercut pits before the car you're chasing — fresh tyres are faster for a few laps, so you can jump ahead once they finally stop. An overcut is the opposite: stay out on older tyres while rivals pit, betting that clean air beats their slower out-lap.",
  },
  {
    id: "safety-car",
    title: "Safety car",
    body: "Neutralises the race after an incident — the field bunches up behind it at reduced speed, so a pit stop taken under it costs far less time than one taken at full racing speed. Teams that catch a safety car at the right moment often gain positions for close to free.",
  },
  {
    id: "ers",
    title: "ERS (Energy Recovery System)",
    body: "The hybrid side of an F1 power unit — electrical energy recovered from braking and exhaust heat, stored in a battery, and deployed for extra power on demand. Drivers and engineers manage how much to save across a lap for a defensive move or an attacking one later on.",
  },
];

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "points-win",
    question: "How many championship points does a race win score?",
    options: ["10", "20", "25", "30"],
    correctIndex: 2,
    explanation: "25 for first, scaling down to 1 point for tenth (18-15-12-10-8-6-4-2-1).",
  },
  {
    id: "fastest-lap-point",
    question: "Is there still a bonus point for the race's fastest lap?",
    options: ["Yes, if you finish in the top 10", "No — abolished after the 2024 season", "Yes, for anyone on track", "Only in sprint races"],
    correctIndex: 1,
    explanation: "The fastest-lap bonus point was dropped from the 2025 season onward — finishing position is the only way to score now.",
  },
  {
    id: "drs-replacement",
    question: "What replaced DRS for the 2026 season?",
    options: ["Nothing — DRS is unchanged", "Overtake Mode, part of a new active-aero system", "A push-to-pass button", "Sprint-only DRS"],
    correctIndex: 1,
    explanation: "F1's 2026 regulations retired the single rear-wing-flap DRS after 14 seasons, replacing it with active aero that adjusts both wings.",
  },
  {
    id: "mandatory-compounds",
    question: "In a dry race, how many different tyre compounds must a driver use?",
    options: ["1", "2", "3", "None — it's optional"],
    correctIndex: 1,
    explanation: "At least two different dry compounds are mandatory in a dry race, which guarantees at least one pit stop.",
  },
  {
    id: "yellow-flag",
    question: "What does a yellow flag mean?",
    options: ["Race finished", "Let a faster car past", "Slow down, no overtaking — hazard ahead", "Pit now"],
    correctIndex: 2,
    explanation: "Yellow is a caution: slow down and don't overtake until you're past the hazard.",
  },
  {
    id: "safety-car-effect",
    question: "What does a safety car do to the field?",
    options: ["Ends the session", "Bunches everyone up behind it at reduced speed", "Adds a mandatory pit stop", "Only slows the leader"],
    correctIndex: 1,
    explanation: "It neutralises the race — the field closes up behind it, which is why pit stops taken under it cost so much less time.",
  },
  {
    id: "softest-compound",
    question: "Which is the softest tyre compound?",
    options: ["C1", "C3", "C5", "They're all equally soft"],
    correctIndex: 2,
    explanation: "C1 is the hardest of the five-compound range, C5 the softest.",
  },
  {
    id: "undercut-def",
    question: "What's an \"undercut\"?",
    options: [
      "Staying out longer than your rival",
      "Pitting before your rival for fresher, faster tyres",
      "A type of kerb",
      "Overtaking under a safety car",
    ],
    correctIndex: 1,
    explanation: "Pit first, and the new tyres' extra pace can be enough to jump the rival once they finally stop themselves.",
  },
  {
    id: "sprint-points",
    question: "How many finishers score points in an F1 sprint race?",
    options: ["Top 3", "Top 8", "Top 10", "Everyone who finishes"],
    correctIndex: 1,
    explanation: "Sprints pay the top 8 finishers, 8-7-6-5-4-3-2-1 — a shorter scale than the full race's top 10.",
  },
  {
    id: "sepang-length",
    question: "How long is one lap of Sepang International Circuit?",
    options: ["3.4 km", "4.8 km", "5.543 km", "6.2 km"],
    correctIndex: 2,
    explanation: "5.543 km, 15 corners — the same figures behind every circuit map and stat on this site.",
  },
];
