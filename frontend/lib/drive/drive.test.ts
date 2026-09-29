import { describe, expect, it } from "vitest";
import { CAR, gearFor, rpmFor, shiftLights, stepCar } from "./physics";
import {
  deltaTo,
  distanceAt,
  formatDelta,
  formatLapTime,
  remapDistance,
  sectorOf,
  splitColour,
  startLights,
  timeAtDistance,
} from "./timing";
import { buildDriveTrack } from "./track";

describe("buildDriveTrack", () => {
  const track = buildDriveTrack();

  it("measures a real Sepang lap and starts at the line", () => {
    expect(track.length).toBeGreaterThan(5480);
    expect(track.length).toBeLessThan(5600);
    expect(track.anchorS["Start/Finish"]).toBe(0);
  });

  it("finds all fifteen corners in lap order", () => {
    expect(track.corners.map((c) => c.turn)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });

  it("turns the way each corner is published to turn", () => {
    // Curvature is signed positive to the right; summed over each apex's
    // arc it must agree with the corner table's direction. This is what
    // caught the table calling T11–T13 left-right-left when the traced
    // track (and every published guide) has them right-left-right.
    const disagree = track.corners.filter((c) => {
      let sum = 0;
      for (let d = -c.lengthM / 2; d <= c.lengthM / 2; d += 2) sum += track.at(c.s + d).curvature;
      return (sum > 0 ? "right" : "left") !== c.direction;
    });
    expect(disagree.map((c) => c.turn)).toEqual([]);
  });

  it("climbs to the T3 crest", () => {
    expect(track.at(track.anchorS["T3 Apex"]).y).toBeGreaterThan(track.at(track.anchorS["T2 Apex"]).y + 10);
  });

  it("limits speed to the published apex figure and opens up on the straights", () => {
    const t15 = track.corners.find((c) => c.turn === 15)!;
    expect(track.safeKmh(t15.s)).toBe(85);
    const backStraight = track.anchorS["Back Straight Mid"];
    expect(track.safeKmh(backStraight)).toBeGreaterThan(300);
  });

  it("points to the next corner ahead, wrapping past the line", () => {
    const next = track.nextCorner(track.length - 5);
    expect(next.corner.turn).toBe(1);
    expect(next.distance).toBeGreaterThan(0);
  });
});

describe("stepCar", () => {
  const run = (seconds: number, input: { throttle: boolean; brake: boolean; boost: boolean }, v0 = 0, battery = 0.5) => {
    let state = { v: v0, battery };
    for (let t = 0; t < seconds; t += 1 / 120) state = stepCar(state, input, 1 / 120);
    return state;
  };

  it("tops out at the terminal speed the sim is tuned to", () => {
    const kmh = run(40, { throttle: true, brake: false, boost: false }).v * 3.6;
    expect(kmh).toBeGreaterThan(CAR.vMaxKmh - 4);
    expect(kmh).toBeLessThanOrEqual(CAR.vMaxKmh + 0.5);
  });

  it("does 0-200 km/h in F1 time", () => {
    let state = { v: 0, battery: 0.5 };
    let t = 0;
    while (state.v * 3.6 < 200) {
      state = stepCar(state, { throttle: true, brake: false, boost: false }, 1 / 120);
      t += 1 / 120;
    }
    expect(t).toBeGreaterThan(3.5);
    expect(t).toBeLessThan(6);
  });

  it("stops from 300 km/h in well under two seconds", () => {
    let state = { v: 300 / 3.6, battery: 0.5 };
    let t = 0;
    while (state.v > 1) {
      state = stepCar(state, { throttle: false, brake: true, boost: false }, 1 / 120);
      t += 1 / 120;
    }
    expect(t).toBeLessThan(2.2);
  });

  it("harvests under braking and spends the battery on Boost", () => {
    expect(run(1, { throttle: false, brake: true, boost: false }, 80).battery).toBeGreaterThan(0.5);
    const boosted = run(1, { throttle: true, brake: false, boost: true }, 60);
    expect(boosted.battery).toBeLessThan(0.5);
    expect(boosted.v).toBeGreaterThan(run(1, { throttle: true, brake: false, boost: false }, 60).v);
  });

  it("slows uphill", () => {
    const flat = stepCar({ v: 50, battery: 0.5 }, { throttle: false, brake: false, boost: false }, 0.1, 0);
    const hill = stepCar({ v: 50, battery: 0.5 }, { throttle: false, brake: false, boost: false }, 0.1, 0.05);
    expect(hill.v).toBeLessThan(flat.v);
  });
});

describe("gears and revs", () => {
  it("climbs through eight gears", () => {
    expect(gearFor(0)).toBe(1);
    expect(gearFor(150)).toBe(3);
    expect(gearFor(330)).toBe(8);
  });

  it("drops revs on an upshift and fills the shift lights near the limiter", () => {
    expect(rpmFor(123, 2)).toBeGreaterThan(rpmFor(126, 3));
    expect(shiftLights(rpmFor(123, 2))).toBeGreaterThan(0.9);
    expect(shiftLights(rpmFor(126, 3))).toBe(0);
  });
});

describe("race control", () => {
  it("lights one red a second, then all out after the hold", () => {
    expect(startLights(0.5, 1).lit).toBe(0);
    expect(startLights(1.2, 1).lit).toBe(1);
    expect(startLights(5.5, 1).lit).toBe(5);
    expect(startLights(5.9, 1).out).toBe(false);
    expect(startLights(6.0, 1)).toEqual({ lit: 0, out: true, outAt: 6 });
  });

  it("reads distance and time off a lap trace, and the delta between laps", () => {
    const trace = [0, 5, 15, 30, 50]; // every 0.1 s
    expect(distanceAt(trace, 0.15)).toBeCloseTo(10, 9);
    expect(timeAtDistance(trace, 40)).toBeCloseTo(0.35, 9);
    // At 0.3 s we're only 20 m in; the reference got there at 0.25 s.
    expect(deltaTo(trace, 0.3, 22.5)).toBeCloseTo(0.3 - 0.25, 9);
  });

  it("times a recorded lap by where its trace crosses the line", () => {
    // A 170 m "lap" sampled every 0.1 s, the last sample one tick past the
    // line. The line falls halfway through the last tick, so the lap took
    // 0.45 s, not the 0.5 s that counting samples implies.
    const trace = [0, 40, 80, 120, 150, 190];
    expect(timeAtDistance(trace, 170)).toBeCloseTo(0.45, 9);
    expect((trace.length - 1) * 0.1).toBeCloseTo(0.5, 9);
  });

  it("splits the lap into sectors and colours the times like F1 timing", () => {
    expect(sectorOf(100, [1500, 3500])).toBe(0);
    expect(sectorOf(2000, [1500, 3500])).toBe(1);
    expect(sectorOf(5000, [1500, 3500])).toBe(2);
    expect(splitColour(30, null, null)).toBe("purple");
    expect(splitColour(31, 30, 32)).toBe("green");
    expect(splitColour(33, 30, 32)).toBe("yellow");
  });

  it("maps a lap between two centrelines landmark by landmark", () => {
    expect(remapDistance(50, [0, 100, 200], [0, 120, 260])).toBe(60);
    expect(remapDistance(150, [0, 100, 200], [0, 120, 260])).toBe(190);
  });

  it("formats times the way the timing screens do", () => {
    expect(formatLapTime(95.4321)).toBe("1:35.432");
    expect(formatDelta(-0.2)).toBe("−0.200");
    expect(formatDelta(0.05)).toBe("+0.050");
  });
});

describe("simTrace", () => {
  it("replays the simulated lap as a forward-only trace ending at the line", async () => {
    const { simTrace } = await import("./sim");
    const track = buildDriveTrack();
    const { trace, lapTimeS } = simTrace(track);
    expect(lapTimeS).toBeGreaterThan(75);
    expect(lapTimeS).toBeLessThan(110);
    expect(trace[trace.length - 1]).toBeCloseTo(track.length, 6);
    expect(trace.every((s, i) => i === 0 || s >= trace[i - 1] - 1e-6)).toBe(true);
    // The SIM car is at its slowest where the T15 hairpin is on this track.
    const t15 = track.corners.find((c) => c.turn === 15)!;
    const at = timeAtDistance(trace, t15.s);
    const speed = (distanceAt(trace, at + 0.05) - distanceAt(trace, at - 0.05)) / 0.1;
    expect(speed * 3.6).toBeLessThan(110);
  });
});
