import { AttractionCard } from "@/components/guide/AttractionCard";
import { attractions } from "@/data/attractions";
import { sessionGaps } from "@/data/sessionGaps";
import type { Session } from "@/types";

interface GuidePanelProps {
  session: Session;
}

export function GuidePanel({ session }: GuidePanelProps) {
  const gap = sessionGaps.find((item) => item.afterSession === session);
  if (!gap) return null;

  const picks = attractions.filter((attraction) =>
    gap.recommendedBands.includes(attraction.proximity)
  );

  return (
    <section className="space-y-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-paper-dim">
          Between sessions
        </p>
        <h2 className="mt-2 font-display text-xl uppercase tracking-wide">{gap.label}</h2>
        <p className="mt-2 text-sm text-paper-dim">{gap.blurb}</p>
      </div>
      <div className="grid gap-3">
        {picks.map((attraction) => (
          <AttractionCard key={attraction.id} attraction={attraction} />
        ))}
      </div>
    </section>
  );
}
