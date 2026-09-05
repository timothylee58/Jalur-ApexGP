import { ConfidenceBar } from "@/components/predict/ConfidenceBar";
import { PitWindowTimeline } from "@/components/predict/PitWindowTimeline";
import { GlossaryText } from "@/components/shared/GlossaryText";
import { Card } from "@/components/ui/card";
import { pitWindowStatus } from "@/lib/predictionUtils";
import type { Session, StrategyPrediction, StrategyVariant } from "@/types";

interface PredictionCardProps {
  prediction: StrategyPrediction;
  session?: Session;
  raceLaps?: number;
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

export function PredictionCard({ prediction, session, raceLaps }: PredictionCardProps) {
  const style = VARIANT_STYLE[prediction.variant];
  const pitLine = session ? pitWindowStatus(prediction, session) : null;
  const stints = prediction.stints ?? [];
  const showStints = stints.length > 1;

  return (
    <Card className={`${style.border} bg-asphalt text-paper`}>
      <div className="flex items-baseline justify-between">
        <p className={`font-mono text-xs uppercase tracking-[0.25em] ${style.label}`}>
          {style.title}
        </p>
        {typeof prediction.stopCount === "number" && prediction.stopCount > 0 ? (
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">
            {prediction.stopCount}-stop
          </p>
        ) : null}
      </div>
      <h2 className="mt-2 font-display text-xl uppercase tracking-wide">
        {prediction.tyreSequence.join(" → ")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        <GlossaryText>{prediction.reasoning}</GlossaryText>
      </p>

      {showStints ? (
        <div className="mt-3 flex overflow-hidden rounded-md border border-paper/10 font-mono text-[10px]">
          {stints.map((stint, index) => {
            const span = raceLaps && raceLaps > 0 ? (stint.laps / raceLaps) * 100 : 100 / stints.length;
            return (
              <div
                key={`${stint.compound}-${stint.startLap}`}
                className={`px-2 py-1.5 text-center ${
                  index === 0 ? "bg-paper/10 text-paper" : "bg-asphalt text-paper-dim"
                }`}
                style={{ width: `${Math.max(span, 12)}%` }}
                title={`${stint.compound}: L${stint.startLap}–L${stint.endLap} (${stint.laps} laps)`}
              >
                {stint.compound.slice(0, 4)} · {stint.laps}L
              </div>
            );
          })}
        </div>
      ) : null}

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
        <GlossaryText>{prediction.keyRisk}</GlossaryText>
      </p>
      <div className="mt-4">
        <ConfidenceBar value={prediction.confidence} />
      </div>
    </Card>
  );
}
