/**
 * Shapes returned by the backend's /api/telemetry/* routes, which proxy
 * OpenF1 (openf1.org) — real recorded F1 telemetry, not this app's own
 * fictional Sepang weekend. See backend/app/services/telemetry_service.py
 * for the source session and the sourcing/verification notes.
 */

export interface TelemetryDriver {
  driverNumber: number;
  fullName: string;
  nameAcronym: string;
  teamName: string;
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
  brake: number;
  rpm: number;
  gear: number;
  /** OpenF1's raw DRS status code (0/1 off, 8 detected-eligible, 10/12/14 active variants). */
  drs: number;
}

export interface TelemetryLapTrace {
  year: number;
  sessionName: string;
  circuitShortName: string;
  driver: TelemetryDriver;
  lapNumber: number;
  lapDuration: number;
  samples: TelemetrySample[];
}
