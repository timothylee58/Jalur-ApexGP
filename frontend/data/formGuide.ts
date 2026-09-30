/**
 * The last race before this weekend, for the picks page's form guide.
 * Hand-written from published race reports, not a live feed, so it names
 * its round and sources, and needs replacing after each round (the live
 * standings beside it update themselves).
 */
export const LAST_RACE = {
  round: 15,
  name: "Azerbaijan Grand Prix",
  date: "26 Sep 2026",
  notes: [
    "Russell won from pole, 0.196s clear of Verstappen after two safety-car restarts, and set the fastest lap.",
    "Hadjar, back from a wrist injury, made it a Red Bull double podium in third.",
    "Championship leader Antonelli recovered from 16th on the grid to fifth.",
    "Colapinto carries a five-place grid penalty to Sepang for the restart collision that also put out Norris and Gasly.",
    "Only 16 of 22 cars were classified.",
  ],
  sources: [
    {
      label: "GPFans",
      url: "https://www.gpfans.com/en/f1-news/1090761/f1-azerbaijan-grand-prix-2026-results-final-classification-all-penalties-applied-baku/",
    },
    { label: "The Race", url: "https://www.the-race.com/formula-1/f1-2026-azerbaijan-grand-prix-race-results/" },
  ],
} as const;
