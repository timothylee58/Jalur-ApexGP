export type Session = "FP1" | "FP2" | "FP3" | "Quali" | "Race";
export type StrategyVariant = "conservative" | "aggressive";
export type Compound = "Soft" | "Medium" | "Hard" | "Intermediate" | "Wet";

export const SESSIONS: Session[] = ["FP1", "FP2", "FP3", "Quali", "Race"];
export const COMPOUNDS: Compound[] = ["Soft", "Medium", "Hard", "Intermediate", "Wet"];

export interface PitWindow {
  startLap: number;
  endLap: number;
}

export interface Stint {
  compound: string;
  startLap: number;
  endLap: number;
  laps: number;
}

export interface StrategyPrediction {
  variant: StrategyVariant;
  tyreSequence: string[];
  confidence: number;
  pitWindow: PitWindow;
  stints?: Stint[];
  stopCount?: number;
  reasoning: string;
  keyRisk: string;
  referencedCorners?: string[];
}

export interface HourlyRainPoint {
  hourLabel: string;
  rainProbability: number;
}

export interface WeatherSnapshot {
  tempC: number;
  rainProbability: number;
  condition: string;
  hourlyRain?: HourlyRainPoint[];
  monsoonNote?: string;
}

export interface ConfidenceTrend {
  variant: StrategyVariant;
  fromConfidence: number;
  toConfidence: number;
  label: string;
}

export interface SimInputs {
  rainProbability: number;
  tempC: number;
  safetyCar: boolean;
  tyreChoice?: string | null;
  rainOverridden?: boolean;
  tempOverridden?: boolean;
}

export interface PredictionResponse {
  session: Session;
  conservative: StrategyPrediction;
  aggressive: StrategyPrediction;
  weather: WeatherSnapshot;
  raceLaps?: number;
  inputs?: SimInputs | null;
  modelKind?: string;
  confidenceTrend?: ConfidenceTrend | null;
}

/** What-if overrides sent to the simulator. Any field left undefined falls back
 * to the live/climatology weather blend on the backend. */
export interface WhatIf {
  rainProbability?: number;
  tempC?: number;
  safetyCar?: boolean;
  tyreChoice?: Compound | null;
}

export interface OutcomeRequest {
  session: Session;
  rainOccurred: boolean;
  actualPitLap?: number | null;
  notes?: string;
}

export interface OutcomeLogged {
  logged: boolean;
  session: Session;
  date: string;
}

export interface VariantScore {
  variant: StrategyVariant;
  predictedConfidence: number;
  rainCallScore: number;
  pitWindowHit: boolean | null;
  compositeScore: number;
  date: string;
}

export interface AccuracySummary {
  variant: StrategyVariant;
  sampleSize: number;
  meanRainCallScore: number;
  pitWindowHitRate: number | null;
  meanCompositeScore: number;
}

export interface AccuracyResponse {
  session: Session;
  sampleSize: number;
  conservative: AccuracySummary;
  aggressive: AccuracySummary;
  recent: VariantScore[];
}
