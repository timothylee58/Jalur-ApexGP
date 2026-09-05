import type { Driver } from "@/data/drivers";
import { teams } from "@/data/teams";

export interface DriverAccent {
  primary: string;
  secondary: string;
}

/** Accents for Sepang-history teams that aren't on the 2026 constructor list. */
const HISTORY_ACCENTS: Record<string, DriverAccent> = {
  Ferrari: { primary: "#E80020", secondary: "#FFF200" },
  "Brawn GP": { primary: "#C8FF00", secondary: "#FFFFFF" },
};

const FALLBACK: DriverAccent = { primary: "#A39B8F", secondary: "#2A3036" };

/** Resolve constructor accent colors for a driver (2026 roster or history). */
export function accentForDriver(driver: Driver): DriverAccent {
  const bySeat = teams.find((team) => team.driverIds.includes(driver.id));
  if (bySeat) {
    return { primary: bySeat.primary, secondary: bySeat.secondary };
  }
  const byName = teams.find(
    (team) => team.name.toLowerCase() === driver.team.toLowerCase(),
  );
  if (byName) {
    return { primary: byName.primary, secondary: byName.secondary };
  }
  return HISTORY_ACCENTS[driver.team] ?? FALLBACK;
}

export function hexToThree(hex: string): number {
  const cleaned = hex.replace("#", "").trim();
  const value = Number.parseInt(cleaned.length === 3
    ? cleaned.split("").map((c) => c + c).join("")
    : cleaned, 16);
  return Number.isFinite(value) ? value : 0xa39b8f;
}

/** Dark ink on light shells (Haas white, Brawn lime); light ink otherwise. */
export function inkForAccent(hex: string): string {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return "#f4efe6";
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.62 ? "#0a0c0e" : "#f4efe6";
}
