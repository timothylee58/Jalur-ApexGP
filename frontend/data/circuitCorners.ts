/**
 * Corner callouts for the 3D circuit explorer, positioned as a 0–1 parameter
 * along the traced track curve (see CircuitExplorer3D). Deliberately limited
 * to the four corners the strategy engine's own reasoning text already
 * names (backend/app/services/strategy_service.py) — Turn 1, the Turn 5–7
 * esses, Turn 9, and Turn 15 — so the 3D view and the predict-flow copy
 * reinforce the same circuit knowledge instead of inventing a separate set.
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
    t: 0.06,
    note: "First braking zone off the pit straight — the reference point for a wet-race box call.",
  },
  {
    id: "t5-7",
    code: "T5–T7",
    name: "The esses",
    t: 0.28,
    note: "A quick left-right-left through the esses. Heat soak builds here before the back straight.",
  },
  {
    id: "t9",
    code: "T9",
    name: "Turn 9",
    t: 0.52,
    note: "A closing-radius corner — the strategy engine's storm-call reference point (box before it closes up).",
  },
  {
    id: "t15",
    code: "T15",
    name: "Turn 15",
    t: 0.86,
    note: "Final corner onto the pit straight. Traffic here on a qualifying out-lap can cost a flying lap.",
  },
];
