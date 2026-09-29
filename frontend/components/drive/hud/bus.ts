import { useEffect, useRef } from "react";
import type { FrameTelemetry } from "../engine/game";

/**
 * Per-frame HUD updates without React renders: the game publishes one
 * telemetry object per animation frame, and each HUD part subscribes and
 * writes straight into its own DOM nodes. React only renders the HUD's
 * structure, and re-renders on the rare events (a lap, a sector, a phase).
 */
export type FrameListener = (t: FrameTelemetry) => void;
export type FrameBus = { current: Set<FrameListener> };

export function useFrameBus(): FrameBus {
  return useRef(new Set<FrameListener>());
}

export function useFrame(bus: FrameBus, listener: FrameListener) {
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => {
    const fn: FrameListener = (t) => latest.current(t);
    const set = bus.current;
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }, [bus]);
}

export const SPLIT_COLOUR = { purple: "#b138dd", green: "#00d26a", yellow: "#ffd200" } as const;
