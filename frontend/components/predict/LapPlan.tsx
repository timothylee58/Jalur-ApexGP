import { TYRE_COLOR } from "@/lib/tyreColors";
import { COMPOUNDS, type Compound, type PitWindow, type Stint, type StrategyVariant } from "@/types";

interface LapPlanProps {
  stints: Stint[];
  window: PitWindow;
  totalLaps: number;
  windowLabel: string;
  variant: StrategyVariant;
}

const SHORT: Record<Compound, string> = {
  Soft: "Soft",
  Medium: "Med",
  Hard: "Hard",
  Intermediate: "Inter",
  Wet: "Wet",
};

// A stint shows its compound only when the label fits at the narrowest the
// strip gets (a card in the desktop two-up grid); otherwise just its laps.
const NARROWEST_STRIP_PX = 260;
const MONO_CHAR_PX = 6.2;
const SEGMENT_PADDING_PX = 12;

function stintLabel(name: string, laps: number, total: number): string {
  const label = `${name} ${laps}L`;
  const fits = label.length * MONO_CHAR_PX + SEGMENT_PADDING_PX <= (laps / total) * NARROWEST_STRIP_PX;
  return fits ? label : `${laps}L`;
}

function asCompound(value: string): Compound | null {
  return COMPOUNDS.includes(value as Compound) ? (value as Compound) : null;
}

/**
 * The whole session as one lap strip: each stint in its compound's sidewall
 * colour, sized by its laps, with the plan's window marked underneath on the
 * same scale — so where the change falls reads against the stints it splits.
 */
export function LapPlan({ stints, window, totalLaps, windowLabel, variant }: LapPlanProps) {
  const total = Math.max(totalLaps, window.endLap, stints.at(-1)?.endLap ?? 0, 1);
  const share = (laps: number) => `${(laps / total) * 100}%`;
  const accent = variant === "aggressive" ? "bg-teal" : "bg-amber";
  const summary = [
    ...stints.map((s) => `${s.compound}, laps ${s.startLap} to ${s.endLap}`),
    `${windowLabel}: laps ${window.startLap} to ${window.endLap} of ${total}`,
  ].join(". ");

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
        <span className="whitespace-nowrap">{total} laps</span>
        <span className="whitespace-nowrap">
          {windowLabel} L{window.startLap}–L{window.endLap}
        </span>
      </div>
      <div role="img" aria-label={summary} className="mt-1.5">
        <div className="flex h-8 gap-px overflow-hidden rounded-md bg-pit-carbon">
          {stints.map((stint) => {
            const compound = asCompound(stint.compound);
            const colour = compound ? TYRE_COLOR[compound] : "#a39b8f";
            const name = compound ? SHORT[compound] : stint.compound;
            return (
              <div
                key={stint.startLap}
                className="flex min-w-0 items-center px-1.5 font-mono text-[10px] text-paper"
                style={{ width: share(stint.laps), background: `${colour}29`, boxShadow: `inset 3px 0 0 ${colour}` }}
              >
                <span className="truncate">{stintLabel(name, stint.laps, total)}</span>
              </div>
            );
          })}
        </div>
        <div className="relative mt-1 h-1 rounded-full bg-asphalt-line">
          <div
            className={`absolute inset-y-0 rounded-full ${accent}`}
            style={{ left: share(window.startLap - 1), width: share(window.endLap - window.startLap + 1) }}
          />
        </div>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-paper-dim/70" aria-hidden>
        <span>L1</span>
        <span>L{total}</span>
      </div>
    </div>
  );
}
