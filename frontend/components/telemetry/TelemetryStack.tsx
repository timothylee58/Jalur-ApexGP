"use client";

import { useMemo, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { distances, interpolate, lapDelta, teamColour } from "@/lib/telemetryCharts";
import type { TelemetryCorner, TelemetryLapTrace } from "@/types/telemetry";

const W = 1000;
// Downsample long laps for drawing; the data itself stays full resolution.
const MAX_POINTS = 700;

interface Props {
  trace: TelemetryLapTrace;
  compare?: TelemetryLapTrace | null;
  time: number;
  corners?: TelemetryCorner[];
  onSeek: (t: number) => void;
}

interface Channel {
  key: string;
  label: string;
  height: number;
  unit?: string;
}

/**
 * Every channel against distance, stacked on one x-axis — the layout the
 * telemetry-analysis sites (TracingInsights among them) use, because it
 * answers "where on track" rather than "when". Laps are aligned by relative
 * distance so a comparison lines up corner for corner. Corner numbers run
 * down every channel; the cursor follows playback and the stack scrubs.
 */
export function TelemetryStack({ trace, compare, time, corners = [], onSeek }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const colourA = teamColour(trace.driver.teamColour, "#2ec4b6");
  const sameTeam = compare && compare.driver.teamName === trace.driver.teamName;
  const colourB = compare ? (sameTeam ? "#f4efe6" : teamColour(compare.driver.teamColour, "#f4efe6")) : "";

  const model = useMemo(() => {
    const dA = distances(trace.samples);
    const totalA = dA[dA.length - 1] || 1;
    const tA = trace.samples.map((s) => s.t);
    const series = (lap: TelemetryLapTrace) => {
      const d = distances(lap.samples);
      const total = d[d.length - 1] || 1;
      const step = Math.max(1, Math.ceil(lap.samples.length / MAX_POINTS));
      const pick = lap.samples.map((s, i) => ({ s, rel: d[i] / total })).filter((_, i) => i % step === 0);
      return pick;
    };
    const a = series(trace);
    const b = compare ? series(compare) : null;
    const delta = compare ? lapDelta(trace.samples, compare.samples, 300) : null;
    const maxSpeed = Math.max(340, ...trace.samples.map((s) => s.speed), ...(compare?.samples.map((s) => s.speed) ?? []));
    const deltaMax = delta ? Math.max(0.3, ...delta.map((p) => Math.abs(p.delta))) : 1;
    const maxGear = 8;
    const relOf = (lap: TelemetryLapTrace) => {
      const d = distances(lap.samples);
      const total = d[d.length - 1] || 1;
      return d.map((v) => v / total);
    };
    const relA = relOf(trace);
    const relB = compare ? relOf(compare) : null;
    return { dA, totalA, tA, a, b, delta, maxSpeed, deltaMax, maxGear, relA, relB };
  }, [trace, compare]);

  const channels: Channel[] = [
    { key: "speed", label: "Speed", height: 150, unit: "km/h" },
    ...(compare ? [{ key: "delta", label: `Delta · + = ${compare.driver.nameAcronym} behind`, height: 64, unit: "s" }] : []),
    { key: "throttle", label: "Throttle", height: 56, unit: "%" },
    { key: "brake", label: "Brake", height: compare ? 36 : 22 },
    { key: "gear", label: "Gear", height: 56 },
  ];

  const cursorD = interpolate(model.tA, model.dA, time);
  const cursorRel = cursorD / model.totalA;
  const readout = (lap: TelemetryLapTrace, rels: number[], rel: number) => {
    const i = rels.findIndex((v) => v >= rel);
    return lap.samples[i < 0 ? lap.samples.length - 1 : i];
  };
  const atA = readout(trace, model.relA, cursorRel);
  const atB = compare && model.relB ? readout(compare, model.relB, cursorRel) : null;
  const deltaNow = model.delta ? interpolate(model.delta.map((p) => p.rel), model.delta.map((p) => p.delta), cursorRel) : null;

  const seekFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const rel = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(interpolate(model.dA, model.tA, rel * model.totalA));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 1;
    if (event.key === "ArrowRight") onSeek(time + step);
    else if (event.key === "ArrowLeft") onSeek(Math.max(0, time - step));
    else if (event.key === "Home") onSeek(0);
    else if (event.key === "End") onSeek(trace.lapDuration);
    else return;
    event.preventDefault();
  };

  const path = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");

  const lineFor = (
    key: string,
    rows: { s: TelemetryLapTrace["samples"][number]; rel: number }[],
    h: number,
    value: (s: TelemetryLapTrace["samples"][number]) => number,
    max: number,
    step = false,
  ) => {
    const pts: { x: number; y: number }[] = [];
    rows.forEach(({ s, rel }, i) => {
      const x = rel * W;
      const y = h - 4 - (value(s) / max) * (h - 10);
      if (step && i > 0) pts.push({ x, y: pts[pts.length - 1].y });
      pts.push({ x, y });
    });
    return path(pts);
  };

  const channelValue = (key: string, lap: TelemetryLapTrace | null, s?: TelemetryLapTrace["samples"][number] | null) => {
    if (!lap || !s) return "";
    if (key === "speed") return `${Math.round(s.speed)}`;
    if (key === "throttle") return `${Math.round(s.throttle)}`;
    if (key === "brake") return s.brake > 0 ? "On" : "—";
    if (key === "gear") return `${s.gear || "N"}`;
    return "";
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Position in lap — drag or use arrow keys to scrub"
      aria-valuemin={0}
      aria-valuemax={Math.round(trace.lapDuration * 1000) / 1000}
      aria-valuenow={Math.round(time * 1000) / 1000}
      aria-valuetext={`${Math.round(cursorD)} metres, ${time.toFixed(1)} seconds`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.buttons & 1) seekFromPointer(event);
      }}
      onKeyDown={onKeyDown}
      className="relative cursor-crosshair touch-pan-y select-none rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
    >
      {channels.map((channel) => (
        <div key={channel.key} className="relative border-b border-paper/[0.06] last:border-b-0">
          <div className="pointer-events-none absolute left-2 top-1 z-10 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-paper-dim">
            <span>{channel.label}</span>
            {channel.key !== "delta" ? (
              <>
                <span style={{ color: colourA }}>{channelValue(channel.key, trace, atA)}</span>
                {compare ? <span style={{ color: colourB }}>{channelValue(channel.key, compare, atB)}</span> : null}
                {channel.unit && channel.key !== "brake" ? <span className="normal-case tracking-normal">{channel.unit}</span> : null}
              </>
            ) : deltaNow != null ? (
              // In the colour of whoever is ahead at this point on the lap.
              <span style={{ color: deltaNow >= 0 ? colourA : colourB }}>
                {deltaNow > 0 ? "+" : ""}
                {deltaNow.toFixed(3)}
              </span>
            ) : null}
          </div>
          <svg viewBox={`0 0 ${W} ${channel.height}`} preserveAspectRatio="none" className="block w-full" style={{ height: channel.height }} aria-hidden="true">
            {corners.map((corner) => (
              <line
                key={corner.number}
                x1={(corner.distance / model.totalA) * W}
                x2={(corner.distance / model.totalA) * W}
                y1={0}
                y2={channel.height}
                stroke="#f4efe6"
                strokeOpacity={0.07}
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {channel.key === "speed" ? (
              <>
                {model.b ? (
                  <path d={lineFor("b", model.b, channel.height, (s) => s.speed, model.maxSpeed)} fill="none" stroke={colourB} strokeWidth={1.4} strokeDasharray={sameTeam ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />
                ) : null}
                <path d={lineFor("a", model.a, channel.height, (s) => s.speed, model.maxSpeed)} fill="none" stroke={colourA} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
              </>
            ) : null}
            {channel.key === "delta" && model.delta ? (
              <>
                <line x1={0} x2={W} y1={channel.height / 2} y2={channel.height / 2} stroke="#f4efe6" strokeOpacity={0.18} vectorEffect="non-scaling-stroke" />
                <path
                  d={path(model.delta.map((p) => ({ x: p.rel * W, y: channel.height / 2 - (p.delta / model.deltaMax) * (channel.height / 2 - 6) })))}
                  fill="none"
                  stroke={colourB}
                  strokeWidth={1.6}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
            {channel.key === "throttle" ? (
              <>
                {model.b ? (
                  <path d={lineFor("b", model.b, channel.height, (s) => s.throttle, 100)} fill="none" stroke={colourB} strokeWidth={1.1} strokeOpacity={0.8} strokeDasharray={sameTeam ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />
                ) : null}
                <path d={lineFor("a", model.a, channel.height, (s) => s.throttle, 100)} fill="none" stroke={colourA} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
              </>
            ) : null}
            {channel.key === "brake"
              ? [
                  { rows: model.a, colour: colourA, y: compare ? 4 : 4, h: compare ? 12 : 14 },
                  ...(model.b ? [{ rows: model.b, colour: colourB, y: 20, h: 12 }] : []),
                ].map(({ rows, colour, y, h }, lane) =>
                  rows.map(({ s, rel }, i) =>
                    s.brake > 0 && i + 1 < rows.length ? (
                      <rect key={`${lane}-${i}`} x={rel * W} y={y} width={Math.max((rows[i + 1].rel - rel) * W, 0.8)} height={h} fill={colour} fillOpacity={0.85} />
                    ) : null,
                  ),
                )
              : null}
            {channel.key === "gear" ? (
              <>
                {model.b ? (
                  <path d={lineFor("b", model.b, channel.height, (s) => s.gear, model.maxGear, true)} fill="none" stroke={colourB} strokeWidth={1.1} strokeOpacity={0.8} strokeDasharray={sameTeam ? "5 3" : undefined} vectorEffect="non-scaling-stroke" />
                ) : null}
                <path d={lineFor("a", model.a, channel.height, (s) => s.gear, model.maxGear, true)} fill="none" stroke={colourA} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
              </>
            ) : null}
            {/* Paper, not amber: team colours (McLaren's papaya) sit too close to amber. */}
            <line x1={cursorRel * W} x2={cursorRel * W} y1={0} y2={channel.height} stroke="#f4efe6" strokeOpacity={0.75} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      ))}
      {corners.length ? (
        <div aria-hidden="true" className="relative h-5">
          {corners.map((corner) => (
            <span
              key={corner.number}
              className="absolute top-1 -translate-x-1/2 font-mono text-[9px] text-paper-dim/70"
              style={{ left: `${Math.min(99, (corner.distance / model.totalA) * 100)}%` }}
            >
              T{corner.number}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
