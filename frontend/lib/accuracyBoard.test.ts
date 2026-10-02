import { describe, expect, it } from "vitest";
import { durationLabel, sessionWindowLabel, sourceLabel, weekendSummary } from "@/lib/accuracyBoard";
import type { SessionBoard, VariantScore, WeekendBoard } from "@/types";

const score = (variant: VariantScore["variant"], compositeScore: number, rainCallScore = compositeScore): VariantScore => ({
  variant,
  predictedConfidence: 70,
  rainCallScore,
  pitWindowHit: null,
  compositeScore,
  date: "2026-10-02",
});

const session = (over: Partial<SessionBoard>): SessionBoard => ({
  session: "FP1",
  start: "2026-10-02T12:30:00+08:00",
  end: "2026-10-02T13:30:00+08:00",
  state: "upcoming",
  prediction: null,
  outcome: null,
  scores: [],
  ...over,
});

const board = (sessions: SessionBoard[]): WeekendBoard => ({
  season: "2026",
  round: "16",
  raceName: "Bahrain Grand Prix in Malaysia",
  generatedAt: "2026-10-02T10:00:00Z",
  sessions,
  nextCheckSeconds: 300,
});

describe("weekendSummary", () => {
  it("averages each variant over scored sessions only", () => {
    const summary = weekendSummary(
      board([
        session({ state: "scored", scores: [score("conservative", 80), score("aggressive", 60)] }),
        session({ session: "FP2", state: "scored", scores: [score("conservative", 90), score("aggressive", 40)] }),
        session({ session: "FP3", state: "awaiting" }),
      ]),
    );
    expect(summary.scored).toBe(2);
    expect(summary.variants).toEqual([
      { variant: "conservative", mean: 85, rainMean: 85 },
      { variant: "aggressive", mean: 50, rainMean: 50 },
    ]);
  });

  it("has no mean before anything is scored", () => {
    expect(weekendSummary(board([session({})])).variants[0].mean).toBeNull();
  });
});

describe("labels", () => {
  it("formats a session window on Sepang's clock from any viewer zone", () => {
    expect(sessionWindowLabel(session({}))).toBe("Fri 2 Oct · 12:30–13:30 MYT");
  });

  it("names data sources plainly", () => {
    expect(sourceLabel("openf1-track-weather")).toMatch(/weather station/);
    expect(sourceLabel(null)).toBe("—");
  });

  it("scales durations", () => {
    expect(durationLabel(45_000)).toBe("45s");
    expect(durationLabel(8 * 60_000)).toBe("8m");
    expect(durationLabel((3 * 60 + 12) * 60_000)).toBe("3h 12m");
    expect(durationLabel(44 * 3_600_000)).toBe("1d 20h");
    expect(durationLabel(50 * 3_600_000)).toBe("2d 2h");
  });
});
