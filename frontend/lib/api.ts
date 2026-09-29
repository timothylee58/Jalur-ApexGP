import type {
  AccuracyResponse,
  OutcomeLogged,
  OutcomeRequest,
  PredictionResponse,
  Session,
  WhatIf,
} from "@/types";
import type { StandingsPayload, WeekendSchedule } from "@/types/jolpica";
import type {
  LeaderboardResponse,
  MyPickResponse,
  PickSubmission,
  PickSubmitted,
} from "@/types/picks";
import type { TelemetryDriver, TelemetryLap, TelemetryLapTrace } from "@/types/telemetry";
import type { SepangAccessPayload } from "@/types/transit";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

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

/** A failed backend call that keeps what the UI needs to explain it: the
 * HTTP status (0 when the request never got a response — which is also
 * what a crashed function looks like from the browser, since its error
 * page carries no CORS headers) and FastAPI's `detail`, if any. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly detail: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Telemetry for a finished session is immutable and the backend marks it
// cacheable (see routes/telemetry.py). The default cache mode lets that
// work; "no-store" would send Cache-Control: no-cache on every request and
// push every page view through to OpenF1's rate-limited free tier.
async function telemetryGet<T>(path: string, what: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`);
  } catch {
    throw new ApiError(`${what} request failed (no response)`, 0, null);
  }
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Not JSON (e.g. a platform error page) — the status says enough.
    }
    throw new ApiError(`${what} request failed (${res.status})`, res.status, detail);
  }
  return res.json() as Promise<T>;
}

export function fetchTelemetryDrivers(): Promise<TelemetryDriver[]> {
  return telemetryGet("/telemetry/drivers", "Telemetry drivers");
}

export function fetchTelemetryLaps(driverNumber: number): Promise<TelemetryLap[]> {
  return telemetryGet(`/telemetry/laps?driver_number=${driverNumber}`, "Telemetry laps");
}

export function fetchTelemetryLapTrace(driverNumber: number, lapNumber: number): Promise<TelemetryLapTrace> {
  return telemetryGet(
    `/telemetry/lap-trace?driver_number=${driverNumber}&lap_number=${lapNumber}`,
    "Telemetry lap-trace",
  );
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

export async function submitOutcome(outcome: OutcomeRequest): Promise<OutcomeLogged> {
  const res = await fetch(`${API_URL}/outcomes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(outcome),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Outcome log failed (${res.status})`);
  return res.json() as Promise<OutcomeLogged>;
}

export async function fetchAccuracy(session: Session): Promise<AccuracyResponse | null> {
  const res = await fetch(`${API_URL}/accuracy?session=${session}`, { cache: "no-store" });
  if (res.status === 404) {
    // Not an error state — just means nothing has been scored yet for this
    // session (no outcome logged against a same-day prediction).
    return null;
  }
  if (!res.ok) throw new Error(`Accuracy request failed (${res.status})`);
  return res.json() as Promise<AccuracyResponse>;
}

/** Thrown on a 409 — the picks deadline has passed. Distinct from a plain
 * Error so the form can show "picks are closed" instead of a generic
 * "something went wrong". */
export class PicksClosedError extends Error {}

/** Thrown on a 503 — picks storage isn't configured server-side yet (a
 * deploy/setup gap, not a network blip). Distinct from a plain Error so
 * the form doesn't tell a fan to "check your connection" for something
 * that isn't their connection's fault. */
export class PicksUnavailableError extends Error {}

export async function submitPicks(submission: PickSubmission): Promise<PickSubmitted> {
  const res = await fetch(`${API_URL}/picks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
    cache: "no-store",
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({ detail: "Picks are closed." }));
    throw new PicksClosedError(body.detail ?? "Picks are closed.");
  }
  if (res.status === 503) {
    throw new PicksUnavailableError("Picks aren't open yet — check back soon.");
  }
  if (!res.ok) throw new Error(`Picks submission failed (${res.status})`);
  return res.json() as Promise<PickSubmitted>;
}

export async function fetchLeaderboard(viewerId?: string | null): Promise<LeaderboardResponse> {
  const query = viewerId ? `?id=${encodeURIComponent(viewerId)}` : "";
  const res = await fetch(`${API_URL}/picks/leaderboard${query}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Leaderboard request failed (${res.status})`);
  return res.json() as Promise<LeaderboardResponse>;
}

export async function fetchMyPick(entryId: string): Promise<MyPickResponse | null> {
  const res = await fetch(`${API_URL}/picks/me?id=${encodeURIComponent(entryId)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`My picks request failed (${res.status})`);
  return res.json() as Promise<MyPickResponse>;
}
