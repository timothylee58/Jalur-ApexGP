"use client";

import { useInView, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { stepAt } from "@/lib/demoTimeline";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { ErsScene } from "./demos/ErsScene";
import { FlagScene } from "./demos/FlagScene";
import { OvertakeScene } from "./demos/OvertakeScene";
import { H, W, useDemoClock, type SceneProps } from "./demos/parts";
import { PitScene } from "./demos/PitScene";
import { SafetyCarScene } from "./demos/SafetyCarScene";
import { TyreScene } from "./demos/TyreScene";

interface Timing {
  /** When each step's caption takes over. */
  starts: number[];
  /** The moment each step is shown at when paused, jumped to, or under
   * reduced motion — the frame that best explains it. */
  stills: number[];
}

interface DemoSpec extends Timing {
  period: number;
  Scene: ComponentType<SceneProps>;
  /** Timing for the second variant, when there is one. */
  alt?: Timing;
}

const DEMOS: Record<string, DemoSpec> = {
  "overtake-mode": { period: 9, starts: [0, 3, 4.6], stills: [2.6, 3.9, 5.6], Scene: OvertakeScene },
  "tyre-compounds": { period: 8, starts: [0, 4], stills: [2, 6], Scene: TyreScene },
  flags: { period: 10, starts: [0, 2.5, 5, 7.5], stills: [1.3, 4.2, 6.3, 9.1], Scene: FlagScene },
  "pit-strategy": {
    period: 11,
    starts: [0, 3.7, 6.0],
    stills: [2.4, 5.0, 9.2],
    alt: { starts: [0, 3.7, 6.0], stills: [2.6, 5.2, 9.2] },
    Scene: PitScene,
  },
  "safety-car": { period: 10, starts: [0, 1.6, 5.0], stills: [1.0, 4.8, 8.6], Scene: SafetyCarScene },
  ers: { period: 8, starts: [0, 3.5], stills: [2.0, 5.8], Scene: ErsScene },
};

/**
 * An animated example above each /guide rule. Scenes are driven by one
 * looping clock and only run while on screen; a caption tracks the step
 * under way, the step buttons jump to (and hold) any step, and there's a
 * pause control. With reduced motion the scene holds on the key frame of
 * each step instead, and the step buttons still show every one.
 */
export function RuleDemo({ id, title }: { id: string; title: string }) {
  const { t } = useLanguage();
  const spec = DEMOS[id];
  const text = t.guide.demos[id];
  const ui = t.guide.demoUi;
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { amount: 0.35 });
  const reduce = useReducedMotion();
  // Motion preferences are only known in the browser: render the same
  // still frame on the server and on the first client pass.
  const [mounted, setMounted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [variant, setVariant] = useState(0);
  const [step, setStep] = useState(0);
  useEffect(() => setMounted(true), []);

  const timing = (variant === 1 && spec?.alt) || spec;
  const motionOk = mounted && !reduce;
  const playing = Boolean(spec) && motionOk && inView && !paused;
  const { clock, seek } = useDemoClock(spec?.period ?? 1, playing, spec?.stills[0] ?? 0);

  useMotionValueEvent(clock, "change", (time) => {
    if (timing) setStep(stepAt(time, timing.starts));
  });

  if (!spec || !text) return null;
  const { Scene } = spec;
  const captions = variant === 1 && text.altSteps ? text.altSteps : text.steps;

  const goTo = (index: number) => {
    seek(timing.stills[index]);
    setStep(index);
    setPaused(true);
  };

  const chooseVariant = (next: number) => {
    const nextTiming = (next === 1 && spec.alt) || spec;
    setVariant(next);
    seek(nextTiming.stills[0]);
    setStep(0);
  };

  const control =
    "rounded-full font-mono text-[10px] uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber";

  return (
    <figure
      aria-label={ui.example.replace("{title}", title)}
      className="-mx-1 -mt-1 mb-3 overflow-hidden rounded-md border border-paper/10 bg-pit-carbon"
    >
      <div ref={frame} aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          <Scene clock={clock} labels={text.labels} variant={variant} />
        </svg>
      </div>

      <figcaption className="border-t border-paper/10 px-3 pb-2.5 pt-2">
        {/* Every caption shares one grid cell, so the box is as tall as the
            longest in any language and never jumps between steps. */}
        <div className="grid" aria-hidden="true">
          {captions.map((caption, i) => (
            <p
              key={i}
              className={`text-xs leading-relaxed text-paper transition-opacity duration-300 [grid-area:1/1] ${
                i === step ? "opacity-100" : "opacity-0"
              }`}
            >
              {caption}
            </p>
          ))}
        </div>
        <ol className="sr-only">
          {captions.map((caption, i) => (
            <li key={i}>{caption}</li>
          ))}
        </ol>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            {captions.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={ui.step.replace("{n}", String(i + 1))}
                aria-current={i === step ? "step" : undefined}
                className="group flex h-6 items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? "w-5 bg-paper" : "w-1.5 bg-paper/25 group-hover:bg-paper/50"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {spec.alt ? (
              <div role="group" className="inline-flex rounded-full border border-paper/15 p-0.5">
                {[text.labels.undercut, text.labels.overcut].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={variant === i}
                    onClick={() => chooseVariant(i)}
                    className={`${control} px-2.5 py-1 ${
                      variant === i ? "bg-paper text-pit-carbon" : "text-paper-dim hover:text-paper"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            {motionOk ? (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                className={`${control} flex items-center gap-1.5 border border-paper/15 px-2.5 py-1 text-paper-dim hover:border-paper/40 hover:text-paper`}
              >
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden>
                  {paused ? <path d="M3 1.5v9l7-4.5z" /> : <path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" />}
                </svg>
                {paused ? ui.play : ui.pause}
              </button>
            ) : null}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
