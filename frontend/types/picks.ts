export type DnfBand = "0" | "1-2" | "3+";

export interface PickAnswers {
  winner: string;
  p2: string;
  p3: string;
  pole: string;
  fastestLap: string;
  topConstructor: string;
  dnfBand: DnfBand;
  beatsTeammateOf: string;
  beatsTeammatePick: string;
}

export interface PickSubmission {
  displayName: string;
  picks: PickAnswers;
}

export interface PickSubmitted {
  id: string;
  displayName: string;
  submittedAt: string;
}

export interface LeaderboardRow {
  rank: number;
  displayName: string;
  // null = not scored yet — distinct from an honest 0.
  score: number | null;
  isYou: boolean;
}

export interface LeaderboardResponse {
  isScored: boolean;
  entries: LeaderboardRow[];
  totalEntries: number;
}

export interface MyPickResponse {
  id: string;
  displayName: string;
  picks: PickAnswers;
  submittedAt: string;
  score: number | null;
  rank: number | null;
}
