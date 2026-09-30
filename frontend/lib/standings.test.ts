import { describe, expect, it } from "vitest";
import type { StandingsPayload } from "@/types/jolpica";
import { appDriverId, appTeamId, driverStanding, teamStanding } from "./standings";

const row = (driverId: string, position = 1) => ({
  position,
  points: 10,
  wins: 0,
  driverId,
  givenName: "",
  familyName: "",
  constructorName: "",
});
const team = (constructorId: string) => ({ position: 1, points: 10, wins: 0, constructorId, name: "" });

describe("standings id mapping", () => {
  it("maps Ergast slugs that differ from this app's ids", () => {
    expect(appDriverId(row("max_verstappen"))).toBe("verstappen");
    expect(appDriverId(row("arvid_lindblad"))).toBe("lindblad");
    expect(appDriverId(row("norris"))).toBe("norris");
  });

  it("drops drivers this app has no card for", () => {
    // A reserve who stood in for a few rounds is in the table, not the grid.
    expect(appDriverId(row("tsunoda"))).toBeNull();
  });

  it("maps constructor ids to this app's team ids", () => {
    expect(appTeamId(team("red_bull"))).toBe("red-bull");
    expect(appTeamId(team("rb"))).toBe("racing-bulls");
    expect(appTeamId(team("aston_martin"))).toBe("aston-martin");
    expect(appTeamId(team("cadillac"))).toBe("cadillac");
    expect(appTeamId(team("unknown_team"))).toBeNull();
  });

  it("looks up a driver's and a team's row by app id", () => {
    const data: StandingsPayload = {
      season: "2026",
      round: "15",
      source: "jolpica",
      drivers: [row("antonelli", 1), row("max_verstappen", 6)],
      constructors: [team("red_bull")],
    };
    expect(driverStanding(data, "verstappen")?.position).toBe(6);
    expect(driverStanding(data, "norris")).toBeNull();
    expect(driverStanding(null, "norris")).toBeNull();
    expect(teamStanding(data, "red-bull")?.constructorId).toBe("red_bull");
  });
});
