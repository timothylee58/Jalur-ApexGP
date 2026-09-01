export type ProximityBand = "near-circuit" | "selangor" | "kl-city";
export type VenueSetting = "indoor" | "outdoor" | "mixed";

export interface Attraction {
  id: string;
  name: string;
  category: string;
  proximity: ProximityBand;
  setting: VenueSetting;
  driveTimeMinutes: number;
  description: string;
  imageQuery: string;
  imageUrl?: string;
}

export const attractions: Attraction[] = [
  {
    id: "bagan-lalang",
    name: "Bagan Lalang Beach (Sepang Gold Coast)",
    category: "Beach",
    proximity: "near-circuit",
    setting: "outdoor",
    driveTimeMinutes: 15,
    description:
      "Post-FP2 wind-down — seafood by the water, 15 min from the circuit, before the overnight reset.",
    imageQuery: "Bagan Lalang Beach Sepang",
  },
  {
    id: "mitsui-outlet-klia",
    name: "Mitsui Outlet Park KLIA Sepang",
    category: "Shopping",
    proximity: "near-circuit",
    setting: "indoor",
    driveTimeMinutes: 10,
    description:
      "Between-session pit stop — air-con, food court, 10 min from the paddock if the heat is brutal.",
    imageQuery: "Mitsui Outlet Park KLIA Sepang",
  },
  {
    id: "cyberjaya-lake-gardens",
    name: "Cyberjaya Lake Gardens",
    category: "Park",
    proximity: "near-circuit",
    setting: "outdoor",
    driveTimeMinutes: 20,
    description:
      "Quiet lakeside walk before race day — 20 min from the circuit, best in the morning before the heat.",
    imageQuery: "Cyberjaya Lake Gardens Malaysia",
  },
  {
    id: "batu-caves",
    name: "Batu Caves",
    category: "Landmark",
    proximity: "selangor",
    setting: "mixed",
    driveTimeMinutes: 60,
    description:
      "Overnight Selangor run — cave climb and temple steps; plan 60 min each way from Sepang.",
    imageQuery: "Batu Caves Selangor Malaysia",
  },
  {
    id: "sunway-lagoon",
    name: "Sunway Lagoon",
    category: "Theme Park",
    proximity: "selangor",
    setting: "mixed",
    driveTimeMinutes: 50,
    description:
      "Full-day theme park if you're extending the trip — water zones indoors when afternoon storms roll in.",
    imageQuery: "Sunway Lagoon theme park Malaysia",
  },
  {
    id: "kuala-selangor-fireflies",
    name: "Kuala Selangor Fireflies",
    category: "Nature",
    proximity: "selangor",
    setting: "outdoor",
    driveTimeMinutes: 75,
    description:
      "Evening river tour after Quali — book the dusk slot; weather-dependent, skip if storms are forecast.",
    imageQuery: "Kuala Selangor fireflies river tour",
  },
  {
    id: "petronas-towers",
    name: "Petronas Twin Towers & KLCC Park",
    category: "Landmark",
    proximity: "kl-city",
    setting: "indoor",
    driveTimeMinutes: 65,
    description:
      "Quali→Race overnight — mall, park, and observation deck; good rain-day KL anchor.",
    imageQuery: "Petronas Twin Towers Kuala Lumpur",
  },
];
