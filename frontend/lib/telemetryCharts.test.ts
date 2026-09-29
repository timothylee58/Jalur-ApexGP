import { describe, expect, it } from "vitest";
import type { SessionLap, TelemetrySample } from "@/types/telemetry";
import {
  distances,
  finishingOrder,
  interpolate,
  lapDelta,
  fuelCorrected,
  heatColour,
  percentileRank,
  rampColour,
  stintsOf,
  teamColour,
} from "./telemetryCharts";

const s = (t: number, speed: number, distance?: number): TelemetrySample => ({
  t,
  speed,
  throttle: 100,
  brake: 0,
  rpm: 11000,
  gear: 8,
  drs: null,
  distance,
});

describe("distances", () => {
  it("uses the published channel when every sample has one", () => {
    expect(distances([s(0, 300, 0), s(1, 300, 83)])).toEqual([0, 83]);
  });

  it("integrates speed otherwise", () => {
    // 360 km/h = 100 m/s for 2 s.
    expect(distances([s(0, 360), s(2, 360)])).toEqual([0, 200]);
  });
});

describe("interpolate", () => {
  it("is linear inside the range and clamped outside it", () => {
    expect(interpolate([0, 10], [0, 100], 2.5)).toBe(25);
    expect(interpolate([0, 10], [0, 100], -5)).toBe(0);
    expect(interpolate([0, 10], [0, 100], 50)).toBe(100);
  });
});

describe("lapDelta", () => {
  it("is zero along identical laps", () => {
    const lap = [s(0, 200, 0), s(10, 200, 500), s(20, 200, 1000)];
    expect(lapDelta(lap, lap, 4).every((p) => Math.abs(p.delta) < 1e-9)).toBe(true);
  });

  it("ends at the lap-time difference and is positive when B is behind", () => {
    const a = [s(0, 200, 0), s(10, 200, 500), s(20, 200, 1000)];
    const b = [s(0, 190, 0), s(10.5, 190, 510), s(21, 190, 1020)]; // 1 s slower, 2% longer line
    const delta = lapDelta(a, b, 4);
    expect(delta[0].delta).toBe(0);
    expect(delta[delta.length - 1].delta).toBeCloseTo(1, 9);
    expect(delta[2].delta).toBeCloseTo(0.5, 9);
  });
});

describe("colour ramps", () => {
  it("runs warm to cool for speed", () => {
    expect(rampColour(0)).toBe("rgb(194, 59, 34)");
    expect(rampColour(1)).toBe("rgb(46, 196, 182)");
  });

  it("colours the heatmap by rank: quickest coolest, slowest warmest", () => {
    const sorted = [74.23, 76.0, 78.3, 79.7, 149.6];
    expect(percentileRank(sorted, 74.23)).toBe(0);
    expect(percentileRank(sorted, 78.3)).toBe(0.5);
    expect(percentileRank(sorted, 149.6)).toBe(1);
    expect(heatColour(0)).toBe("rgb(46, 196, 182)");
    expect(heatColour(1)).toBe("rgb(194, 59, 34)");
  });

  it("fuel-corrects with TracingInsights' 0.03 s per kg, burned linearly", () => {
    // Lap 1 of 72 carries ~98.6 kg -> ~2.96 s; the last lap carries none.
    expect(fuelCorrected(80, 1, 72)).toBeCloseTo(80 - 100 * (1 - 1 / 72) * 0.03, 9);
    expect(fuelCorrected(75, 72, 72)).toBe(75);
  });
});

const lap = (driver: string, n: number, stint: number, compound: string, position = 1): SessionLap => ({
  driver,
  lap: n,
  time: 76,
  compound,
  stint,
  position,
  pitIn: false,
  pitOut: false,
  status: "1",
});

describe("stints and classification", () => {
  it("groups consecutive laps by stint", () => {
    const laps = [lap("NOR", 1, 1, "MEDIUM"), lap("NOR", 2, 1, "MEDIUM"), lap("NOR", 3, 2, "HARD")];
    expect(stintsOf(laps)).toEqual([
      { stint: 1, compound: "MEDIUM", firstLap: 1, lastLap: 2 },
      { stint: 2, compound: "HARD", firstLap: 3, lastLap: 3 },
    ]);
  });

  it("orders by laps completed, then position on the last lap", () => {
    const laps = [lap("VER", 2, 1, "SOFT", 2), lap("NOR", 2, 1, "SOFT", 1), lap("ALB", 1, 1, "SOFT", 3)];
    expect(finishingOrder(laps)).toEqual(["NOR", "VER", "ALB"]);
  });

  it("only trusts well-formed team colours", () => {
    expect(teamColour("F47600")).toBe("#F47600");
    expect(teamColour(null)).toBe("#a39b8f");
    expect(teamColour("red")).toBe("#a39b8f");
  });
});
