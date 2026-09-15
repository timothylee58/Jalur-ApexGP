import { describe, expect, it } from "vitest";
import {
  SEPANG_CORNER_REFERENCE,
  formatLapTime,
  sampleAtTime,
  simulateLap,
  speedRamp,
} from "./lapSim";

/**
 * These lock the solver's *shape* — that it closes, respects the sourced
 * reference speeds, and attributes braking to real corners. They
 * deliberately do not assert an exact lap time: the centreline's known
 * distortion (see lapSim's module docstring) means that number is
 * approximate by construction, and pinning it would just make the test
 * fail the moment anyone improves the geometry.
 */
describe("simulateLap", () => {
  const lap = simulateLap();

  it("normalises to the circuit's published length", () => {
    expect(lap.lengthM).toBeCloseTo(5543, 0);
  });

  it("is memoised, so every consumer reads one identical trace", () => {
    expect(simulateLap()).toBe(lap);
  });

  it("closes: the speed either side of the timing line agrees", () => {
    const first = lap.samples[0].speedKmh;
    const last = lap.samples[lap.samples.length - 1].speedKmh;
    expect(Math.abs(first - last)).toBeLessThan(6);
  });

  it("never exceeds a sourced apex speed at that corner", () => {
    for (const ref of SEPANG_CORNER_REFERENCE) {
      const corner = lap.corners.find((c) => c.turn === ref.turn);
      expect(corner).toBeDefined();
      expect(corner!.apexSpeedKmh).toBe(ref.apexKmh);
    }
  });

  it("bottoms out at the slowest sourced corner, not somewhere invented", () => {
    const slowest = Math.min(...SEPANG_CORNER_REFERENCE.map((c) => c.apexKmh));
    expect(lap.minSpeedKmh).toBeCloseTo(slowest, 1);
  });

  it("reaches a plausible Sepang top speed", () => {
    expect(lap.topSpeedKmh).toBeGreaterThan(300);
    expect(lap.topSpeedKmh).toBeLessThan(350);
  });

  it("emits all 15 real corners exactly once", () => {
    const turns = lap.corners.map((c) => c.turn);
    expect(turns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  });

  it("orders corners monotonically around the lap", () => {
    const positions = lap.corners.map((c) => c.s);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("spends most of the lap flat out, as a two-long-straight circuit should", () => {
    expect(lap.flatOutFraction).toBeGreaterThan(0.6);
    expect(lap.flatOutFraction).toBeLessThan(0.9);
  });

  it("attributes every braking zone to a real corner", () => {
    expect(lap.brakingZones.length).toBeGreaterThan(4);
    for (const zone of lap.brakingZones) {
      expect(zone.cornerCode).toMatch(/^T\d{1,2}$/);
      expect(zone.minSpeedKmh).toBeLessThan(zone.entrySpeedKmh);
      expect(zone.peakG).toBeLessThan(0);
    }
  });

  it("brakes hardest for the two hairpins at the end of the long straights", () => {
    const hardest = [...lap.brakingZones].sort((a, b) => a.peakG - b.peakG)[0];
    expect(["T1", "T15"]).toContain(hardest.cornerCode);
  });

  it("splits sector times that sum back to the lap", () => {
    const total = lap.sectorTimesS.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(lap.lapTimeS, 3);
    for (const s of lap.sectorTimesS) expect(s).toBeGreaterThan(0);
  });

  it("assigns every sample to the sector its distance falls in", () => {
    const [s1, s2] = lap.sectorSplitsM;
    for (const sample of lap.samples) {
      const expected = sample.s < s1 ? 1 : sample.s < s2 ? 2 : 3;
      expect(sample.sector).toBe(expected);
    }
  });

  it("never brakes and applies throttle at the same time", () => {
    for (const sample of lap.samples) {
      expect(sample.brake > 0 && sample.throttle > 0).toBe(false);
    }
  });
});

describe("sampleAtTime", () => {
  const lap = simulateLap();

  it("wraps past the end of the lap instead of clamping", () => {
    const a = sampleAtTime(lap, 1.5);
    const b = sampleAtTime(lap, 1.5 + lap.lapTimeS);
    expect(b.s).toBeCloseTo(a.s, 3);
  });

  it("handles negative time by wrapping backwards", () => {
    const sample = sampleAtTime(lap, -1);
    expect(sample.t).toBeGreaterThan(lap.lapTimeS - 2);
    expect(Number.isFinite(sample.x)).toBe(true);
  });

  it("advances monotonically through the lap", () => {
    let prev = -1;
    for (let t = 0; t < lap.lapTimeS; t += lap.lapTimeS / 50) {
      const s = sampleAtTime(lap, t).s;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});

describe("formatLapTime", () => {
  it("pads to the conventional m:ss.mmm", () => {
    expect(formatLapTime(84.411)).toBe("1:24.411");
    expect(formatLapTime(94.08)).toBe("1:34.080");
    expect(formatLapTime(9.5)).toBe("0:09.500");
  });
});

describe("speedRamp", () => {
  const lap = simulateLap();

  it("maps the lap's own speed range onto 0-1", () => {
    expect(speedRamp(lap, lap.minSpeedKmh)).toBeCloseTo(0, 5);
    expect(speedRamp(lap, lap.topSpeedKmh)).toBeCloseTo(1, 5);
  });
});
