/**
 * Longitudinal car model for /drive, using the same public 2026 ballpark
 * figures as /circuit's lap simulator (lib/lapSim.ts) so a perfect game lap
 * and the simulated lap are the same car: 768 kg, ~750 kW, 1.45 g of
 * traction off slow corners, 5 g on the brakes, drag solved so that
 * terminal speed is 336 km/h. On top of that, the 2026 energy loop the
 * player manages: the battery harvests under braking and lifting, and
 * Boost spends it for extra power. Tested in physics.test.ts.
 */

export const G = 9.80665;

export const CAR = {
  massKg: 768,
  powerW: 750_000,
  /** Extra electric deployment while Boost is held and the battery has charge. */
  boostW: 150_000,
  tractionG: 1.45,
  brakeG: 5.0,
  vMaxKmh: 336,
};

const V_MAX = CAR.vMaxKmh / 3.6;
/** Drag as a deceleration k·v², solved so power and drag balance at V_MAX. */
const DRAG_K = CAR.powerW / (CAR.massKg * V_MAX ** 3);
const ROLLING = 0.12;

/** Battery fraction gained or spent per second. */
export const ENERGY = { brakeHarvest: 0.1, liftHarvest: 0.035, boostDrain: 0.14 };

export interface CarInput {
  throttle: boolean;
  brake: boolean;
  boost: boolean;
}

export interface CarState {
  /** m/s */
  v: number;
  /** 0–1 */
  battery: number;
}

export interface CarStep extends CarState {
  /** Longitudinal acceleration, m/s². */
  accel: number;
  harvesting: boolean;
  deploying: boolean;
}

/** Straight Mode's drag saving: the flattened wings shed about this much. */
export const STRAIGHT_MODE_DRAG = 0.9;

/** One physics step. `gradient` is rise over run (uphill positive);
 * `dragFactor` below 1 models the wings in Straight Mode. */
export function stepCar(state: CarState, input: CarInput, dt: number, gradient = 0, dragFactor = 1): CarStep {
  const { v } = state;
  let battery = state.battery;
  let accel = -DRAG_K * dragFactor * v * v - G * gradient - (v > 0.5 ? ROLLING : 0);
  let harvesting = false;
  let deploying = false;

  if (input.brake) {
    // Downforce: the brakes bite harder the faster the car is going.
    accel -= CAR.brakeG * G * (0.72 + 0.28 * Math.min(1, v / 70));
    if (v > 4) {
      harvesting = true;
      battery += ENERGY.brakeHarvest * dt;
    }
  } else if (input.throttle) {
    let power = CAR.powerW;
    if (input.boost && battery > 0.005) {
      power += CAR.boostW;
      battery -= ENERGY.boostDrain * dt;
      deploying = true;
    }
    accel += Math.min(CAR.tractionG * G, power / (CAR.massKg * Math.max(v, 1)));
  } else if (v > 4) {
    harvesting = true;
    battery += ENERGY.liftHarvest * dt;
  }

  return {
    v: Math.max(0, v + accel * dt),
    battery: Math.min(1, Math.max(0, battery)),
    accel,
    harvesting,
    deploying,
  };
}

/** Top of each gear, km/h — an 8-speed box geared for Sepang's straights. */
export const GEAR_TOP_KMH = [82, 124, 160, 196, 232, 268, 304, 350];
const RPM_LOW = 8600;
const RPM_HIGH = 12000;

export function gearFor(kmh: number): number {
  const i = GEAR_TOP_KMH.findIndex((top) => kmh <= top);
  return i === -1 ? GEAR_TOP_KMH.length : i + 1;
}

/** Engine speed for a road speed in a gear: low in the band just after an
 * upshift, climbing to the shift point at the top of the gear. */
export function rpmFor(kmh: number, gear = gearFor(kmh)): number {
  const top = GEAR_TOP_KMH[gear - 1];
  const bottom = gear === 1 ? 0 : GEAR_TOP_KMH[gear - 2];
  if (gear === 1) return Math.round(4200 + (RPM_HIGH - 4200) * Math.min(1, kmh / top));
  const f = (kmh - bottom) / (top - bottom);
  return Math.round(RPM_LOW + (RPM_HIGH - RPM_LOW) * Math.min(1, Math.max(0, f)));
}

/** 0–1 fill of the steering-wheel shift lights. */
export function shiftLights(rpm: number): number {
  return Math.min(1, Math.max(0, (rpm - 10300) / (RPM_HIGH - 10300)));
}
