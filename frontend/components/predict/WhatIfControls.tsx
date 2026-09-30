"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { SafetyCarArt } from "@/components/predict/SafetyCarArt";
import { TyreArt, type TyreOption } from "@/components/predict/TyreArt";
import { TYRE_COLOR } from "@/lib/tyreColors";
import { useTyreThumbnails } from "@/components/predict/tyre3d/useTyreThumbnails";
import { adjustedLife, tyreFit, type TyreFit } from "@/lib/tyreModel";
import { COMPOUNDS, type Compound, type SimInputs, type WhatIf } from "@/types";

interface WhatIfControlsProps {
  whatIf: WhatIf;
  inputs: SimInputs | null;
  onChange: (next: WhatIf) => void;
  onReset: () => void;
}

const TYRE_OPTIONS: TyreOption[] = ["Auto", ...COMPOUNDS];

const SHORT_LABEL: Record<TyreOption, string> = {
  Auto: "Auto",
  Soft: "Soft",
  Medium: "Medium",
  Hard: "Hard",
  Intermediate: "Inter",
  Wet: "Wet",
};

// three.js stays out of the /predict entry chunk; the SVG tyre holds the
// stage until the model has drawn its first frame.
const TyreShowcase = dynamic(
  () => import("@/components/predict/tyre3d/TyreShowcase").then((m) => m.TyreShowcase),
  { ssr: false },
);

const PRODUCT: Record<TyreOption, string> = {
  Auto: "Engine picks",
  Soft: "P Zero · Soft",
  Medium: "P Zero · Medium",
  Hard: "P Zero · Hard",
  Intermediate: "Cinturato · Intermediate",
  Wet: "Cinturato · Full wet",
};

const FIT_COPY: Record<TyreFit, { label: string; tone: string }> = {
  good: { label: "Suits these conditions", tone: "text-teal" },
  marginal: { label: "Marginal here — small confidence hit", tone: "text-amber" },
  wrong: { label: "Wrong tyre for these conditions", tone: "text-brick" },
};

export function WhatIfControls({ whatIf, inputs, onChange, onReset }: WhatIfControlsProps) {
  // The live read is a blended float; the backend's tyre-fit bands compare
  // the raw value, so the readout must too — rounding 34.6 up to 35 would
  // flip a slick from "suits" to "marginal" the engine never applied.
  const rainRaw = whatIf.rainProbability ?? inputs?.rainProbability ?? 40;
  const rain = Math.round(rainRaw);
  const temp = Math.round(whatIf.tempC ?? inputs?.tempC ?? 32);
  const safetyCar = whatIf.safetyCar ?? inputs?.safetyCar ?? false;
  const tyre: Compound | "Auto" = whatIf.tyreChoice ?? "Auto";

  // WAI-ARIA radiogroup pattern: arrow keys move focus AND selection
  // together (like a native <input type="radio"> group), with roving
  // tabindex — only the checked option sits in the tab order, everything
  // else is reached via arrow keys once the group has focus.
  const thumbs = useTyreThumbnails();
  const [showcaseReady, setShowcaseReady] = useState(false);
  const tyreFallback = (
    <span className="absolute inset-0 flex items-center justify-center p-6">
      <span className="aspect-square h-full">
        <TyreArt option={tyre} selected />
      </span>
    </span>
  );
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
          <span id="whatif-sc-label" className="font-mono text-[11px] text-paper-dim">
            Safety car
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={safetyCar}
            aria-labelledby="whatif-sc-label"
            aria-describedby="whatif-sc-state"
            onClick={() => onChange({ ...whatIf, safetyCar: !safetyCar })}
            className={`group mt-1.5 block w-full overflow-hidden rounded-md border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ${
              safetyCar ? "border-amber/70" : "border-paper/15 hover:border-paper/35"
            }`}
          >
            <span
              className={`relative block aspect-[2/1] max-h-56 w-full transition-colors duration-500 ${
                safetyCar
                  ? "bg-[radial-gradient(ellipse_at_45%_20%,rgba(245,166,35,0.16),transparent_60%),linear-gradient(#0d1013,#0a0c0e)]"
                  : "bg-[linear-gradient(#0d1013,#0a0c0e)]"
              }`}
            >
              <span className="absolute inset-x-3 inset-y-2">
                <SafetyCarArt deployed={safetyCar} />
              </span>
            </span>
            <span
              className={`flex items-center gap-3 border-t px-3 py-2.5 transition-colors ${
                safetyCar ? "border-amber/30 bg-amber/10" : "border-paper/10 bg-asphalt"
              }`}
            >
              <span id="whatif-sc-state" className="min-w-0 flex-1">
                <span
                  className={`block font-display text-base uppercase tracking-wide ${
                    safetyCar ? "text-amber" : "text-paper"
                  }`}
                >
                  {safetyCar ? "Safety car deployed" : "Track clear"}
                </span>
                <span className="block text-[11px] leading-snug text-paper-dim">
                  {safetyCar
                    ? "Field bunched up — a pit stop now costs far less time"
                    : "Tap to send the safety car out and see the strategy change"}
                </span>
              </span>
              {/* A real switch track, so the control reads as on/off at a
                  glance rather than relying on the artwork alone. */}
              <span
                aria-hidden="true"
                className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300 ${
                  safetyCar ? "border-amber bg-amber/25" : "border-paper/25 bg-pit-carbon"
                }`}
              >
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none ${
                    safetyCar ? "left-[22px] bg-amber shadow-[0_0_10px_rgba(245,166,35,0.8)]" : "left-[3px] bg-paper-dim"
                  }`}
                />
              </span>
            </span>
          </button>
        </div>

        <div>
          <span id="whatif-tyre-label" className="font-mono text-[11px] text-paper-dim">
            Starting tyre
          </span>
          <div className="relative mt-1.5 block aspect-[2/1] max-h-56 w-full overflow-hidden rounded-md border border-paper/15 bg-[radial-gradient(ellipse_at_50%_85%,rgba(125,140,255,0.10),transparent_60%),linear-gradient(#0d1013,#0a0c0e)]">
            {/* The SVG tyre holds the stage while the 3D chunk loads and
                until its first frame is drawn. */}
            {showcaseReady ? null : tyreFallback}
            <TyreShowcase option={tyre} fallback={tyreFallback} onReady={() => setShowcaseReady(true)} />
            <span className="pointer-events-none absolute bottom-2.5 left-3 font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim">
              <span
                aria-hidden="true"
                className="mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ background: tyre === "Auto" ? "#f5a623" : TYRE_COLOR[tyre] }}
              />
              {PRODUCT[tyre]}
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 right-3 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-paper-dim/60 sm:inline"
            >
              Drag to turn
            </span>
          </div>
          <div
            role="radiogroup"
            aria-labelledby="whatif-tyre-label"
            aria-describedby="whatif-tyre-readout"
            onKeyDown={handleTyreKeyDown}
            className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6"
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
                  aria-label={option === "Auto" ? "Auto — let the engine pick" : option}
                  tabIndex={selected ? 0 : -1}
                  onClick={() =>
                    onChange({ ...whatIf, tyreChoice: option === "Auto" ? null : (option as Compound) })
                  }
                  className={`flex flex-col items-center gap-1.5 rounded-md border px-1 pb-2 pt-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt ${
                    selected
                      ? "border-paper/40 bg-pit-carbon"
                      : "border-paper/10 hover:border-paper/30 hover:bg-pit-carbon/60"
                  }`}
                >
                  <span className="h-11 w-11 sm:h-14 sm:w-14">
                    {thumbs && option !== "Auto" ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data: URL rendered client-side
                      <img
                        src={thumbs[option]}
                        alt=""
                        className={`h-full w-full object-contain transition-transform duration-500 ease-out motion-reduce:transition-none ${
                          selected ? "scale-110" : "opacity-80"
                        }`}
                      />
                    ) : (
                      <TyreArt option={option} selected={selected} />
                    )}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                      selected ? "text-paper" : "text-paper-dim"
                    }`}
                  >
                    {SHORT_LABEL[option]}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-5 rounded-full transition-opacity"
                    style={{
                      background: option === "Auto" ? "#f5a623" : TYRE_COLOR[option],
                      opacity: selected ? 1 : 0,
                    }}
                  />
                </button>
              );
            })}
          </div>
          <TyreReadout tyre={tyre} rain={rainRaw} temp={temp} />
        </div>
      </div>
    </section>
  );
}

function TyreReadout({ tyre, rain, temp }: { tyre: TyreOption; rain: number; temp: number }) {
  if (tyre === "Auto") {
    return (
      <p id="whatif-tyre-readout" className="mt-2 text-[11px] leading-snug text-paper-dim">
        The engine picks the opening compound from rain and temperature.
      </p>
    );
  }
  const fit = FIT_COPY[tyreFit(tyre, rain)];
  return (
    <p
      id="whatif-tyre-readout"
      aria-live="polite"
      className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] leading-snug"
    >
      <span className="font-mono text-paper">
        ~{adjustedLife(tyre, temp)} laps
        <span className="text-paper-dim"> of life at {temp}°C</span>
      </span>
      <span className={fit.tone}>{fit.label}</span>
    </p>
  );
}
