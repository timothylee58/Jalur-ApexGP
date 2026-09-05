export type Session = "FP1" | "FP2" | "FP3" | "Quali" | "Race";
export type StrategyVariant = "conservative" | "aggressive";

export const SESSIONS: Session[] = ["FP1", "FP2", "FP3", "Quali", "Race"];

export interface PitWindow {
  startLap: number;
  endLap: number;
}

export interface StrategyPrediction {
  variant: StrategyVariant;
  tyreSequence: string[];
  confidence: number;
  pitWindow: PitWindow;
  reasoning: string;
  keyRisk: string;
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

export interface PredictionResponse {
  session: Session;
  conservative: StrategyPrediction;
  aggressive: StrategyPrediction;
  weather: WeatherSnapshot;
  confidenceTrend?: ConfidenceTrend | null;
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
