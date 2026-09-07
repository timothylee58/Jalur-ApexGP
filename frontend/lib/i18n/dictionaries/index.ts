import type { Dictionary, Lang } from "../types";
import { en } from "./en";
import { ms } from "./ms";
import { zh } from "./zh";

export const dictionaries: Record<Lang, Dictionary> = { en, ms, zh };

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "ms", label: "BM" },
  { code: "zh", label: "中文" },
];
