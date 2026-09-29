import type { Dictionary, Lang } from "../types";
import { en } from "./en";
import { ms } from "./ms";
import { zh } from "./zh";

export const dictionaries: Record<Lang, Dictionary> = { en, ms, zh };

// `native` is each language named in itself — the one label a reader of
// that language is guaranteed to recognise, whatever the page is set to.
export const LANGUAGES: { code: Lang; label: string; native: string; english: string }[] = [
  { code: "en", label: "EN", native: "English", english: "English" },
  { code: "ms", label: "BM", native: "Bahasa Melayu", english: "Malay" },
  { code: "zh", label: "中文", native: "简体中文", english: "Chinese (Simplified)" },
];
