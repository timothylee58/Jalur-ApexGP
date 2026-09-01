import type { GrandstandInfo, SeatCategory } from "@/data/ticketinfo";

const CATEGORY_CLASS: Record<SeatCategory, string> = {
  Premium: "text-amber",
  Action: "text-paper",
  Value: "text-paper-dim",
  Hospitality: "text-amber",
};

interface GrandstandCardProps {
  stand: GrandstandInfo;
}

export function GrandstandCard({ stand }: GrandstandCardProps) {
  const categoryClass = CATEGORY_CLASS[stand.category];

  return (
    <article className="rounded-lg border border-paper/10 bg-asphalt p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg uppercase tracking-wide text-paper">
          {stand.name}
        </h2>
        <span className={`shrink-0 font-mono text-[11px] uppercase ${categoryClass}`}>
          {stand.category}
        </span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-paper-dim">{stand.viewType}</p>
      <p className="mt-3 text-sm text-paper-dim">{stand.description}</p>
    </article>
  );
}
