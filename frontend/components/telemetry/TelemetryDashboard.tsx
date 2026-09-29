"use client";

import { useEffect, useState } from "react";
import { fetchTelemetryDrivers, fetchTelemetryLaps } from "@/lib/api";
import { describeTelemetryError, formatLapTime, isDrsActive, lapHasDrs, sampleAt } from "@/lib/telemetry";
import { teamColour } from "@/lib/telemetryCharts";
import { useLapTrace } from "@/hooks/useLapTrace";
import { useTelemetryPlayback } from "@/hooks/useTelemetryPlayback";
import { RaceOverview } from "@/components/telemetry/RaceOverview";
import { TelemetryStack } from "@/components/telemetry/TelemetryStack";
import { TrackMap } from "@/components/telemetry/TrackMap";
import type { TelemetryDriver, TelemetryLap, TelemetryLapTrace } from "@/types/telemetry";

type FetchState<T> = { status: "idle" | "loading" | "ready" | "error"; data: T | null; error?: string };

function Bar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">{label}</p>
        <p className="font-mono text-xs text-paper">{Math.round(value)}</p>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper/10">
        <div className="h-full rounded-full bg-amber transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** A driver's timed laps, plus the lap to show once they arrive: the one
 * asked for (e.g. from the heatmap) when it exists, else the fastest. */
function useDriverLaps(driverNumber: number | null, wanted: number | null, onPick: (lap: number | null) => void) {
  const [laps, setLaps] = useState<FetchState<TelemetryLap[]>>({ status: "idle", data: null });

  useEffect(() => {
    if (driverNumber == null) {
      setLaps({ status: "idle", data: null });
      return;
    }
    let cancelled = false;
    setLaps({ status: "loading", data: null });
    fetchTelemetryLaps(driverNumber)
      .then((data) => {
        if (cancelled) return;
        setLaps({ status: "ready", data });
        const fastest = data.reduce<TelemetryLap | null>(
          (best, lap) => (!best || lap.lapDuration < best.lapDuration ? lap : best),
          null,
        );
        onPick(wanted != null && data.some((l) => l.lapNumber === wanted) ? wanted : (fastest?.lapNumber ?? null));
      })
      .catch((err: unknown) => {
        if (!cancelled) setLaps({ status: "error", data: null, error: describeTelemetryError(err) });
      });
    return () => {
      cancelled = true;
    };
    // `wanted` is read once per driver change on purpose; onPick only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverNumber]);

  return laps;
}

const selectClass =
  "min-w-0 rounded-md border border-paper/15 bg-asphalt px-3 py-2 font-mono text-xs uppercase tracking-wide text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber disabled:opacity-60";

function LapPicker({
  label,
  drivers,
  driverNumber,
  onDriver,
  laps,
  lapNumber,
  onLap,
  allowNone = false,
}: {
  label: string;
  drivers: TelemetryDriver[];
  driverNumber: number | null;
  onDriver: (n: number | null) => void;
  laps: FetchState<TelemetryLap[]>;
  lapNumber: number | null;
  onLap: (n: number) => void;
  allowNone?: boolean;
}) {
  const driver = drivers.find((d) => d.driverNumber === driverNumber);
  return (
    <fieldset className="flex min-w-0 flex-1 flex-col">
      <legend className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full"
          style={
            driver
              ? { background: teamColour(driver.teamColour) }
              : { border: "1px solid #a39b8f" }
          }
        />
        {label}
      </legend>
      <div className="flex min-w-0 gap-2">
        <select
          aria-label={`${label}: driver`}
          value={driverNumber ?? ""}
          onChange={(e) => onDriver(e.target.value ? Number(e.target.value) : null)}
          className={`${selectClass} flex-1`}
        >
          {allowNone ? <option value="">— none —</option> : null}
          {drivers.map((d) => (
            <option key={d.driverNumber} value={d.driverNumber}>
              #{d.driverNumber} {d.fullName} — {d.teamName}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: lap`}
          value={lapNumber ?? ""}
          onChange={(e) => onLap(Number(e.target.value))}
          disabled={laps.status !== "ready"}
          className={`${selectClass} w-44 shrink-0`}
        >
          {laps.status === "loading" ? <option>Loading laps…</option> : null}
          {laps.status === "idle" ? <option value="">—</option> : null}
          {laps.data?.map((lap) => (
            <option key={lap.lapNumber} value={lap.lapNumber}>
              Lap {lap.lapNumber} — {formatLapTime(lap.lapDuration)}
            </option>
          ))}
        </select>
      </div>
      {laps.status === "error" ? (
        <p role="alert" className="mt-1 text-xs text-brick">
          {laps.error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Where this lap's numbers came from — always said, never implied. */
function SourceNote({ trace }: { trace: TelemetryLapTrace }) {
  if (trace.source === "tracinginsights") {
    return (
      <p className="rounded-md border border-amber/30 bg-amber/[0.06] px-3 py-2 text-xs leading-relaxed text-paper-dim">
        <span className="font-mono uppercase tracking-wide text-amber">Fallback source · </span>
        {trace.fallbackReason ?? "OpenF1 couldn't answer"}, so this lap comes from{" "}
        <a
          href="https://github.com/TracingInsights"
          target="_blank"
          rel="noopener noreferrer"
          className="text-paper hover:underline"
        >
          TracingInsights
        </a>
        &apos; published copy of the same timing data (FastF1, from F1&apos;s live-timing feed).
      </p>
    );
  }
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim">
      Telemetry · OpenF1{trace.corners?.length ? " · corner positions · TracingInsights" : ""}
    </p>
  );
}

export function TelemetryDashboard() {
  const [drivers, setDrivers] = useState<FetchState<TelemetryDriver[]>>({ status: "loading", data: null });
  const [attempt, setAttempt] = useState(0);

  const [driverNumber, setDriverNumber] = useState<number | null>(null);
  const [lapNumber, setLapNumber] = useState<number | null>(null);
  const [wantedLap, setWantedLap] = useState<number | null>(null);
  const [compareDriver, setCompareDriver] = useState<number | null>(null);
  const [compareLap, setCompareLap] = useState<number | null>(null);

  useEffect(() => {
    setDrivers({ status: "loading", data: null });
    fetchTelemetryDrivers()
      .then((data) => {
        setDrivers({ status: "ready", data });
        if (data[0]) setDriverNumber((current) => current ?? data[0].driverNumber);
      })
      .catch((err: unknown) => setDrivers({ status: "error", data: null, error: describeTelemetryError(err) }));
  }, [attempt]);

  const laps = useDriverLaps(driverNumber, wantedLap, (lap) => {
    setLapNumber(lap);
    setWantedLap(null);
  });
  const compareLaps = useDriverLaps(compareDriver, null, setCompareLap);

  const { loading, error, trace, currentTime, playing, play, pause, seek } = useTelemetryPlayback(
    driverNumber,
    lapNumber,
  );
  const other = useLapTrace(compareDriver, compareLap);
  const compare = other.trace;

  const sample = trace ? sampleAt(trace.samples, currentTime) : null;
  const compareSample = compare ? sampleAt(compare.samples, currentTime) : null;
  const compareColour = compare ? teamColour(compare.driver.teamColour, "#f4efe6") : "";
  // The comparison car's reading at the same moment, under the main one.
  const alsoB = (value: string) =>
    compare && compareSample ? (
      <p className="mt-0.5 font-mono text-xs" style={{ color: compareColour }}>
        {compare.driver.nameAcronym} {value}
      </p>
    ) : null;
  const highlighted = [trace?.driver.nameAcronym, compare?.driver.nameAcronym].filter(Boolean) as string[];

  const pickFromOverview = (number: number, lap: number) => {
    if (number === driverNumber) {
      setLapNumber(lap);
    } else {
      setWantedLap(lap);
      setDriverNumber(number);
    }
    document.getElementById("lap-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (drivers.status === "error") {
    return (
      <div className="rounded-lg border border-paper/10 bg-asphalt px-4 py-6 text-center">
        <p role="alert" className="text-sm text-paper-dim">
          {drivers.error}
        </p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-3 rounded-full border border-paper/20 px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-paper hover:border-amber hover:text-amber"
        >
          Try again
        </button>
      </div>
    );
  }

  const driverList = drivers.data ?? [];

  return (
    <div className="space-y-12">
      <section id="lap-panel" aria-label="Lap telemetry" className="scroll-mt-20 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <LapPicker
            label="Lap"
            drivers={driverList}
            driverNumber={driverNumber}
            onDriver={(n) => n != null && setDriverNumber(n)}
            laps={laps}
            lapNumber={lapNumber}
            onLap={setLapNumber}
          />
          <LapPicker
            label="Compare with"
            drivers={driverList.filter((d) => d.driverNumber !== driverNumber)}
            driverNumber={compareDriver}
            onDriver={(n) => {
              setCompareDriver(n);
              if (n == null) setCompareLap(null);
            }}
            laps={compareLaps}
            lapNumber={compareLap}
            onLap={setCompareLap}
            allowNone
          />
        </div>

        {loading ? (
          <p className="rounded-lg border border-paper/10 bg-asphalt px-4 py-6 text-center font-mono text-xs text-paper-dim">
            Loading lap telemetry…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-lg border border-paper/10 bg-asphalt px-4 py-6 text-center text-sm text-paper-dim">
            {error}
          </p>
        ) : null}
        {other.error ? (
          <p role="alert" className="text-xs text-brick">
            Comparison lap: {other.error}
          </p>
        ) : null}

        {trace && sample ? (
          <div className="space-y-4 rounded-lg border border-paper/10 bg-asphalt px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.2em]"
                  style={{ color: teamColour(trace.driver.teamColour, "#f5a623") }}
                >
                  {trace.driver.fullName} · Lap {trace.lapNumber} · {formatLapTime(trace.lapDuration)}
                </p>
                {compare ? (
                  <p
                    className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em]"
                    style={{ color: teamColour(compare.driver.teamColour, "#f4efe6") }}
                  >
                    vs {compare.driver.fullName} · Lap {compare.lapNumber} · {formatLapTime(compare.lapDuration)}{" "}
                    <span className="text-paper-dim">
                      ({compare.lapDuration >= trace.lapDuration ? "+" : "−"}
                      {Math.abs(compare.lapDuration - trace.lapDuration).toFixed(3)} s)
                    </span>
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-paper-dim">
                  {trace.circuitShortName} · {trace.year} {trace.sessionName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-mono text-xs text-paper-dim">
                  {formatLapTime(currentTime)} / {formatLapTime(trace.lapDuration)}
                </p>
                <button
                  type="button"
                  onClick={playing ? pause : play}
                  className="rounded-full border border-paper/20 px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-paper hover:border-amber hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
                >
                  {playing ? "Pause" : "Play"}
                </button>
              </div>
            </div>

            <SourceNote trace={trace} />

            <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
              <div className="rounded-md border border-paper/10 bg-pit-carbon p-3">
                <TrackMap trace={trace} compare={compare} time={currentTime} corners={trace.corners} />
              </div>
              <div className="flex flex-col justify-between gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-paper/10 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Speed</p>
                    <p className="mt-1 font-mono text-2xl text-paper">
                      {Math.round(sample.speed)} <span className="text-sm text-paper-dim">km/h</span>
                    </p>
                    {alsoB(`${Math.round(compareSample?.speed ?? 0)} km/h`)}
                  </div>
                  <div className="rounded-md border border-paper/10 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Gear</p>
                    <p className="mt-1 font-mono text-2xl text-paper">{sample.gear || "N"}</p>
                    {alsoB(`${compareSample?.gear || "N"}`)}
                  </div>
                  <div className="rounded-md border border-paper/10 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">RPM</p>
                    <p className="mt-1 font-mono text-2xl text-paper">{Math.round(sample.rpm)}</p>
                    {alsoB(`${Math.round(compareSample?.rpm ?? 0)}`)}
                  </div>
                  <div className="rounded-md border border-paper/10 px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">DRS</p>
                    {lapHasDrs(trace.samples) ? (
                      <p className={`mt-1 font-mono text-2xl ${isDrsActive(sample.drs) ? "text-pit-lime" : "text-paper-dim"}`}>
                        {isDrsActive(sample.drs) ? "Open" : "Closed"}
                      </p>
                    ) : (
                      // 2026 cars have no DRS; both sources report the channel as absent.
                      <p
                        className="mt-1 font-mono text-sm leading-8 text-paper-dim"
                        title="The 2026 rules replaced DRS with Overtake Mode"
                      >
                        None in 2026
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Bar label="Throttle" value={sample.throttle} />
                  <Bar label="Brake" value={sample.brake} />
                </div>
              </div>
            </div>

            <div className="rounded-md border border-paper/10 bg-pit-carbon">
              <TelemetryStack
                trace={trace}
                compare={compare}
                time={currentTime}
                corners={trace.corners}
                onSeek={seek}
              />
            </div>
            <p className="text-[11px] leading-relaxed text-paper-dim">
              Channels are plotted against distance and the laps aligned by relative distance, so a comparison
              lines up corner for corner; the delta ends at the lap-time difference. Drag across the chart or use
              the arrow keys to scrub.
            </p>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="race-overview-title" className="space-y-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">Whole race</p>
          <h2 id="race-overview-title" className="mt-1 font-display text-2xl uppercase tracking-wide text-paper">
            Race overview
          </h2>
          <p className="mt-1 text-xs text-paper-dim">
            Every driver&apos;s laps from{" "}
            <a
              href="https://github.com/TracingInsights"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber hover:underline"
            >
              TracingInsights
            </a>
            &apos; published session file — one request for the whole field.
          </p>
        </div>
        <RaceOverview
          highlight={highlighted}
          selectedLap={trace ? { driver: trace.driver.nameAcronym, lap: trace.lapNumber } : null}
          onPickLap={pickFromOverview}
        />
      </section>
    </div>
  );
}
