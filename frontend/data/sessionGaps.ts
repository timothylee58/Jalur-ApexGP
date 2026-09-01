import type { ProximityBand } from "./attractions";
import type { Session } from "@/types";

export type GapLength = "short" | "overnight" | "post-event";

export interface SessionGap {
  afterSession: Session;
  label: string;
  gapLength: GapLength;
  recommendedBands: ProximityBand[];
  blurb: string;
}

export const sessionGaps: SessionGap[] = [
  {
    afterSession: "FP1",
    label: "FP1 → FP2",
    gapLength: "short",
    recommendedBands: ["near-circuit"],
    blurb: "~3hr gap — grab a quick bite near the circuit; Mitsui Outlet is 10 min if you need AC.",
  },
  {
    afterSession: "FP2",
    label: "FP2 → FP3 (overnight)",
    gapLength: "overnight",
    recommendedBands: ["near-circuit", "selangor"],
    blurb: "Overnight — Selangor day trip works if you're back before FP3 grid walk.",
  },
  {
    afterSession: "FP3",
    label: "FP3 → Quali",
    gapLength: "short",
    recommendedBands: ["near-circuit"],
    blurb: "~3hr gap — stay within 20 min of the circuit; traffic builds after Quali.",
  },
  {
    afterSession: "Quali",
    label: "Quali → Race (overnight)",
    gapLength: "overnight",
    recommendedBands: ["near-circuit", "selangor", "kl-city"],
    blurb: "Longest gap — KLCC or Batu Caves feasible if you're not back at the paddock early.",
  },
  {
    afterSession: "Race",
    label: "Post-race",
    gapLength: "post-event",
    recommendedBands: ["near-circuit"],
    blurb: "Post-race decompression — Bagan Lalang seafood is 15 min if you're not rushing to KLIA.",
  },
];
