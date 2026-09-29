import { describe, expect, it } from "vitest";
import { easeIn, easeOut, keyframes, linear, stepAt, windowed } from "./demoTimeline";

describe("keyframes", () => {
  it("interpolates between keys and holds outside them", () => {
    expect(keyframes(-1, [0, 2, 4], [10, 20, 0])).toBe(10);
    expect(keyframes(1, [0, 2, 4], [10, 20, 0])).toBe(15);
    expect(keyframes(3, [0, 2, 4], [10, 20, 0])).toBe(10);
    expect(keyframes(9, [0, 2, 4], [10, 20, 0])).toBe(0);
  });

  it("shapes each segment with its own easing", () => {
    // Halfway through an ease-in segment is a quarter of the way there.
    expect(keyframes(1, [0, 2, 4], [0, 100, 200], [easeIn, linear])).toBe(25);
    expect(keyframes(3, [0, 2, 4], [0, 100, 200], [easeIn, linear])).toBe(150);
    expect(keyframes(1, [0, 2], [0, 100], easeOut)).toBe(75);
  });
});

describe("stepAt", () => {
  it("picks the step whose start has most recently passed", () => {
    expect(stepAt(0, [0, 3, 4.6])).toBe(0);
    expect(stepAt(3, [0, 3, 4.6])).toBe(1);
    expect(stepAt(8.9, [0, 3, 4.6])).toBe(2);
  });
});

describe("windowed", () => {
  it("is fully visible inside the window and fades at its edges", () => {
    expect(windowed(2, 1, 3)).toBe(1);
    expect(windowed(0.5, 1, 3)).toBe(0);
    expect(windowed(0.875, 1, 3, 0.25)).toBeCloseTo(0.5, 9);
    expect(windowed(3.125, 1, 3, 0.25)).toBeCloseTo(0.5, 9);
  });
});
