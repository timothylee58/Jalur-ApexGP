import type { Compound, PredictionResponse, Session, StrategyPrediction, WhatIf } from "@/types";
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

const WET_COMPOUNDS = new Set(["Intermediate", "Wet"]);

export interface PlanWindow {
  /** What the lap window means in this session. */
  label: string;
  /** One line on how to use it. */
  line: string;
}

/** Session-aware copy for a card's lap window. The backend's plans differ by
 * session (see strategy_service.py): the race has a pit stop, practice a
 * trip to the garage between two runs, qualifying a decisive Q3 run. The
 * target lap is the plan's own change lap, the same one its reasoning names. */
export function planWindow(prediction: StrategyPrediction, session: Session): PlanWindow {
  const { startLap, endLap } = prediction.pitWindow;
  // A word joiner after the dash stops "L13–" and "L15" landing on two lines.
  const range = `L${startLap}–\u2060L${endLap}`;
  const [first, next] = prediction.tyreSequence;
  const change = prediction.stints?.[0]?.endLap ?? Math.round((startLap + endLap) / 2);
  const aggressive = prediction.variant === "aggressive";

  if (session === "Quali") {
    return aggressive
      ? { label: "Final Q3 run", line: `Everything on the last run · ${range}. Abort if rain reaches Turn 9.` }
      : { label: "First Q3 run", line: `Bank a lap on the first run · ${range}, then improve if you can.` };
  }

  if (!next) {
    return { label: session === "Race" ? "Pit window" : "Tyre change", line: `${first} throughout.` };
  }

  if (session === "Race") {
    // A switch between slicks and wet tyres is timed by the weather, not by
    // tyre wear, so undercut talk doesn't apply to it.
    if (WET_COMPOUNDS.has(first) !== WET_COMPOUNDS.has(next)) {
      return { label: "Pit window", line: `Switch to ${next}s when the weather turns · modelled ${range}.` };
    }
    return {
      label: "Pit window",
      line: aggressive
        ? `Box ${range}, target L${change}. Undercut the car ahead if you're within 2.0s.`
        : `Box ${range}, target L${change}. Cover any undercut from cars within 2.0s.`,
    };
  }

  return { label: "Tyre change", line: `Back to the garage around L${change} for the ${next} run.` };
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
