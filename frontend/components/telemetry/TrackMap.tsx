"use client";

import { useMemo } from "react";
import { sampleAt } from "@/lib/telemetry";
import { distances, rampColour, teamColour } from "@/lib/telemetryCharts";
import type { TelemetryCorner, TelemetryLapTrace } from "@/types/telemetry";

const W = 1000;
const PAD = 70;

interface Props {
  trace: TelemetryLapTrace;
  compare?: TelemetryLapTrace | null;
  time: number;
  corners?: TelemetryCorner[];
}

/**
 * The lap as driven, from the timing feed's own position data: the line is
 * coloured by speed (warm where the car is slow, cool where it's flat out),
 * corners are numbered, and each car's dot moves with the playback clock.
 * Both cars run on the same clock from their own lap start, so the gap
 * between the dots *is* the gap on track.
 */
export function TrackMap({ trace, compare, time, corners = [] }: Props) {
  const geometry = useMemo(() => {
    const points = trace.samples.filter((s) => s.x != null && s.y != null);
    if (points.length < 20) return null;
    const xs = points.map((s) => s.x as number);
    const ys = points.map((s) => s.y as number);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = (W - PAD * 2) / Math.max(maxX - minX, maxY - minY, 1);
    const height = Math.round((maxY - minY) * scale + PAD * 2);
    // Feed y grows "up" on the map; SVG y grows down.
    const project = (x: number, y: number) => ({
      px: PAD + (x - minX) * scale + ((W - PAD * 2) - (maxX - minX) * scale) / 2,
      py: height - PAD - (y - minY) * scale,
    });
    const projected = points.map((s) => ({ ...project(s.x as number, s.y as number), speed: s.speed }));
    const speeds = points.map((s) => s.speed);
    const vMin = Math.min(...speeds);
    const vMax = Math.max(...speeds);

    const segments = projected.slice(1).map((p, i) => ({
      x1: projected[i].px,
      y1: projected[i].py,
      x2: p.px,
      y2: p.py,
      colour: rampColour((((projected[i].speed + p.speed) / 2) - vMin) / (vMax - vMin || 1)),
    }));

    // Corner labels sit off the track, pushed away from its centre.
    const cx = projected.reduce((sum, p) => sum + p.px, 0) / projected.length;
    const cy = projected.reduce((sum, p) => sum + p.py, 0) / projected.length;
    const dist = distances(trace.samples);
    const withPos = trace.samples
      .map((s, i) => ({ s, d: dist[i] }))
      .filter(({ s }) => s.x != null && s.y != null);
    const labels = corners.map((corner) => {
      let best = withPos[0];
      for (const candidate of withPos) {
        if (Math.abs(candidate.d - corner.distance) < Math.abs(best.d - corner.distance)) best = candidate;
      }
      const { px, py } = project(best.s.x as number, best.s.y as number);
      const dx = px - cx;
      const dy = py - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { number: corner.number, px, py, lx: px + (dx / len) * 34, ly: py + (dy / len) * 34 };
    });

    return { height, project, segments, labels, vMin, vMax, outline: projected.map((p) => `${p.px},${p.py}`).join(" ") };
  }, [trace, corners]);

  if (!geometry) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-md border border-paper/10 bg-pit-carbon px-6 text-center text-xs text-paper-dim">
        No position data for this lap, so there&apos;s no track map — the charts below still show every channel.
      </div>
    );
  }

  // The primary car's label sits above its dot and the comparison car's
  // below, so two cars side by side never print over each other.
  const dot = (lap: TelemetryLapTrace, key: string, labelBelow = false) => {
    const s = sampleAt(lap.samples.filter((p) => p.x != null && p.y != null), time);
    if (!s || s.x == null || s.y == null) return null;
    const { px, py } = geometry.project(s.x, s.y);
    const colour = teamColour(lap.driver.teamColour);
    return (
      <g key={key}>
        <circle cx={px} cy={py} r={17} fill={colour} fillOpacity={0.22} />
        <circle cx={px} cy={py} r={9} fill={colour} stroke="#0a0c0e" strokeWidth={3} />
        <text
          x={px + 16}
          y={labelBelow ? py + 30 : py - 14}
          fill={colour}
          className="font-mono"
          fontSize={22}
          letterSpacing={2}
          stroke="#0a0c0e"
          strokeWidth={5}
          paintOrder="stroke"
        >
          {lap.driver.nameAcronym}
        </text>
      </g>
    );
  };

  return (
    <figure className="flex h-full flex-col">
      <svg
        viewBox={`0 0 ${W} ${geometry.height}`}
        className="w-full flex-1"
        role="img"
        aria-label={`Track map of ${trace.circuitShortName} coloured by ${trace.driver.nameAcronym}'s speed on lap ${trace.lapNumber}`}
      >
        <polyline points={geometry.outline} fill="none" stroke="#050607" strokeWidth={22} strokeLinejoin="round" />
        {geometry.segments.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={seg.colour}
            strokeWidth={9}
            strokeLinecap="round"
          />
        ))}
        {geometry.labels.map((label) => (
          <g key={label.number}>
            <line x1={label.px} y1={label.py} x2={label.lx} y2={label.ly} stroke="#a39b8f" strokeOpacity={0.35} strokeWidth={1.5} />
            <text
              x={label.lx}
              y={label.ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-paper-dim font-mono"
              fontSize={20}
            >
              {label.number}
            </text>
          </g>
        ))}
        {compare ? dot(compare, "b", true) : null}
        {dot(trace, "a")}
      </svg>
      <figcaption className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim">
        <span>{Math.round(geometry.vMin)}</span>
        <span
          aria-hidden="true"
          className="h-1.5 flex-1 rounded-full"
          style={{ background: `linear-gradient(90deg, ${rampColour(0)}, ${rampColour(0.35)}, ${rampColour(0.65)}, ${rampColour(1)})` }}
        />
        <span>{Math.round(geometry.vMax)} km/h</span>
      </figcaption>
    </figure>
  );
}
