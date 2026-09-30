import { drivers, type Driver } from "@/data/drivers";
import { teams, type Team } from "@/data/teams";
import { teamStanding } from "@/lib/standings";
import type { StandingsPayload } from "@/types/jolpica";

export interface RosterTeam {
  team: Team;
  drivers: Driver[];
}

const BY_ID = new Map(drivers.map((driver) => [driver.id, driver]));

export function driverById(id: string | undefined): Driver | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function teamOfDriver(driverId: string | undefined): Team | undefined {
  return driverId ? teams.find((team) => team.driverIds.includes(driverId)) : undefined;
}

export function teamById(id: string | undefined): Team | undefined {
  return id ? teams.find((team) => team.id === id) : undefined;
}

/** The 2026 grid as team pairs, championship order when the live table is
 * in (so the picker doubles as a form guide), the app's own order until
 * then. */
export function rosterByStanding(standings: StandingsPayload | null): RosterTeam[] {
  const rank = (team: Team) => teamStanding(standings, team.id)?.position ?? Number.POSITIVE_INFINITY;
  return teams
    .map((team, index) => ({ team, index }))
    .sort((a, b) => rank(a.team) - rank(b.team) || a.index - b.index)
    .map(({ team }) => ({
      team,
      drivers: team.driverIds.map((id) => BY_ID.get(id)).filter((d): d is Driver => Boolean(d)),
    }));
}
