import type { Compound } from "@/types";

// Mirrors backend/app/services/strategy_service.py so the tyre picker can say
// what the engine will actually do with a choice before the request returns.
// If those constants change, change these — tyreModel.test.ts pins the pairs.

export const COMPOUND_BASE_LIFE: Record<Compound, number> = {
  Soft: 16,
  Medium: 26,
  Hard: 38,
  Intermediate: 22,
  Wet: 30,
};

export const NOMINAL_TEMP_C = 31;

export function adjustedLife(compound: Compound, tempC: number): number {
  const factor = Math.min(1.18, Math.max(0.72, 1 - 0.011 * (tempC - NOMINAL_TEMP_C)));
  return Math.round(COMPOUND_BASE_LIFE[compound] * factor);
}

export type TyreFit = "good" | "marginal" | "wrong";

/** Same thresholds as `_tyre_fit_penalty`: 0 → good, <=6 → marginal, else wrong. */
export function tyreFit(compound: Compound, rainProbability: number): TyreFit {
  const slick = compound === "Soft" || compound === "Medium" || compound === "Hard";
  let penalty = 0;
  if (rainProbability >= 60) {
    penalty = slick ? 24 : compound === "Wet" ? 0 : 6;
  } else if (rainProbability >= 35) {
    penalty = compound === "Wet" ? 14 : compound === "Soft" ? 6 : 0;
  } else if (!slick) {
    penalty = 20;
  }
  if (penalty === 0) return "good";
  return penalty <= 6 ? "marginal" : "wrong";
}
