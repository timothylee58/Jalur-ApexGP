import type { PredictionResponse, Session } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
