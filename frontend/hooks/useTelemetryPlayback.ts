"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTelemetryLapTrace } from "@/lib/api";
import { buildDistanceProgress } from "@/lib/telemetry";
import type { TelemetryLapTrace } from "@/types/telemetry";

interface TelemetryPlaybackState {
  loading: boolean;
  error: boolean;
  trace: TelemetryLapTrace | null;
  /** Same length/order as trace.samples — see buildDistanceProgress. */
  distanceProgress: number[];
  currentTime: number;
  playing: boolean;
}

const initialState: TelemetryPlaybackState = {
  loading: false,
  error: false,
  trace: null,
  distanceProgress: [],
  currentTime: 0,
  playing: false,
};

/** Fetches one lap's telemetry and drives a play/pause/seek clock over it.
 * `driverNumber`/`lapNumber` null means "nothing selected yet" — distinct
 * from a fetch in flight or a fetch that failed. */
interface UseTelemetryPlaybackOptions {
  /** Wrap back to the start and keep playing instead of stopping at the
   * end of the lap — for an ambient/decorative use (pacing /circuit's car)
   * rather than the dedicated /telemetry page, where stopping at the end
   * is the more useful default for actually studying a lap. */
  loop?: boolean;
}

export function useTelemetryPlayback(
  driverNumber: number | null,
  lapNumber: number | null,
  options: UseTelemetryPlaybackOptions = {},
) {
  const { loop = false } = options;
  const [state, setState] = useState<TelemetryPlaybackState>(initialState);
  const frameRef = useRef<number | null>(null);
  const lastFrameMsRef = useRef(0);

  useEffect(() => {
    if (driverNumber == null || lapNumber == null) {
      setState(initialState);
      return;
    }

    let cancelled = false;
    setState({ ...initialState, loading: true });

    fetchTelemetryLapTrace(driverNumber, lapNumber)
      .then((trace) => {
        if (cancelled) return;
        setState({
          loading: false,
          error: false,
          trace,
          distanceProgress: buildDistanceProgress(trace.samples),
          currentTime: 0,
          playing: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ ...initialState, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [driverNumber, lapNumber]);

  useEffect(() => {
    if (!state.playing || !state.trace) return;

    lastFrameMsRef.current = performance.now();
    const tick = (nowMs: number) => {
      const dt = (nowMs - lastFrameMsRef.current) / 1000;
      lastFrameMsRef.current = nowMs;
      setState((prev) => {
        if (!prev.trace || !prev.playing) return prev;
        const next = prev.currentTime + dt;
        if (next >= prev.trace.lapDuration) {
          return loop
            ? { ...prev, currentTime: next % prev.trace.lapDuration }
            : { ...prev, currentTime: prev.trace.lapDuration, playing: false };
        }
        return { ...prev, currentTime: next };
      });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.trace's
    // identity is stable for the lap's lifetime; re-running this effect on
    // every currentTime tick (were it in the dep array) would restart the
    // rAF loop instead of letting it run continuously.
  }, [state.playing, state.trace, loop]);

  const play = useCallback(() => {
    setState((prev) => {
      if (!prev.trace) return prev;
      const atEnd = prev.currentTime >= prev.trace.lapDuration;
      return { ...prev, playing: true, currentTime: atEnd ? 0 : prev.currentTime };
    });
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, playing: false }));
  }, []);

  const seek = useCallback((t: number) => {
    setState((prev) => {
      if (!prev.trace) return prev;
      return { ...prev, currentTime: Math.max(0, Math.min(t, prev.trace.lapDuration)) };
    });
  }, []);

  return { ...state, play, pause, seek };
}
