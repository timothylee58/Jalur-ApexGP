"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { dictionaries } from "./dictionaries";
import { isLang, LANG_COOKIE, type Dictionary, type Lang } from "./types";

// Re-exported for existing importers — the canonical definitions now
// live in types.ts (see the comment there) so layout.tsx, a Server
// Component, can call isLang() directly.
export { isLang, LANG_COOKIE };

const STORAGE_KEY = "jalur-apexgp:lang";
const DEFAULT_LANG: Lang = "en";

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// initialLang comes from the cookie the server already read in
// layout.tsx (a Server Component, via next/headers) — so the very first
// client render matches what the server sent: no flash of DEFAULT_LANG
// while a client-only effect catches up, and no hydration mismatch
// either (server and client agree on the same value up front). Reading
// localStorage synchronously here instead would fix the flash but
// reintroduce a mismatch, since the server has no localStorage access.
export function LanguageProvider({
  children,
  initialLang = DEFAULT_LANG,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  // Post-mount fallback only, for a tab that set the old localStorage-only
  // key before this cookie existed and never revisited setLang since —
  // the cookie read in layout.tsx is what actually removes the flash for
  // everyone else.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(stored) && stored !== initialLang) setLangState(stored);
    } catch {
      // Private window / blocked storage — stay on the server-resolved language.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    try {
      document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
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
