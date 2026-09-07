"use client";

import { COMPOUNDS, type Compound, type SimInputs, type WhatIf } from "@/types";

interface WhatIfControlsProps {
  whatIf: WhatIf;
  inputs: SimInputs | null;
  onChange: (next: WhatIf) => void;
  onReset: () => void;
}

const TYRE_OPTIONS: Array<Compound | "Auto"> = ["Auto", ...COMPOUNDS];

// Real Pirelli sidewall colors — informational, not decorative, so these
// stay true to the actual compound colors rather than forced into the
// brand palette (the same reasoning data/f1Guide.ts's tyre-compounds card
// already states in words: "Hard (white sidewall), Medium (yellow), Soft
// (red)"). Intermediate/Wet aren't raced in a dry-only what-if sim's
// normal range but stay selectable, so they get their real colors too.
const TYRE_COLOR: Record<Compound, string> = {
  Hard: "#f4efe6",
  Medium: "#ffd200",
  Soft: "#c23b22",
  Intermediate: "#43b02a",
  Wet: "#1e5bc6",
};

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

/**
 * Original side-profile tyre icon — tread block pattern + a sidewall band
 * in the compound's real color (see TYRE_COLOR above). "Auto" gets a
 * dashed, colorless outline instead of picking a compound for it.
 */
function TyreGlyph({ compound }: { compound: Compound | "Auto" }) {
  const isAuto = compound === "Auto";
  const sidewallColor = isAuto ? "none" : TYRE_COLOR[compound];

  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
      <circle
        cx={20}
        cy={20}
        r={17.5}
        fill="#0a0c0e"
        stroke={isAuto ? "currentColor" : "none"}
        strokeWidth={isAuto ? 1.5 : 0}
        strokeDasharray={isAuto ? "3 3" : undefined}
        className={isAuto ? "text-paper-dim" : undefined}
      />
      {/* Sidewall band carrying the compound color. */}
      {!isAuto ? <circle cx={20} cy={20} r={13.5} fill="none" stroke={sidewallColor} strokeWidth={3} /> : null}
      {/* Tread blocks around the rim. */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2;
        const x1 = 20 + Math.cos(angle) * 15.5;
        const y1 = 20 + Math.sin(angle) * 15.5;
        const x2 = 20 + Math.cos(angle) * 17.5;
        const y2 = 20 + Math.sin(angle) * 17.5;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#0a0c0e"
            strokeWidth={2.5}
            className={isAuto ? "opacity-30" : undefined}
          />
        );
      })}
      {/* Hub */}
      <circle cx={20} cy={20} r={6} fill="#2a3036" />
      <circle cx={20} cy={20} r={2} fill={isAuto ? "#a39b8f" : sidewallColor} />
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
            <span>
              <span aria-hidden>🌧️</span> Rain probability
            </span>
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
            <span>
              <span aria-hidden>🌡️</span> Track / air temp
            </span>
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

        <div>
          <span className="font-mono text-[11px] text-paper-dim">Safety car</span>
          <button
            type="button"
            role="switch"
            aria-checked={safetyCar}
            onClick={() => onChange({ ...whatIf, safetyCar: !safetyCar })}
            className={`mt-1.5 flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
              safetyCar
                ? "border-amber bg-amber/10"
                : "border-paper/15 bg-asphalt hover:border-paper/30"
            }`}
          >
            <span className="h-10 w-16 shrink-0">
              <SafetyCarGlyph active={safetyCar} />
            </span>
            <span>
              <span className={`block font-display text-sm uppercase tracking-wide ${safetyCar ? "text-amber" : "text-paper"}`}>
                {safetyCar ? "Deployed" : "Track clear"}
              </span>
              <span className="block text-[11px] text-paper-dim">
                {safetyCar ? "Field bunched, pit cost falls" : "Tap to force a safety car"}
              </span>
            </span>
          </button>
        </div>

        <div>
          <span className="font-mono text-[11px] text-paper-dim">Starting tyre</span>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {TYRE_OPTIONS.map((option) => {
              const selected = tyre === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    onChange({ ...whatIf, tyreChoice: option === "Auto" ? null : (option as Compound) })
                  }
                  className={`flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 transition-colors ${
                    selected
                      ? "border-amber bg-amber/10"
                      : "border-paper/15 hover:border-paper/30"
                  }`}
                >
                  <span className="h-8 w-8">
                    <TyreGlyph compound={option} />
                  </span>
                  <span
                    className={`font-mono text-[9px] uppercase tracking-wide ${
                      selected ? "text-amber" : "text-paper-dim"
                    }`}
                  >
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
