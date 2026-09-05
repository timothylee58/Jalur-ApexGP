export type LoreKind = "opening" | "monsoon" | "farewell" | "return";

export interface LoreEntry {
  id: string;
  year: string;
  date: string;
  title: string;
  body: string;
  kind: LoreKind;
  /** Why this moment still shapes a strategy read at Sepang today. */
  engineerNote: string;
}

export const loreEntries: LoreEntry[] = [
  {
    id: "1999-opening",
    year: "1999",
    date: "17 October 1999",
    title: "The circuit opens",
    body:
      "Sepang International Circuit hosts its first Formula 1 race, a Hermann Tilke design built on reclaimed palm plantation south of Kuala Lumpur. Eddie Irvine wins for Ferrari; Michael Schumacher, back from a broken leg, runs interference for him all afternoon.",
    kind: "opening",
    engineerNote:
      "The layout that debuted here — two long straights joined by a hairpin — is why every read on this circuit starts with rear-tyre temperature, not lap time.",
  },
  {
    id: "2009-monsoon",
    year: "2009",
    date: "5 April 2009",
    title: "The monsoon red flag",
    body:
      "A late-afternoon storm arrives over the circuit and the race is stopped after 31 laps. With standing water on track and daylight gone, it is never restarted — the classification is taken from lap 31 and half points are awarded. Jenson Button is declared the winner for Brawn.",
    kind: "monsoon",
    engineerNote:
      "The reason this app blends an hourly rain curve rather than a single daily number. At Sepang the storm does not build all day — it arrives.",
  },
  {
    id: "2017-farewell",
    year: "2017",
    date: "1 October 2017",
    title: "The last Malaysian Grand Prix",
    body:
      "After 19 editions, Malaysia drops off the calendar over rising hosting costs and falling attendance. Max Verstappen wins the send-off. The circuit stays busy with motorcycle and endurance racing, but the Formula 1 paddock does not come back for years.",
    kind: "farewell",
    engineerNote:
      "The gap in the record is why there is no useful recent-form data to model here — the strategy engine leans on climatology instead.",
  },
  {
    id: "2026-return",
    year: "2026",
    date: "2–4 October 2026",
    title: "Formula 1 returns to Sepang",
    body:
      "The Formula 1 paddock is back at the circuit. Jolpica/Ergast lists this weekend as the Bahrain Grand Prix in Malaysia (round 16) — Sepang is hosting that event, not a rebranded Malaysian Grand Prix. Jalur APEXGP is built around this weekend.",
    kind: "return",
    engineerNote:
      "An October date sits in the shoulder of the northeast monsoon — afternoon storms are still in play, just less of a daily certainty than the April inter-monsoon peak.",
  },
];
