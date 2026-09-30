import type { Compound } from "@/types";

/** Pirelli's compound colours, as painted on the sidewall. Kept out of the
 * client components so server code (the /og share card) can use them too. */
export const TYRE_COLOR: Record<Compound, string> = {
  Hard: "#f4efe6",
  Medium: "#ffd200",
  Soft: "#e0301f",
  Intermediate: "#43b02a",
  Wet: "#2f6fe0",
};
