import { describe, expect, it } from "vitest";
import type { StrategyPrediction } from "@/types";
import { planWindow } from "./predictionUtils";

function read(overrides: Partial<StrategyPrediction>): StrategyPrediction {
  return {
    variant: "conservative",
    tyreSequence: ["Medium", "Hard"],
    confidence: 70,
    pitWindow: { startLap: 23, endLap: 28 },
    stints: [
      { compound: "Medium", startLap: 1, endLap: 26, laps: 26 },
      { compound: "Hard", startLap: 27, endLap: 56, laps: 30 },
    ],
    stopCount: 1,
    reasoning: "",
    keyRisk: "",
    ...overrides,
  };
}

describe("planWindow", () => {
  it("targets the race stop on the plan's own pit lap", () => {
    const window = planWindow(read({}), "Race");
    expect(window.label).toBe("Pit window");
    // The stint ends on L26, which is what the reasoning names — not the
    // window's midpoint.
    expect(window.line).toContain("target L26");
    expect(window.line).toContain("Cover any undercut");
    expect(planWindow(read({ variant: "aggressive" }), "Race").line).toContain("Undercut the car ahead");
  });

  it("drops undercut talk when the stop is a weather call", () => {
    const window = planWindow(read({ tyreSequence: ["Medium", "Intermediate"] }), "Race");
    expect(window.line).toBe("Switch to Intermediates when the weather turns · modelled L23–\u2060L28.");
  });

  it("calls a practice change a trip to the garage", () => {
    const window = planWindow(
      read({
        tyreSequence: ["Medium", "Intermediate"],
        pitWindow: { startLap: 13, endLap: 15 },
        stints: [
          { compound: "Medium", startLap: 1, endLap: 14, laps: 14 },
          { compound: "Intermediate", startLap: 15, endLap: 20, laps: 6 },
        ],
      }),
      "FP1",
    );
    expect(window).toEqual({ label: "Tyre change", line: "Back to the garage around L14 for the Intermediate run." });
    expect(window.line).not.toMatch(/undercut|pit window/i);
  });

  it("points qualifying at a Q3 run", () => {
    const single = { tyreSequence: ["Soft"], stints: [{ compound: "Soft", startLap: 1, endLap: 18, laps: 18 }] };
    expect(planWindow(read({ ...single, pitWindow: { startLap: 13, endLap: 15 } }), "Quali").label).toBe(
      "First Q3 run",
    );
    expect(
      planWindow(read({ ...single, variant: "aggressive", pitWindow: { startLap: 16, endLap: 18 } }), "Quali").label,
    ).toBe("Final Q3 run");
  });
});
