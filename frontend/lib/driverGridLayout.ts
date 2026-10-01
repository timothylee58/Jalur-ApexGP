import type { Driver } from "@/data/drivers";
import type { StandingsPayload } from "@/types/jolpica";
import { driverStanding } from "@/lib/standings";

/**
 * Where everything stands in the /drivers 3D scenes, in metres, kept out
 * of the Three.js component so it can be tested. Cars face +Z; the grid
 * runs back down -Z from the start line.
 */

/** A real F1 grid staggers cars 8 m apart, alternating sides of the track. */
export const GRID_SPACING_M = 8;
export const GRID_OFFSET_X_M = 2.9;

export function gridSlot(index: number): { x: number; z: number } {
  return { x: index % 2 === 0 ? GRID_OFFSET_X_M : -GRID_OFFSET_X_M, z: -index * GRID_SPACING_M };
}

/** Broadcast-style three-letter code: "Max Verstappen" → "VER",
 * "Nico Hülkenberg" → "HUL". */
export function driverCode(name: string): string {
  const surname = name.trim().split(/\s+/).pop() ?? name;
  return surname
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

export interface GridOrder {
  drivers: Driver[];
  /** True when the order came from the live championship table. */
  ranked: boolean;
}

/**
 * The 2026 field in championship order, so P1 on the 3D grid is the
 * championship leader. Anyone without a classified result yet keeps their
 * team order behind the ranked drivers; with no standings at all the field
 * stays grouped by team.
 */
export function championshipOrder(field: Driver[], standings: StandingsPayload | null): GridOrder {
  const position = new Map<string, number>();
  for (const driver of field) {
    const row = driverStanding(standings, driver.id);
    if (row) position.set(driver.id, row.position);
  }
  if (position.size === 0) return { drivers: field, ranked: false };
  const drivers = field
    .map((driver, i) => ({ driver, i }))
    .sort((a, b) => {
      const pa = position.get(a.driver.id) ?? Number.POSITIVE_INFINITY;
      const pb = position.get(b.driver.id) ?? Number.POSITIVE_INFINITY;
      return pa === pb ? a.i - b.i : pa - pb;
    })
    .map(({ driver }) => driver);
  return { drivers, ranked: true };
}

export interface HistoryPlinth {
  x: number;
  /** Podium-step height, so a winner stands taller than a runner-up. */
  height: number;
  year: string;
  result: string;
}

// The real results of the two Sepang races the history set is tied to:
// 1999, Irvine won from Schumacher; 2009, Button won the rain-shortened race.
export const HISTORY_PLINTHS: Record<string, HistoryPlinth> = {
  schumacher: { x: -6.2, height: 0.9, year: "1999", result: "P2" },
  irvine: { x: -3, height: 1.3, year: "1999", result: "P1" },
  button: { x: 3.4, height: 1.3, year: "2009", result: "P1" },
};

export function historyPlinth(driverId: string, index: number): HistoryPlinth {
  return HISTORY_PLINTHS[driverId] ?? { x: index * 2.6 - 2.6, height: 1, year: "", result: "" };
}
