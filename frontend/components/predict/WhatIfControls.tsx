"use client";

import { COMPOUNDS, type Compound, type SimInputs, type WhatIf } from "@/types";

interface WhatIfControlsProps {
  whatIf: WhatIf;
  inputs: SimInputs | null;
  onChange: (next: WhatIf) => void;
  onReset: () => void;
}

const TYRE_OPTIONS: Array<Compound | "Auto"> = ["Auto", ...COMPOUNDS];

/**
 * Original side-profile safety-car silhouette — cropped tight to the car
 * itself (no road/background) so it can drop straight into the toggle below.
 * Deliberately unbranded (see docs/BRAND.md): this control lives on the
 * strategy tool, not /fan, so it gets the same generic treatment as
 * car.glb rather than a real, sponsor/FIA-liveried photo.
 */
function SafetyCarGlyph({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 56 28"
      className={`h-full w-full transition-colors ${active ? "text-amber" : "text-paper-dim"}`}
      aria-hidden="true"
    >
      {/* Beacon bar — lit (amber + brick) only when the safety car is out. */}
      <rect x={23} y={1} width={5} height={3} rx={1} fill={active ? "#f5a623" : "currentColor"} opacity={active ? 1 : 0.4} />
      <rect x={28} y={1} width={5} height={3} rx={1} fill={active ? "#c23b22" : "currentColor"} opacity={active ? 1 : 0.4} />
      {/* Body */}
      <path
        d="M6 20 L6 15 C6 12 8 10 11 10 L20 10 L25 4 C26.5 2.3 28.8 1.5 31 1.8 L38 3 C40 3.3 41.8 4.6 42.7 6.4 L45 10 L49 10 C51 10 52.5 11.5 52.5 13.5 L52.5 18 C52.5 19.1 51.6 20 50.5 20 Z"
        fill="currentColor"
      />
      {/* Cabin glass */}
      <path d="M21 10 L25.5 5.3 C26.5 4.2 28 3.6 29.5 3.8 L29.5 10 Z" fill="#0a0c0e" opacity={0.55} />
      <path d="M32 10 L32 4 L37.6 4.9 C39 5.1 40.2 6 40.9 7.2 L42.9 10 Z" fill="#0a0c0e" opacity={0.55} />
      {/* Wheels */}
      <circle cx={15} cy={21} r={3.6} fill="#0a0c0e" />
      <circle cx={15} cy={21} r={1.3} fill="currentColor" />
      <circle cx={42} cy={21} r={3.6} fill="#0a0c0e" />
      <circle cx={42} cy={21} r={1.3} fill="currentColor" />
    </svg>
  );
}

export function WhatIfControls({ whatIf, inputs, onChange, onReset }: WhatIfControlsProps) {
  const rain = Math.round(whatIf.rainProbability ?? inputs?.rainProbability ?? 40);
  const temp = Math.round(whatIf.tempC ?? inputs?.tempC ?? 32);
  const safetyCar = whatIf.safetyCar ?? inputs?.safetyCar ?? false;
  const tyre: Compound | "Auto" = whatIf.tyreChoice ?? "Auto";

  const touched =
    whatIf.rainProbability !== undefined ||
    whatIf.tempC !== undefined ||
    Boolean(whatIf.safetyCar) ||
    Boolean(whatIf.tyreChoice);

  return (
    <section className="rounded-lg border border-paper/10 bg-asphalt px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          What-if simulator
        </p>
        {touched ? (
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[10px] uppercase tracking-wide text-amber hover:underline"
          >
            Reset to live
          </button>
        ) : null}
      </div>

      <div className="mt-3 space-y-4">
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-[11px] text-paper-dim">
            <span>Rain probability</span>
            <span className="text-paper">{rain}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={rain}
            onChange={(event) => onChange({ ...whatIf, rainProbability: Number(event.target.value) })}
            className="mt-1 w-full accent-amber"
            aria-label="Rain probability"
          />
        </label>

        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-[11px] text-paper-dim">
            <span>Track / air temp</span>
            <span className="text-paper">{temp}°C</span>
          </span>
          <input
            type="range"
            min={22}
            max={48}
            step={1}
            value={temp}
            onChange={(event) => onChange({ ...whatIf, tempC: Number(event.target.value) })}
            className="mt-1 w-full accent-amber"
            aria-label="Track temperature"
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-paper-dim">Safety car</span>
          <button
            type="button"
            role="switch"
            aria-checked={safetyCar}
            aria-label="Safety car"
            onClick={() => onChange({ ...whatIf, safetyCar: !safetyCar })}
            className={`h-7 w-14 shrink-0 rounded-md transition-colors ${
              safetyCar ? "bg-amber/10" : "hover:bg-paper/5"
            }`}
          >
            <SafetyCarGlyph active={safetyCar} />
          </button>
        </div>

        <div>
          <span className="font-mono text-[11px] text-paper-dim">Starting tyre</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {TYRE_OPTIONS.map((option) => {
              const selected = tyre === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() =>
                    onChange({ ...whatIf, tyreChoice: option === "Auto" ? null : (option as Compound) })
                  }
                  className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors ${
                    selected
                      ? "border-amber bg-amber text-asphalt"
                      : "border-paper/20 text-paper-dim hover:border-amber hover:text-amber"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
