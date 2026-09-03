import { ConfidenceBar } from "@/components/predict/ConfidenceBar";
import { PitWindowTimeline } from "@/components/predict/PitWindowTimeline";
import { Card } from "@/components/ui/card";
import { pitWindowStatus } from "@/lib/predictionUtils";
import type { Session, StrategyPrediction, StrategyVariant } from "@/types";

interface PredictionCardProps {
  prediction: StrategyPrediction;
  session?: Session;
}

// Accent per variant is the only non-text cue separating the two cards at a glance.
const VARIANT_STYLE: Record<StrategyVariant, { title: string; border: string; label: string; pit: string }> = {
  conservative: {
    title: "Conservative",
    border: "border-amber/40",
    label: "text-amber",
    pit: "text-amber",
  },
  aggressive: {
    title: "Aggressive",
    border: "border-teal/40",
    label: "text-teal",
    pit: "text-teal",
  },
};

export function PredictionCard({ prediction, session }: PredictionCardProps) {
  const style = VARIANT_STYLE[prediction.variant];
  const pitLine = session ? pitWindowStatus(prediction, session) : null;

  return (
    <Card className={`${style.border} bg-asphalt text-paper`}>
      <p className={`font-mono text-xs uppercase tracking-[0.25em] ${style.label}`}>
        {style.title}
      </p>
      <h2 className="mt-2 font-display text-xl uppercase tracking-wide">
        {prediction.tyreSequence.join(" → ")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">{prediction.reasoning}</p>
      {pitLine ? (
        <p className={`mt-3 font-mono text-xs ${style.pit}`}>{pitLine}</p>
      ) : null}
      <PitWindowTimeline
        startLap={prediction.pitWindow.startLap}
        endLap={prediction.pitWindow.endLap}
        variant={prediction.variant}
      />
      <p className="mt-3 rounded-md border border-brick/30 bg-brick/5 px-2 py-1.5 text-xs text-paper-dim">
        <span className="font-mono uppercase text-brick">Key risk · </span>
        {prediction.keyRisk}
      </p>
      <div className="mt-4">
        <ConfidenceBar value={prediction.confidence} />
      </div>
    </Card>
  );
}
