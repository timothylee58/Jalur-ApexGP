"use client";

import { useEffect, useMemo, useState } from "react";
import { sampleAt } from "@/lib/telemetry";
import { distances, miniSectorLeaders, rampColour, teamColour } from "@/lib/telemetryCharts";
import { MAP_WIDTH, buildTrackLayout, type Pt, type TrackLayout } from "@/lib/trackMap";
import type { TelemetryCorner, TelemetryLapTrace, TelemetrySample } from "@/types/telemetry";

const BG = "#0a0c0e";
const PAPER = "#f4efe6";
const MINI_SECTORS = 25;

type ColourMode = "speed" | "faster";

interface Props {
  trace: TelemetryLapTrace;
  compare?: TelemetryLapTrace | null;
  time: number;
  corners?: TelemetryCorner[];
}

/** Rendered width of an element, so type can be sized for the screen. A
 * callback ref, so the observer follows the element when it is swapped
 * (the no-positions placeholder and the map are different nodes). */
function useWidth<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width] as const;
}

const positioned = (samples: TelemetrySample[]) => samples.filter((s) => s.x != null && s.y != null);

/**
 * The lap as driven, drawn like a printed circuit guide: one bold ribbon,
 * chevrons on the straights for the direction of running, a chequered
 * start/finish band, and corner numbers set off on leader lines. The
 * ribbon carries the data — the primary lap's speed (warm where slow,
 * cool where flat out), or, in a head-to-head, which driver was quicker
 * through each of 25 mini-sectors. Both cars run on the same clock from
 * their own lap start, so the gap between the dots *is* the gap on track.
 */
export function TrackMap({ trace, compare, time, corners = [] }: Props) {
  const [frameRef, width] = useWidth<HTMLElement>();
  // The viewBox scales everything down on a phone; keep labels ~11px+.
  const textScale = width ? Math.round(Math.min(2.2, Math.max(1, (11 * MAP_WIDTH) / width / 25)) * 10) / 10 : 1;
  const [requested, setRequested] = useState<ColourMode>("speed");
  const mode: ColourMode = compare ? requested : "speed";

  const layout = useMemo(
    () => buildTrackLayout(trace.samples, corners, { textScale }),
    [trace.samples, corners, textScale],
  );

  const colourA = teamColour(trace.driver.teamColour);
  const rawB = compare ? teamColour(compare.driver.teamColour, PAPER) : PAPER;
  // Team-mates share a colour; the comparison lap then reads in paper.
  const colourB = rawB.toLowerCase() === colourA.toLowerCase() ? PAPER : rawB;

  const leaders = useMemo(
    () => (compare ? miniSectorLeaders(trace.samples, compare.samples, MINI_SECTORS) : []),
    [trace.samples, compare],
  );

  const speedRange = useMemo(() => {
    const speeds = positioned(trace.samples).map((s) => s.speed);
    return { min: Math.min(...speeds), max: Math.max(...speeds) };
  }, [trace.samples]);

  // One colour per ribbon quad, plus each quad's mini-sector so the cuts
  // between mini-sectors land exactly where the colour changes.
  const segments = useMemo(() => {
    if (!layout) return { colours: [] as string[], sectors: [] as number[] };
    const lapDist = distances(trace.samples);
    const total = lapDist[lapDist.length - 1] || 1;
    const span = speedRange.max - speedRange.min || 1;
    // A short moving average keeps sample-to-sample noise in the speed
    // trace from striping the ribbon.
    const speeds = trace.samples.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - 3); j <= Math.min(trace.samples.length - 1, i + 3); j += 1) {
        sum += trace.samples[j].speed;
        n += 1;
      }
      return sum / n;
    });
    const sectors = layout.ribbon.map((_, k) => {
      const mid = (lapDist[layout.sampleIndex[k]] + lapDist[layout.sampleIndex[k + 1] ?? layout.sampleIndex[k]]) / 2;
      return Math.min(Math.floor((mid / total) * MINI_SECTORS), MINI_SECTORS - 1);
    });
    const colours = layout.ribbon.map((_, k) => {
      if (mode === "faster" && leaders.length) return leaders[sectors[k]] === "b" ? colourB : colourA;
      const i0 = layout.sampleIndex[k];
      const i1 = layout.sampleIndex[k + 1] ?? i0;
      return rampColour(((speeds[i0] + speeds[i1]) / 2 - speedRange.min) / span);
    });
    return { colours, sectors };
  }, [layout, trace.samples, mode, leaders, colourA, colourB, speedRange]);

  // Everything but the cars is fixed for a lap: build it once, so the
  // playback clock only re-renders two dots.
  const staticLayer = useMemo(() => {
    if (!layout) return null;
    return (
      <g>
        <polyline
          points={layout.centreline.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="#1c2126"
          strokeWidth={layout.half * 2 + 5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {layout.ribbon.map((points, k) => (
          <polygon
            key={k}
            points={points}
            fill={segments.colours[k]}
            stroke={segments.colours[k]}
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
        ))}
        {mode === "faster" ? <SectorTicks layout={layout} sectors={segments.sectors} /> : null}
        {layout.chevrons.map((points, k) => (
          <polyline key={k} points={points} fill="none" stroke={BG} strokeWidth={3.4} strokeLinejoin="miter" />
        ))}
        <StartFinish layout={layout} />
        {layout.callouts.map((c) => (
          <g key={c.number}>
            <line
              x1={c.from.x}
              y1={c.from.y}
              x2={c.to.x}
              y2={c.to.y}
              stroke="#a39b8f"
              strokeOpacity={0.6}
              strokeWidth={1.4}
            />
            <circle cx={c.from.x} cy={c.from.y} r={2.1} fill="#a39b8f" />
            <text
              x={c.at.x}
              y={c.at.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-display"
              fontSize={c.fontSize}
              letterSpacing={0.5}
              fill={PAPER}
              fillOpacity={0.88}
            >
              {c.number}
            </text>
          </g>
        ))}
      </g>
    );
  }, [layout, segments, mode]);

  const cars = useMemo(
    () => ({
      a: positioned(trace.samples),
      // Two sources can place a car in different coordinate frames; only a
      // comparison lap from the same source shares the primary's map.
      b: compare && compare.source === trace.source ? positioned(compare.samples) : [],
    }),
    [trace.samples, compare],
  );

  if (!layout) {
    return (
      <div
        ref={frameRef}
        className="flex h-full min-h-[220px] items-center justify-center rounded-md border border-paper/10 bg-pit-carbon px-6 text-center text-xs text-paper-dim"
      >
        No position data for this lap, so there&apos;s no track map — the charts below still show every channel.
      </div>
    );
  }

  const car = (samples: TelemetrySample[], code: string, colour: string, below: boolean) => {
    const s = sampleAt(samples, time);
    if (!s || s.x == null || s.y == null) return null;
    return (
      <CarTag
        key={code + below}
        at={layout.project(s.x, s.y)}
        code={code}
        colour={colour}
        below={below}
        scale={textScale}
      />
    );
  };

  const aWins = leaders.filter((l) => l === "a").length;

  return (
    <figure ref={frameRef} className="flex h-full flex-col">
      {compare ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">Colour the track by</span>
          <div
            role="group"
            aria-label="Colour the track by"
            className="inline-flex rounded-full border border-paper/15 p-0.5"
          >
            {(
              [
                ["speed", "Speed"],
                ["faster", "Who's quicker"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => setRequested(id)}
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber ${
                  mode === id ? "bg-paper text-pit-carbon" : "text-paper-dim hover:text-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="w-full flex-1"
        role="img"
        aria-label={
          mode === "faster" && compare
            ? `Track map of ${trace.circuitShortName}: ${trace.driver.nameAcronym} quicker in ${aWins} of ${MINI_SECTORS} mini-sectors, ${compare.driver.nameAcronym} in ${MINI_SECTORS - aWins}`
            : `Track map of ${trace.circuitShortName} coloured by ${trace.driver.nameAcronym}'s speed on lap ${trace.lapNumber}`
        }
      >
        {staticLayer}
        {compare ? car(cars.b, compare.driver.nameAcronym, colourB, true) : null}
        {car(cars.a, trace.driver.nameAcronym, colourA, false)}
      </svg>
      {mode === "faster" && compare ? (
        <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-4 rounded-sm" style={{ background: colourA }} />
            {trace.driver.nameAcronym} quicker in {aWins}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2 w-4 rounded-sm" style={{ background: colourB }} />
            {compare.driver.nameAcronym} in {MINI_SECTORS - aWins}
          </span>
          <span className="normal-case tracking-normal">of {MINI_SECTORS} mini-sectors</span>
        </figcaption>
      ) : (
        <figcaption className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim">
          <span>{Math.round(speedRange.min)}</span>
          <span
            aria-hidden="true"
            className="h-1.5 flex-1 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${rampColour(0)}, ${rampColour(0.35)}, ${rampColour(0.65)}, ${rampColour(1)})`,
            }}
          />
          <span>{Math.round(speedRange.max)} km/h</span>
        </figcaption>
      )}
    </figure>
  );
}

/** The chequered band across the ribbon where the lap starts. */
function StartFinish({ layout }: { layout: TrackLayout }) {
  const { x, y, angle } = layout.startFinish;
  const size = layout.half;
  const cols = 6;
  const cells = [];
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if ((r + c) % 2 === 0) {
        cells.push(
          <rect key={`${r}-${c}`} x={(c - cols / 2) * size} y={(r - 1) * size} width={size} height={size} fill={BG} />,
        );
      }
    }
  }
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}>
      <rect x={(-cols / 2) * size} y={-size} width={cols * size} height={size * 2} fill={PAPER} />
      {cells}
    </g>
  );
}

/** Thin cuts across the ribbon wherever one mini-sector hands over to the
 * next — at the shared edge of the two quads, so a cut never leaves a
 * sliver of the neighbouring colour beside it. */
function SectorTicks({ layout, sectors }: { layout: TrackLayout; sectors: number[] }) {
  const ticks = [];
  const pts = layout.centreline;
  for (let k = 1; k < sectors.length; k += 1) {
    if (sectors[k] === sectors[k - 1]) continue;
    const a = pts[k - 1];
    const b = pts[k + 1] ?? pts[k];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = (-(b.y - a.y) / len) * (layout.half + 1);
    const ny = ((b.x - a.x) / len) * (layout.half + 1);
    ticks.push(
      <line
        key={k}
        x1={pts[k].x + nx}
        y1={pts[k].y + ny}
        x2={pts[k].x - nx}
        y2={pts[k].y - ny}
        stroke={BG}
        strokeWidth={2.2}
      />,
    );
  }
  return <g>{ticks}</g>;
}

/** A car: team-colour dot ringed in black so it reads on any ribbon colour,
 * with its code on a tag at the end of a short vertical leader — above for
 * the primary lap, below for the comparison, so two cars side by side
 * never print over each other. */
function CarTag({
  at,
  code,
  colour,
  below,
  scale,
}: {
  at: Pt;
  code: string;
  colour: string;
  below: boolean;
  scale: number;
}) {
  const s = Math.sqrt(scale);
  const r = 8.5 * s;
  const f = 22 * scale;
  const w = code.length * f * 0.5 + f * 0.7;
  const h = f * 1.1;
  const gap = 16 * s;
  const tagY = below ? at.y + r + gap : at.y - r - gap - h;
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={r * 2.3} fill={colour} fillOpacity={0.2} />
      <line
        x1={at.x}
        y1={below ? at.y + r : at.y - r}
        x2={at.x}
        y2={below ? tagY : tagY + h}
        stroke={colour}
        strokeWidth={2}
      />
      <circle cx={at.x} cy={at.y} r={r + 3.5 * s} fill={BG} />
      <circle cx={at.x} cy={at.y} r={r} fill={colour} />
      <rect x={at.x - w / 2} y={tagY} width={w} height={h} rx={3} fill={colour} />
      <text
        x={at.x}
        y={tagY + h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display"
        fontSize={f}
        letterSpacing={1}
        fill={BG}
      >
        {code}
      </text>
    </g>
  );
}
