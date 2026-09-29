"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { fetchSessionOverview } from "@/lib/api";
import { describeTelemetryError, formatLapTime } from "@/lib/telemetry";
import {
  COMPOUND_COLOUR,
  finishingOrder,
  fuelCorrected,
  heatColour,
  percentileRank,
  stintsOf,
  teamColour,
} from "@/lib/telemetryCharts";
import type { SessionLap, SessionOverview } from "@/types/telemetry";

interface Props {
  /** Driver codes currently loaded in the lap panel, to highlight. */
  highlight: string[];
  selectedLap?: { driver: string; lap: number } | null;
  onPickLap: (driverNumber: number, lap: number) => void;
}

const ROW = 16;
const LABEL = 44;

/**
 * The whole race at a glance, from TracingInsights' single session file —
 * three of the views tracinginsights.com is built around: tyre strategy,
 * position changes, and a lap-time heatmap whose cells load that lap's
 * telemetry into the panel above.
 */
export function RaceOverview({ highlight, selectedLap, onPickLap }: Props) {
  const [state, setState] = useState<{ data: SessionOverview | null; error: string | null }>({ data: null, error: null });
  const [fuel, setFuel] = useState(false);

  useEffect(() => {
    fetchSessionOverview()
      .then((data) => setState({ data, error: null }))
      .catch((err: unknown) => setState({ data: null, error: describeTelemetryError(err) }));
  }, []);

  const model = useMemo(() => {
    const data = state.data;
    if (!data) return null;
    const byDriver = new Map<string, SessionLap[]>();
    for (const lap of data.laps) {
      const list = byDriver.get(lap.driver) ?? [];
      list.push(lap);
      byDriver.set(lap.driver, list);
    }
    const order = finishingOrder(data.laps).filter((code) => byDriver.has(code));
    const maxLap = Math.max(...data.laps.map((l) => l.lap));
    // Sprints start with ~30 kg of fuel, full races ~100 kg.
    const startFuel = data.sessionName.toLowerCase() === "sprint" ? 30 : 100;
    const lapTime = (l: SessionLap) => (fuel ? fuelCorrected(l.time as number, l.lap, maxLap, startFuel) : (l.time as number));
    const timed = data.laps.filter((l) => l.time != null);
    const sorted = timed.map(lapTime).sort((a, b) => a - b);
    const bestLap = timed.reduce<SessionLap | null>((b, l) => (!b || (l.time as number) < (b.time as number) ? l : b), null);
    const drivers = new Map(data.drivers.map((d) => [d.code, d]));
    return { data, byDriver, order, maxLap, sorted, lapTime, bestLap, drivers };
  }, [state.data, fuel]);

  if (state.error) {
    return (
      <p className="rounded-lg border border-paper/10 bg-asphalt px-4 py-5 text-center text-xs text-paper-dim">
        Race overview unavailable — {state.error}
      </p>
    );
  }
  if (!model) {
    return (
      <p className="rounded-lg border border-paper/10 bg-asphalt px-4 py-5 text-center font-mono text-xs text-paper-dim">
        Loading race overview…
      </p>
    );
  }

  const { order, byDriver, maxLap, sorted, lapTime, bestLap, drivers } = model;
  const chartW = 1000;
  // One cell per lap, the first starting at the plot's left edge; lapX is a
  // lap's centre, so a one-lap session still fits inside the plot.
  const lapW = (chartW - LABEL - 8) / Math.max(maxLap, 1);
  const cellX = (lap: number) => LABEL + (lap - 1) * lapW;
  const lapX = (lap: number) => cellX(lap) + lapW / 2;
  const isHot = (code: string) => highlight.includes(code);

  return (
    <div className="space-y-8">
      <section aria-labelledby="ov-strategy">
        <h3 id="ov-strategy" className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Tyre strategy
        </h3>
        <div className="mt-2 overflow-x-auto">
        <svg viewBox={`0 0 ${chartW} ${order.length * ROW + 18}`} style={{ minWidth: 720 }} className="w-full" role="img" aria-label="Tyre strategy by driver, in finishing order">
          {order.map((code, row) => {
            const y = row * ROW;
            return (
              <g key={code}>
                {isHot(code) ? <rect x={0} y={y} width={chartW} height={ROW} fill="#f4efe6" fillOpacity={0.05} /> : null}
                <rect x={0} y={y + 3} width={3} height={ROW - 6} fill={teamColour(drivers.get(code)?.teamColour)} />
                <text
                  x={8}
                  y={y + ROW / 2}
                  dominantBaseline="central"
                  className={`font-mono ${isHot(code) ? "fill-paper" : "fill-paper-dim"}`}
                  fontSize={10}
                  fontWeight={isHot(code) ? 700 : 400}
                >
                  {code}
                </text>
                {stintsOf(byDriver.get(code) ?? []).map((stint) => (
                  <rect
                    key={stint.stint}
                    x={cellX(stint.firstLap) + 1}
                    y={y + 3}
                    width={Math.max((stint.lastLap - stint.firstLap + 1) * lapW - 2, 1)}
                    height={ROW - 6}
                    rx={2}
                    fill={COMPOUND_COLOUR[stint.compound ?? ""] ?? "#3a4046"}
                    fillOpacity={0.9}
                  >
                    <title>{`${code} · stint ${stint.stint} · ${stint.compound ?? "unknown"} · laps ${stint.firstLap}–${stint.lastLap}`}</title>
                  </rect>
                ))}
              </g>
            );
          })}
          {[1, ...Array.from({ length: Math.floor(maxLap / 10) }, (_, i) => (i + 1) * 10)].map((lap) => (
            <text key={lap} x={lapX(lap)} y={order.length * ROW + 12} textAnchor="middle" className="fill-paper-dim font-mono" fontSize={9}>
              {lap}
            </text>
          ))}
        </svg>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
          {Object.entries(COMPOUND_COLOUR).map(([name, colour]) => (
            <span key={name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2 w-3 rounded-sm" style={{ background: colour }} />
              {name.toLowerCase()}
            </span>
          ))}
        </p>
      </section>

      <section aria-labelledby="ov-positions">
        <h3 id="ov-positions" className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Position changes
        </h3>
        <div className="mt-2 overflow-x-auto">
        <svg viewBox={`0 0 ${chartW + 40} ${order.length * ROW + 18}`} style={{ minWidth: 720 }} className="w-full" role="img" aria-label="Race position by lap for every driver">
          {Array.from({ length: order.length }, (_, i) => (
            <line key={i} x1={LABEL} x2={chartW - 8} y1={i * ROW + ROW / 2} y2={i * ROW + ROW / 2} stroke="#f4efe6" strokeOpacity={0.04} />
          ))}
          {[...order].reverse().map((code) => {
            const laps = (byDriver.get(code) ?? []).filter((l) => l.position != null).sort((a, b) => a.lap - b.lap);
            if (laps.length < 2) return null;
            const hot = isHot(code);
            const colour = teamColour(drivers.get(code)?.teamColour);
            const d = laps
              .map((l, i) => `${i ? "L" : "M"}${lapX(l.lap).toFixed(1)},${((l.position as number) - 1) * ROW + ROW / 2}`)
              .join("");
            return (
              <g key={code}>
                <path d={d} fill="none" stroke={colour} strokeWidth={hot ? 2.4 : 1.2} strokeOpacity={highlight.length && !hot ? 0.28 : 0.9} strokeLinejoin="round" />
                {laps.filter((l) => l.pitIn).map((l) => (
                  <circle key={l.lap} cx={lapX(l.lap)} cy={((l.position as number) - 1) * ROW + ROW / 2} r={hot ? 3 : 2} fill={colour} fillOpacity={highlight.length && !hot ? 0.35 : 1}>
                    <title>{`${code} pits · lap ${l.lap}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
          {order.map((code, row) => (
            <text key={code} x={LABEL - 6} y={row * ROW + ROW / 2} textAnchor="end" dominantBaseline="central" className="fill-paper-dim font-mono" fontSize={9}>
              P{row + 1}
            </text>
          ))}
          {/* Each line ends in its driver's code, at the last position held. */}
          {order.map((code) => {
            const laps = (byDriver.get(code) ?? []).filter((l) => l.position != null);
            const last = laps.reduce<SessionLap | null>((b, l) => (!b || l.lap > b.lap ? l : b), null);
            if (!last) return null;
            return (
              <text
                key={code}
                x={lapX(last.lap) + 6}
                y={((last.position as number) - 1) * ROW + ROW / 2}
                dominantBaseline="central"
                className="font-mono"
                fontSize={9}
                fontWeight={isHot(code) ? 700 : 400}
                fill={teamColour(drivers.get(code)?.teamColour)}
                fillOpacity={highlight.length && !isHot(code) ? 0.55 : 1}
              >
                {code}
              </text>
            );
          })}
        </svg>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-paper-dim">Dots mark pit stops · selected drivers highlighted</p>
      </section>

      <section aria-labelledby="ov-heatmap">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="ov-heatmap" className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
            Lap-time heatmap
          </h3>
          <label className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim">
            <input
              type="checkbox"
              checked={fuel}
              onChange={(e) => setFuel(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber"
            />
            Fuel-corrected
          </label>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-paper-dim">
          Each lap is coloured by where it ranks in the session — the quickest laps coolest, the slowest (pit laps,
          safety cars) warmest{bestLap ? ` · best ${bestLap.driver} ${formatLapTime(bestLap.time as number)}` : ""}.{" "}
          {fuel
            ? "Fuel-corrected: ~0.03 s per kg with the fuel burned evenly (TracingInsights' approximation), which removes the early-race weight penalty."
            : "Select a lap to load its telemetry above."}
        </p>
        <LapHeatmap
          order={order}
          byDriver={byDriver}
          maxLap={maxLap}
          colourOf={(lap) => heatColour(percentileRank(sorted, lapTime(lap)))}
          selectedLap={selectedLap}
          onPick={(code, lap) => {
            const driverNumber = drivers.get(code)?.driverNumber;
            if (driverNumber != null) onPickLap(driverNumber, lap);
          }}
        />
      </section>
    </div>
  );
}

const CELL = 12;

function describeLap(code: string, lap: SessionLap) {
  return `${code} · lap ${lap.lap} · ${formatLapTime(lap.time as number)} · ${lap.compound?.toLowerCase() ?? "?"}${lap.pitIn ? " · in-lap" : ""}${lap.pitOut ? " · out-lap" : ""}`;
}

/**
 * Every timed lap as a cell, as an ARIA grid: one tab stop, arrow keys move
 * between laps (up/down keeps the lap number where the other driver has
 * it), Home/End jump to a driver's first and last lap, and Enter or Space
 * loads the lap into the panel above — the same as clicking it.
 */
function LapHeatmap({
  order,
  byDriver,
  maxLap,
  colourOf,
  selectedLap,
  onPick,
}: {
  order: string[];
  byDriver: Map<string, SessionLap[]>;
  maxLap: number;
  colourOf: (lap: SessionLap) => string;
  selectedLap?: { driver: string; lap: number } | null;
  onPick: (code: string, lap: number) => void;
}) {
  const cells = useRef(new Map<string, SVGRectElement>());
  const [cursor, setCursor] = useState<{ row: number; lap: number } | null>(null);
  const timedLaps = (row: number) =>
    (byDriver.get(order[row]) ?? []).filter((l) => l.time != null).map((l) => l.lap);

  const firstRow = order.findIndex((_, row) => timedLaps(row).length > 0);
  const active = cursor ?? (firstRow >= 0 ? { row: firstRow, lap: timedLaps(firstRow)[0] } : null);

  const moveTo = (row: number, lap: number) => {
    setCursor({ row, lap });
    cells.current.get(`${row}:${lap}`)?.focus();
  };

  const nearest = (laps: number[], lap: number) =>
    laps.reduce((best, l) => (Math.abs(l - lap) < Math.abs(best - lap) ? l : best), laps[0]);

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!active) return;
    const laps = timedLaps(active.row);
    const at = laps.indexOf(active.lap);
    const vertical = (step: number) => {
      for (let row = active.row + step; row >= 0 && row < order.length; row += step) {
        const other = timedLaps(row);
        if (other.length) return moveTo(row, nearest(other, active.lap));
      }
    };
    const actions: Record<string, () => void> = {
      ArrowRight: () => at < laps.length - 1 && moveTo(active.row, laps[at + 1]),
      ArrowLeft: () => at > 0 && moveTo(active.row, laps[at - 1]),
      ArrowDown: () => vertical(1),
      ArrowUp: () => vertical(-1),
      Home: () => moveTo(active.row, laps[0]),
      End: () => moveTo(active.row, laps[laps.length - 1]),
      Enter: () => onPick(order[active.row], active.lap),
      " ": () => onPick(order[active.row], active.lap),
    };
    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="mt-2 overflow-x-auto">
      <svg
        viewBox={`0 0 ${LABEL + maxLap * CELL} ${order.length * CELL + 16}`}
        style={{ minWidth: 640 }}
        className="w-full"
        role="grid"
        aria-label="Lap times for every driver and lap, coloured from quickest to slowest. Arrow keys move between laps; Enter loads one."
        onKeyDown={onKeyDown}
      >
        {order.map((code, row) => (
          <g key={code} role="row">
            <text
              role="rowheader"
              x={LABEL - 6}
              y={row * CELL + 6}
              textAnchor="end"
              dominantBaseline="central"
              className="fill-paper-dim font-mono"
              fontSize={8}
            >
              {code}
            </text>
            {(byDriver.get(code) ?? []).map((lap) => {
              if (lap.time == null) return null;
              const picked = selectedLap?.driver === code && selectedLap.lap === lap.lap;
              const focusable = active?.row === row && active.lap === lap.lap;
              const label = describeLap(code, lap);
              return (
                <rect
                  key={lap.lap}
                  ref={(el) => {
                    if (el) cells.current.set(`${row}:${lap.lap}`, el);
                    else cells.current.delete(`${row}:${lap.lap}`);
                  }}
                  role="gridcell"
                  tabIndex={focusable ? 0 : -1}
                  aria-label={label}
                  aria-selected={picked}
                  x={LABEL + (lap.lap - 1) * CELL + 0.5}
                  y={row * CELL + 0.5}
                  width={CELL - 1}
                  height={CELL - 1}
                  rx={1.5}
                  fill={colourOf(lap)}
                  stroke={picked ? "#f5a623" : "none"}
                  strokeWidth={picked ? 2 : 0}
                  className="cursor-pointer outline-none transition-opacity hover:opacity-70 focus-visible:[stroke-width:2] focus-visible:[stroke:#f4efe6]"
                  onFocus={() => setCursor({ row, lap: lap.lap })}
                  onClick={() => onPick(code, lap.lap)}
                >
                  <title>{label}</title>
                </rect>
              );
            })}
          </g>
        ))}
        {[1, ...Array.from({ length: Math.floor(maxLap / 10) }, (_, i) => (i + 1) * 10)].map((lap) => (
          <text
            key={lap}
            aria-hidden="true"
            x={LABEL + (lap - 1) * CELL + CELL / 2}
            y={order.length * CELL + 10}
            textAnchor="middle"
            className="fill-paper-dim font-mono"
            fontSize={8}
          >
            {lap}
          </text>
        ))}
      </svg>
    </div>
  );
}
