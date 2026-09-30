import { COMPOUNDS, SESSIONS, type Compound, type Session } from "@/types";

/**
 * The /og share card's content, parsed from the query string a shared
 * /predict link carries (see predictionUtils.buildShareUrl). Anything in the
 * URL is untrusted, so every field is validated here before it reaches the
 * image renderer: numbers are clamped, the session and compounds must be
 * real ones, and the weather text is cleaned and capped. Beyond fitting the
 * card, that stops a crafted link printing arbitrary words on an image
 * served from this site.
 */

export interface Stint {
  compound: Compound;
  /** Short enough for a long plan to fit on one line. */
  short: string;
}

export interface StrategyRead {
  /** 0–100, or null when the link didn't carry a usable number. */
  confidence: number | null;
  stints: Stint[];
}

export interface OgCard {
  session: Session;
  sessionName: string;
  condition: string;
  tempC: number | null;
  rain: number | null;
  safetyCar: boolean;
  startTyre: Compound | null;
  conservative: StrategyRead;
  aggressive: StrategyRead;
  /** The read the model is more confident in; null on a tie or missing data. */
  stronger: "conservative" | "aggressive" | null;
}

const SESSION_NAMES: Record<Session, string> = {
  FP1: "Free Practice 1",
  FP2: "Free Practice 2",
  FP3: "Free Practice 3",
  Quali: "Qualifying",
  Race: "Grand Prix",
};

const MAX_STINTS = 4;
const SHORT: Record<Compound, string> = {
  Soft: "Soft",
  Medium: "Medium",
  Hard: "Hard",
  Intermediate: "Inter",
  Wet: "Wet",
};

/** Letters, digits and plain punctuation only, whitespace collapsed,
 * capped with an ellipsis. */
export function cleanText(value: string | null, max: number): string {
  if (!value) return "";
  const text = value
    .replace(/[^\p{L}\p{N} ,.'()/+&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function numberIn(value: string | null, min: number, max: number): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(max, Math.max(min, n)));
}

function compoundOf(value: string): Compound | null {
  const match = COMPOUNDS.find((c) => c.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

/** Known compounds only; anything else in the list is dropped. */
function stints(value: string | null): Stint[] {
  if (!value) return [];
  return value
    .split("-")
    .map(compoundOf)
    .filter((c): c is Compound => c !== null)
    .slice(0, MAX_STINTS)
    .map((compound) => ({ compound, short: SHORT[compound] }));
}

export function parseOgCard(params: URLSearchParams): OgCard {
  const rawSession = (params.get("session") ?? "").trim().toLowerCase();
  const session = SESSIONS.find((s) => s.toLowerCase() === rawSession) ?? "Race";
  const conservative = { confidence: numberIn(params.get("cc"), 0, 100), stints: stints(params.get("ct")) };
  const aggressive = { confidence: numberIn(params.get("ac"), 0, 100), stints: stints(params.get("at")) };

  let stronger: OgCard["stronger"] = null;
  if (conservative.confidence !== null && aggressive.confidence !== null) {
    if (conservative.confidence > aggressive.confidence) stronger = "conservative";
    else if (aggressive.confidence > conservative.confidence) stronger = "aggressive";
  }

  return {
    session,
    sessionName: SESSION_NAMES[session],
    condition: cleanText(params.get("cond"), 28) || "Sepang weekend",
    tempC: numberIn(params.get("temp"), -10, 60),
    rain: numberIn(params.get("rain"), 0, 100),
    safetyCar: params.get("sc") === "1",
    startTyre: compoundOf(params.get("ty") ?? ""),
    conservative,
    aggressive,
    stronger,
  };
}
