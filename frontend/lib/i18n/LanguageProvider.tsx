"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries } from "./dictionaries";
import type { Dictionary, Lang } from "./types";

const STORAGE_KEY = "jalur-apexgp:lang";
const DEFAULT_LANG: Lang = "en";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLang(value: string | null): value is Lang {
  return value === "en" || value === "ms" || value === "zh";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always starts "en" on both server and the client's first render —
  // the real preference only applies after mount (below), same
  // hydration-safe pattern as SessionCountdown's clock and RookieQuiz's
  // draft restore elsewhere in this app. Reading localStorage during the
  // initial render would make server and client markup disagree.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(stored)) setLangState(stored);
    } catch {
      // Private window / blocked storage — stay on the default language.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort — the choice still applies for this page view.
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
