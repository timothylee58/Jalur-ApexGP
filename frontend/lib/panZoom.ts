/**
 * Pan/zoom maths for the full-screen map viewer: a view is a scale `k`
 * plus a translation, applied as `translate(x, y) scale(k)` from the
 * top-left corner of a `w`×`h` viewport. Views are clamped against the
 * map itself — its letterboxed box inside the viewport — so it can't be
 * zoomed out past "fit" or dragged off into empty space, and a map
 * narrower than the screen stays centred. Pure functions, tested in
 * panZoom.test.ts.
 */

export interface View {
  k: number;
  x: number;
  y: number;
}

/** A w×h viewport and, at zoom 1, where the map sits inside it. */
export interface Frame {
  w: number;
  h: number;
  content?: { x: number; y: number; w: number; h: number };
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 6;
export const FIT: View = { k: 1, x: 0, y: 0 };

/** The box a map of aspect ratio `aspect` (width / height) fills when
 * fitted, centred, inside a w×h viewport. */
export function fittedContent(w: number, h: number, aspect: number) {
  const cw = Math.min(w, h * aspect);
  const ch = cw / aspect;
  return { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
}

function clampAxis(t: number, k: number, size: number, start: number, extent: number): number {
  const scaled = extent * k;
  // Smaller than the screen on this axis: keep it centred.
  if (scaled <= size) return (size - scaled) / 2 - start * k;
  return Math.min(0 - start * k, Math.max(size - (start + extent) * k, t));
}

export function clampView(view: View, frame: Frame): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k));
  if (k === MIN_ZOOM) return FIT;
  const c = frame.content ?? { x: 0, y: 0, w: frame.w, h: frame.h };
  return {
    k,
    x: clampAxis(view.x, k, frame.w, c.x, c.w),
    y: clampAxis(view.y, k, frame.h, c.y, c.h),
  };
}

/** Zoom by `factor` about the viewport point (px, py): whatever sits under
 * that point stays under it, the way map apps zoom toward the cursor. */
export function zoomAt(view: View, factor: number, px: number, py: number, frame: Frame): View {
  const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.k * factor));
  const r = k / view.k;
  return clampView({ k, x: px - (px - view.x) * r, y: py - (py - view.y) * r }, frame);
}

export function panBy(view: View, dx: number, dy: number, frame: Frame): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, frame);
}
