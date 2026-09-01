export type SeatCategory = "Premium" | "Action" | "Value" | "Hospitality";
export type ViewType = "Seated & Rooftop" | "Grass / Open Air";

export interface GrandstandInfo {
  id: string;
  name: string;
  category: SeatCategory;
  viewType: ViewType;
  description: string;
}

// Orientation only — no pricing, no sales. Prices change and belong on the
// official ticketing site, not duplicated here where they'd go stale.
// Descriptions written independently based on publicly listed stand names.
export const grandstands: GrandstandInfo[] = [
  {
    id: "main-grandstand",
    name: "Main Grandstand (MGS)",
    category: "Premium",
    viewType: "Seated & Rooftop",
    description:
      "Covers the start/finish straight and podium — the only stand with sightlines over both the race start and the trophy presentation.",
  },
  {
    id: "k1-grandstand",
    name: "K1 Grandstand",
    category: "Action",
    viewType: "Seated & Rooftop",
    description:
      "Overlooks a heavy braking zone into a tight corner — typically one of the highest overtake-count seats on the lap.",
  },
  {
    id: "k2-hillstand",
    name: "K2 Hillstand",
    category: "Value",
    viewType: "Grass / Open Air",
    description:
      "Open grass banking with elevated sightlines across several corners at once — breadth of view over proximity.",
  },
  {
    id: "f-grandstand",
    name: "F Grandstand",
    category: "Action",
    viewType: "Seated & Rooftop",
    description:
      "Mid-circuit seated stand, good for watching cars carry speed through a technical sequence.",
  },
  {
    id: "b-hillstand",
    name: "B Hillstand",
    category: "Value",
    viewType: "Grass / Open Air",
    description: "Open-air grass banking, unreserved within the section.",
  },
  {
    id: "c-hillstand",
    name: "C Hillstand",
    category: "Value",
    viewType: "Grass / Open Air",
    description: "Open-air grass banking on the opposite side of the circuit from B Hillstand.",
  },
];

export const ticketPolicy = {
  duration: "Tickets are typically sold as a single pass covering the full race weekend, not per-session.",
  residentPricing:
    "Malaysian citizens (MyKad holders) are usually offered local resident rates, separate from international pricing, verified at checkout.",
  childPolicy:
    "Young children commonly receive a partial discount, with very young children admitted free without a seat allocation — always confirm current age bands with the official seller.",
  disclaimer:
    "This is a general orientation guide only. No tickets are sold here and no live pricing is quoted — purchase only through the official Sepang International Circuit channel. This year's race weekend at Sepang runs under the Formula 1 Gulf Air Bahrain Grand Prix name; Jalur APEXGP is an independent fan project, not affiliated with or endorsed by Formula 1, the FIA, Bahrain International Circuit, or Sepang International Circuit.",
};
