"use client";

import { useEffect, useState } from "react";
import type { Thumbs } from "./renderThumbs";

// Rendered once per page load and shared by every picker instance.
let cache: Thumbs | null = null;
let pending: Promise<Thumbs | null> | null = null;

/**
 * Still images of each compound, rendered from the same model and stage as
 * the live showcase — the picker gets real 3D renders without six WebGL
 * contexts. Null until ready, or permanently where WebGL is unavailable;
 * callers fall back to the SVG art.
 */
export function useTyreThumbnails(size = 176): Thumbs | null {
  const [thumbs, setThumbs] = useState<Thumbs | null>(cache);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    pending ??= new Promise((resolve) => {
      // Off the critical path: the SVG fallback is already on screen, and
      // three.js is only fetched once the page is idle.
      const run = () =>
        import("./renderThumbs")
          .then((m) => resolve(m.renderThumbs(size)))
          .catch(() => resolve(null));
      if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 1200 });
      else setTimeout(run, 200);
    });
    pending.then((result) => {
      cache = result;
      if (alive && result) setThumbs(result);
    });
    return () => {
      alive = false;
    };
  }, [size]);

  return thumbs;
}
