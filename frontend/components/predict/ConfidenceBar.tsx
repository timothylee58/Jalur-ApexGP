interface ConfidenceBarProps {
  value: number;
  /** Fill colour; matches the card's variant accent. */
  barClassName?: string;
}

export function ConfidenceBar({ value, barClassName = "bg-amber" }: ConfidenceBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const pct = Math.round(clamped);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-paper-dim">
        <span>Confidence</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div
        role="meter"
        aria-label="Confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-paper/10"
      >
        <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
