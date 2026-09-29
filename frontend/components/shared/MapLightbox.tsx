"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FIT, fittedContent, panBy, zoomAt, type View } from "@/lib/panZoom";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Accessible name, and the small label in the corner. */
  title: string;
  children: ReactNode;
  /** Optional strip along the bottom, e.g. details of what's selected. */
  footer?: ReactNode;
  /** The map's width / height, so panning stops at its edges rather than
   * the screen's when it's letterboxed (a wide map on a tall phone). */
  contentAspect?: number;
}

const STEP = 1.5;

/**
 * A map, as big as the screen allows: a viewport-filling dialog with
 * zoom (buttons, wheel/trackpad, pinch, +/−/0 keys) and pan (drag, arrow
 * keys), plus the browser's real full-screen mode where it exists. The
 * map inside stays fully interactive — a press only turns into a pan once
 * it has moved a few pixels, so taps and clicks on the map still land.
 */
export function MapLightbox({ open, onClose, title, children, footer, contentAspect }: Props) {
  const reduce = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(FIT);
  const [smooth, setSmooth] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    pinch: number | null;
  }>({
    startX: 0,
    startY: 0,
    moved: false,
    pinch: null,
  });
  const suppressClick = useRef(false);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setMounted(true);
    setCanFullscreen(Boolean(document.fullscreenEnabled));
    const onChange = () =>
      setIsFullscreen(document.fullscreenElement === dialogRef.current && dialogRef.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const size = useCallback(() => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const w = rect?.width || 1;
    const h = rect?.height || 1;
    return {
      w,
      h,
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
      content: contentAspect ? fittedContent(w, h, contentAspect) : undefined,
    };
  }, [contentAspect]);

  const zoomBy = useCallback(
    (factor: number, animate = true) => {
      const frame = size();
      setSmooth(animate);
      setView((v) => zoomAt(v, factor, frame.w / 2, frame.h / 2, frame));
    },
    [size],
  );

  const reset = useCallback(() => {
    setSmooth(true);
    setView(FIT);
  }, []);

  const close = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    onClose();
  }, [onClose]);

  // While open: lock page scroll, close on Escape, hand focus back to
  // whatever opened the viewer when it closes, and start from "fit".
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    setView(FIT);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => viewportRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open, close]);

  // Wheel and trackpad pinch zoom toward the cursor. Registered by hand:
  // React's onWheel is passive, and the page mustn't scroll underneath.
  useEffect(() => {
    const el = viewportRef.current;
    if (!open || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const frame = size();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setSmooth(false);
      setView((v) => zoomAt(v, factor, e.clientX - frame.left, e.clientY - frame.top, frame));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, mounted, size]);

  // Resizing (rotating a phone, entering full screen) re-fits the map.
  useEffect(() => {
    if (!open) return;
    const onResize = () => setView(FIT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        pinch: null,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const frame = size();
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.pinch) {
        const midX = (a.x + b.x) / 2 - frame.left;
        const midY = (a.y + b.y) / 2 - frame.top;
        setSmooth(false);
        setView((v) => zoomAt(v, distance / (g.pinch as number), midX, midY, frame));
      }
      g.pinch = distance;
      g.moved = true;
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > 5) {
      g.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (g.moved) {
      setSmooth(false);
      setView((v) => panBy(v, e.clientX - previous.x, e.clientY - previous.y, frame));
    }
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
    if (pointers.current.size > 0 || e.type === "pointercancel") return;
    if (gesture.current.moved) {
      suppressClick.current = true;
      lastTap.current = null;
      return;
    }
    // Double-tap (or double-click) zooms in toward that spot; at full
    // zoom it fits the map back to the screen.
    const now = e.timeStamp;
    const tap = lastTap.current;
    if (tap && now - tap.time < 320 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 30) {
      lastTap.current = null;
      const frame = size();
      setSmooth(true);
      setView((v) => (v.k >= 5.9 ? FIT : zoomAt(v, 2, e.clientX - frame.left, e.clientY - frame.top, frame)));
      return;
    }
    lastTap.current = { time: now, x: e.clientX, y: e.clientY };
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const frame = size();
    const pan = 80;
    const actions: Record<string, () => void> = {
      "+": () => zoomBy(STEP),
      "=": () => zoomBy(STEP),
      "-": () => zoomBy(1 / STEP),
      "0": reset,
      ArrowLeft: () => setView((v) => panBy(v, pan, 0, frame)),
      ArrowRight: () => setView((v) => panBy(v, -pan, 0, frame)),
      ArrowUp: () => setView((v) => panBy(v, 0, pan, frame)),
      ArrowDown: () => setView((v) => panBy(v, 0, -pan, frame)),
    };
    const action = actions[e.key];
    if (action && e.target === e.currentTarget) {
      e.preventDefault();
      setSmooth(true);
      action();
    }
  };

  // Keep Tab inside the dialog while it's open.
  const trapFocus = (e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void dialogRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  if (!mounted) return null;

  const control =
    "flex h-9 min-w-9 items-center justify-center rounded-full border border-paper/15 bg-asphalt/90 px-2 text-paper-dim backdrop-blur transition-colors hover:border-amber hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-40 disabled:hover:border-paper/15 disabled:hover:text-paper-dim";

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onKeyDown={trapFocus}
          className="fixed inset-0 z-[60] flex flex-col bg-pit-carbon"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          <div className="flex items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim sm:block">{title}</p>
            <div className="ml-auto flex items-center gap-1.5" role="toolbar" aria-label="Map view">
              <button
                type="button"
                className={control}
                onClick={() => zoomBy(1 / STEP)}
                disabled={view.k <= 1}
                aria-label="Zoom out"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path d="M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
              <span className="w-12 text-center font-mono text-[11px] tabular-nums text-paper-dim" aria-live="polite">
                {Math.round(view.k * 100)}%
              </span>
              <button
                type="button"
                className={control}
                onClick={() => zoomBy(STEP)}
                disabled={view.k >= 6}
                aria-label="Zoom in"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path d="M5 12h14M12 5v14" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                className={`${control} px-3 font-mono text-[10px] uppercase tracking-[0.15em]`}
                onClick={reset}
                disabled={view.k === 1}
              >
                Fit
              </button>
              {canFullscreen ? (
                <button
                  type="button"
                  className={control}
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? "Leave full screen" : "Enter full screen"}
                  aria-pressed={isFullscreen}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    {isFullscreen ? (
                      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" strokeLinecap="round" strokeLinejoin="round" />
                    ) : (
                      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </svg>
                </button>
              ) : null}
              <button type="button" className={`${control} ml-1.5`} onClick={close} aria-label="Close full-screen map">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <motion.div
            className="relative mx-[max(1rem,env(safe-area-inset-left))] min-h-0 flex-1 overflow-hidden rounded-xl border border-paper/10 bg-[#14181c]"
            initial={{ scale: reduce ? 1 : 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: reduce ? 1 : 0.97, opacity: 0 }}
            transition={{
              duration: reduce ? 0 : 0.28,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          >
            <div
              ref={viewportRef}
              tabIndex={0}
              aria-label="Map — plus and minus keys zoom, arrow keys pan, 0 fits it back to the screen"
              className={`h-full w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber ${
                view.k > 1 ? "cursor-grab active:cursor-grabbing" : ""
              }`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              onClickCapture={(e) => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
              onKeyDown={onKeyDown}
            >
              <div
                className="flex h-full w-full items-center justify-center [&>svg]:max-h-full [&>svg]:w-full"
                style={{
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                  transformOrigin: "0 0",
                  transition: smooth && !reduce ? "transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)" : "none",
                }}
              >
                {children}
              </div>
            </div>
            {/* A wide map on a phone held upright is mostly letterbox; the hint
                goes once the map is zoomed. */}
            {contentAspect && contentAspect > 1 && view.k === 1 ? (
              <p className="pointer-events-none absolute inset-x-0 bottom-4 hidden justify-center portrait:max-sm:flex">
                <span className="flex items-center gap-2 rounded-full border border-paper/10 bg-asphalt/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-paper-dim">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <rect x="7" y="3" width="10" height="18" rx="2" />
                    <path d="M21 14a8 8 0 0 1-6 7.7M19 21.5l-4-.8.8-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Rotate phone · double-tap to zoom
                </span>
              </p>
            ) : null}
          </motion.div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-[max(1rem,env(safe-area-inset-left))] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0 flex-1">{footer}</div>
            <p className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim/70 sm:block">
              Scroll, pinch or double-click to zoom · drag to pan · Esc to close
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
