import type { PredictionResponse, Session, WhatIf } from "@/types";
import type { StandingsPayload, WeekendSchedule } from "@/types/jolpica";
import type { TelemetryDriver, TelemetryLap, TelemetryLapTrace } from "@/types/telemetry";
import type { SepangAccessPayload } from "@/types/transit";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function fetchPrediction(
  session: Session,
  whatIf: WhatIf = {},
): Promise<PredictionResponse> {
  const body: Record<string, unknown> = { session };
  if (whatIf.rainProbability !== undefined) body.rain_probability = whatIf.rainProbability;
  if (whatIf.tempC !== undefined) body.temp_c = whatIf.tempC;
  if (whatIf.safetyCar) body.safety_car = whatIf.safetyCar;
  if (whatIf.tyreChoice) body.tyre_choice = whatIf.tyreChoice;

  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Prediction request failed (${res.status})`);
  }

  return res.json() as Promise<PredictionResponse>;
}

export async function fetchTelemetryDrivers(): Promise<TelemetryDriver[]> {
  const res = await fetch(`${API_URL}/telemetry/drivers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Telemetry drivers request failed (${res.status})`);
  return res.json() as Promise<TelemetryDriver[]>;
}

export async function fetchTelemetryLaps(driverNumber: number): Promise<TelemetryLap[]> {
  const res = await fetch(
    `${API_URL}/telemetry/laps?driver_number=${driverNumber}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Telemetry laps request failed (${res.status})`);
  return res.json() as Promise<TelemetryLap[]>;
}

export async function fetchTelemetryLapTrace(
  driverNumber: number,
  lapNumber: number,
): Promise<TelemetryLapTrace> {
  const res = await fetch(
    `${API_URL}/telemetry/lap-trace?driver_number=${driverNumber}&lap_number=${lapNumber}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Telemetry lap-trace request failed (${res.status})`);
  return res.json() as Promise<TelemetryLapTrace>;
}

export async function fetchWeekendSchedule(): Promise<WeekendSchedule> {
  const res = await fetch(`${API_URL}/schedule`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Schedule request failed (${res.status})`);
  return res.json() as Promise<WeekendSchedule>;
}

export async function fetchStandings(): Promise<StandingsPayload> {
  const res = await fetch(`${API_URL}/standings`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Standings request failed (${res.status})`);
  return res.json() as Promise<StandingsPayload>;
}

export async function fetchSepangAccess(): Promise<SepangAccessPayload> {
  const res = await fetch(`${API_URL}/transit/sepang-access`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Transit access request failed (${res.status})`);
  return res.json() as Promise<SepangAccessPayload>;
}
