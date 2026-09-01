interface ConfidenceBarProps {
  value: number;
}

export function ConfidenceBar({ value }: ConfidenceBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);
  const pct = Math.round(clamped);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-paper-dim">
        <span>Confidence</span>
        <span className="font-mono">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper/10">
        <div
          className="h-full rounded-full bg-amber"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
