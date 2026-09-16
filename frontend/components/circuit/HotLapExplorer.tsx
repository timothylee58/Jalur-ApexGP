"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { HotLap3D, type CameraMode, type SeekRequest } from "@/components/circuit/HotLap3D";
import { formatLapTime, simulateLap, type LapSample } from "@/lib/lapSim";

const SECTOR_CLASS = [
  { text: "text-amber", border: "border-amber", bg: "bg-amber/10", dot: "bg-amber" },
  { text: "text-teal", border: "border-teal", bg: "bg-teal/10", dot: "bg-teal" },
  { text: "text-pit-lime", border: "border-pit-lime", bg: "bg-pit-lime/10", dot: "bg-pit-lime" },
] as const;

/** Sepang's real F1 race lap record, for honest comparison against the sim. */
const REAL_LAP_RECORD = { time: "1:34.080", who: "Lewis Hamilton", year: 2017 };

function PedalBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 font-mono text-[9px] uppercase tracking-wide text-paper-dim">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper/10">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ${tone}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function HotLapExplorer() {
  const lap = useMemo(() => simulateLap(), []);
  const [playing, setPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>("orbit");
  const [focusTurn, setFocusTurn] = useState<number | null>(null);
  const [seek, setSeek] = useState<SeekRequest | null>(null);
  const [sample, setSample] = useState<LapSample>(lap.samples[0]);
  const nonceRef = useRef(0);

  const onSample = useCallback((next: LapSample) => setSample(next), []);

  const jumpToCorner = useCallback((turn: number) => {
    const corner = lap.corners.find((c) => c.turn === turn);
    if (!corner) return;
    setFocusTurn(turn);
    // Arrive a beat before the apex so the braking zone is on screen, which
    // is the part worth watching.
    const target = lap.samples.reduce((best, s) =>
      Math.abs(s.s - corner.s) < Math.abs(best.s - corner.s) ? s : best,
    );
    nonceRef.current += 1;
    setSeek({ t: Math.max(0, target.t - 1.6), nonce: nonceRef.current });
    setPlaying(true);
  }, [lap]);

  const restart = useCallback(() => {
    nonceRef.current += 1;
    setSeek({ t: 0, nonce: nonceRef.current });
    setFocusTurn(null);
    setPlaying(true);
  }, []);

  const focused = focusTurn ? lap.corners.find((c) => c.turn === focusTurn) ?? null : null;
  const sectorStyle = SECTOR_CLASS[sample.sector - 1];

  return (
    <div>
      {/* --- Headline + stat tiles ---------------------------------------- */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-sm ${sectorStyle.dot}`} aria-hidden />
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          Simulated hot lap
        </p>
      </div>
      <h1 className="mt-2 font-display text-4xl uppercase leading-[0.95] tracking-wide text-paper sm:text-5xl">
        {(lap.lengthM / 1000).toFixed(3)} km,
        <br />
        <span className="text-brick">in {Math.round(lap.lapTimeS)} seconds.</span>
      </h1>

      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-paper/10 bg-paper/10">
        <div className="bg-asphalt px-3 py-2.5">
          <p className="font-display text-xl tracking-wide text-paper">
            {formatLapTime(lap.lapTimeS)}
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
            Sim lap
          </p>
        </div>
        <div className="bg-asphalt px-3 py-2.5">
          <p className="font-display text-xl tracking-wide text-paper">
            {Math.round(lap.topSpeedKmh)} <span className="text-sm text-paper-dim">km/h</span>
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
            Top speed
          </p>
        </div>
        <div className="bg-asphalt px-3 py-2.5">
          <p className="font-display text-xl tracking-wide text-paper">
            {Math.round(lap.flatOutFraction * 100)}%
          </p>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
            Flat out
          </p>
        </div>
      </div>

      {/* --- Controls ------------------------------------------------------ */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="rounded-full bg-brick px-5 py-2 font-mono text-xs uppercase tracking-wide text-paper transition-opacity hover:opacity-90"
        >
          {playing ? "Pause lap" : "Play lap"}
        </button>
        <button
          type="button"
          onClick={restart}
          className="rounded-full border border-paper/20 px-4 py-2 font-mono text-xs uppercase tracking-wide text-paper-dim transition-colors hover:border-paper/40 hover:text-paper"
        >
          Restart
        </button>
        <div
          role="radiogroup"
          aria-label="Camera"
          className="ml-auto flex items-center gap-1 rounded-full border border-paper/15 p-0.5"
        >
          {(["orbit", "chase"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={cameraMode === mode}
              onClick={() => setCameraMode(mode)}
              className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                cameraMode === mode ? "bg-paper/10 text-amber" : "text-paper-dim hover:text-paper"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* --- Scene + HUD --------------------------------------------------- */}
      <div className="relative mt-3">
        <HotLap3D
          playing={playing}
          cameraMode={cameraMode}
          focusTurn={focusTurn}
          seek={seek}
          onSample={onSample}
        />

        <div
          className="pointer-events-none absolute left-3 top-3 w-[11.5rem] rounded-md border border-paper/15 bg-pit-carbon/85 p-3 backdrop-blur"
          role="status"
          aria-live="off"
        >
          <div className="flex items-baseline gap-1">
            <span className="font-display text-3xl leading-none tracking-wide text-paper tabular-nums">
              {Math.round(sample.speedKmh)}
            </span>
            <span className="font-mono text-[10px] uppercase text-paper-dim">km/h</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-paper-dim tabular-nums">
            <span>{formatLapTime(sample.t)}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${sectorStyle.bg} ${sectorStyle.text}`}>
              S{sample.sector}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-paper/10 pt-2 font-mono text-[10px] uppercase tracking-wide text-paper-dim">
            <span>
              Gear <span className="text-paper">{sample.gear}</span>
            </span>
            {sample.braking ? (
              <span className="text-brick">Braking {Math.abs(sample.longG).toFixed(1)}g</span>
            ) : (
              <span>{Math.round(sample.s)} m</span>
            )}
          </div>
          <div className="mt-2 space-y-1">
            <PedalBar label="Thr" value={sample.throttle} tone="bg-pit-lime" />
            <PedalBar label="Brk" value={sample.brake} tone="bg-brick" />
          </div>
        </div>

        {focused ? (
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-md border border-paper/15 bg-pit-carbon/85 p-3 backdrop-blur sm:right-auto sm:max-w-md">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">
              {focused.code}
              {focused.label ? ` · ${focused.label}` : ""} · {focused.direction} ·{" "}
              {Math.round(focused.apexSpeedKmh)} km/h · gear {focused.gear}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-paper-dim">{focused.note}</p>
          </div>
        ) : null}
      </div>

      {/* --- Sector splits -------------------------------------------------- */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {lap.sectorTimesS.map((time, index) => {
          const style = SECTOR_CLASS[index];
          const live = sample.sector === index + 1;
          return (
            <div
              key={index}
              className={`rounded-md border px-3 py-2 transition-colors ${
                live ? `${style.border} ${style.bg}` : "border-paper/10 bg-asphalt"
              }`}
            >
              <p className={`font-mono text-[9px] uppercase tracking-[0.2em] ${style.text}`}>
                Sector {index + 1}
              </p>
              <p className="mt-1 font-display text-lg tracking-wide text-paper tabular-nums">
                {time.toFixed(3)}
              </p>
            </div>
          );
        })}
      </div>

      {/* --- Braking zones --------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="font-display text-xl uppercase tracking-wide text-paper">
          Braking zones
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
          Not drawn on by hand — these fall out of the solver wherever it has to shed
          speed for the next corner, so the length and peak load are consequences of
          the apex speed it is braking to.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {lap.brakingZones.map((zone) => (
            <button
              key={zone.id}
              type="button"
              onClick={() => zone.cornerCode && jumpToCorner(Number(zone.cornerCode.slice(1)))}
              className="rounded-md border border-paper/10 bg-asphalt px-3 py-2.5 text-left transition-colors hover:border-brick/50"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-display text-base uppercase tracking-wide text-paper">
                  Into {zone.cornerCode}
                </span>
                <span className="font-mono text-[10px] uppercase text-brick">
                  {Math.abs(zone.peakG).toFixed(1)}g peak
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-paper-dim tabular-nums">
                {Math.round(zone.entrySpeedKmh)} → {Math.round(zone.minSpeedKmh)} km/h over{" "}
                {Math.round(zone.lengthM)} m
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* --- Corner breakdown ------------------------------------------------ */}
      <section className="mt-8">
        <h2 className="font-display text-xl uppercase tracking-wide text-paper">
          Every corner, apex speed and gear
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-paper-dim">
          Tap a corner to jump the lap to its braking zone. Speeds marked{" "}
          <span className="font-mono text-[11px] text-paper-dim">EST</span> are reasoned
          from the corner&apos;s described character rather than taken from a published
          guide — treat those as the softest numbers here.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-paper/10 font-mono text-[9px] uppercase tracking-[0.2em] text-paper-dim">
                <th scope="col" className="py-2 pr-3 font-normal">Corner</th>
                <th scope="col" className="py-2 pr-3 font-normal">Dir</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Entry</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Apex</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Gear</th>
                <th scope="col" className="py-2 text-right font-normal">Sector</th>
              </tr>
            </thead>
            <tbody>
              {lap.corners.map((corner) => {
                const style = SECTOR_CLASS[corner.sector - 1];
                const active = focusTurn === corner.turn;
                return (
                  <tr
                    key={corner.turn}
                    onClick={() => jumpToCorner(corner.turn)}
                    tabIndex={0}
                    role="button"
                    aria-pressed={active}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        jumpToCorner(corner.turn);
                      }
                    }}
                    className={`cursor-pointer border-b border-paper/5 font-mono text-xs tabular-nums transition-colors ${
                      active ? style.bg : "hover:bg-paper/5"
                    }`}
                  >
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span className={`font-display text-sm tracking-wide ${active ? style.text : "text-paper"}`}>
                        {corner.code}
                      </span>
                      {corner.label ? (
                        <span className="ml-2 text-[10px] text-paper-dim">{corner.label}</span>
                      ) : null}
                      {!corner.sourced ? (
                        <span className="ml-2 rounded bg-paper/10 px-1 text-[9px] uppercase text-paper-dim">
                          est
                        </span>
                      ) : null}
                    </th>
                    <td className="py-2 pr-3 text-paper-dim">{corner.direction === "left" ? "L" : "R"}</td>
                    <td className="py-2 pr-3 text-right text-paper-dim">
                      {Math.round(corner.entrySpeedKmh)}
                    </td>
                    <td className="py-2 pr-3 text-right text-paper">
                      {Math.round(corner.apexSpeedKmh)}
                    </td>
                    <td className="py-2 pr-3 text-right text-paper-dim">{corner.gear}</td>
                    <td className={`py-2 text-right ${style.text}`}>S{corner.sector}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- Honesty note ----------------------------------------------------- */}
      <section className="mt-8 rounded-lg border border-paper/10 bg-asphalt px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
          What this lap is, and is not
        </p>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          It is a solved lap, not a recorded one. Apex speeds come from published
          circuit guides where one exists and are reasoned where one does not; the
          braking, acceleration and lap time between those apexes are solved from
          ballpark 2026-regulation car figures. Nothing here is telemetry, and no
          real driver drove it.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">
          It comes out at{" "}
          <span className="text-paper">{formatLapTime(lap.lapTimeS)}</span> against a
          real Sepang F1 race lap record of{" "}
          <span className="text-paper">{REAL_LAP_RECORD.time}</span> (
          {REAL_LAP_RECORD.who}, {REAL_LAP_RECORD.year}) — about{" "}
          {Math.round(94.08 - lap.lapTimeS)} seconds quick. That gap is honest and
          known: the lap is solved over one point per corner, so each corner is a
          single apex speed rather than an arc the car has to stay slow through,
          and the car spends more of the lap accelerating than a real one does.
          Closing it needs the solver run over the full traced centreline, not a
          tuning pass on the physics.
        </p>
      </section>
    </div>
  );
}
