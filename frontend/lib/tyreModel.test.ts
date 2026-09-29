import { describe, expect, it } from "vitest";
import { adjustedLife, tyreFit } from "./tyreModel";

describe("adjustedLife", () => {
  it("returns base life at the nominal temperature", () => {
    expect(adjustedLife("Soft", 31)).toBe(16);
    expect(adjustedLife("Hard", 31)).toBe(38);
  });

  it("shortens life as the track heats, capped at 72%", () => {
    expect(adjustedLife("Medium", 41)).toBe(Math.round(26 * (1 - 0.11)));
    expect(adjustedLife("Medium", 80)).toBe(Math.round(26 * 0.72));
  });

  it("extends life on a cool track, capped at 118%", () => {
    expect(adjustedLife("Hard", 0)).toBe(Math.round(38 * 1.18));
  });
});

describe("tyreFit", () => {
  it("flags slicks in heavy rain and wets on a dry track", () => {
    expect(tyreFit("Soft", 70)).toBe("wrong");
    expect(tyreFit("Wet", 10)).toBe("wrong");
    expect(tyreFit("Intermediate", 10)).toBe("wrong");
  });

  it("treats the damp band like the engine does", () => {
    expect(tyreFit("Medium", 40)).toBe("good");
    expect(tyreFit("Soft", 40)).toBe("marginal");
    expect(tyreFit("Wet", 40)).toBe("wrong");
    expect(tyreFit("Intermediate", 40)).toBe("good");
  });

  it("prefers full wets over inters in heavy rain", () => {
    expect(tyreFit("Wet", 80)).toBe("good");
    expect(tyreFit("Intermediate", 80)).toBe("marginal");
  });
});
