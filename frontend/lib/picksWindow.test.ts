import { describe, expect, it } from "vitest";
import { BAKED_WINDOW, countdown, formatLocal, formatMyt, picksPhase, windowFromSchedule } from "./picksWindow";

describe("picks window", () => {
  it("locks at the start of qualifying, from the baked schedule", () => {
    expect(BAKED_WINDOW.lockAt.toISOString()).toBe("2026-10-03T08:00:00.000Z");
    expect(BAKED_WINDOW.raceName).toBe("Bahrain Grand Prix in Malaysia");
    expect(BAKED_WINDOW.live).toBe(false);
  });

  it("reads the live schedule, and rejects one missing a session", () => {
    const live = windowFromSchedule({
      season: "2026",
      round: "16",
      raceName: "Bahrain Grand Prix in Malaysia",
      circuitId: "sepang",
      circuitName: "Sepang International Circuit",
      source: "jolpica",
      sessions: [
        { session: "Quali", start: "2026-10-03T17:00:00+08:00", end: "2026-10-03T18:00:00+08:00" },
        { session: "Race", start: "2026-10-04T15:00:00+08:00", end: "2026-10-04T17:00:00+08:00" },
      ],
    });
    expect(live?.live).toBe(true);
    expect(live?.lockAt.toISOString()).toBe("2026-10-03T09:00:00.000Z");
    expect(
      windowFromSchedule({
        season: "2026",
        round: "16",
        raceName: "x",
        circuitId: "sepang",
        circuitName: "x",
        source: "jolpica",
        sessions: [],
      }),
    ).toBeNull();
  });

  it("moves through open, locked, racing and awaiting-result", () => {
    const at = (iso: string) => picksPhase(BAKED_WINDOW, new Date(iso));
    expect(at("2026-09-30T10:00:00+08:00")).toBe("open");
    expect(at("2026-10-03T15:59:59+08:00")).toBe("open");
    expect(at("2026-10-03T16:00:00+08:00")).toBe("locked");
    expect(at("2026-10-04T15:30:00+08:00")).toBe("racing");
    expect(at("2026-10-04T17:00:00+08:00")).toBe("awaiting-result");
  });

  it("counts down in whole days, hours, minutes and seconds, never below zero", () => {
    const lock = BAKED_WINDOW.lockAt;
    expect(countdown(new Date("2026-09-30T09:14:55+08:00"), lock)).toEqual({
      days: 3,
      hours: 6,
      minutes: 45,
      seconds: 5,
    });
    expect(countdown(new Date("2026-10-05T00:00:00+08:00"), lock)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it("formats on Sepang's clock, and the viewer's only when it differs", () => {
    expect(formatMyt(BAKED_WINDOW.lockAt)).toBe("Sat 3 Oct, 16:00 MYT");
    expect(formatLocal(BAKED_WINDOW.lockAt, "Asia/Singapore")).toBeNull();
    expect(formatLocal(BAKED_WINDOW.lockAt, "Europe/London")).toBe("Sat 09:00 BST");
  });
});
