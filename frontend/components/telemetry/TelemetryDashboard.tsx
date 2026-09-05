"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchTelemetryDrivers, fetchTelemetryLaps } from "@/lib/api";
import { formatLapTime, isDrsActive, sampleAt } from "@/lib/telemetry";
import { useTelemetryPlayback } from "@/hooks/useTelemetryPlayback";
import type { TelemetryDriver, TelemetryLap } from "@/types/telemetry";

type FetchState<T> = { status: "loading" | "ready" | "error"; data: T | null };

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

export function TelemetryDashboard() {
  const [drivers, setDrivers] = useState<FetchState<TelemetryDriver[]>>({ status: "loading", data: null });
  const [driverNumber, setDriverNumber] = useState<number | null>(null);
  const [laps, setLaps] = useState<FetchState<TelemetryLap[]>>({ status: "loading", data: null });
  const [lapNumber, setLapNumber] = useState<number | null>(null);

  useEffect(() => {
    fetchTelemetryDrivers()
      .then((data) => {
        setDrivers({ status: "ready", data });
        if (data[0]) setDriverNumber(data[0].driverNumber);
      })
      .catch(() => setDrivers({ status: "error", data: null }));
  }, []);

  useEffect(() => {
    if (driverNumber == null) return;
    setLaps({ status: "loading", data: null });
    setLapNumber(null);
    fetchTelemetryLaps(driverNumber)
      .then((data) => {
        setLaps({ status: "ready", data });
        const fastest = data.reduce<TelemetryLap | null>(
          (best, lap) => (!best || lap.lapDuration < best.lapDuration ? lap : best),
          null,
        );
        setLapNumber(fastest?.lapNumber ?? null);
      })
      .catch(() => setLaps({ status: "error", data: null }));
  }, [driverNumber]);

  const { loading, error, trace, distanceProgress, currentTime, playing, play, pause, seek } =
    useTelemetryPlayback(driverNumber, lapNumber);

  const sample = trace ? sampleAt(trace.samples, currentTime) : null;
  void distanceProgress; // consumed by /circuit's real-lap mode, not this dashboard

  const speedPoints = useMemo(() => {
    if (!trace || trace.samples.length === 0) return "";
    const maxSpeed = Math.max(...trace.samples.map((s) => s.speed), 1);
    return trace.samples
      .map((s) => {
        const x = (s.t / trace.lapDuration) * 100;
        const y = 100 - (s.speed / maxSpeed) * 100;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [trace]);

  const chartRef = useRef<HTMLDivElement>(null);
  function handleScrub(clientX: number) {
    const el = chartRef.current;
    if (!el || !trace) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(fraction * trace.lapDuration);
  }

  if (drivers.status === "error") {
    return (
      <p className="rounded-lg border border-paper/10 bg-asphalt px-4 py-6 text-center text-sm text-paper-dim">
        Couldn&apos;t reach the telemetry backend. OpenF1 may be unavailable, or this specific
        session isn&apos;t in its archive yet — try again later.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={driverNumber ?? ""}
          onChange={(e) => setDriverNumber(Number(e.target.value))}
          disabled={drivers.status === "loading"}
          className="rounded-md border border-paper/15 bg-asphalt px-3 py-2 font-mono text-xs uppercase tracking-wide text-paper"
        >
          {drivers.status === "loading" ? <option>Loading drivers…</option> : null}
          {drivers.data?.map((driver) => (
            <option key={driver.driverNumber} value={driver.driverNumber}>
              #{driver.driverNumber} {driver.fullName} — {driver.teamName}
            </option>
          ))}
        </select>

        <select
          value={lapNumber ?? ""}
          onChange={(e) => setLapNumber(Number(e.target.value))}
          disabled={laps.status !== "ready"}
          className="rounded-md border border-paper/15 bg-asphalt px-3 py-2 font-mono text-xs uppercase tracking-wide text-paper"
        >
          {laps.status === "loading" ? <option>Loading laps…</option> : null}
          {laps.data?.map((lap) => (
            <option key={lap.lapNumber} value={lap.lapNumber}>
              Lap {lap.lapNumber} — {formatLapTime(lap.lapDuration)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="rounded-lg border border-paper/10 bg-asphalt px-4 py-6 text-center font-mono text-xs text-paper-dim">
          Loading lap telemetry…
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-paper/10 bg-asphalt px-4 py-6 text-center text-sm text-paper-dim">
          Couldn&apos;t load this lap&apos;s telemetry — pick a different driver or lap, or try again.
        </p>
      ) : null}

      {trace && sample ? (
        <div className="rounded-lg border border-paper/10 bg-asphalt px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
                {trace.driver.fullName} · Lap {trace.lapNumber}
              </p>
              <p className="mt-0.5 text-xs text-paper-dim">
                {trace.circuitShortName} · {trace.year} {trace.sessionName}
              </p>
            </div>
            <button
              type="button"
              onClick={playing ? pause : play}
              className="rounded-full border border-paper/20 px-4 py-1.5 font-mono text-xs uppercase tracking-wide text-paper hover:border-amber hover:text-amber"
            >
              {playing ? "Pause" : "Play"}
            </button>
          </div>

          <div
            ref={chartRef}
            role="slider"
            aria-label="Lap position"
            aria-valuemin={0}
            aria-valuemax={trace.lapDuration}
            aria-valuenow={currentTime}
            tabIndex={0}
            onClick={(e) => handleScrub(e.clientX)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") seek(currentTime + 1);
              if (e.key === "ArrowLeft") seek(currentTime - 1);
            }}
            className="relative mt-4 h-20 cursor-pointer rounded-md border border-paper/10 bg-pit-carbon"
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
              <polyline
                points={speedPoints}
                fill="none"
                stroke="#2ec4b6"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-amber"
              style={{ left: `${(currentTime / trace.lapDuration) * 100}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] text-paper-dim">
            {formatLapTime(currentTime)} / {formatLapTime(trace.lapDuration)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-paper/10 px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Speed</p>
              <p className="mt-1 font-mono text-lg text-paper">{Math.round(sample.speed)} km/h</p>
            </div>
            <div className="rounded-md border border-paper/10 px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">Gear</p>
              <p className="mt-1 font-mono text-lg text-paper">{sample.gear || "N"}</p>
            </div>
            <div className="rounded-md border border-paper/10 px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">RPM</p>
              <p className="mt-1 font-mono text-lg text-paper">{Math.round(sample.rpm)}</p>
            </div>
            <div className="rounded-md border border-paper/10 px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">DRS</p>
              <p className={`mt-1 font-mono text-lg ${isDrsActive(sample.drs) ? "text-pit-lime" : "text-paper-dim"}`}>
                {isDrsActive(sample.drs) ? "Open" : "Closed"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Bar label="Throttle" value={sample.throttle} />
            <Bar label="Brake" value={sample.brake} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
