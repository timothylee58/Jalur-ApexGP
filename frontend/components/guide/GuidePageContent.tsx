"use client";

import { GuideCards } from "@/components/guide/GuideCards";
import { RookieQuiz } from "@/components/guide/RookieQuiz";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function GuidePageContent() {
  const { t } = useLanguage();

  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
        {t.guide.kicker}
      </p>
      <h1 className="mt-2 font-display text-3xl uppercase leading-none tracking-wide text-paper">
        {t.guide.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-paper-dim">{t.guide.intro}</p>

      <div className="mt-6">
        <GuideCards />
      </div>

      <div className="mt-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-dim">
          {t.guide.quizLabel}
        </span>
        <div className="mt-2">
          <RookieQuiz />
        </div>
      </div>

      <p className="mt-6 text-[11px] leading-relaxed text-paper-dim/70">{t.guide.disclaimer}</p>
    </>
  );
}
