interface PitWindowTimelineProps {
  startLap: number;
  endLap: number;
}

export function PitWindowTimeline({ startLap, endLap }: PitWindowTimelineProps) {
  return (
    <section className="rounded-lg border border-paper/10 bg-asphalt p-6">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-paper-dim">
        Pit window
      </p>
      <p className="mt-2 text-sm text-paper-dim">
        L{startLap} – L{endLap}
      </p>
    </section>
  );
}
