"use client";

import { COMPOUNDS, type Compound, type SimInputs, type WhatIf } from "@/types";

interface WhatIfControlsProps {
  whatIf: WhatIf;
  inputs: SimInputs | null;
  onChange: (next: WhatIf) => void;
  onReset: () => void;
}

const TYRE_OPTIONS: Array<Compound | "Auto"> = ["Auto", ...COMPOUNDS];

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
            className={`relative h-6 w-11 rounded-full transition-colors ${
              safetyCar ? "bg-amber" : "bg-asphalt-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper transition-transform ${
                safetyCar ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
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
