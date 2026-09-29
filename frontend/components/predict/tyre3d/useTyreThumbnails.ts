"use client";

import { useEffect, useState } from "react";
import type { Thumbs } from "./renderThumbs";

// Rendered once per page load per size, and shared by every picker
// instance asking for that size.
const cache = new Map<number, Thumbs | null>();
const pending = new Map<number, Promise<Thumbs | null>>();

function load(size: number): Promise<Thumbs | null> {
  let job = pending.get(size);
  if (!job) {
    job = new Promise((resolve) => {
      // Off the critical path: the SVG fallback is already on screen, and
      // three.js is only fetched once the page is idle.
      const run = () =>
        import("./renderThumbs")
          .then((m) => resolve(m.renderThumbs(size)))
          .catch(() => resolve(null));
      if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 1200 });
      else setTimeout(run, 200);
    });
    pending.set(size, job);
  }
  return job;
}

/**
 * Still images of each compound, rendered from the same model and stage as
 * the live showcase — the picker gets real 3D renders without six WebGL
 * contexts. Null until ready, or permanently where WebGL is unavailable;
 * callers fall back to the SVG art.
 */
export function useTyreThumbnails(size = 176): Thumbs | null {
  const [thumbs, setThumbs] = useState<Thumbs | null>(cache.get(size) ?? null);

  useEffect(() => {
    let alive = true;
    load(size).then((result) => {
      cache.set(size, result);
      if (alive) setThumbs(result);
    });
    return () => {
      alive = false;
    };
  }, [size]);

  return thumbs;
}
