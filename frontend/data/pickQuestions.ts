/**
 * Race-day Picks' 8 questions. The choices come from data/teams.ts and
 * its 2026 driver pairs (see lib/pickRoster.ts), never duplicated here, so
 * the grid only has to change in one place.
 *
 * Each question is mechanically scoreable from Jolpica's real round-16
 * classification once it's final (backend/app/services/picks_scoring.py)
 * — nothing here asks about something this app has no honest way to
 * verify later (no safety-car or weather question, for that reason).
 */

import { teams } from "./teams";
import type { DnfBand } from "@/types/picks";

export const DNF_BAND_OPTIONS: { id: DnfBand; label: string; detail: string }[] = [
  { id: "0", label: "None", detail: "All 22 cars see the flag" },
  { id: "1-2", label: "1–2", detail: "A retirement or two" },
  { id: "3+", label: "3 or more", detail: "A race of attrition" },
];

/** The team id a given driver id races for — used to derive
 * `beatsTeammateOf` automatically from a single "pick a driver" question,
 * rather than asking the fan to pick a team and then a driver within it. */
export function teamIdForDriver(driverId: string): string | undefined {
  return teams.find((team) => team.driverIds.includes(driverId))?.id;
}

export type PickQuestionType = "driver" | "team" | "band";

export type PickQuestionKey =
  | "winner"
  | "p2"
  | "p3"
  | "pole"
  | "fastestLap"
  | "topConstructor"
  | "dnfBand"
  | "beatsTeammatePick";

export interface PickQuestion {
  key: PickQuestionKey;
  /** Label on the submitted ticket. */
  short: string;
  prompt: string;
  helper: string;
  type: PickQuestionType;
}

export const PICK_QUESTIONS: PickQuestion[] = [
  {
    key: "winner",
    short: "Winner",
    prompt: "Who wins the race?",
    helper: "P1 at the chequered flag.",
    type: "driver",
  },
  {
    key: "p2",
    short: "P2",
    prompt: "Who finishes P2?",
    helper: "Second on the podium.",
    type: "driver",
  },
  {
    key: "p3",
    short: "P3",
    prompt: "Who finishes P3?",
    helper: "Third on the podium.",
    type: "driver",
  },
  {
    key: "pole",
    short: "Pole",
    prompt: "Who takes pole position?",
    helper: "Fastest in qualifying — this one locks first, at the start of Quali.",
    type: "driver",
  },
  {
    key: "fastestLap",
    short: "Fastest lap",
    prompt: "Who sets the fastest lap?",
    helper: "The single quickest lap of the race, by anyone.",
    type: "driver",
  },
  {
    key: "topConstructor",
    short: "Top constructor",
    prompt: "Which constructor scores the most points?",
    helper: "Both cars' points combined, for this race only.",
    type: "team",
  },
  {
    key: "dnfBand",
    short: "Retirements",
    prompt: "How many cars retire (DNF)?",
    helper: "A car classified a lap down still counts as finishing — only real retirements count.",
    type: "band",
  },
  {
    key: "beatsTeammatePick",
    short: "Beats teammate",
    prompt: "Pick a driver who out-scores their own teammate",
    helper: "Head-to-head within the same car, not the whole grid.",
    type: "driver",
  },
];

const PODIUM: { key: "winner" | "p2" | "p3"; label: string }[] = [
  { key: "winner", label: "your winner" },
  { key: "p2", label: "your P2" },
  { key: "p3", label: "your P3" },
];

/** Drivers a podium question can't take because another podium place
 * already has them, each with the reason shown on the disabled choice.
 * No result has one driver in two places, and the backend rejects it. */
export function podiumConflicts(key: PickQuestionKey, answers: Partial<Record<PickQuestionKey, string>>): Record<string, string> {
  if (!PODIUM.some((place) => place.key === key)) return {};
  const taken: Record<string, string> = {};
  for (const place of PODIUM) {
    const driverId = answers[place.key];
    if (place.key !== key && driverId) taken[driverId] = `Already ${place.label}`;
  }
  return taken;
}

/** Every question answered, and the podium is three different drivers. */
export function ticketComplete(answers: Partial<Record<PickQuestionKey, string>>): boolean {
  if (!PICK_QUESTIONS.every((question) => Boolean(answers[question.key]))) return false;
  return new Set(PODIUM.map((place) => answers[place.key])).size === PODIUM.length;
}
