import { describe, expect, it } from "vitest";
import { drivers } from "@/data/drivers";
import { championshipOrder, driverCode, gridSlot, GRID_SPACING_M, historyPlinth } from "@/lib/driverGridLayout";
import type { StandingsPayload } from "@/types/jolpica";

const field = drivers.filter((driver) => driver.era === "2026-grid");

function standingsFor(rows: Array<[string, number]>): StandingsPayload {
  return {
    season: "2026",
    round: "15",
    source: "test",
    constructors: [],
    drivers: rows.map(([driverId, position]) => ({
      driverId,
      position,
      points: 0,
      wins: 0,
      givenName: "",
      familyName: "",
      constructorName: "",
    })),
  };
}

describe("gridSlot", () => {
  it("staggers the grid 8 m apart on alternating sides", () => {
    expect(gridSlot(0)).toEqual({ x: 2.9, z: -0 });
    expect(gridSlot(1)).toEqual({ x: -2.9, z: -GRID_SPACING_M });
    expect(gridSlot(21).z).toBe(-21 * GRID_SPACING_M);
  });
});

describe("driverCode", () => {
  it("uses the first three letters of the surname, accents stripped", () => {
    expect(driverCode("Max Verstappen")).toBe("VER");
    expect(driverCode("Nico Hülkenberg")).toBe("HUL");
    expect(driverCode("Sergio Pérez")).toBe("PER");
    expect(driverCode("Andrea Kimi Antonelli")).toBe("ANT");
  });
});

describe("championshipOrder", () => {
  it("keeps team order when there are no standings", () => {
    const order = championshipOrder(field, null);
    expect(order.ranked).toBe(false);
    expect(order.drivers).toBe(field);
  });

  it("puts the championship leader on pole and unranked drivers at the back", () => {
    const order = championshipOrder(
      field,
      standingsFor([
        ["russell", 1],
        ["max_verstappen", 2],
        ["norris", 3],
      ]),
    );
    expect(order.ranked).toBe(true);
    expect(order.drivers.slice(0, 3).map((d) => d.id)).toEqual(["russell", "verstappen", "norris"]);
    expect(order.drivers).toHaveLength(field.length);
    const rest = field.filter((d) => !["russell", "verstappen", "norris"].includes(d.id)).map((d) => d.id);
    expect(order.drivers.slice(3).map((d) => d.id)).toEqual(rest);
  });
});

describe("historyPlinth", () => {
  it("stands each Sepang winner taller than the runner-up", () => {
    expect(historyPlinth("irvine", 0).height).toBeGreaterThan(historyPlinth("schumacher", 1).height);
    expect(historyPlinth("button", 2)).toMatchObject({ year: "2009", result: "P1" });
  });
});
