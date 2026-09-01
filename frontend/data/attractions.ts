export type ProximityBand = "near-circuit" | "selangor" | "kl-city";

export interface Attraction {
  id: string;
  name: string;
  category: string;
  proximity: ProximityBand;
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
    driveTimeMinutes: 20,
    description:
      "A green space in Malaysia's tech hub district, close to Sepang, good for a quiet morning walk before race day.",
    imageQuery: "Cyberjaya Lake Gardens Malaysia",
  },
  {
    id: "batu-caves",
    name: "Batu Caves",
    category: "Landmark",
    proximity: "selangor",
    driveTimeMinutes: 60,
    description:
      "Limestone caves and a Hindu temple complex north of KL, one of the most recognisable landmarks in the Klang Valley.",
    imageQuery: "Batu Caves Selangor Malaysia",
  },
  {
    id: "sunway-lagoon",
    name: "Sunway Lagoon",
    category: "Theme Park",
    proximity: "selangor",
    driveTimeMinutes: 50,
    description:
      "A multi-park theme park with water, amusement, and wildlife zones — a full-day option if you're extending the trip beyond race weekend.",
    imageQuery: "Sunway Lagoon theme park Malaysia",
  },
  {
    id: "kuala-selangor-fireflies",
    name: "Kuala Selangor Fireflies",
    category: "Nature",
    proximity: "selangor",
    driveTimeMinutes: 75,
    description:
      "River tours at dusk to see firefly colonies along the Selangor riverbank — a distinctive evening activity outside the city.",
    imageQuery: "Kuala Selangor fireflies river tour",
  },
  {
    id: "petronas-towers",
    name: "Petronas Twin Towers & KLCC Park",
    category: "Landmark",
    proximity: "kl-city",
    driveTimeMinutes: 65,
    description:
      "Kuala Lumpur's defining skyline landmark, with a park, mall, and observation deck — the standard first stop for visitors basing themselves in KL.",
    imageQuery: "Petronas Twin Towers Kuala Lumpur",
  },
];
