import type { PredictionResponse, StrategyPrediction } from "@/types";

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
    cond: data.weather.condition,
    ct: data.conservative.tyreSequence.join("-"),
    at: data.aggressive.tyreSequence.join("-"),
  });
  return `${origin}/predict?${params.toString()}`;
}
