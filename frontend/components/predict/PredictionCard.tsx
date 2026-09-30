import { ConfidenceBar } from "@/components/predict/ConfidenceBar";
import { LapPlan } from "@/components/predict/LapPlan";
import { GlossaryText } from "@/components/shared/GlossaryText";
import { Card } from "@/components/ui/card";
import { planWindow } from "@/lib/predictionUtils";
import type { Session, StrategyPrediction, StrategyVariant } from "@/types";

interface PredictionCardProps {
  prediction: StrategyPrediction;
  session: Session;
  totalLaps: number;
}

// Accent per variant is the only non-text cue separating the two cards at a glance.
const VARIANT_STYLE: Record<StrategyVariant, { title: string; border: string; text: string; bar: string }> = {
  conservative: { title: "Conservative", border: "border-amber/40", text: "text-amber", bar: "bg-amber" },
  aggressive: { title: "Aggressive", border: "border-teal/40", text: "text-teal", bar: "bg-teal" },
};

// What a tyre change is called in each session's plan.
function changeCount(session: Session, stops: number): string | null {
  if (stops < 1) return null;
  if (session === "Race") return `${stops}-stop`;
  if (session === "Quali") return "Tyre switch";
  return `${stops + 1} runs`;
}

export function PredictionCard({ prediction, session, totalLaps }: PredictionCardProps) {
  const style = VARIANT_STYLE[prediction.variant];
  const stints = prediction.stints ?? [];
  const window = planWindow(prediction, session);
  const changes = changeCount(session, prediction.stopCount ?? Math.max(stints.length - 1, 0));

  return (
    <Card className={`flex h-full flex-col ${style.border} bg-asphalt p-5 text-paper sm:p-6`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`font-mono text-xs uppercase tracking-[0.25em] ${style.text}`}>{style.title}</p>
        {changes ? (
          <p className="font-mono text-[10px] uppercase tracking-wide text-paper-dim">{changes}</p>
        ) : null}
      </div>
      <h2 className="mt-2 font-display text-xl uppercase tracking-wide">{prediction.tyreSequence.join(" → ")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
        <GlossaryText>{prediction.reasoning}</GlossaryText>
      </p>

      {stints.length > 0 ? (
        <LapPlan
          stints={stints}
          window={prediction.pitWindow}
          totalLaps={totalLaps}
          windowLabel={window.label}
          variant={prediction.variant}
        />
      ) : null}
      <p className={`mt-3 font-mono text-xs leading-relaxed ${style.text}`}>{window.line}</p>

      {/* mt-auto keeps risk + confidence on one baseline when the two cards
          sit side by side with different amounts of text. */}
      <div className="mt-auto pt-4">
        <p className="rounded-md border border-brick/30 bg-brick/5 px-2 py-1.5 text-xs leading-relaxed text-paper-dim">
          <span className="font-mono uppercase text-brick">Key risk · </span>
          <GlossaryText>{prediction.keyRisk}</GlossaryText>
        </p>
        <div className="mt-4">
          <ConfidenceBar value={prediction.confidence} barClassName={style.bar} />
        </div>
      </div>
    </Card>
  );
}
