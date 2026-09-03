import type { StrategyVariant } from "@/types";

interface PitWindowTimelineProps {
  startLap: number;
  endLap: number;
  variant?: StrategyVariant;
}

// Presentational axis only — the backend returns a window, not a race distance,
// so the scale is rounded up from endLap rather than assuming a lap count.
function axisEnd(endLap: number): number {
  return Math.max(Math.ceil((endLap + 2) / 5) * 5, endLap + 1);
}

export function PitWindowTimeline({ startLap, endLap, variant }: PitWindowTimelineProps) {
  const end = axisEnd(endLap);
  const left = ((startLap - 1) / (end - 1)) * 100;
  const width = Math.max(((endLap - startLap) / (end - 1)) * 100, 4);
  const accent = variant === "aggressive" ? "bg-teal" : "bg-amber";
  const label = `Pit window laps ${startLap} to ${endLap}`;

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-paper-dim">
        <span>Pit window</span>
        <span>
          L{startLap}–L{endLap}
        </span>
      </div>
      <div
        role="img"
        aria-label={label}
        className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-asphalt-line"
      >
        <div
          className={`absolute inset-y-0 rounded-full ${accent}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-paper-dim/70">
        <span>L1</span>
        <span>L{end}</span>
      </div>
    </div>
  );
}
