"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AboutNote } from "@/components/shared/AboutNote";
import { CircuitExplorer3D } from "@/components/circuit/CircuitExplorer3D";
import { SiteHeader } from "@/components/site-chrome";
import { circuitCorners } from "@/data/circuitCorners";
import { useTelemetryPlayback } from "@/hooks/useTelemetryPlayback";
import { fetchTelemetryDrivers, fetchTelemetryLaps } from "@/lib/api";
import { isDrsActive, sampleAt } from "@/lib/telemetry";
import type { TelemetryDriver, TelemetryLap } from "@/types/telemetry";

export default function CircuitPage() {
  const [selectedId, setSelectedId] = useState<string | null>(circuitCorners[0].id);
  const selected = circuitCorners.find((corner) => corner.id === selectedId) ?? null;

  const [realLapMode, setRealLapMode] = useState(false);
  const [drivers, setDrivers] = useState<TelemetryDriver[] | null>(null);
  const [driverNumber, setDriverNumber] = useState<number | null>(null);
  const [laps, setLaps] = useState<TelemetryLap[] | null>(null);
  const [lapNumber, setLapNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!realLapMode || drivers) return;
    fetchTelemetryDrivers()
      .then((data) => {
        setDrivers(data);
        if (data[0]) setDriverNumber(data[0].driverNumber);
      })
      .catch(() => setDrivers([]));
  }, [realLapMode, drivers]);

  useEffect(() => {
    if (driverNumber == null) return;
    setLaps(null);
    setLapNumber(null);
    fetchTelemetryLaps(driverNumber)
      .then((data) => {
        setLaps(data);
        const fastest = data.reduce<TelemetryLap | null>(
          (best, lap) => (!best || lap.lapDuration < best.lapDuration ? lap : best),
          null,
        );
        setLapNumber(fastest?.lapNumber ?? null);
      })
      .catch(() => setLaps([]));
  }, [driverNumber]);

  const playback = useTelemetryPlayback(realLapMode ? driverNumber : null, realLapMode ? lapNumber : null, {
    loop: true,
  });

  useEffect(() => {
    if (realLapMode && playback.trace && !playback.playing) playback.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to
    // a freshly-loaded trace or the mode toggling on, not to play()'s own
    // identity or every playing-state flip this effect itself can't cause.
  }, [realLapMode, playback.trace]);

  const currentSample = playback.trace ? sampleAt(playback.trace.samples, playback.currentTime) : null;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-6 sm:max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Circuit explorer
        </p>
        <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
          Sepang, corner by corner
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          Drag to orbit, or tap a corner below. Built from the circuit's
          real apex-point centreline — the same geometry behind the
          landing page's flyover hero and the 2D strategy map — covering
          all 15 named corners, not a stylized subset.
        </p>

        <label className="mt-4 flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-paper-dim">
          <input
            type="checkbox"
            checked={realLapMode}
            onChange={(e) => setRealLapMode(e.target.checked)}
            className="accent-amber"
          />
          Pace the car with a real recorded lap
        </label>
        {realLapMode ? (
          <p className="mt-1 text-xs leading-relaxed text-paper-dim">
            Real speed/throttle/brake from{" "}
            <a
              href="https://openf1.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber hover:underline"
            >
              OpenF1
            </a>{" "}
            drives how fast the car moves along this fictional track shape —
            the real corners don&apos;t line up with these ones, only the
            rhythm does. Full dashboard at{" "}
            <Link href="/telemetry" className="text-amber hover:underline">
              /telemetry
            </Link>
            .
          </p>
        ) : null}

        {realLapMode && drivers && drivers.length === 0 ? (
          <p className="mt-3 rounded-md border border-paper/10 bg-asphalt px-3 py-2 text-xs text-paper-dim">
            Real lap data isn&apos;t available right now — the car keeps its
            usual showcase pacing instead.
          </p>
        ) : null}

        {realLapMode && drivers && drivers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={driverNumber ?? ""}
              onChange={(e) => setDriverNumber(Number(e.target.value))}
              className="rounded-md border border-paper/15 bg-asphalt px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-paper"
            >
              {drivers.map((driver) => (
                <option key={driver.driverNumber} value={driver.driverNumber}>
                  #{driver.driverNumber} {driver.fullName}
                </option>
              ))}
            </select>
            <select
              value={lapNumber ?? ""}
              onChange={(e) => setLapNumber(Number(e.target.value))}
              disabled={!laps || laps.length === 0}
              className="rounded-md border border-paper/15 bg-asphalt px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-paper"
            >
              {laps === null ? <option>Loading laps…</option> : null}
              {laps?.map((lap) => (
                <option key={lap.lapNumber} value={lap.lapNumber}>
                  Lap {lap.lapNumber}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {realLapMode && drivers === null ? (
          <p className="mt-3 font-mono text-xs uppercase tracking-wide text-paper-dim">
            Loading drivers…
          </p>
        ) : null}

        <div className="mt-6">
          <CircuitExplorer3D
            selectedId={selectedId}
            onSelect={setSelectedId}
            realLap={
              realLapMode && playback.trace
                ? {
                    samples: playback.trace.samples,
                    distanceProgress: playback.distanceProgress,
                    currentTime: playback.currentTime,
                  }
                : null
            }
          />
        </div>

        {realLapMode && currentSample ? (
          <div className="mt-3 flex flex-wrap gap-4 rounded-md border border-paper/10 bg-asphalt px-3 py-2 font-mono text-xs text-paper">
            <span>{Math.round(currentSample.speed)} km/h</span>
            <span>Gear {currentSample.gear || "N"}</span>
            <span className={isDrsActive(currentSample.drs) ? "text-pit-lime" : "text-paper-dim"}>
              DRS {isDrsActive(currentSample.drs) ? "Open" : "Closed"}
            </span>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {circuitCorners.map((corner) => (
            <button
              key={corner.id}
              type="button"
              onClick={() => setSelectedId(corner.id)}
              aria-pressed={selectedId === corner.id}
              className={`rounded-md border px-3 py-2 text-left font-mono text-xs uppercase tracking-wide transition-colors ${
                selectedId === corner.id
                  ? "border-amber bg-amber/10 text-amber"
                  : "border-paper/10 text-paper-dim hover:text-paper"
              }`}
            >
              {corner.code}
            </button>
          ))}
        </div>

        {selected ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-lg border border-paper/10 bg-asphalt px-4 py-3"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
              {selected.code} · {selected.name}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-paper-dim">{selected.note}</p>
          </div>
        ) : null}

        <AboutNote />
      </main>
    </>
  );
}
