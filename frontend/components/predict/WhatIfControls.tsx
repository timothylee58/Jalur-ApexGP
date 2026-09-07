"use client";

import { useRef, type KeyboardEvent } from "react";
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
// brand palette (Hard: white sidewall, Medium: yellow, Soft: red).
// Intermediate/Wet aren't raced in a dry-only what-if sim's normal range
// but stay selectable, so they get their real colors too.
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
 * car.glb rather than a real, sponsor/FIA-liveried photo — no manufacturer
 * marque, no sponsor decals, no readable text.
 *
 * Body paint is always "safety-car red" (a real one always is — what
 * actually changes when one's deployed is the beacon lights, not the
 * paint), pushed toward some real photographed-car drama instead of a flat
 * icon fill: a glossy gradient, a soft amber glow behind the beacons when
 * lit, motion streaks trailing the car once it's moving, and a ground
 * shadow for depth.
 */
function SafetyCarGlyph({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 64 30" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="sc-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2543a" />
          <stop offset="55%" stopColor="#c23b22" />
          <stop offset="100%" stopColor="#8f2a18" />
        </linearGradient>
        <radialGradient id="sc-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f5a623" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#f5a623" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Ground shadow. */}
      <ellipse cx={30} cy={25.5} rx={22} ry={2.2} fill="#000" opacity={0.35} />

      {/* Motion streaks — only trail the car once it's deployed and moving. */}
      {active ? (
        <g opacity={0.6}>
          <rect x={0} y={13} width={9} height={1.3} rx={0.65} fill="#f4efe6" opacity={0.5} />
          <rect x={0} y={17} width={5} height={1.1} rx={0.55} fill="#f4efe6" opacity={0.35} />
          <rect x={0} y={9.5} width={5} height={1} rx={0.5} fill="#f4efe6" opacity={0.3} />
        </g>
      ) : null}

      {/* Beacon glow, behind the lights, only lit when deployed. */}
      {active ? <circle cx={30} cy={3} r={9} fill="url(#sc-glow)" /> : null}
      {/* Beacon bar. */}
      <rect x={26} y={1} width={5} height={3} rx={1} fill={active ? "#f5a623" : "#4a5158"} />
      <rect x={31} y={1} width={5} height={3} rx={1} fill={active ? "#c23b22" : "#3a4046"} />

      {/* Body — glossy gradient red, dimmed when parked/not deployed. */}
      <g opacity={active ? 1 : 0.6}>
        <path
          d="M10 22 L10 17 C10 14 12 12 15 12 L24 12 L29 6 C30.5 4.3 32.8 3.5 35 3.8 L42 5 C44 5.3 45.8 6.6 46.7 8.4 L49 12 L53 12 C55 12 56.5 13.5 56.5 15.5 L56.5 20 C56.5 21.1 55.6 22 54.5 22 Z"
          fill="url(#sc-body)"
        />
        {/* Specular highlight along the roofline — the "photographed gloss". */}
        <path d="M25 12 L30 6.5 C31.3 5.1 33.1 4.4 35 4.6 L40.5 5.6" stroke="#ffb89f" strokeWidth={0.8} strokeLinecap="round" opacity={0.7} fill="none" />
        {/* Cabin glass */}
        <path d="M25 12 L29.5 7.3 C30.5 6.2 32 5.6 33.5 5.8 L33.5 12 Z" fill="#0a0c0e" opacity={0.6} />
        <path d="M36 12 L36 6 L41.6 6.9 C43 7.1 44.2 8 44.9 9.2 L46.9 12 Z" fill="#0a0c0e" opacity={0.6} />
        {/* Front splitter, evokes the aero of a real safety car without copying one. */}
        <rect x={7} y={20.5} width={7} height={1.6} rx={0.6} fill="#0a0c0e" opacity={0.7} />
      </g>

      {/* Wheels */}
      <circle cx={19} cy={23} r={3.8} fill="#0a0c0e" />
      <circle cx={19} cy={23} r={1.4} fill={active ? "#f5a623" : "#4a5158"} />
      <circle cx={46} cy={23} r={3.8} fill="#0a0c0e" />
      <circle cx={46} cy={23} r={1.4} fill={active ? "#f5a623" : "#4a5158"} />
    </svg>
  );
}

// Real F1 dry compounds (Soft/Medium/Hard, the "P Zero" family) are slick
// — zero tread pattern, that's the entire point of a slick tyre. Only the
// two wet-weather compounds carry circumferential tread grooves, and Wet's
// are visibly deeper/denser than Intermediate's — confirmed against real
// reference photos of mounted F1 tyres (deep chevron-block grooves on a
// full wet vs. a lighter groove count on an intermediate vs. bald slicks),
// not guessed. Reproduced here as dashed rings (a stroke-dasharray on a
// circle), not the actual tread-block artwork or any Pirelli/P Zero/
// Cinturato text from those photos.
const TREAD_DASH: Partial<Record<Compound, string>> = {
  Intermediate: "2 2.6",
  Wet: "1.4 1.1",
};

/**
 * Original side-profile tyre icon — a sidewall band in the compound's real
 * color (see TYRE_COLOR above), slick or treaded to match the real
 * compound, plus a soft gloss highlight evoking photographed rubber.
 * "Auto" gets a dashed, colorless outline instead of picking a compound.
 */
function TyreGlyph({ compound }: { compound: Compound | "Auto" }) {
  const isAuto = compound === "Auto";
  const sidewallColor = isAuto ? "none" : TYRE_COLOR[compound];
  const treadDash = isAuto ? undefined : TREAD_DASH[compound];

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
      {/* Gloss highlight — real tread rubber reads as glossy/reflective,
          not flat matte, under any real light. */}
      <path
        d="M8.5 12.5 A17.5 17.5 0 0 1 17 3.2"
        stroke="#fff"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.18}
      />
      {/* Tread grooves — only for wet-weather compounds, see TREAD_DASH. */}
      {treadDash ? (
        <circle
          cx={20}
          cy={20}
          r={16}
          fill="none"
          stroke="#2a3036"
          strokeWidth={2.2}
          strokeDasharray={treadDash}
        />
      ) : null}
      {/* Sidewall band carrying the compound color. */}
      {!isAuto ? <circle cx={20} cy={20} r={13} fill="none" stroke={sidewallColor} strokeWidth={2.6} /> : null}
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

  // WAI-ARIA radiogroup pattern: arrow keys move focus AND selection
  // together (like a native <input type="radio"> group), with roving
  // tabindex — only the checked option sits in the tab order, everything
  // else is reached via arrow keys once the group has focus.
  const tyreButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectTyreAt = (index: number) => {
    const wrapped = (index + TYRE_OPTIONS.length) % TYRE_OPTIONS.length;
    const option = TYRE_OPTIONS[wrapped];
    onChange({ ...whatIf, tyreChoice: option === "Auto" ? null : (option as Compound) });
    tyreButtonRefs.current[wrapped]?.focus();
  };

  const handleTyreKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = TYRE_OPTIONS.indexOf(tyre);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectTyreAt(currentIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectTyreAt(currentIndex - 1);
    }
  };

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
          <div
            role="radiogroup"
            aria-label="Starting tyre"
            onKeyDown={handleTyreKeyDown}
            className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6"
          >
            {TYRE_OPTIONS.map((option, index) => {
              const selected = tyre === option;
              return (
                <button
                  key={option}
                  ref={(el) => {
                    tyreButtonRefs.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() =>
                    onChange({ ...whatIf, tyreChoice: option === "Auto" ? null : (option as Compound) })
                  }
                  className={`flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 transition-colors ${
                    selected
                      ? "border-amber bg-amber/10"
                      : "border-paper/15 hover:border-paper/30"
                  }`}
                >
                  <span className="h-8 w-8" style={{ perspective: "180px" }}>
                    <span
                      className="animate-tyre-spin block h-full w-full"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <TyreGlyph compound={option} />
                    </span>
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
