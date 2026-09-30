import { drivers } from "@/data/drivers";
import { teams } from "@/data/teams";
import type { ConstructorStandingRow, DriverStandingRow, StandingsPayload } from "@/types/jolpica";

/**
 * Joins Jolpica's live championship table to this app's own driver and
 * team ids. Ergast slugs mostly match (`norris`, `mclaren`), but not
 * always: Max Verstappen is `max_verstappen` (to tell him from his father
 * Jos), 2026 rookies get full-name slugs, and constructors use
 * underscores where this app uses hyphens. Anything not in the maps below
 * falls back to the same id, and is dropped if this app has no such
 * driver or team (a stand-in who raced a few rounds, say).
 */
const DRIVER_ID: Record<string, string> = {
  max_verstappen: "verstappen",
  arvid_lindblad: "lindblad",
};

const TEAM_ID: Record<string, string> = {
  red_bull: "red-bull",
  rb: "racing-bulls",
  aston_martin: "aston-martin",
};

const DRIVER_IDS = new Set(drivers.map((driver) => driver.id));
const TEAM_IDS = new Set(teams.map((team) => team.id));

export function appDriverId(row: DriverStandingRow): string | null {
  const id = DRIVER_ID[row.driverId] ?? row.driverId;
  return DRIVER_IDS.has(id) ? id : null;
}

export function appTeamId(row: ConstructorStandingRow): string | null {
  const id = TEAM_ID[row.constructorId] ?? row.constructorId.replace(/_/g, "-");
  return TEAM_IDS.has(id) ? id : null;
}

/** This season's row for one of this app's drivers, if they've scored a
 * classified result yet. */
export function driverStanding(data: StandingsPayload | null, driverId: string): DriverStandingRow | null {
  return data?.drivers.find((row) => appDriverId(row) === driverId) ?? null;
}

export function teamStanding(data: StandingsPayload | null, teamId: string): ConstructorStandingRow | null {
  return data?.constructors.find((row) => appTeamId(row) === teamId) ?? null;
}
