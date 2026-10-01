/**
 * The official race-weekend shuttle: Rapid KL, with Sepang International
 * Circuit, running free buses to the circuit for the 2026 Bahrain Grand
 * Prix weekend. Facts are from Rapid KL's own travel notice ("Notis
 * Perjalanan"), cross-checked against the press coverage in SOURCES — a
 * hand-kept snapshot, not a live feed, so nothing here pretends to know
 * where a bus is right now.
 */

export const SHUTTLE_DAYS = ["2026-10-02", "2026-10-03", "2026-10-04"] as const;

const OPENS_AT = "07:00:00";
const SERVICE_HOURS = 17;

export const SHUTTLE_FACTS = {
  dates: "2–4 Oct",
  days: "Fri–Sun",
  hours: "7am–midnight",
  frequency: "10–15 min",
  buses: 95,
} as const;

export interface ShuttlePickup {
  id: string;
  name: string;
  spot: string;
  note?: string;
  mapsQuery: string;
}

export const SHUTTLE_PICKUPS: ShuttlePickup[] = [
  {
    id: "klia2",
    name: "KLIA 2",
    spot: "Bus Hub, Level 1 · Bays B1, B2 & B3",
    note: "Where the KLIA Ekspres and KLIA Transit trains arrive, so every rail route below ends here.",
    mapsQuery: "KLIA2 Transportation Hub Level 1 Sepang",
  },
  {
    id: "mitsui",
    name: "Mitsui Outlet Park KLIA",
    spot: "Bus Hub",
    mapsQuery: "Mitsui Outlet Park KLIA Sepang",
  },
  {
    id: "enstek",
    name: "Bandar Baru Enstek",
    spot: "De-Village, Persiaran Millenia 2",
    mapsQuery: "De-Village Persiaran Millenia 2 Bandar Baru Enstek",
  },
];

export function directionsUrl(pickup: ShuttlePickup): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickup.mapsQuery)}`;
}

export interface RailLine {
  name: string;
  color: string;
}

export interface RailRoute {
  lines: RailLine[];
  steps: string;
}

// Line colours follow Rapid KL's own network map, so a rider can match a
// chip here to the signage in the station.
export const RAIL_ROUTES: RailRoute[] = [
  {
    lines: [
      { name: "Kelana Jaya Line", color: "#e0004d" },
      { name: "KL Monorail", color: "#78be20" },
    ],
    steps: "Ride to KL Sentral, then KLIA Ekspres or KLIA Transit to KLIA 2.",
  },
  {
    lines: [{ name: "Kajang Line", color: "#008640" }],
    steps: "Change at Muzium Negara (linked to KL Sentral), then KLIA Ekspres or KLIA Transit to KLIA 2.",
  },
  {
    lines: [
      { name: "Ampang Line", color: "#e57200" },
      { name: "Sri Petaling Line", color: "#8d2833" },
    ],
    steps: "Change at Bandar Tasik Selatan for KLIA Transit to KLIA 2.",
  },
  {
    lines: [{ name: "Putrajaya Line", color: "#ffcb05" }],
    steps: "Change at Putrajaya Sentral for KLIA Transit to KLIA 2.",
  },
];

export const SHUTTLE_SOURCES = [
  {
    label: "Malay Mail, 30 Sep — Rapid KL travel notice",
    href: "https://www.malaymail.com/news/malaysia/2026/09/30/free-rapid-kl-shuttle-buses-to-sepang-circuit-to-run-every-10-15-minutes-from-oct-24/237130",
  },
  {
    label: "Malay Mail, 24 Sep — 95 buses, in-circuit shuttles",
    href: "https://www.malaymail.com/news/malaysia/2026/09/24/rapid-kl-to-offer-free-shuttle-buses-for-bahrain-gp-at-sepang/236378",
  },
  {
    label: "Malay Mail, 1 Oct — KLIA parking advisory",
    href: "https://www.malaymail.com/news/malaysia/2026/10/01/watching-the-f1-in-sepang-this-weekend-klia-urges-visitors-to-ditch-cars-use-public-transport/237225",
  },
  {
    label: "paultan.org, 25 Sep — Race Train Pass",
    href: "https://paultan.org/2026/09/25/rapid-kl-to-provide-free-shuttle-bus-service-to-sic-for-f1-bahrain-gp-in-sepang/",
  },
] as const;

export type ShuttleStatus =
  | { kind: "upcoming"; nextStart: Date }
  | { kind: "running"; endsAt: Date }
  | { kind: "overnight"; nextStart: Date }
  | { kind: "ended" };

/** Where the timetable stands at `now`: before the first bus, running,
 * paused overnight between race days, or done for the weekend. Malaysia
 * has no daylight saving, so the fixed +08:00 offset is exact. */
export function shuttleStatus(now: Date): ShuttleStatus {
  for (const [i, day] of SHUTTLE_DAYS.entries()) {
    const start = new Date(`${day}T${OPENS_AT}+08:00`);
    const end = new Date(start.getTime() + SERVICE_HOURS * 3_600_000);
    if (now < start) return i === 0 ? { kind: "upcoming", nextStart: start } : { kind: "overnight", nextStart: start };
    if (now < end) return { kind: "running", endsAt: end };
  }
  return { kind: "ended" };
}
