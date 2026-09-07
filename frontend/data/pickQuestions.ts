/**
 * Race-day Picks' 8 questions. Driver/team options are sourced from
 * data/drivers.ts (2026-grid era only — the three historical
 * "sepang-history" entries aren't real 2026 contenders) and data/teams.ts,
 * never duplicated here, so the grid only has to change in one place.
 *
 * Each question is mechanically scoreable from Jolpica's real round-16
 * classification once it's final (backend/app/services/picks_scoring.py)
 * — nothing here asks about something this app has no honest way to
 * verify later (no safety-car or weather question, for that reason).
 */

import { drivers } from "./drivers";
import { teams } from "./teams";
import type { DnfBand } from "@/types/picks";

export interface PickOption {
  id: string;
  label: string;
}

export const DRIVER_OPTIONS: PickOption[] = drivers
  .filter((driver) => driver.era === "2026-grid")
  .map((driver) => ({ id: driver.id, label: `${driver.name} (${driver.team})` }));

export const TEAM_OPTIONS: PickOption[] = teams.map((team) => ({
  id: team.id,
  label: team.name,
}));

export const DNF_BAND_OPTIONS: { id: DnfBand; label: string }[] = [
  { id: "0", label: "0 — everyone runs the full race distance" },
  { id: "1-2", label: "1–2 retirements" },
  { id: "3+", label: "3 or more retirements" },
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
  prompt: string;
  helper: string;
  type: PickQuestionType;
}

export const PICK_QUESTIONS: PickQuestion[] = [
  {
    key: "winner",
    prompt: "Who wins the race?",
    helper: "P1 at the chequered flag.",
    type: "driver",
  },
  {
    key: "p2",
    prompt: "Who finishes P2?",
    helper: "Second on the podium.",
    type: "driver",
  },
  {
    key: "p3",
    prompt: "Who finishes P3?",
    helper: "Third on the podium.",
    type: "driver",
  },
  {
    key: "pole",
    prompt: "Who takes pole position?",
    helper: "Fastest in qualifying — this one locks first, at the start of Quali.",
    type: "driver",
  },
  {
    key: "fastestLap",
    prompt: "Who sets the fastest lap?",
    helper: "The single quickest lap of the race, by anyone.",
    type: "driver",
  },
  {
    key: "topConstructor",
    prompt: "Which constructor scores the most points?",
    helper: "Both cars' points combined, for this race only.",
    type: "team",
  },
  {
    key: "dnfBand",
    prompt: "How many cars retire (DNF)?",
    helper: "A car classified a lap down still counts as finishing — only real retirements count.",
    type: "band",
  },
  {
    key: "beatsTeammatePick",
    prompt: "Pick a driver who out-scores their own teammate",
    helper: "Head-to-head within the same car, not the whole grid.",
    type: "driver",
  },
];
