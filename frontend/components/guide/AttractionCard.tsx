import { DriveTimeBadge } from "@/components/guide/DriveTimeBadge";
import type { Attraction } from "@/data/attractions";

interface AttractionCardProps {
  attraction: Attraction;
}

export function AttractionCard({ attraction }: AttractionCardProps) {
  return (
    <article className="overflow-hidden rounded-lg border border-paper/10 bg-asphalt">
      <div
        className="h-28 bg-paper/5 bg-cover bg-center"
        style={
          attraction.imageUrl
            ? { backgroundImage: `url(${attraction.imageUrl})` }
            : undefined
        }
      />
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold leading-snug">{attraction.name}</h3>
          <DriveTimeBadge minutes={attraction.driveTimeMinutes} />
        </div>
        <p className="text-xs uppercase tracking-wide text-paper-dim">
          {attraction.category}
        </p>
        <p className="text-sm text-paper-dim">{attraction.description}</p>
      </div>
    </article>
  );
}
