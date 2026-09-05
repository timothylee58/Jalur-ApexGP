import type {
  AccuracyResponse,
  OutcomeLogged,
  OutcomeRequest,
  PredictionResponse,
  Session,
} from "@/types";

// Matches .env.example: the backend mounts every route under /api, baked
// into the FastAPI app itself (not deploy-specific), so the fallback here
// needs the same suffix a real .env value would carry.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export async function fetchPrediction(session: Session): Promise<PredictionResponse> {
  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Prediction request failed (${res.status})`);
  }

  return res.json() as Promise<PredictionResponse>;
}

export async function submitOutcome(outcome: OutcomeRequest): Promise<OutcomeLogged> {
  const res = await fetch(`${API_URL}/outcomes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(outcome),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Outcome log failed (${res.status})`);
  }

  return res.json() as Promise<OutcomeLogged>;
}

export async function fetchAccuracy(session: Session): Promise<AccuracyResponse | null> {
  const res = await fetch(`${API_URL}/accuracy?session=${session}`, { cache: "no-store" });

  if (res.status === 404) {
    // Not an error state — just means nothing has been scored yet for this
    // session (no outcome logged against a same-day prediction).
    return null;
  }
  if (!res.ok) {
    throw new Error(`Accuracy request failed (${res.status})`);
  }

  return res.json() as Promise<AccuracyResponse>;
}
