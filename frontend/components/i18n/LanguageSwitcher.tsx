"use client";

import { LANGUAGES } from "@/lib/i18n/dictionaries";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex shrink-0 items-center gap-0.5 font-mono text-[10px] uppercase tracking-wide">
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          onClick={() => setLang(option.code)}
          aria-pressed={lang === option.code}
          aria-label={`Switch language to ${option.label}`}
          className={`rounded px-1.5 py-0.5 transition-colors ${
            lang === option.code ? "text-amber" : "text-paper-dim hover:text-paper"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
