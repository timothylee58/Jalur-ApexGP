import type { Compound, PredictionResponse, StrategyPrediction, WhatIf } from "@/types";
import { COMPOUNDS } from "@/types";

export function confidenceDelta(data: PredictionResponse): {
  leader: "conservative" | "aggressive" | "even";
  points: number;
  headline: string;
  subline: string;
} {
  const diff = data.conservative.confidence - data.aggressive.confidence;
  const points = Math.abs(Math.round(diff));

  if (points <= 3) {
    return {
      leader: "even",
      points,
      headline: "Strategies disagree — only a few points apart",
      subline: "When the gap is this tight, Sepang tends to reward whoever reads the weather shift first.",
    };
  }

  if (diff > 0) {
    return {
      leader: "conservative",
      points,
      headline: `Conservative reads +${points}pts more confident this session`,
      subline: `Aggressive at ${Math.round(data.aggressive.confidence)}% — higher reward if the radar stays dry.`,
    };
  }

  return {
    leader: "aggressive",
    points,
    headline: `Aggressive reads +${points}pts more confident this session`,
    subline: `Conservative at ${Math.round(data.conservative.confidence)}% — cover position if rain builds.`,
  };
}

export function pitWindowStatus(prediction: StrategyPrediction, session: PredictionResponse["session"]): string {
  const { startLap, endLap } = prediction.pitWindow;
  if (session === "Quali") {
    return "Quali window — commit on the last clean lap, abort if rain hits Turn 9.";
  }
  const mid = Math.round((startLap + endLap) / 2);
  return `Optimal window L${startLap}–L${endLap} · target around L${mid}. Cover any undercut within 2.0s.`;
}

export function buildShareUrl(data: PredictionResponse, origin: string): string {
  const params = new URLSearchParams({
    session: data.session,
    cc: String(Math.round(data.conservative.confidence)),
    ac: String(Math.round(data.aggressive.confidence)),
    rain: String(Math.round(data.weather.rainProbability)),
    temp: String(Math.round(data.weather.tempC)),
    cond: data.weather.condition,
    ct: data.conservative.tyreSequence.join("-"),
    at: data.aggressive.tyreSequence.join("-"),
  });
  if (data.inputs?.safetyCar) params.set("sc", "1");
  if (data.inputs?.tyreChoice) params.set("ty", data.inputs.tyreChoice);
  return `${origin}/predict?${params.toString()}`;
}

/** Hydrate the what-if simulator state from a shared link's query params so a
 * shared scenario reproduces the same read on open. */
export function parseWhatIfParams(params: URLSearchParams): WhatIf {
  const whatIf: WhatIf = {};
  const rain = params.get("rain");
  const temp = params.get("temp");
  const sc = params.get("sc");
  const ty = params.get("ty");

  if (rain !== null && Number.isFinite(Number(rain))) whatIf.rainProbability = Number(rain);
  if (temp !== null && Number.isFinite(Number(temp))) whatIf.tempC = Number(temp);
  if (sc === "1") whatIf.safetyCar = true;
  if (ty !== null && COMPOUNDS.includes(ty as Compound)) whatIf.tyreChoice = ty as Compound;

  return whatIf;
}
