import { ConfidenceBar } from "@/components/predict/ConfidenceBar";
import { Card } from "@/components/ui/card";
import { pitWindowStatus } from "@/lib/predictionUtils";
import type { Session, StrategyPrediction, StrategyVariant } from "@/types";

interface PredictionCardProps {
  prediction: StrategyPrediction;
  session?: Session;
}

function variantTitle(variant: StrategyVariant): string {
  switch (variant) {
    case "conservative":
      return "Conservative";
    case "aggressive":
      return "Aggressive";
    default: {
      const exhaustive: never = variant;
      return exhaustive;
    }
  }
}

export function PredictionCard({ prediction, session }: PredictionCardProps) {
  const pitLine = session ? pitWindowStatus(prediction, session) : null;

  return (
    <Card className="border-paper/10 bg-asphalt text-paper">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-paper-dim">
        {variantTitle(prediction.variant)}
      </p>
      <h2 className="mt-2 font-display text-xl uppercase tracking-wide">
        {prediction.tyreSequence.join(" → ")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">{prediction.reasoning}</p>
      {pitLine ? (
        <p className="mt-3 font-mono text-xs text-amber">{pitLine}</p>
      ) : null}
      <p className="mt-2 rounded-md border border-brick/30 bg-brick/5 px-2 py-1.5 text-xs text-paper-dim">
        <span className="font-mono uppercase text-brick">Key risk · </span>
        {prediction.keyRisk}
      </p>
      <div className="mt-4">
        <ConfidenceBar value={prediction.confidence} />
      </div>
    </Card>
  );
}
