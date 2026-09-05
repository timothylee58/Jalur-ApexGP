/**
 * Constructor roster for `/teams` and `/fan` — the 11 teams behind the 22
 * `data/drivers.ts` 2026-grid entries, one entry each, `driverIds` pointing
 * back into that file rather than duplicating driver data.
 *
 * Base/founded/powerUnit are stable, low-controversy facts (see per-field
 * notes below for what changed for 2026 specifically, WebSearch-verified —
 * the power unit realignment in particular is new this season). `recap` is
 * the same 2026 Dutch Grand Prix at Zandvoort the driver-level recaps use,
 * written from the team's side — see the note on `Driver.recap` in
 * `data/drivers.ts` for the sourcing/inference caveat on four drivers.
 *
 * `primary` / `secondary` are fan-card accent hexes for `/fan` (papaya,
 * rosso, petrol teal, etc.). `/teams` can stay neutral; `/fan` leans into
 * constructor identity on purpose — see docs/BRAND.md Imagery.
 */

export interface Team {
  id: string;
  name: string;
  base: string;
  powerUnit: string;
  founded: string;
  constructorTitles: number;
  driverIds: [string, string];
  recap: string;
  /** Fan-card accent (constructor identity color). */
  primary: string;
  /** Supporting accent for gradients / trim on `/fan`. */
  secondary: string;
}

export const teams: Team[] = [
  {
    id: "mclaren",
    name: "McLaren",
    base: "Woking, UK",
    powerUnit: "Mercedes",
    founded: "1966",
    constructorTitles: 9,
    driverIds: ["norris", "piastri"],
    recap: "Locked out the top of the story at Zandvoort — Norris's second straight win with Piastri sixth after the race was reshaped by an early red flag.",
    primary: "#FF8000",
    secondary: "#47C7FC",
  },
  {
    id: "ferrari",
    name: "Ferrari",
    base: "Maranello, Italy",
    powerUnit: "Ferrari",
    founded: "1950",
    constructorTitles: 16,
    driverIds: ["leclerc", "hamilton"],
    recap: "A quiet but solid Zandvoort: Hamilton fourth, Leclerc fifth with the race's fastest lap — neither close enough to trouble the fight up front.",
    primary: "#E80020",
    secondary: "#FFF200",
  },
  {
    id: "red-bull",
    name: "Red Bull",
    base: "Milton Keynes, UK",
    // Real 2026 change — Red Bull Powertrains' first season building its
    // own engine, with Ford as technical/commercial partner.
    powerUnit: "Red Bull Powertrains–Ford",
    founded: "2005",
    constructorTitles: 6,
    driverIds: ["verstappen", "hadjar"],
    recap: "Verstappen's Zandvoort ended on Lap 1 in a heavy crash that red-flagged the race; Hadjar brought the second car home outside the points.",
    primary: "#1E5BC6",
    secondary: "#DC052D",
  },
  {
    id: "mercedes",
    name: "Mercedes",
    base: "Brackley, UK",
    powerUnit: "Mercedes",
    founded: "2010",
    constructorTitles: 8,
    driverIds: ["russell", "antonelli"],
    recap: "A genuine Zandvoort podium lockout, Antonelli ahead of Russell — the rookie's podium tally keeps climbing.",
    primary: "#00D2BE",
    secondary: "#C0C0C0",
  },
  {
    id: "aston-martin",
    name: "Aston Martin",
    base: "Silverstone, UK",
    // Real 2026 change — Honda's works engine partner, replacing the
    // Mercedes customer supply Aston Martin ran through 2025.
    powerUnit: "Honda",
    founded: "2021",
    constructorTitles: 0,
    driverIds: ["alonso", "stroll"],
    recap: "Alonso's ninth was the team's best result of the season; Stroll didn't make it to the flag.",
    primary: "#006F62",
    secondary: "#CEDC00",
  },
  {
    id: "alpine",
    name: "Alpine",
    base: "Enstone, UK",
    // Real 2026 change — Renault stopped building F1 engines; Alpine is
    // now a Mercedes customer team.
    powerUnit: "Mercedes",
    founded: "2021",
    constructorTitles: 2,
    driverIds: ["gasly", "colapinto"],
    recap: "Gasly scored in tenth; Colapinto's Zandvoort was undone by two separate yellow-flag penalties, dropping him to 14th.",
    primary: "#FF87BC",
    secondary: "#0F1C2C",
  },
  {
    id: "haas",
    name: "Haas",
    base: "Kannapolis, North Carolina, USA",
    powerUnit: "Ferrari",
    founded: "2016",
    constructorTitles: 0,
    driverIds: ["ocon", "bearman"],
    recap: "A weekend to forget at Zandvoort — both Ocon and Bearman retired without reaching the chequered flag.",
    primary: "#FFFFFF",
    secondary: "#E6002D",
  },
  {
    id: "racing-bulls",
    name: "Racing Bulls",
    base: "Faenza, Italy",
    powerUnit: "Red Bull Powertrains–Ford",
    founded: "2006",
    constructorTitles: 0,
    driverIds: ["lawson", "lindblad"],
    recap: "Lawson brought the team's only finisher home in seventh, weathering a yellow-flag penalty; Lindblad finished outside the points.",
    primary: "#6692FF",
    secondary: "#152238",
  },
  {
    id: "williams",
    name: "Williams",
    base: "Grove, UK",
    powerUnit: "Mercedes",
    founded: "1977",
    constructorTitles: 9,
    driverIds: ["sainz", "albon"],
    recap: "A first-lap clash between teammates Sainz and Albon ended Albon's race and left Sainz last of the runners after a penalty.",
    primary: "#00A0DE",
    secondary: "#041E42",
  },
  {
    id: "audi",
    name: "Audi",
    base: "Hinwil, Switzerland",
    // Real 2026 debut — Audi's own works power unit, on the factory it
    // bought from Sauber.
    powerUnit: "Audi",
    founded: "2026",
    constructorTitles: 0,
    driverIds: ["hulkenberg", "bortoleto"],
    recap: "Hulkenberg's eighth was the team's best result of the season; Bortoleto finished outside the points.",
    primary: "#F50537",
    secondary: "#000000",
  },
  {
    id: "cadillac",
    name: "Cadillac",
    base: "Fishers, Indiana, USA",
    powerUnit: "Ferrari",
    founded: "2026",
    constructorTitles: 0,
    driverIds: ["perez", "bottas"],
    recap: "Pérez finished outside the points; Bottas was the other retirement of the day.",
    primary: "#D4AF37",
    secondary: "#0A0A0A",
  },
];
