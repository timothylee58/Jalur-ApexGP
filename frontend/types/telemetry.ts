/**
 * Shapes returned by the backend's /api/telemetry/* routes: real recorded
 * F1 telemetry, not this app's own fictional Sepang weekend. OpenF1
 * (openf1.org) answers first; when it can't — its free tier caps requests —
 * the same timing data is served from TracingInsights' published files
 * (github.com/TracingInsights). See backend/app/services/telemetry_pipeline.py.
 */

export type TelemetrySource = "openf1" | "tracinginsights";

export interface TelemetryDriver {
  driverNumber: number;
  fullName: string;
  nameAcronym: string;
  teamName: string;
  /** Hex without "#", e.g. "F47600". */
  teamColour?: string | null;
}

export interface TelemetryLap {
  lapNumber: number;
  lapDuration: number;
}

export interface TelemetrySample {
  /** Seconds since this lap's own start — not a wall-clock timestamp. */
  t: number;
  speed: number;
  throttle: number;
  /** 0–100. */
  brake: number;
  rpm: number;
  gear: number;
  /** OpenF1's raw DRS status code (0/1 off, 8 detected-eligible, 10/12/14
   * active variants), or null when the car has no DRS — every 2026 sample,
   * since the 2026 rules replaced it with Overtake Mode. */
  drs: number | null;
  /** Metres from the start line, when known. */
  distance?: number | null;
  /** Track position in the timing feed's own frame, when known. */
  x?: number | null;
  y?: number | null;
}

export interface TelemetryCorner {
  number: number;
  /** Metres from the start line on the reference lap. */
  distance: number;
}

export interface TelemetryLapTrace {
  year: number;
  sessionName: string;
  circuitShortName: string;
  driver: TelemetryDriver;
  lapNumber: number;
  lapDuration: number;
  samples: TelemetrySample[];
  source?: TelemetrySource;
  /** Why the fallback source answered, when it did. */
  fallbackReason?: string | null;
  corners?: TelemetryCorner[];
}

export interface SessionLap {
  driver: string;
  lap: number;
  time: number | null;
  compound: string | null;
  stint: number | null;
  position: number | null;
  pitIn: boolean;
  pitOut: boolean;
  /** Track status codes during the lap: "4" SC, "5" red flag, "6"/"7" VSC. */
  status: string | null;
}

export interface SessionOverviewDriver {
  code: string;
  driverNumber: number;
  fullName: string;
  teamName: string;
  teamColour: string | null;
}

export interface SessionOverview {
  year: number;
  sessionName: string;
  circuitShortName: string;
  eventName: string;
  source: TelemetrySource;
  drivers: SessionOverviewDriver[];
  laps: SessionLap[];
}
