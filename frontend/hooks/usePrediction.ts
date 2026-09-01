"use client";

import { useEffect, useState } from "react";
import { fetchPrediction } from "@/lib/api";
import type { PredictionResponse, Session } from "@/types";

interface PredictionState {
  loading: boolean;
  error: boolean;
  data: PredictionResponse | null;
}

export function usePrediction(session: Session | null) {
  const [state, setState] = useState<PredictionState>({
    loading: Boolean(session),
    error: false,
    data: null,
  });

  useEffect(() => {
    if (!session) {
      setState({ loading: false, error: false, data: null });
      return;
    }

    let isCancelled = false;
    setState({ loading: true, error: false, data: null });

    fetchPrediction(session)
      .then((data) => {
        if (!isCancelled) setState({ loading: false, error: false, data });
      })
      .catch(() => {
        if (!isCancelled) setState({ loading: false, error: true, data: null });
      });

    return () => {
      isCancelled = true;
    };
  }, [session]);

  return state;
}
