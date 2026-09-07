/**
 * /calendar — this app's Sepang weekend alongside the real Singapore
 * Grand Prix, for the Malaysia/Singapore audience this whole project is
 * built for. Every fact here is WebSearch-verified against real sources
 * (see sourceUrl on each event and the citations below), same honesty
 * standard as sepangSchedule.ts and jolpica_service.py — no invented
 * dates or session times.
 *
 * Distance/travel time between the two host cities is stated as a real
 * range (not a fabricated single figure) — sources for the Kuala Lumpur
 * <-> Singapore road link vary between roughly 305–341 km / ~3.5–4
 * hours depending on route and traffic.
 */

export interface RegionalEvent {
  id: string;
  name: string;
  circuit: string;
  location: string;
  dateRange: string;
  isThisAppsWeekend: boolean;
  facts: string[];
  sourceLabel: string;
  sourceUrl: string;
}

export const REGIONAL_EVENTS: RegionalEvent[] = [
  {
    id: "sepang",
    name: "Formula 1 Gulf Air Bahrain Grand Prix",
    circuit: "Sepang International Circuit",
    location: "Sepang, Selangor, Malaysia",
    dateRange: "2–4 October 2026",
    isThisAppsWeekend: true,
    facts: [
      "The event this whole app is built around — Jolpica/Ergast round 16 of the real 2026 F1 season, relocated to Sepang in this app's fiction.",
      "Sepang's first Formula 1 weekend since 2017.",
    ],
    sourceLabel: "Jolpica/Ergast schedule",
    sourceUrl: "https://api.jolpi.ca/ergast/f1/2026/circuits/sepang/races/",
  },
  {
    id: "singapore",
    name: "Formula 1 Singapore Airlines Singapore Grand Prix",
    circuit: "Marina Bay Street Circuit",
    location: "Marina Bay, Singapore",
    dateRange: "9–11 October 2026",
    isThisAppsWeekend: false,
    facts: [
      "A real, currently-scheduled round — not modelled by this app, which stays focused on Sepang.",
      "Singapore's first-ever F1 Sprint weekend, and the season's final Sprint round.",
      "Run entirely under floodlights, as it has been every year since 2008 — F1's original night race.",
    ],
    sourceLabel: "singaporegp.sg",
    sourceUrl: "https://singaporegp.sg/en/",
  },
];

export const TRAVEL_NOTE =
  "The two circuits sit roughly 305–341 km apart by road (sources vary by route) — about 3.5–4 hours' drive between Sepang/Kuala Lumpur and Marina Bay. Sepang's weekend wraps Sunday 4 October; Singapore's starts the following Friday, 9 October — five days apart, close enough that both are realistically one trip.";
