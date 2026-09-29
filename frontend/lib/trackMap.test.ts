import { describe, expect, it } from "vitest";
import type { TelemetrySample } from "@/types/telemetry";
import { buildTrackLayout, ribbonQuads } from "./trackMap";

/** A stadium-shaped lap run anticlockwise in the feed's frame: two 1 km
 * straights joined by 300 m-radius bends, a fix every 10 m. */
function stadium(): { samples: TelemetrySample[]; bends: number[] } {
  const straight = 1000;
  const r = 300;
  const arc = Math.PI * r;
  const total = 2 * straight + 2 * arc;
  const at = (d: number) => {
    if (d < straight) return { x: d, y: 0 };
    if (d < straight + arc) {
      const a = -Math.PI / 2 + (d - straight) / r;
      return { x: straight + r * Math.cos(a), y: r + r * Math.sin(a) };
    }
    if (d < 2 * straight + arc) return { x: straight - (d - straight - arc), y: 2 * r };
    const a = Math.PI / 2 + (d - 2 * straight - arc) / r;
    return { x: r * Math.cos(a), y: r + r * Math.sin(a) };
  };
  const samples: TelemetrySample[] = [];
  for (let d = 0; d <= total; d += 10) {
    const { x, y } = at(d);
    samples.push({
      t: d / 60,
      speed: 216,
      throttle: 100,
      brake: 0,
      rpm: 11000,
      gear: 7,
      drs: null,
      distance: d,
      x,
      y,
    });
  }
  return { samples, bends: [straight + arc / 2, 2 * straight + arc * 1.5] };
}

describe("buildTrackLayout", () => {
  it("needs position data", () => {
    const { samples } = stadium();
    expect(buildTrackLayout(samples.map((s) => ({ ...s, x: null, y: null })))).toBeNull();
  });

  it("closes the lap and draws one ribbon quad per segment", () => {
    const layout = buildTrackLayout(stadium().samples)!;
    const first = layout.centreline[0];
    const last = layout.centreline[layout.centreline.length - 1];
    expect(last).toEqual(first);
    expect(layout.ribbon).toHaveLength(layout.centreline.length - 1);
  });

  it("points every chevron the way the cars run, one per straight", () => {
    const layout = buildTrackLayout(stadium().samples)!;
    expect(layout.chevrons).toHaveLength(2);
    for (const chevron of layout.chevrons) {
      const [e1, tip, e2] = chevron.split(" ").map((p) => p.split(",").map(Number));
      const back = { x: (e1[0] + e2[0]) / 2, y: (e1[1] + e2[1]) / 2 };
      let k = 0;
      layout.centreline.forEach((p, j) => {
        const best = layout.centreline[k];
        if (Math.hypot(p.x - back.x, p.y - back.y) < Math.hypot(best.x - back.x, best.y - back.y)) k = j;
      });
      const next = layout.centreline[Math.min(k + 1, layout.centreline.length - 1)];
      const dir = {
        x: next.x - layout.centreline[k].x,
        y: next.y - layout.centreline[k].y,
      };
      expect((tip[0] - back.x) * dir.x + (tip[1] - back.y) * dir.y).toBeGreaterThan(0);
    }
  });

  it("treats a straight that crosses the line as one straight", () => {
    // The same lap, timed from halfway down the first straight: that
    // straight now spans the end and the start of the lap.
    const { samples } = stadium();
    const total = samples[samples.length - 1].distance!;
    const cut = samples.findIndex((s) => s.distance === 500);
    const shifted = [...samples.slice(cut), ...samples.slice(1, cut + 1)].map((s, i) => ({
      ...s,
      distance: i * 10,
      t: (i * 10) / 60,
    }));
    expect(shifted[shifted.length - 1].distance).toBeCloseTo(total, 0);
    const layout = buildTrackLayout(shifted)!;
    expect(layout.chevrons).toHaveLength(2);
  });

  it("lays the start/finish band along the first straight", () => {
    const layout = buildTrackLayout(stadium().samples)!;
    // The first straight runs along +x in the feed; the map keeps x.
    expect(Math.abs(layout.startFinish.angle)).toBeLessThan(2);
  });

  it("sets corner numbers off the track, inside the frame, apart", () => {
    const { samples, bends } = stadium();
    const layout = buildTrackLayout(
      samples,
      bends.map((distance, i) => ({ number: i + 1, distance })),
    )!;
    expect(layout.callouts.map((c) => c.number)).toEqual([1, 2]);
    for (const callout of layout.callouts) {
      const nearest = Math.min(...layout.centreline.map((p) => Math.hypot(p.x - callout.at.x, p.y - callout.at.y)));
      expect(nearest).toBeGreaterThan(layout.half + callout.fontSize / 2);
      expect(callout.at.x).toBeGreaterThan(0);
      expect(callout.at.x).toBeLessThan(layout.width);
      expect(callout.at.y).toBeGreaterThan(0);
      expect(callout.at.y).toBeLessThan(layout.height);
    }
    const [a, b] = layout.callouts;
    expect(Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y)).toBeGreaterThan(a.fontSize);
  });
});

describe("ribbonQuads", () => {
  it("keeps a constant width along a straight", () => {
    const [quad] = ribbonQuads(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      5,
    );
    expect(quad).toBe("0.0,5.0 10.0,5.0 10.0,-5.0 0.0,-5.0");
  });
});
