/**
 * Corner callouts for the 3D circuit explorer (CircuitExplorer3D), covering
 * all 15 named Sepang corners. `t` is the *raw* curve parameter (not
 * arc-length — see CatmullRomCurve3.getPoint vs getPointAt), matching each
 * corner's index among the 18 real apex points in `data/sepang.json` /
 * `data/sepangCircuit.ts` (Start/Finish, T1 Entry, T1 Apex, T2 Apex, …,
 * T14 Apex, Back Straight Mid, T15 Hairpin — "Back Straight Mid" sits
 * between T14 and T15, Sepang's real 927m back straight, which runs back
 * alongside the pit straight in the opposite direction and joins it only
 * via the T15 hairpin, per driver61.com's circuit guide; T15 is therefore
 * index 17, one later than T14's corner number alone would suggest) — the
 * same real centreline CircuitFlyoverHero / `lib/circuitFlyoverTrack.ts`
 * builds its curve from, per t = index / 18.
 * This intentionally reunifies the two curves the codebase had split
 * (CircuitExplorer3D previously traced its own by-eye loop rather than use
 * this real data, since its hotspot `t` values were calibrated against
 * that curve specifically) — this file is now the corner source of truth
 * for both.
 *
 * T1, T9, and T15's notes are kept word-for-word aligned with
 * `data/sepangCircuit.ts`'s `circuitMarkers` (the predict-flow's compact
 * map) and the strategy engine's own reasoning text
 * (backend/app/services/strategy_service.py), since those three corners
 * are the ones its output actually references.
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
    t: 2 / 18,
    note: "First braking zone off the pit straight — the wet-race box-call reference.",
  },
  {
    id: "t2",
    code: "T2",
    name: "Turn 2",
    t: 3 / 18,
    note: "Second-gear left that catches drivers carrying too much speed out of Turn 1 — a common early-lap lockup spot.",
  },
  {
    id: "t3",
    code: "T3",
    name: "Turn 3",
    t: 4 / 18,
    note: "Long, patient right-hander setting the car up for the braking zone into Turn 4 — track-out width matters here.",
  },
  {
    id: "t4",
    code: "T4",
    name: "Turn 4",
    t: 5 / 18,
    note: "The Langkawi Curve — a 90-degree, second-gear right-hander. Looks simple but the apex kerb step catches drivers who don't commit to it.",
  },
  {
    id: "t5",
    code: "T5",
    name: "Turn 5",
    t: 6 / 18,
    note: "Opens the esses — a quick left that loads the front-left hard on entry.",
  },
  {
    id: "t6",
    code: "T6",
    name: "Turn 6",
    t: 7 / 18,
    note: "Fast right-hand flick right after Turn 5 — the car unweights over a crest here, so clean throttle pickup matters more than outright commitment.",
  },
  {
    id: "t7",
    code: "T7",
    name: "Turn 7",
    t: 8 / 18,
    note: "Opens the KLIA Curve — a long, medium-speed double-apex right-hander with Turn 8. A compromised entry here costs both apexes.",
  },
  {
    id: "t8",
    code: "T8",
    name: "Turn 8",
    t: 9 / 18,
    note: "Closes the KLIA Curve's second apex — exit speed matters more than entry commitment here, unlike most double-apex corners.",
  },
  {
    id: "t9",
    code: "T9",
    name: "Turn 9",
    t: 10 / 18,
    note: "Closing-radius left — the storm-call reference (box before it closes up).",
  },
  {
    id: "t10",
    code: "T10",
    name: "Turn 10",
    t: 11 / 18,
    note: "Fast, blind right-hand kink over a crest — taken with commitment; unwinding the wheel early costs the run to Turn 11.",
  },
  {
    id: "t11",
    code: "T11",
    name: "Turn 11",
    t: 12 / 18,
    note: "Tightens on exit — a wide entry here often turns into a defensive squeeze on the following straight.",
  },
  {
    id: "t12",
    code: "T12",
    name: "Turn 12",
    t: 13 / 18,
    note: "Fast left that loads the outside tyres hard — one of the higher-deg corners on a race-distance run.",
  },
  {
    id: "t13",
    code: "T13",
    name: "Turn 13",
    t: 14 / 18,
    note: "Tight infield right that punishes an early throttle — costs more time on used rears than it looks.",
  },
  {
    id: "t14",
    code: "T14",
    name: "Turn 14",
    t: 15 / 18,
    note: "90-degree right-hander onto the back straight — exit traction here sets the top speed for the whole run down to Turn 15.",
  },
  {
    id: "t15",
    code: "T15",
    name: "Turn 15",
    t: 17 / 18,
    note: "Final hairpin onto the pit straight; out-lap traffic here costs a flying lap.",
  },
];
