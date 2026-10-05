export type SessionName = "FP1" | "FP2" | "FP3" | "Quali" | "Race";
export type SessionState = "upcoming" | "live" | "awaiting" | "scored" | "unscored";
export type Variant = "conservative" | "aggressive";

export interface PitWindow {
  startLap: number;
  endLap: number;
}

export interface PredictionSnapshot {
  madeAt: string;
  source: string;
  rainProbability: number;
  condition: string;
  confidenceConservative: number;
  confidenceAggressive: number;
  pitWindowConservative: PitWindow;
  pitWindowAggressive: PitWindow;
}

export interface SessionOutcome {
  rainOccurred: boolean;
  actualPitLap: number | null;
  rainSource: string;
  pitSource: string | null;
  recordedAt: string;
}

export interface VariantScore {
  variant: Variant;
  predictedConfidence: number;
  rainCallScore: number;
  pitWindowHit: boolean | null;
  compositeScore: number;
  date: string;
}

export interface SessionBoard {
  session: SessionName;
  start: string;
  end: string;
  state: SessionState;
  prediction: PredictionSnapshot | null;
  outcome: SessionOutcome | null;
  scores: VariantScore[];
}

export interface WeekendBoard {
  season: string;
  round: string;
  raceName: string;
  generatedAt: string;
  sessions: SessionBoard[];
  nextCheckSeconds: number;
}
