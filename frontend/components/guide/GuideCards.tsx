import { GUIDE_CARDS } from "@/data/f1Guide";

export function GuideCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {GUIDE_CARDS.map((card) => (
        <div key={card.id} className="rounded-lg border border-paper/10 bg-asphalt/80 p-4">
          <h3 className="font-display text-lg uppercase tracking-wide text-paper">{card.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-paper-dim">{card.body}</p>
        </div>
      ))}
    </div>
  );
}
