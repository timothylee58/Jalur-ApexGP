import { describe, expect, it } from "vitest";
import { FIT, MAX_ZOOM, clampView, fittedContent, panBy, zoomAt } from "./panZoom";

const frame = { w: 800, h: 600 };
// Where a viewport point lands in map space under a view.
const toMap = (v: { k: number; x: number; y: number }, px: number, py: number) => ({
  x: (px - v.x) / v.k,
  y: (py - v.y) / v.k,
});

describe("zoomAt", () => {
  it("keeps the point under the cursor fixed", () => {
    const before = toMap(FIT, 200, 150);
    const zoomed = zoomAt(FIT, 2, 200, 150, frame);
    expect(zoomed.k).toBe(2);
    const after = toMap(zoomed, 200, 150);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  it("stops at the zoom limits", () => {
    expect(zoomAt(FIT, 0.5, 400, 300, frame)).toEqual(FIT);
    expect(zoomAt({ k: 5, x: 0, y: 0 }, 4, 0, 0, frame).k).toBe(MAX_ZOOM);
  });
});

describe("clampView / panBy", () => {
  it("can't pan an unzoomed map", () => {
    expect(panBy(FIT, 120, -40, frame)).toEqual(FIT);
  });

  it("keeps a zoomed map covering the viewport", () => {
    const v = { k: 2, x: -100, y: -100 };
    expect(panBy(v, 500, 500, frame)).toEqual({ k: 2, x: 0, y: 0 });
    expect(panBy(v, -5000, -5000, frame)).toEqual({ k: 2, x: -800, y: -600 });
    expect(clampView({ k: 0.2, x: 50, y: 50 }, frame)).toEqual(FIT);
  });

  it("clamps to a letterboxed map, centring it on the short axis", () => {
    // A wide map on a tall phone screen: 360×740 viewport, 1160×820 map.
    const content = fittedContent(360, 740, 1160 / 820);
    expect(content.w).toBe(360);
    expect(content.y).toBeGreaterThan(0);
    const phone = { w: 360, h: 740, content };
    const v = panBy({ k: 2, x: 0, y: 0 }, -10000, -10000, phone);
    // Panned as far right as the map goes, and no further.
    expect(v.x).toBe(360 - (content.x + content.w) * 2);
    // Still shorter than the screen at 2×, so it stays vertically centred.
    expect(v.y).toBeCloseTo((740 - content.h * 2) / 2 - content.y * 2, 9);
  });
});
