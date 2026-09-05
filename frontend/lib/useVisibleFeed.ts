/**
 * Visibility-aware feed fetch with localStorage cache.
 * Refreshes on an interval only while the document is visible, keeps the
 * last good payload on failure, and aborts in-flight requests on teardown.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VisibleFeedState<T> {
  data: T | null;
  loading: boolean;
  error: string;
  retrieved: string | null;
  refresh: () => void;
}

interface CachedEnvelope<T> {
  raw: T;
  retrieved: string;
}

export function useVisibleFeed<T>(
  key: string,
  url: string,
  normalize: (raw: unknown) => T,
  intervalMs = 300_000,
): VisibleFeedState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrieved, setRetrieved] = useState<string | null>(null);

  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const normalizeRef = useRef(normalize);
  normalizeRef.current = normalize;

  const storageKey = `jalur:feed:${key}`;

  const refresh = useCallback(async () => {
    if (busy.current) return;
    const run = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    busy.current = true;
    setLoading(true);
    setError("");

    const timer = window.setTimeout(() => abort.abort(), 30_000);
    try {
      const response = await fetch(url, {
        signal: abort.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Source is busy. Try again shortly."
            : `Source unavailable (HTTP ${response.status}).`,
        );
      }
      const raw: unknown = await response.json();
      const rows = normalizeRef.current(raw);
      const at = new Date().toISOString();
      if (run !== generation.current) return;
      setData(rows);
      setRetrieved(at);
      setLoading(false);
      setError("");
      try {
        const envelope: CachedEnvelope<T> = { raw: rows, retrieved: at };
        localStorage.setItem(storageKey, JSON.stringify(envelope));
      } catch {
        /* cache is optional */
      }
    } catch (err) {
      if (run !== generation.current) return;
      const message =
        err instanceof Error
          ? err.name === "AbortError"
            ? "Update timed out. Try refreshing."
            : err.message
          : "Update failed.";
      setLoading(false);
      setError(message);
    } finally {
      window.clearTimeout(timer);
      if (run === generation.current) busy.current = false;
    }
  }, [url, storageKey]);

  useEffect(() => {
    generation.current += 1;
    busy.current = false;

    try {
      const cached = JSON.parse(localStorage.getItem(storageKey) ?? "") as CachedEnvelope<T>;
      if (cached?.retrieved && cached.raw != null) {
        setData(cached.raw);
        setRetrieved(cached.retrieved);
      }
    } catch {
      /* ignore stale cache */
    }

    void refresh();

    const tick = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, intervalMs);

    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      generation.current += 1;
      controller.current?.abort();
      busy.current = false;
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, intervalMs, storageKey]);

  return { data, loading, error, retrieved, refresh };
}
