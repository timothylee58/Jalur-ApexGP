"use client";

import { useEffect, useState } from "react";
import { fetchPrediction } from "@/lib/api";
import type { PredictionResponse, Session, WhatIf } from "@/types";

interface PredictionState {
  loading: boolean;
  error: boolean;
  data: PredictionResponse | null;
}

export function usePrediction(session: Session | null, whatIf: WhatIf = {}) {
  const [state, setState] = useState<PredictionState>({
    loading: Boolean(session),
    error: false,
    data: null,
  });

  // Serialize the what-if inputs so the effect only re-fires when a value
  // actually changes, not on every render's fresh object identity.
  const whatIfKey = JSON.stringify({
    r: whatIf.rainProbability ?? null,
    t: whatIf.tempC ?? null,
    sc: whatIf.safetyCar ?? false,
    ty: whatIf.tyreChoice ?? null,
  });

  useEffect(() => {
    if (!session) {
      setState({ loading: false, error: false, data: null });
      return;
    }

    let isCancelled = false;
    setState((prev) => ({ loading: true, error: false, data: prev.data }));

    fetchPrediction(session, whatIf)
      .then((data) => {
        if (!isCancelled) setState({ loading: false, error: false, data });
      })
      .catch(() => {
        if (!isCancelled) setState({ loading: false, error: true, data: null });
      });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, whatIfKey]);

  return state;
}
