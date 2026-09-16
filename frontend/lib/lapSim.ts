/**
 * Physics-lite hot-lap simulation over Sepang's centreline.
 *
 * This is a quasi-steady-state lap solver — the standard first-order lap
 * time approach — not a trained model and not a telemetry replay:
 *
 *   1. Each named corner gets a target apex speed (see
 *      SEPANG_CORNER_REFERENCE) applied over the arc it actually occupies.
 *      Everything between corners starts at the car's terminal speed.
 *   2. A forward pass applies what the car can *add* — traction limited at
 *      low speed, power limited at high speed, minus drag.
 *   3. A backward pass applies what it can *shed* under braking, which is
 *      what actually sets the braking point ahead of each corner.
 *   4. The envelope of the three is the speed trace; integrating ds/v
 *      gives lap and sector times, and the braking zones fall out of the
 *      solved deceleration rather than being drawn on by hand.
 *
 * WHY APEX SPEEDS ARE TABULATED RATHER THAN DERIVED FROM CURVATURE.
 * The obvious approach — radius from local curvature, then
 * v = sqrt(a_lat * R) — needs corner radii, and these 18 points are one
 * sample per corner: they sit on the OpenStreetMap-traced centreline in
 * `data/sepang.json` (so the loop now measures 5236 m as a raw polygon
 * against a published 5543 m — chord-cutting, not distortion — and
 * T14 -> Back Straight Mid -> T15 is 914 m against the real 927 m back
 * straight), but three points around a corner still describe its radius
 * far too coarsely to solve a speed from. Deriving speeds instead wants
 * the dense `centreline` array, which is a larger change than the shape
 * fix this table predates. So the points supply *shape* — position,
 * elevation, the line the car follows — and the table below supplies
 * *speed*, with the curvature route now unblocked as a follow-up and
 * this table its cross-check.
 *
 * HONESTY, same standard as strategy_service.py and data/sepang.json:
 * corner speeds marked `sourced` come from published circuit guides
 * (driver61.com, sepangtravel.com — see per-corner notes); the rest are
 * reasoned from the corner's described character and are marked
 * `estimated`. Vehicle constants are public ballpark 2026-regulation
 * figures, not any team's real data. Output is a *plausible* lap,
 * labelled as simulated everywhere it surfaces — never a real one.
 *
 * Sector boundaries sit at real corner landmarks — the T5 and T11 apexes
 * — chosen to match how the layout is described: the T1-T4 opening
 * complex, then the Genting and KLIA curves, then the final sequence
 * through the T15 hairpin onto the straight. They do NOT come out as
 * even thirds by distance — sector 3 swallows the back straight. The
 * FIA's actual timing-loop positions aren't published, so these are
 * derived landmarks, not official splits.
 */

import { circuitPointsMetres } from "@/data/sepangCircuit";
import sepang from "@/data/sepang.json";

export interface LapSample {
  /** Cumulative distance from the start/finish line, metres. */
  s: number;
  /** Circuit-local position, metres (same planar projection as sepangCircuit). */
  x: number;
  y: number;
  /** Interpolated elevation, metres above the same datum as sepang.json. */
  elev: number;
  speedKmh: number;
  /** Longitudinal acceleration, g. Negative under braking. */
  longG: number;
  /** Elapsed lap time at this point, seconds. */
  t: number;
  sector: 1 | 2 | 3;
  braking: boolean;
  /** 0-1, modelled from the longitudinal demand rather than measured. */
  throttle: number;
  brake: number;
  gear: number;
}

export interface BrakingZone {
  id: string;
  startS: number;
  endS: number;
  entrySpeedKmh: number;
  minSpeedKmh: number;
  /** Peak deceleration through the zone, g. */
  peakG: number;
  lengthM: number;
  /** Nearest named corner at the zone's exit. */
  cornerCode: string | null;
  sector: 1 | 2 | 3;
}

export interface CornerAnalysis {
  turn: number;
  code: string;
  label: string | null;
  direction: "left" | "right";
  /** Arc-length position of the apex, metres from the timing line. */
  s: number;
  apexSpeedKmh: number;
  gear: number;
  sector: 1 | 2 | 3;
  elev: number;
  /** False where apexSpeedKmh/gear are reasoned rather than published. */
  sourced: boolean;
  note: string;
  /** Speed carried into the corner's braking zone, km/h. */
  entrySpeedKmh: number;
}

export interface LapSimResult {
  samples: LapSample[];
  /** Total simulated lap time, seconds. */
  lapTimeS: number;
  sectorTimesS: [number, number, number];
  /** Cumulative distance at each sector boundary, metres. */
  sectorSplitsM: [number, number];
  topSpeedKmh: number;
  minSpeedKmh: number;
  /** Share of lap distance at effectively full throttle, 0-1. */
  flatOutFraction: number;
  brakingZones: BrakingZone[];
  corners: CornerAnalysis[];
  /** Length the centreline was normalised to, metres. */
  lengthM: number;
  /**
   * Factor the raw `circuitPointsMetres` coordinates were multiplied by to
   * make the loop measure `lengthM`. Renderers that need to line up with
   * anything built from the *unscaled* points (the flyover curve, and the
   * terrain registered against it) must divide sample x/y by this first.
   */
  coordScale: number;
  elevationRangeM: [number, number];
}

// --- Vehicle + track constants -------------------------------------------
// Public ballpark 2026-regulation figures, not any team's real data.
// Tuned so the solved lap sits near Sepang's real race lap record rather
// than at some arbitrary point — see the module docstring.

/** 2026 minimum car + driver mass, kg. */
const MASS_KG = 768;
/** Combined ICE + electric deployment, watts (~1000 hp). */
const POWER_W = 750_000;
/** Peak braking, g. */
const MAX_BRAKE_G = 5.0;
/** Traction-limited longitudinal accel off a slow corner, g. */
const MAX_TRACTION_G = 1.45;
/** Terminal speed on the longest straight, km/h — sets the drag constant. */
const V_MAX_KMH = 336;
/** Resampled points around the lap. ~4.6 m spacing at Sepang's length. */
const SAMPLES = 1200;

const G = 9.80665;
const KMH = 3.6;
const V_MAX = V_MAX_KMH / KMH;

export interface CornerReference {
  /** 1-15, matching the real corner numbering and sepang.json's point names. */
  turn: number;
  /** Local name where the corner has one. */
  label: string | null;
  direction: "left" | "right";
  apexKmh: number;
  gear: number;
  /** Arc the car spends at roughly apex speed — a hairpin is short, a sweeper long. */
  lengthM: number;
  /** True where apexKmh/gear come from a published guide rather than reasoning. */
  sourced: boolean;
  /**
   * True where this corner and the next are one continuous complex the car
   * never fully unloads between (Genting, KLIA, T1 into the T2 hairpin).
   * Without this the solver treats every apex as isolated and lets the car
   * reach terminal speed in a 150 m gap, which is what made the first
   * version of this lap 11 s quick.
   */
  linkedToNext: boolean;
  note: string;
}

/**
 * Per-corner reference speeds. `sourced: true` entries come from published
 * circuit guides (driver61.com's Sepang guide and sepangtravel.com's
 * 15-turn walkthrough); `sourced: false` entries are reasoned from the
 * surrounding corners and the described character of that section, and
 * should be treated as the weakest numbers here.
 *
 * Two guides disagree on which corner is genuinely slowest — one calls
 * T15 "the slowest point on the circuit", the other gives T9 a specific
 * ~75 km/h. The specific figure wins, and both sit within 10 km/h, so
 * nothing downstream hinges on the tie-break.
 */
export const SEPANG_CORNER_REFERENCE: CornerReference[] = [
  { turn: 1, label: null, direction: "right", apexKmh: 90, gear: 2, lengthM: 110, sourced: true,
    linkedToNext: true,
    note: "Cars arrive around 330 km/h and shed it to roughly 90 — a long, slow second-gear right where you brake late and give the speed up gradually." },
  { turn: 2, label: null, direction: "left", apexKmh: 125, gear: 3, lengthM: 60, sourced: true,
    linkedToNext: false,
    note: "Tight left hairpin dropping downhill; brake just past the 100m board, third gear, then flat from the exit kerb." },
  { turn: 3, label: null, direction: "right", apexKmh: 215, gear: 5, lengthM: 90, sourced: false,
    linkedToNext: false,
    note: "Medium right linking the opening complex to the T4 braking zone. Estimated — no published apex figure found." },
  { turn: 4, label: null, direction: "right", apexKmh: 120, gear: 3, lengthM: 60, sourced: true,
    linkedToNext: false,
    note: "Second/third-gear 90-degree right, hard braking down to about 75 mph." },
  { turn: 5, label: "Genting Curve", direction: "left", apexKmh: 275, gear: 7, lengthM: 140, sourced: true,
    linkedToNext: true,
    note: "First half of the Genting Curve — a very high-speed long chicane that punishes tyres and loads the driver up with sustained lateral g." },
  { turn: 6, label: "Genting Curve", direction: "right", apexKmh: 260, gear: 7, lengthM: 120, sourced: true,
    linkedToNext: false,
    note: "Second half of the Genting Curve, still carrying big speed." },
  { turn: 7, label: "KLIA Curve", direction: "right", apexKmh: 205, gear: 5, lengthM: 130, sourced: true,
    linkedToNext: true,
    note: "First apex of the KLIA Curve — a long, medium-speed double-apex right." },
  { turn: 8, label: "KLIA Curve", direction: "right", apexKmh: 190, gear: 5, lengthM: 110, sourced: true,
    linkedToNext: false,
    note: "Second apex of the KLIA Curve. A bump unsettles the car, and the outer exit kerb slopes away, so running wide is punished." },
  { turn: 9, label: "Berjaya Tioman", direction: "left", apexKmh: 75, gear: 2, lengthM: 50, sourced: true,
    linkedToNext: true,
    note: "The slowest corner on the circuit, around 75 km/h — an uphill left hairpin with a crest right at the apex that steps most cars sideways." },
  { turn: 10, label: null, direction: "right", apexKmh: 150, gear: 4, lengthM: 70, sourced: false,
    linkedToNext: false,
    note: "Medium-slow right out of the Berjaya Tioman complex. Estimated." },
  { turn: 11, label: null, direction: "left", apexKmh: 195, gear: 5, lengthM: 80, sourced: false,
    linkedToNext: false,
    note: "Medium left opening the final sector. Estimated." },
  { turn: 12, label: null, direction: "right", apexKmh: 235, gear: 6, lengthM: 100, sourced: false,
    linkedToNext: false,
    note: "Quick right, close to flat in a good car. Estimated." },
  { turn: 13, label: null, direction: "left", apexKmh: 170, gear: 4, lengthM: 70, sourced: false,
    linkedToNext: false,
    note: "Medium-slow left. Estimated." },
  { turn: 14, label: null, direction: "right", apexKmh: 155, gear: 4, lengthM: 70, sourced: false,
    linkedToNext: false,
    note: "Slower right feeding the back straight — exit speed here sets up the whole run to T15. Estimated." },
  { turn: 15, label: null, direction: "left", apexKmh: 85, gear: 2, lengthM: 55, sourced: true,
    linkedToNext: false,
    note: "Second-gear left hairpin at the end of the back straight, and the main overtaking spot into the run past the timing line." },
];

/**
 * Drag as a deceleration, k*v². Derived from V_MAX rather than guessed:
 * at terminal speed the power-limited accel exactly cancels drag, so
 * k = P / (m * v_max³). One tunable (V_MAX) instead of two that can
 * disagree with each other.
 */
const DRAG_K = POWER_W / (MASS_KG * V_MAX ** 3);

interface XY {
  x: number;
  y: number;
}

/**
 * Index of a turn's *apex* point in sepang.json.
 *
 * Two traps this exists to close, both of which shipped as bugs before it
 * did. Turn number and array index are not the same thing — the file
 * carries a "T1 Entry" point as well as "T1 Apex", so everything from T2
 * on is offset by one, and a hardcoded `points[5]` is T4, not T5. And a
 * `startsWith("T1 ")` scan finds "T1 Entry" first, which put T1's entire
 * speed constraint, 3D marker and seek target on the braking point
 * instead of the apex — leaving the real apex free to run at the
 * linked-complex ceiling rather than the 90 km/h it is supposed to be
 * held to.
 *
 * T15 is named "T15 Hairpin" rather than "T15 Apex", so both suffixes
 * count; "Entry" never does.
 */
function apexPointIndex(turn: number): number {
  return sepang.points.findIndex(
    (p) => p.name === `T${turn} Apex` || p.name === `T${turn} Hairpin`,
  );
}

interface DensePoint extends XY {
  elev: number;
}

/**
 * Centripetal Catmull-Rom (alpha = 0.5). Hand-rolled rather than reusing
 * three's CatmullRomCurve3 so this module stays dependency-free and
 * runnable under plain node in tests — and centripetal specifically,
 * because the uniform variant can throw cusps and self-intersections
 * through tight apex clusters like T5-T6-T7, which would poison the
 * curvature pass downstream.
 */
function catmullRom(
  p0: DensePoint,
  p1: DensePoint,
  p2: DensePoint,
  p3: DensePoint,
  t: number,
): DensePoint {
  const alpha = 0.5;
  const dist = (a: DensePoint, b: DensePoint) => Math.hypot(b.x - a.x, b.y - a.y) ** alpha;

  const t0 = 0;
  const t1 = t0 + (dist(p0, p1) || 1e-6);
  const t2 = t1 + (dist(p1, p2) || 1e-6);
  const t3 = t2 + (dist(p2, p3) || 1e-6);
  const tt = t1 + (t2 - t1) * t;

  const lerp = (a: number, b: number, ta: number, tb: number, at: number) =>
    ((tb - at) * a + (at - ta) * b) / (tb - ta || 1e-6);

  const mix = (key: "x" | "y" | "elev") => {
    const a1 = lerp(p0[key], p1[key], t0, t1, tt);
    const a2 = lerp(p1[key], p2[key], t1, t2, tt);
    const a3 = lerp(p2[key], p3[key], t2, t3, tt);
    const b1 = lerp(a1, a2, t0, t2, tt);
    const b2 = lerp(a2, a3, t1, t3, tt);
    return lerp(b1, b2, t1, t2, tt);
  };

  return { x: mix("x"), y: mix("y"), elev: mix("elev") };
}

/** Raw apex points with elevation, in the same planar metres projection. */
function controlPoints(): DensePoint[] {
  return circuitPointsMetres.map((p, i) => ({
    x: p.x,
    y: p.y,
    elev: sepang.points[i]?.elevM ?? 0,
  }));
}

/**
 * Dense closed spline through the control points, then resampled to even
 * arc-length spacing and scaled so the loop measures the circuit's real
 * published length. Chord-to-chord through 18 apexes undershoots the true
 * 5.543 km, so without this the speed trace would be right but every
 * distance and lap time would be systematically short.
 */
function resampleCentreline(): {
  points: DensePoint[];
  lengthM: number;
  controlS: number[];
  coordScale: number;
} {
  const ctrl = controlPoints();
  const n = ctrl.length;
  const PER_SEGMENT = 60;

  const dense: DensePoint[] = [];
  /** Arc-length index where each original control point lands. */
  const controlDenseIndex: number[] = [];
  for (let i = 0; i < n; i += 1) {
    controlDenseIndex.push(dense.length);
    const p0 = ctrl[(i - 1 + n) % n];
    const p1 = ctrl[i];
    const p2 = ctrl[(i + 1) % n];
    const p3 = ctrl[(i + 2) % n];
    for (let j = 0; j < PER_SEGMENT; j += 1) {
      dense.push(catmullRom(p0, p1, p2, p3, j / PER_SEGMENT));
    }
  }

  const cum: number[] = [0];
  for (let i = 1; i <= dense.length; i += 1) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const rawLength = cum[dense.length];
  const targetLength = sepang.lengthKm * 1000;
  const scale = targetLength / rawLength;

  // Even arc-length resample, walking the dense polyline once.
  const points: DensePoint[] = [];
  let cursor = 0;
  for (let i = 0; i < SAMPLES; i += 1) {
    const want = (i / SAMPLES) * rawLength;
    while (cursor < dense.length - 1 && cum[cursor + 1] < want) cursor += 1;
    const segLen = cum[cursor + 1] - cum[cursor] || 1e-6;
    const f = (want - cum[cursor]) / segLen;
    const a = dense[cursor];
    const b = dense[(cursor + 1) % dense.length];
    points.push({
      x: (a.x + (b.x - a.x) * f) * scale,
      y: (a.y + (b.y - a.y) * f) * scale,
      elev: a.elev + (b.elev - a.elev) * f,
    });
  }

  const controlS = controlDenseIndex.map((idx) => cum[idx] * scale);
  return { points, lengthM: targetLength, controlS, coordScale: scale };
}

function gearFor(speedKmh: number): number {
  // Eight ratios spread across the usable range — presentational, derived
  // from speed alone rather than modelled from engine rpm.
  const bands = [70, 105, 140, 175, 215, 255, 300];
  return bands.filter((b) => speedKmh > b).length + 1;
}

let cached: LapSimResult | null = null;

/**
 * Solves the lap. Deterministic and side-effect free, so the result is
 * memoised — every consumer (3D scene, 2D map, HUD, corner table) reads
 * the same trace rather than each re-solving and drifting apart.
 */
export function simulateLap(): LapSimResult {
  if (cached) return cached;

  const { points, lengthM, controlS, coordScale } = resampleCentreline();
  const n = points.length;
  const ds = lengthM / n;

  // 1. Speed ceiling: terminal speed everywhere, pulled down to the
  // reference apex speed across the arc each real corner occupies. The
  // window is centred on the named apex point's own arc position, so the
  // constraint lands where the corner actually is on this centreline even
  // though the centreline's absolute distances are known to be distorted.
  const vLimit = new Array<number>(n).fill(V_MAX);
  /** Sample index of each corner's apex, keyed by turn number. */
  const apexIndexByTurn = new Map<number, number>();

  for (const ref of SEPANG_CORNER_REFERENCE) {
    const pointIdx = apexPointIndex(ref.turn);
    if (pointIdx < 0) continue;
    const apexS = controlS[pointIdx];
    const apexI = Math.round(apexS / ds) % n;
    apexIndexByTurn.set(ref.turn, apexI);

    const half = Math.max(1, Math.round(ref.lengthM / 2 / ds));
    const vRef = ref.apexKmh / KMH;
    for (let k = -half; k <= half; k += 1) {
      const i = (apexI + k + n) % n;
      // Ease from the apex out to the corner's edges so the constraint is
      // a corner, not a step — a hard edge would make the solver brake and
      // accelerate impossibly sharply right at the window boundary.
      const edge = Math.abs(k) / half;
      const eased = vRef + (V_MAX - vRef) * edge * edge;
      vLimit[i] = Math.min(vLimit[i], eased);
    }
  }

  // Join linked complexes: between two apexes the car never fully unloads
  // between, cap the gap just above the faster of the two apex speeds
  // instead of letting it run to terminal speed. The 12% allowance is what
  // the car genuinely picks up between the two apexes of a double-apex
  // corner — it isn't held at a constant speed through there either.
  for (let r = 0; r < SEPANG_CORNER_REFERENCE.length; r += 1) {
    const ref = SEPANG_CORNER_REFERENCE[r];
    if (!ref.linkedToNext) continue;
    const next = SEPANG_CORNER_REFERENCE[r + 1];
    if (!next) continue;
    const from = apexIndexByTurn.get(ref.turn);
    const to = apexIndexByTurn.get(next.turn);
    if (from === undefined || to === undefined) continue;

    const ceiling = (Math.max(ref.apexKmh, next.apexKmh) * 1.12) / KMH;
    const span = (to - from + n) % n;
    for (let k = 0; k <= span; k += 1) {
      const i = (from + k) % n;
      vLimit[i] = Math.min(vLimit[i], ceiling);
    }
  }

  // 2/3. Forward (what we can add) and backward (what we can shed) passes.
  // Both run twice around the loop so the closed lap converges — a single
  // pass would leave the start/finish point unconstrained by the corner
  // that precedes it.
  // The friction-ellipse trade (less longitudinal grip while cornering
  // hard) is deliberately NOT modelled: it needs a trustworthy lateral
  // load, which needs a trustworthy radius, which this centreline cannot
  // give. The reference apex speeds already encode the grip limit at the
  // point it binds, so the passes only have to connect them. Exits come
  // out slightly optimistic as a result — a far smaller error than
  // feeding the ellipse a fabricated radius would introduce.
  const vf = vLimit.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < n; i += 1) {
      const v = vf[i];
      const next = (i + 1) % n;
      const powerLimitedG = POWER_W / (MASS_KG * Math.max(v, 5) * G);
      const netG = Math.min(MAX_TRACTION_G, powerLimitedG) - (DRAG_K * v * v) / G;
      const vNext = Math.sqrt(Math.max(0, v * v + 2 * netG * G * ds));
      vf[next] = Math.min(vf[next], vNext);
    }
  }

  const vb = vf.slice();
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = n - 1; i >= 0; i -= 1) {
      const next = (i + 1) % n;
      const v = vb[next];
      // Drag assists braking, so it adds to the decel budget here.
      const available = MAX_BRAKE_G + (DRAG_K * v * v) / G;
      const vPrev = Math.sqrt(Math.max(0, v * v + 2 * available * G * ds));
      vb[i] = Math.min(vb[i], vPrev);
    }
  }

  const speed = vb;

  // 4. Integrate time, and derive the presentational channels.
  // Looked up by turn number, never by a hardcoded array index. The index
  // and the turn number are off by one from T2 onward — sepang.json carries
  // a "T1 Entry" point as well as "T1 Apex" — so `controlS[5]` was landing
  // on T4, splitting sector 2 a corner earlier than the docstring says.
  const sectorSplitIndices: [number, number] = [
    controlS[apexPointIndex(5)] ?? lengthM / 3,
    controlS[apexPointIndex(11)] ?? (2 * lengthM) / 3,
  ];

  const samples: LapSample[] = [];
  let elapsed = 0;
  let flatOutDistance = 0;
  for (let i = 0; i < n; i += 1) {
    const s = i * ds;
    const v = speed[i];
    const vNext = speed[(i + 1) % n];
    const vAvg = Math.max((v + vNext) / 2, 1);
    const longG = (vNext * vNext - v * v) / (2 * ds * G);

    const sector: 1 | 2 | 3 =
      s < sectorSplitIndices[0] ? 1 : s < sectorSplitIndices[1] ? 2 : 3;

    const braking = longG < -0.35;
    // Throttle/brake are modelled, not measured — a quasi-steady-state
    // solver has no pedal channel. "Flat out" is whether the pedal is
    // buried, which is NOT the same as still accelerating: on the back
    // straight at terminal speed longG is ~0 and the car is absolutely
    // flat. So the test is "not braking, and not being held down by a
    // corner" — either running into the power/drag ceiling, or already at
    // it. Deriving it from longG instead reported 21% flat out for a lap
    // that spends a third of its distance pinned on two long straights.
    const cornerLimited = vLimit[i] < V_MAX * 0.999;
    const flatOut = !braking && (!cornerLimited || v < vLimit[i] * 0.995);
    const brake = braking ? Math.min(1, -longG / MAX_BRAKE_G) : 0;
    const throttle = braking ? 0 : flatOut ? 1 : 0.55;
    if (flatOut) flatOutDistance += ds;

    samples.push({
      s,
      x: points[i].x,
      y: points[i].y,
      elev: points[i].elev,
      speedKmh: v * KMH,
      longG,
      t: elapsed,
      sector,
      braking,
      throttle,
      brake,
      gear: gearFor(v * KMH),
    });

    elapsed += ds / vAvg;
  }

  const lapTimeS = elapsed;
  const sectorTimesS: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i += 1) {
    const next = samples[(i + 1) % n];
    const dt = i === n - 1 ? lapTimeS - samples[i].t : next.t - samples[i].t;
    sectorTimesS[samples[i].sector - 1] += dt;
  }

  // Braking zones: contiguous runs of braking samples, kept only if long
  // enough to be a real zone rather than a blip of spline noise.
  const brakingZones: BrakingZone[] = [];
  let runStart: number | null = null;
  for (let i = 0; i <= n; i += 1) {
    const isBraking = i < n && samples[i].braking;
    if (isBraking && runStart === null) runStart = i;
    if (!isBraking && runStart !== null) {
      const run = samples.slice(runStart, i);
      const lengthOfZone = run.length * ds;
      if (lengthOfZone >= 40) {
        // A braking zone belongs to the corner it ends at, so look ahead
        // from the zone's exit rather than at its midpoint.
        const exitS = run[run.length - 1].s;
        let turn: number | null = null;
        let bestGap = Infinity;
        apexIndexByTurn.forEach((apexI, t) => {
          const gap = (apexI * ds - exitS + lengthM) % lengthM;
          if (gap < bestGap) {
            bestGap = gap;
            turn = t;
          }
        });
        brakingZones.push({
          id: `bz-${brakingZones.length + 1}`,
          startS: run[0].s,
          endS: exitS,
          entrySpeedKmh: run[0].speedKmh,
          minSpeedKmh: Math.min(...run.map((r) => r.speedKmh)),
          peakG: Math.min(...run.map((r) => r.longG)),
          lengthM: lengthOfZone,
          cornerCode: turn === null || bestGap > 200 ? null : `T${turn}`,
          sector: run[0].sector,
        });
      }
      runStart = null;
    }
  }

  // Per-corner analysis, driven by the reference table so each real corner
  // appears exactly once — iterating sepang.json's points instead would
  // emit T1 twice, since it carries both a "T1 Entry" and a "T1 Apex".
  const corners: CornerAnalysis[] = SEPANG_CORNER_REFERENCE.map((ref) => {
    const apexI = apexIndexByTurn.get(ref.turn) ?? 0;
    const apex = samples[apexI];
    const half = Math.max(1, Math.round(ref.lengthM / 2 / ds));

    // Entry speed: the fastest the car is still doing in the approach,
    // which is what the braking zone actually starts from.
    let entry = apex.speedKmh;
    const approach = Math.round(250 / ds);
    for (let k = 1; k <= approach; k += 1) {
      const s = samples[(apexI - k + n) % n];
      if (s.speedKmh > entry) entry = s.speedKmh;
    }

    return {
      turn: ref.turn,
      code: `T${ref.turn}`,
      label: ref.label,
      direction: ref.direction,
      s: apex.s,
      apexSpeedKmh: ref.apexKmh,
      gear: ref.gear,
      sector: apex.sector,
      elev: apex.elev,
      sourced: ref.sourced,
      note: ref.note,
      entrySpeedKmh: entry,
    };
  });

  const elevs = samples.map((s) => s.elev);

  cached = {
    samples,
    lapTimeS,
    sectorTimesS,
    sectorSplitsM: sectorSplitIndices,
    topSpeedKmh: Math.max(...samples.map((s) => s.speedKmh)),
    minSpeedKmh: Math.min(...samples.map((s) => s.speedKmh)),
    flatOutFraction: flatOutDistance / lengthM,
    brakingZones,
    corners,
    lengthM,
    coordScale,
    elevationRangeM: [Math.min(...elevs), Math.max(...elevs)],
  };
  return cached;
}

/** `1:34.710` from seconds. */
export function formatLapTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Interpolated sample at a given elapsed time, for HUD playback. */
export function sampleAtTime(result: LapSimResult, t: number): LapSample {
  const { samples, lapTimeS } = result;
  const wrapped = ((t % lapTimeS) + lapTimeS) % lapTimeS;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].t <= wrapped) lo = mid;
    else hi = mid - 1;
  }
  const a = samples[lo];
  const b = samples[(lo + 1) % samples.length];
  const span = (b.t > a.t ? b.t : lapTimeS) - a.t || 1e-6;
  const f = Math.min(1, Math.max(0, (wrapped - a.t) / span));
  return {
    ...a,
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    elev: a.elev + (b.elev - a.elev) * f,
    speedKmh: a.speedKmh + (b.speedKmh - a.speedKmh) * f,
    t: wrapped,
  };
}

/**
 * Speed as a 0-1 ramp across the lap's own range — the colour key for the
 * racing line (slowest = hot, fastest = pale) in both the 3D scene and
 * the 2D map, so the two always agree.
 */
export function speedRamp(result: LapSimResult, speedKmh: number): number {
  const { minSpeedKmh, topSpeedKmh } = result;
  return (speedKmh - minSpeedKmh) / Math.max(1, topSpeedKmh - minSpeedKmh);
}
