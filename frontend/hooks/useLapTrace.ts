"use client";

import { useEffect, useState } from "react";
import { fetchTelemetryLapTrace } from "@/lib/api";
import { describeTelemetryError } from "@/lib/telemetry";
import type { TelemetryLapTrace } from "@/types/telemetry";

/** One lap's trace, fetched and nothing else — for the comparison lap, which
 * rides the primary lap's playback clock rather than keeping its own. */
export function useLapTrace(driverNumber: number | null, lapNumber: number | null) {
  const [state, setState] = useState<{ trace: TelemetryLapTrace | null; loading: boolean; error: string | null }>({
    trace: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (driverNumber == null || lapNumber == null) {
      setState({ trace: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ trace: null, loading: true, error: null });
    fetchTelemetryLapTrace(driverNumber, lapNumber)
      .then((trace) => !cancelled && setState({ trace, loading: false, error: null }))
      .catch((err: unknown) => !cancelled && setState({ trace: null, loading: false, error: describeTelemetryError(err) }));
    return () => {
      cancelled = true;
    };
  }, [driverNumber, lapNumber]);

  return state;
}
