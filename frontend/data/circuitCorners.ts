/**
 * Corner callouts for the 3D circuit explorer, positioned as a 0–1 parameter
 * along the traced track curve (see CircuitExplorer3D). Covers all 15 named
 * corners of the Sepang International Circuit layout — Turn 1 through the
 * final chicane onto the pit straight — so the explorer reads as a full
 * lap rather than a curated subset. Notes stay in the same register as the
 * rest of the site: general, well-known circuit characteristics (braking
 * zones, camber, historical overtaking spots), not survey-grade telemetry.
 * Turns 5, 9, and 15 additionally carry the strategy engine's own reasoning
 * hooks (backend/app/services/strategy_service.py) so the two views still
 * reinforce each other where they overlap.
 */
export interface CircuitCorner {
  id: string;
  code: string;
  name: string;
  t: number;
  note: string;
}

export const circuitCorners: CircuitCorner[] = [
  {
    id: "t1",
    code: "T1",
    name: "Turn 1",
    t: 0.04,
    note: "First braking zone off the pit straight, downhill into a tightening right — the reference point for a wet-race box call.",
  },
  {
    id: "t2",
    code: "T2",
    name: "Turn 2",
    t: 0.09,
    note: "Second-gear left that catches drivers who carry too much speed out of Turn 1 — a common early-lap lockup spot.",
  },
  {
    id: "t3",
    code: "T3",
    name: "Turn 3",
    t: 0.14,
    note: "Long, patient right-hander that sets the car up for the run down to the hairpin — track-out width matters here.",
  },
  {
    id: "t4",
    code: "T4",
    name: "Turn 4",
    t: 0.19,
    note: "Tight, low-speed hairpin — heavy braking zone and the most common first-lap contact point on the circuit.",
  },
  {
    id: "t5-7",
    code: "T5–T7",
    name: "The esses",
    t: 0.28,
    note: "A quick left-right-left through the esses. Heat soak builds here before the back straight.",
  },
  {
    id: "t8",
    code: "T8",
    name: "Turn 8",
    t: 0.38,
    note: "Long, high-speed right sweeper leading onto the back straight — a big commitment corner on a low-fuel qualifying lap.",
  },
  {
    id: "t9",
    code: "T9",
    name: "Turn 9",
    t: 0.52,
    note: "A closing-radius corner — the strategy engine's storm-call reference point (box before it closes up).",
  },
  {
    id: "t10",
    code: "T10",
    name: "Turn 10",
    t: 0.58,
    note: "Short-radius right taken off the back straight's braking zone — the primary DRS-assisted overtaking spot.",
  },
  {
    id: "t11",
    code: "T11",
    name: "Turn 11",
    t: 0.63,
    note: "Tightens on exit — a wide entry here often turns into a defensive squeeze on the following straight.",
  },
  {
    id: "t12",
    code: "T12",
    name: "Turn 12",
    t: 0.68,
    note: "Fast left that loads the outside tyres hard — one of the higher-deg corners on a race-distance run.",
  },
  {
    id: "t13",
    code: "T13",
    name: "Turn 13",
    t: 0.74,
    note: "Tight infield right that punishes an early throttle — costs more time on used rears than it looks.",
  },
  {
    id: "t14",
    code: "T14",
    name: "Turn 14",
    t: 0.80,
    note: "Sets up the final approach — a compromised line here carries all the way through Turn 15.",
  },
  {
    id: "t15",
    code: "T15",
    name: "Turn 15",
    t: 0.86,
    note: "Final corner onto the pit straight. Traffic here on a qualifying out-lap can cost a flying lap.",
  },
  {
    id: "t15b",
    code: "T15b",
    name: "Turn 15 exit",
    t: 0.92,
    note: "Long exit kerb onto the pit straight — where the tow for next lap's DRS zone is made or lost.",
  },
  {
    id: "sf",
    code: "S/F",
    name: "Start/finish",
    t: 0.0,
    note: "The widest straight on the calendar — a strong exit out of Turn 15 is worth more here than almost anywhere else on the lap.",
  },
];
