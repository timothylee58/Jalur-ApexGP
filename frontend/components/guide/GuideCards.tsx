"use client";

import { RuleDemo } from "@/components/guide/RuleDemo";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function GuideCards() {
  const { t } = useLanguage();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {t.guide.cards.map((card) => (
        <div key={card.id} className="flex flex-col rounded-lg border border-paper/10 bg-asphalt/80 p-4">
          <RuleDemo id={card.id} title={card.title} />
          <h3 className="font-display text-lg uppercase tracking-wide text-paper">{card.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-paper-dim">{card.body}</p>
        </div>
      ))}
    </div>
  );
}
