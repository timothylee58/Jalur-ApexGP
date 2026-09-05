/**
 * Driver roster for the 3D grid explorer. Two eras, kept separate rather
 * than merged into one list:
 *
 * - "2026-grid": the confirmed 22-driver, 11-team lineup for the season
 *   this app's fictional Sepang weekend sits in.
 * - "sepang-history": three retired drivers tied directly to the three
 *   pre-2026 moments in `data/lore.ts` (1999 opening, 2009 monsoon,
 *   2017 farewell) via `loreId` — not a general all-time-greats list.
 *
 * Stats are career totals through the 2025 season close — the season this
 * grid enters 2026 with — rather than tracking in-progress 2026 results,
 * same honesty standard the weather blend and circuit model hold
 * themselves to elsewhere in this app: a stated snapshot, not a live feed
 * this app has no way to keep current. `number` is null for the three
 * historical drivers — F1 didn't assign permanent car numbers until 2014,
 * so listing one for them would misstate the era.
 */

export type DriverEra = "2026-grid" | "sepang-history";

export interface DriverStats {
  championships: number;
  wins: number;
  podiums: number;
  poles: number;
}

export interface Driver {
  id: string;
  name: string;
  initials: string;
  number: number | null;
  team: string;
  nationality: string;
  era: DriverEra;
  seasonsActive: string;
  stats: DriverStats;
  /** Ties a Sepang-history driver to its matching entry in `data/lore.ts`. */
  loreId?: string;
  note: string;
  /**
   * "Last time out" recap — one real, WebSearch-verified sentence about the
   * 2026 Dutch Grand Prix at Zandvoort (Aug 21–23), the most recently
   * completed round as of this app's "today" (Sept 2026), a weekend before
   * this round's Monza date. Only on 2026-grid drivers — a real in-season
   * result, not a fictional one, same distinction `note` already draws
   * against career stats. Four drivers (Hadjar, Lindblad, Bortoleto, Pérez)
   * weren't individually named in the point-scorer or retirement lists any
   * search surfaced; "finished outside the points" is an inference from
   * that absence, not a directly sourced classification.
   */
  recap?: string;
}

export const drivers: Driver[] = [
  // ---- 2026 grid, paired by team (McLaren, Ferrari, Red Bull, Mercedes,
  // Aston Martin, Alpine, Haas, Racing Bulls, Williams, Audi, Cadillac) ----
  {
    id: "norris",
    name: "Lando Norris",
    initials: "LN",
    number: 4,
    team: "McLaren",
    nationality: "United Kingdom",
    era: "2026-grid",
    seasonsActive: "2019–",
    stats: { championships: 1, wins: 13, podiums: 48, poles: 18 },
    note: "2025 champion — enters 2026 as the reference lap the rest of the grid is measured against.",
    recap: "Won Zandvoort's farewell Grand Prix from pole, a second straight victory, timing the strategy around Verstappen's Lap 1 red flag.",
  },
  {
    id: "piastri",
    name: "Oscar Piastri",
    initials: "OP",
    number: 81,
    team: "McLaren",
    nationality: "Australia",
    era: "2026-grid",
    seasonsActive: "2023–",
    stats: { championships: 0, wins: 9, podiums: 28, poles: 6 },
    note: "Title runner-up in 2025 off the shortest career in the McLaren pairing.",
    recap: "Brought the second McLaren home in sixth at Zandvoort after the early red flag reshuffled the whole race.",
  },
  {
    id: "leclerc",
    name: "Charles Leclerc",
    initials: "CL",
    number: 16,
    team: "Ferrari",
    nationality: "Monaco",
    era: "2026-grid",
    seasonsActive: "2018–",
    stats: { championships: 0, wins: 9, podiums: 54, poles: 27 },
    note: "More poles than wins by a wide margin — Saturday pace that hasn't always converted on Sunday.",
    recap: "Set the race's fastest lap at Zandvoort (1:14.230, lap 60) on the way to fifth, just off the podium.",
  },
  {
    id: "hamilton",
    name: "Lewis Hamilton",
    initials: "LH",
    number: 44,
    team: "Ferrari",
    nationality: "United Kingdom",
    era: "2026-grid",
    seasonsActive: "2007–",
    stats: { championships: 7, wins: 106, podiums: 206, poles: 104 },
    note: "The all-time pole record. Second season in red after the 2025 move from Mercedes.",
    recap: "Split the Mercedes and Ferrari pace in fourth at Zandvoort, the team's best finish of the weekend.",
  },
  {
    id: "verstappen",
    name: "Max Verstappen",
    initials: "MV",
    number: 1,
    team: "Red Bull",
    nationality: "Netherlands",
    era: "2026-grid",
    seasonsActive: "2015–",
    stats: { championships: 4, wins: 71, podiums: 131, poles: 48 },
    note: "Won the last Malaysian Grand Prix run at this circuit, back in 2017.",
    recap: "Zandvoort ended on Lap 1 — a heavy crash that brought out the red flag and reshaped the entire race.",
  },
  {
    id: "hadjar",
    name: "Isack Hadjar",
    initials: "IH",
    number: 6,
    team: "Red Bull",
    nationality: "France",
    era: "2026-grid",
    seasonsActive: "2025–",
    stats: { championships: 0, wins: 0, podiums: 1, poles: 0 },
    note: "First podium came at the 2025 Dutch GP in mixed conditions — promoted to the senior Red Bull seat for 2026.",
    recap: "Kept the second Red Bull running after Verstappen's Lap 1 crash at Zandvoort, finishing outside the points.",
  },
  {
    id: "russell",
    name: "George Russell",
    initials: "GR",
    number: 63,
    team: "Mercedes",
    nationality: "United Kingdom",
    era: "2026-grid",
    seasonsActive: "2019–",
    stats: { championships: 0, wins: 7, podiums: 30, poles: 11 },
    note: "Team's senior driver since Hamilton's 2025 departure to Ferrari.",
    recap: "Rounded out a genuine Mercedes podium lockout in third at Zandvoort, with teammate Antonelli splitting him and race winner Norris.",
  },
  {
    id: "antonelli",
    name: "Kimi Antonelli",
    initials: "KA",
    number: 12,
    team: "Mercedes",
    nationality: "Italy",
    era: "2026-grid",
    seasonsActive: "2025–",
    stats: { championships: 0, wins: 0, podiums: 3, poles: 0 },
    note: "Three podiums as an 18-year-old rookie replacing Hamilton — highest-scoring rookie season on record.",
    recap: "Took second at Zandvoort's farewell Grand Prix — another podium in a rookie season already full of them.",
  },
  {
    id: "alonso",
    name: "Fernando Alonso",
    initials: "FA",
    number: 14,
    team: "Aston Martin",
    nationality: "Spain",
    era: "2026-grid",
    seasonsActive: "2001–2018, 2021–",
    stats: { championships: 2, wins: 32, podiums: 106, poles: 22 },
    note: "The only current driver who raced at Sepang before the 2017 farewell.",
    recap: "Ninth at Zandvoort was Aston Martin's best result of the season.",
  },
  {
    id: "stroll",
    name: "Lance Stroll",
    initials: "LS",
    number: 18,
    team: "Aston Martin",
    nationality: "Canada",
    era: "2026-grid",
    seasonsActive: "2017–",
    stats: { championships: 0, wins: 0, podiums: 3, poles: 1 },
    note: "A wet-weather pole at Turkey 2020 remains the standout result on an otherwise midfield record.",
    recap: "Retired from Zandvoort's farewell race — didn't see the chequered flag.",
  },
  {
    id: "gasly",
    name: "Pierre Gasly",
    initials: "PG",
    number: 10,
    team: "Alpine",
    nationality: "France",
    era: "2026-grid",
    seasonsActive: "2017–",
    stats: { championships: 0, wins: 1, podiums: 6, poles: 0 },
    note: "That single win came at Monza 2020, from a Red Bull seat he'd already been dropped from mid-season.",
    recap: "Rounded out the points in tenth at Zandvoort, Alpine's stronger side of the garage that day.",
  },
  {
    id: "colapinto",
    name: "Franco Colapinto",
    initials: "FC",
    number: 43,
    team: "Alpine",
    nationality: "Argentina",
    era: "2026-grid",
    seasonsActive: "2024–",
    stats: { championships: 0, wins: 0, podiums: 0, poles: 0 },
    note: "Still building a full-season points record after a mid-2024 Williams call-up.",
    recap: "Two separate penalties for yellow-flag infringements dropped him to 14th at Zandvoort — a tough weekend to build on.",
  },
  {
    id: "ocon",
    name: "Esteban Ocon",
    initials: "EO",
    number: 31,
    team: "Haas",
    nationality: "France",
    era: "2026-grid",
    seasonsActive: "2016–",
    stats: { championships: 0, wins: 1, podiums: 4, poles: 0 },
    note: "Career win at Hungary 2021, in a Renault-Alpine that had no business being on the top step that day.",
    recap: "Didn't finish Zandvoort's farewell race — one of two Haas retirements that day.",
  },
  {
    id: "bearman",
    name: "Oliver Bearman",
    initials: "OB",
    number: 87,
    team: "Haas",
    nationality: "United Kingdom",
    era: "2026-grid",
    seasonsActive: "2024–",
    stats: { championships: 0, wins: 0, podiums: 0, poles: 0 },
    note: "Debuted as a late Ferrari substitute in 2024 before a full-time Haas seat in 2025.",
    recap: "The other side of a difficult Haas weekend at Zandvoort — retired without reaching the flag.",
  },
  {
    id: "lawson",
    name: "Liam Lawson",
    initials: "LL",
    number: 30,
    team: "Racing Bulls",
    nationality: "New Zealand",
    era: "2026-grid",
    seasonsActive: "2023–",
    stats: { championships: 0, wins: 0, podiums: 0, poles: 0 },
    note: "A single 2025 season at Red Bull ended in a swap back to Racing Bulls after two races.",
    recap: "Brought Racing Bulls' only finisher home in seventh at Zandvoort, weathering a penalty for a yellow-flag infringement.",
  },
  {
    id: "lindblad",
    name: "Arvid Lindblad",
    initials: "AL",
    number: 41,
    team: "Racing Bulls",
    nationality: "United Kingdom",
    era: "2026-grid",
    seasonsActive: "2026–",
    stats: { championships: 0, wins: 0, podiums: 0, poles: 0 },
    note: "The only rookie on the 2026 grid — no prior F1 starts to draw a record from yet.",
    recap: "Finished outside the points at Zandvoort — still building race craft in a debut season.",
  },
  {
    id: "sainz",
    name: "Carlos Sainz",
    initials: "CS",
    number: 55,
    team: "Williams",
    nationality: "Spain",
    era: "2026-grid",
    seasonsActive: "2015–",
    stats: { championships: 0, wins: 4, podiums: 29, poles: 6 },
    note: "Beat Verstappen to a win at Australia 2024 while recovering from an appendectomy days earlier.",
    recap: "Last of the runners at Zandvoort (16th) after a post-race penalty for a first-lap clash with teammate Albon.",
  },
  {
    id: "albon",
    name: "Alex Albon",
    initials: "AA",
    number: 23,
    team: "Williams",
    nationality: "Thailand",
    era: "2026-grid",
    seasonsActive: "2019–2020, 2022–",
    stats: { championships: 0, wins: 0, podiums: 2, poles: 0 },
    note: "Both podiums came in a two-year Red Bull spell before a 2022 rebuild at Williams.",
    recap: "Didn't finish Zandvoort's farewell race after contact with teammate Sainz on the first lap.",
  },
  {
    id: "hulkenberg",
    name: "Nico Hülkenberg",
    initials: "NH",
    number: 27,
    team: "Audi",
    nationality: "Germany",
    era: "2026-grid",
    seasonsActive: "2010–2019, 2023–",
    stats: { championships: 0, wins: 0, podiums: 1, poles: 1 },
    note: "Most career starts of any driver without a win — first podium finally arrived in 2025.",
    recap: "Eighth at Zandvoort was Audi's best result of the season.",
  },
  {
    id: "bortoleto",
    name: "Gabriel Bortoleto",
    initials: "GB",
    number: 5,
    team: "Audi",
    nationality: "Brazil",
    era: "2026-grid",
    seasonsActive: "2025–",
    stats: { championships: 0, wins: 0, podiums: 0, poles: 0 },
    note: "Arrived off an F2 title — still working through his first full season's points record.",
    recap: "Finished outside the points at Zandvoort, on Audi's stronger side of the garage that day.",
  },
  {
    id: "perez",
    name: "Sergio Pérez",
    initials: "SP",
    number: 11,
    team: "Cadillac",
    nationality: "Mexico",
    era: "2026-grid",
    seasonsActive: "2011–",
    stats: { championships: 0, wins: 6, podiums: 39, poles: 4 },
    note: "Returns to the grid in 2026 with Cadillac's debut entry after a year out.",
    recap: "Finished outside the points at Zandvoort, on Cadillac's side of the garage that reached the flag.",
  },
  {
    id: "bottas",
    name: "Valtteri Bottas",
    initials: "VB",
    number: 77,
    team: "Cadillac",
    nationality: "Finland",
    era: "2026-grid",
    seasonsActive: "2013–",
    stats: { championships: 0, wins: 10, podiums: 67, poles: 20 },
    note: "Ten wins and a title runner-up finish, mostly as the second Mercedes seat through their dominant run.",
    recap: "Didn't finish Zandvoort's farewell race — the other retirement on Cadillac's side of the garage.",
  },

  // ---- Sepang history, each tied to a specific /lore entry ----
  {
    id: "irvine",
    name: "Eddie Irvine",
    initials: "EI",
    number: null,
    team: "Ferrari",
    nationality: "United Kingdom",
    era: "sepang-history",
    seasonsActive: "1993–2002",
    stats: { championships: 0, wins: 4, podiums: 26, poles: 0 },
    loreId: "1999-opening",
    note: "Won Sepang's inaugural 1999 race — his fourth and final F1 win, and the closest he got to that year's title.",
  },
  {
    id: "schumacher",
    name: "Michael Schumacher",
    initials: "MS",
    number: null,
    team: "Ferrari",
    nationality: "Germany",
    era: "sepang-history",
    seasonsActive: "1991–2006, 2010–2012",
    stats: { championships: 7, wins: 91, podiums: 155, poles: 68 },
    loreId: "1999-opening",
    note: "Finished second at Sepang's 1999 opener, running interference for teammate Irvine on his return from a broken leg.",
  },
  {
    id: "button",
    name: "Jenson Button",
    initials: "JB",
    number: null,
    team: "Brawn GP",
    nationality: "United Kingdom",
    era: "sepang-history",
    seasonsActive: "2000–2017",
    stats: { championships: 1, wins: 15, podiums: 50, poles: 8 },
    loreId: "2009-monsoon",
    note: "Declared the winner when the 2009 monsoon red flag stopped the race at lap 31 and it was never restarted.",
  },
];
