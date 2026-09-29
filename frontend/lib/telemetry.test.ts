import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { describeTelemetryError, isDrsActive, lapHasDrs } from "./telemetry";
import type { TelemetrySample } from "@/types/telemetry";

const sample = (drs: number | null): TelemetrySample => ({
  t: 0,
  speed: 300,
  throttle: 100,
  brake: 0,
  rpm: 11000,
  gear: 8,
  drs,
});

describe("DRS on 2026 laps", () => {
  it("treats a lap whose samples all carry null DRS as having no DRS", () => {
    expect(lapHasDrs([sample(null), sample(null)])).toBe(false);
    expect(lapHasDrs([sample(null), sample(12)])).toBe(true);
  });

  it("never reports null as open", () => {
    expect(isDrsActive(null)).toBe(false);
    expect(isDrsActive(12)).toBe(true);
  });
});

describe("describeTelemetryError", () => {
  it("passes the backend's reason through for missing data", () => {
    expect(describeTelemetryError(new ApiError("x", 404, "No timed laps found for driver 7."))).toBe(
      "No timed laps found for driver 7.",
    );
  });

  it("names rate limiting when OpenF1 is the cause", () => {
    const detail = "OpenF1 is rate limiting this app right now — try again in a minute.";
    expect(describeTelemetryError(new ApiError("x", 502, detail))).toBe(detail);
    expect(describeTelemetryError(new ApiError("x", 502, "OpenF1 returned 500"))).toMatch(/OpenF1 didn't answer/);
  });

  it("calls an unreachable or crashed backend what it is", () => {
    expect(describeTelemetryError(new ApiError("x", 0, null))).toMatch(/backend isn't responding/);
    expect(describeTelemetryError(new ApiError("x", 500, null))).toMatch(/backend isn't responding/);
    expect(describeTelemetryError(new TypeError("Failed to fetch"))).toMatch(/backend isn't responding/);
  });
});
