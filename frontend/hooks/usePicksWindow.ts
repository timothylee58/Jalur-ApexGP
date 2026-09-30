"use client";

import { useEffect, useState } from "react";
import { fetchWeekendSchedule } from "@/lib/api";
import { BAKED_WINDOW, windowFromSchedule, type PicksWindow } from "@/lib/picksWindow";

/** The live schedule's lock time, starting from the baked copy so the
 * countdown shows immediately and only shifts if Jolpica says it moved. */
export function usePicksWindow(): PicksWindow {
  const [picksWindow, setPicksWindow] = useState<PicksWindow>(BAKED_WINDOW);

  useEffect(() => {
    let cancelled = false;
    fetchWeekendSchedule()
      .then((schedule) => {
        const live = windowFromSchedule(schedule);
        if (!cancelled && live) setPicksWindow(live);
      })
      .catch(() => {
        // Keep the baked schedule; the backend still enforces the real lock.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return picksWindow;
}

/** The current time, ticking every `intervalMs`. Null on the server and on
 * the first client render, so time-dependent markup never mismatches
 * during hydration. */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
