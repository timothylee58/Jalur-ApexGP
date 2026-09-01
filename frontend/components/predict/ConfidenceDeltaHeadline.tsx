import type { PredictionResponse } from "@/types";
import { confidenceDelta } from "@/lib/predictionUtils";

interface ConfidenceDeltaHeadlineProps {
  data: PredictionResponse;
}

export function ConfidenceDeltaHeadline({ data }: ConfidenceDeltaHeadlineProps) {
  const { headline, subline, leader } = confidenceDelta(data);

  return (
    <section className="rounded-lg border border-amber/30 bg-amber/5 px-4 py-3">
      <p
        className={`font-display text-base uppercase leading-snug tracking-wide ${
          leader === "even" ? "text-paper" : "text-amber"
        }`}
      >
        {headline}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-paper-dim">{subline}</p>
      {data.confidenceTrend ? (
        <p className="mt-2 font-mono text-[11px] text-paper-dim">
          Confidence moved {Math.round(data.confidenceTrend.fromConfidence)}% →{" "}
          {Math.round(data.confidenceTrend.toConfidence)}% {data.confidenceTrend.label}
        </p>
      ) : null}
    </section>
  );
}
