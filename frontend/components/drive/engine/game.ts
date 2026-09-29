import * as THREE from "three";
import { gearFor, rpmFor, shiftLights, stepCar, STRAIGHT_MODE_DRAG, type CarInput } from "@/lib/drive/physics";
import { simTrace } from "@/lib/drive/sim";
import {
  deltaTo,
  distanceAt,
  randomHold,
  sectorOf,
  splitColour,
  startLights,
  timeAtDistance,
  TRACE_DT,
  type Trace,
} from "@/lib/drive/timing";
import { buildDriveTrack, type DriveTrack } from "@/lib/drive/track";
import { AERO, buildF1Car, ghostOf, LIVERIES, type CarRig, type Livery } from "../scene/f1car";
import { createSky, HAZE, SUN_DIRECTION } from "../scene/sky";
import { glowTexture } from "../scene/textures";
import { buildWorld, type World } from "../scene/world";

/**
 * The /drive game: one Three.js scene, one loop, no React in the hot path.
 * The component around it gets low-frequency events (phase changes, the
 * start lights, laps, sectors, messages) and one `frame` callback per
 * animation frame with plain numbers for the HUD to write straight into
 * the DOM.
 */

export type Phase = "intro" | "lights" | "racing" | "paused";
export type CameraMode = "chase" | "tcam" | "tv";
export type GhostMode = "auto" | "best" | "sim" | "off";

export interface FrameTelemetry {
  kmh: number;
  gear: number;
  rpm: number;
  shift: number;
  throttle: boolean;
  brake: boolean;
  boost: boolean;
  battery: number;
  harvesting: boolean;
  deploying: boolean;
  straightMode: boolean;
  /** Seconds into the current lap, null before the car first crosses the line. */
  lapTime: number | null;
  delta: number | null;
  lap: number;
  sector: 0 | 1 | 2;
  s: number;
  x: number;
  z: number;
  ghost: { x: number; z: number; label: string } | null;
  next: { turn: number; label: string | null; apexKmh: number; distance: number };
  safeKmh: number;
}

export interface LapResult {
  lap: number;
  time: number;
  penalties: number;
  sectors: [number, number, number];
  sectorColours: ("purple" | "green" | "yellow")[];
  best: boolean;
  bestTime: number;
  delta: number | null;
}

export interface GameEvents {
  phase: (phase: Phase) => void;
  lights: (lit: number, out: boolean) => void;
  sector: (index: number, time: number, colour: "purple" | "green" | "yellow") => void;
  lap: (result: LapResult) => void;
  message: (kind: "off" | "jump" | "reaction" | "info", text: string) => void;
  frame: (t: FrameTelemetry) => void;
}

interface Options {
  livery?: Livery;
  reducedMotion: boolean;
  lite: boolean;
  events: GameEvents;
}

const KEYS = {
  best: "jalur-apexgp-drive-best-ms",
  trace: "jalur-apexgp-drive-best-trace",
  sectors: "jalur-apexgp-drive-best-sectors",
};
const OVERSPEED = 1.1;
const PENALTY_S = 3;
const JUMP_START_S = 5;
const GRID_BACK = 8;
const INTRO_S = 4.6;
const SUBSTEP = 1 / 240;

function load<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the best lap just won't persist.
  }
}

export class DriveGame {
  readonly track: DriveTrack;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sun: THREE.DirectionalLight;
  private readonly world: World;
  private readonly sky: ReturnType<typeof createSky>;
  private readonly car: CarRig;
  private readonly ghost: ReturnType<typeof ghostOf>;
  private readonly env: THREE.Texture;
  private readonly streaks: THREE.LineSegments;
  private readonly dust: THREE.Points;
  private readonly dustVel: Float32Array;
  private readonly dustTexture: THREE.Texture;
  private dustAge = 99;
  private readonly sim: { trace: Trace; lapTimeS: number };

  private raf = 0;
  private last = 0;
  private clock = 0;
  private phase: Phase = "intro";
  private phaseBeforePause: Phase = "intro";
  private phaseTimeBeforePause = 0;
  private phaseTime = 0;
  private hold = randomHold();
  private litShown = -1;
  private jumpStart = false;
  private reactionFrom: number | null = null;

  private input: CarInput = { throttle: false, brake: false, boost: false };
  private v = 0;
  private battery = 0.6;
  private s: number;
  private lap = 0;
  private lapTime: number | null = null;
  private penalties = 0;
  private lastPenaltyAt = -99;
  private spin = 0;
  private shake = 0;
  private sectorStarts: number[] = [0];
  private sectorTimes: number[] = [];
  private currentTrace: Trace = [];
  private traceClock = 0;
  private straightMode = false;
  private flapFront = [...AERO.frontCorner];
  private flapRear = AERO.rearCorner;
  private brakeHeat = 0;
  private wheelAngle = 0;
  private camMode: CameraMode = "chase";
  private tvIndex = 0;
  private ghostMode: GhostMode = "auto";
  private bestTime: number | null;
  private bestTrace: Trace | null;
  private bestSectors: number[] | null;
  private sessionBest: number | null = null;
  private sessionSectors: (number | null)[] = [null, null, null];
  private visible = true;
  private readonly observer: IntersectionObserver | null;

  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();

  constructor(
    private readonly mount: HTMLElement,
    private readonly opts: Options,
  ) {
    this.track = buildDriveTrack();
    this.s = this.track.length - GRID_BACK;
    this.sim = simTrace(this.track);
    const storedBest = load<number>(KEYS.best);
    this.bestTime = storedBest ? storedBest / 1000 : null;
    this.bestTrace = load<Trace>(KEYS.trace);
    this.bestSectors = load<number[]>(KEYS.sectors);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.lite ? 1.5 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(60, mount.clientWidth / Math.max(1, mount.clientHeight), 0.3, 6500);
    this.scene.fog = new THREE.Fog(HAZE, 380, 3000);
    this.scene.background = HAZE.clone();

    // Sky, and the car's reflections taken from that same sky.
    this.sky = createSky();
    this.scene.add(this.sky.mesh);
    const skyScene = new THREE.Scene();
    const skyForEnv = createSky();
    skyForEnv.mesh.scale.setScalar(100);
    skyScene.add(skyForEnv.mesh);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.env = pmrem.fromScene(skyScene, 0, 1, 1000).texture;
    pmrem.dispose();
    skyForEnv.dispose();
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.9;

    this.scene.add(new THREE.HemisphereLight("#cfe0f0", "#4c5a33", 1.25));
    this.sun = new THREE.DirectionalLight("#ffd6a0", 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(opts.lite ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 10;
    sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun, this.sun.target);

    this.world = buildWorld(this.track, { lite: opts.lite });
    this.scene.add(this.world.group);

    this.car = buildF1Car(opts.livery ?? LIVERIES[0]);
    // Yaw first, then pitch about the car's own axis, so hills tilt it the right way.
    this.car.root.rotation.order = "YXZ";
    this.scene.add(this.car.root);
    this.ghost = ghostOf(this.car, "#9fe9df");
    this.ghost.root.rotation.order = "YXZ";
    this.ghost.root.visible = false;
    this.scene.add(this.ghost.root);

    // Speed streaks ride with the camera; gravel dust is spawned on an off.
    const streakPositions = new Float32Array(90 * 6);
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute("position", new THREE.BufferAttribute(streakPositions, 3));
    for (let i = 0; i < 90; i += 1) this.respawnStreak(streakPositions, i, true);
    this.streaks = new THREE.LineSegments(
      streakGeo,
      new THREE.LineBasicMaterial({ color: "#f4efe6", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.streaks.frustumCulled = false;
    this.camera.add(this.streaks);
    this.scene.add(this.camera);

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(220 * 3), 3));
    this.dustVel = new Float32Array(220 * 3);
    this.dustTexture = glowTexture();
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: "#c9ae80",
        map: this.dustTexture,
        size: 1.6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    this.placeCar(0);
    this.snapCamera();

    this.observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            this.visible = entry.isIntersecting;
          });
    this.observer?.observe(mount);
    window.addEventListener("resize", this.onResize);
    document.addEventListener("visibilitychange", this.onVisibility);

    this.setPhase(opts.reducedMotion ? "lights" : "intro");
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // --- Public controls ---------------------------------------------------------

  setInput(partial: Partial<CarInput>) {
    if (partial.throttle && this.phase === "intro") this.setPhase("lights");
    if (partial.throttle && this.phase === "lights" && this.litShown > 0 && !this.jumpStart) {
      this.jumpStart = true;
      this.opts.events.message("jump", `Jump start · +${JUMP_START_S} s`);
    }
    if (partial.throttle && this.reactionFrom != null && this.phase === "racing") {
      this.opts.events.message("reaction", `Reaction ${(this.clock - this.reactionFrom).toFixed(3)} s`);
      this.reactionFrom = null;
    }
    this.input = { ...this.input, ...partial };
  }

  setCamera(mode: CameraMode) {
    this.camMode = mode;
    if (mode !== "tv") this.snapCamera();
  }

  setGhost(mode: GhostMode) {
    this.ghostMode = mode;
  }

  setLivery(livery: Livery) {
    this.car.setLivery(livery);
  }

  togglePause() {
    if (this.phase === "paused") {
      // Resume exactly where it stopped: paused mid-sequence, the start
      // lights carry on from the lamp they were on rather than starting
      // the procedure again (setPhase would zero the clock and the lamps).
      this.phase = this.phaseBeforePause;
      this.phaseTime = this.phaseTimeBeforePause;
      this.litShown = -1; // re-announce the lamps that are lit
      this.opts.events.phase(this.phase);
    } else {
      this.phaseBeforePause = this.phase;
      this.phaseTimeBeforePause = this.phaseTime;
      this.setPhase("paused");
    }
  }

  restart() {
    this.v = 0;
    this.battery = 0.6;
    this.s = this.track.length - GRID_BACK;
    this.lap = 0;
    this.lapTime = null;
    this.penalties = 0;
    this.spin = 0;
    this.jumpStart = false;
    this.reactionFrom = null;
    this.hold = randomHold();
    this.litShown = -1;
    this.currentTrace = [];
    this.input = { throttle: false, brake: false, boost: false };
    this.placeCar(0);
    this.snapCamera();
    this.setPhase("lights");
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.world.dispose();
    this.sky.dispose();
    this.car.dispose();
    this.ghost.dispose();
    this.env.dispose();
    this.streaks.geometry.dispose();
    (this.streaks.material as THREE.Material).dispose();
    this.dust.geometry.dispose();
    (this.dust.material as THREE.Material).dispose();
    this.dustTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // --- Loop ---------------------------------------------------------------------

  private readonly onResize = () => {
    const { clientWidth: w, clientHeight: h } = this.mount;
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private readonly onVisibility = () => {
    if (document.hidden && (this.phase === "racing" || this.phase === "lights")) this.togglePause();
  };

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
    if (phase === "lights") {
      this.litShown = -1;
      this.opts.events.lights(0, false);
    }
    this.opts.events.phase(phase);
  }

  private readonly loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.visible || this.phase === "paused") return;
    this.clock += dt;
    this.phaseTime += dt;

    if (this.phase === "intro" && this.phaseTime > INTRO_S) this.setPhase("lights");
    if (this.phase === "lights") this.runLights();
    if (this.phase === "racing") {
      for (let t = 0; t < dt; t += SUBSTEP) this.physics(Math.min(SUBSTEP, dt - t));
    }

    this.animateCar(dt);
    this.updateGhost();
    this.updateCamera(dt);
    this.updateEffects(dt);
    this.sky.update(this.clock, this.camera.position);
    this.emitFrame();
    this.renderer.render(this.scene, this.camera);
  };

  private runLights() {
    const { lit, out } = startLights(this.phaseTime, this.hold);
    if (lit !== this.litShown || out) {
      this.litShown = lit;
      this.opts.events.lights(lit, out);
    }
    this.world.lamps.columns.forEach((m, i) => m.color.set(i < lit ? "#ff2410" : "#2a0806"));
    this.world.lamps.glows.forEach((g, i) => g.forEach((sprite) => ((sprite.material as THREE.SpriteMaterial).opacity = i < lit ? 0.95 : 0)));
    if (out) {
      this.reactionFrom = this.input.throttle ? null : this.clock;
      if (this.jumpStart) this.penalties += JUMP_START_S;
      this.setPhase("racing");
    }
  }

  private physics(dt: number) {
    const here = this.track.at(this.s);
    const wasS = this.s;
    const stepped = stepCar(
      { v: this.v, battery: this.battery },
      this.spin > 0 ? { throttle: false, brake: true, boost: false } : this.input,
      dt,
      here.gradient,
      this.straightMode ? STRAIGHT_MODE_DRAG : 1,
    );
    this.v = stepped.v;
    this.battery = stepped.battery;
    this.harvesting = stepped.harvesting;
    this.deploying = stepped.deploying;
    this.accel = stepped.accel;
    this.s += this.v * dt;

    // Timing starts the first time the car crosses the line from the grid.
    if (this.lapTime == null && wasS > this.track.length / 2 && this.s >= this.track.length) {
      this.s -= this.track.length;
      this.startLap();
    } else if (this.lapTime != null) {
      this.lapTime += dt;
      this.traceClock += dt;
      while (this.traceClock >= TRACE_DT) {
        this.traceClock -= TRACE_DT;
        this.currentTrace.push(this.s);
      }
      const sectorNow = sectorOf(Math.min(this.s, this.track.length - 0.01), this.track.sectorEnds);
      if (sectorNow > this.sectorTimes.length) this.closeSector(this.sectorTimes.length);
      if (this.s >= this.track.length) {
        this.s -= this.track.length;
        this.finishLap();
      }
    }

    // Too fast for the corner: off track, a spin, a penalty.
    const safe = this.track.safeKmh(this.s);
    if (this.v * 3.6 > safe * OVERSPEED && this.clock - this.lastPenaltyAt > 1.4 && this.spin <= 0) {
      this.lastPenaltyAt = this.clock;
      this.penalties += PENALTY_S;
      this.spin = 1;
      this.shake = 1;
      this.spawnDust();
      this.opts.events.message("off", `Off track · +${PENALTY_S} s`);
      this.v *= 0.45;
    }
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt / 0.95);

    // Straight Mode: wings flat on the straights, closed again for braking.
    const clearAhead = this.track.safeKmh(this.s + 70) >= 330 && this.track.safeKmh(this.s) >= 330;
    this.straightMode = clearAhead && !this.input.brake && this.v * 3.6 > 150;
  }

  private harvesting = false;
  private deploying = false;
  private accel = 0;

  private startLap() {
    this.lap += 1;
    this.lapTime = 0;
    this.traceClock = 0;
    this.currentTrace = [0];
    this.sectorTimes = [];
    this.sectorStarts = [0];
    // A jump-start penalty lands on the first lap; every later lap starts clean.
    if (this.lap > 1) this.penalties = 0;
  }

  private closeSector(index: number) {
    const now = this.lapTime ?? 0;
    const time = now - this.sectorStarts[index];
    this.sectorTimes.push(time);
    this.sectorStarts.push(now);
    const colour = splitColour(time, this.bestSectors?.[index] ?? null, this.sessionSectors[index]);
    this.opts.events.sector(index, time, colour);
  }

  private finishLap() {
    if (this.sectorTimes.length < 2) {
      // A sector boundary skipped in one step (it can't at these speeds,
      // but keep the arithmetic honest if it ever does).
      while (this.sectorTimes.length < 2) this.closeSector(this.sectorTimes.length);
    }
    const raw = this.lapTime ?? 0;
    const s3 = raw - this.sectorStarts[2];
    const sectors: [number, number, number] = [this.sectorTimes[0], this.sectorTimes[1], s3];
    const colours = sectors.map((t, i) => splitColour(t, this.bestSectors?.[i] ?? null, this.sessionSectors[i]));
    this.opts.events.sector(2, s3, colours[2]);
    const time = raw + this.penalties;
    const previousBest = this.bestTime;
    const best = previousBest == null || time < previousBest;
    const reference = this.referenceTrace();
    const delta = reference ? time - (reference.time ?? 0) : null;

    sectors.forEach((t, i) => {
      if (this.sessionSectors[i] == null || t < (this.sessionSectors[i] as number)) this.sessionSectors[i] = t;
    });
    const bestSectors = sectors.map((t, i) => Math.min(t, this.bestSectors?.[i] ?? Infinity));
    this.bestSectors = bestSectors;
    save(KEYS.sectors, bestSectors);
    if (this.sessionBest == null || time < this.sessionBest) this.sessionBest = time;
    if (best && this.penalties === 0) {
      this.bestTime = time;
      // One more tick past the line, extrapolated at the finishing speed
      // (`s` has already wrapped): the samples stay one TRACE_DT apart, so
      // the moment the trace reaches the line can be interpolated.
      this.currentTrace.push(this.track.length + this.s + this.v * (TRACE_DT - this.traceClock));
      this.bestTrace = this.currentTrace.map((d) => Math.round(d * 10) / 10);
      save(KEYS.best, Math.round(time * 1000));
      save(KEYS.trace, this.bestTrace);
    } else if (best) {
      // A penalised lap can still be the best time; it just isn't a clean
      // line to chase, so the ghost keeps the last clean one.
      this.bestTime = time;
      save(KEYS.best, Math.round(time * 1000));
    }

    this.opts.events.lap({
      lap: this.lap,
      time,
      penalties: this.penalties,
      sectors,
      sectorColours: colours,
      best,
      bestTime: this.bestTime ?? time,
      delta,
    });
    this.startLap();
  }

  /** The lap the ghost replays and the delta is measured against. */
  private referenceTrace(): { trace: Trace; label: string; time: number | null } | null {
    const mode = this.ghostMode;
    if (mode === "off") return null;
    if ((mode === "best" || mode === "auto") && this.bestTrace && this.bestTrace.length > 10) {
      return { trace: this.bestTrace, label: "Best", time: timeAtDistance(this.bestTrace, this.track.length) };
    }
    if (mode === "best") return null;
    return { trace: this.sim.trace, label: "Sim", time: this.sim.lapTimeS };
  }

  // --- Presentation -------------------------------------------------------------

  private placeCar(dt: number) {
    const p = this.track.at(this.s);
    const heading = Math.atan2(p.tx, p.tz);
    const spinYaw = this.spin > 0 ? (1 - this.spin) * Math.PI * 2 * (1 - this.spin * 0.2) : 0;
    this.car.root.position.set(p.x, p.y, p.z);
    this.car.root.rotation.set(0, heading + spinYaw, 0);
    // Pitch with the gradient, then dive and squat with the load.
    const pitchSlope = -Math.atan(p.gradient);
    this.car.root.rotation.x = pitchSlope;
    const lat = this.v * this.v * p.curvature;
    this.car.body.rotation.x = THREE.MathUtils.lerp(this.car.body.rotation.x, THREE.MathUtils.clamp(-this.accel * 0.0022, -0.03, 0.045), 1 - Math.exp(-dt * 10));
    this.car.body.rotation.z = THREE.MathUtils.lerp(this.car.body.rotation.z, THREE.MathUtils.clamp(-lat * 0.0011, -0.05, 0.05), 1 - Math.exp(-dt * 8));
  }

  private animateCar(dt: number) {
    this.placeCar(dt);
    const omega = this.v / 0.36;
    this.wheelAngle += omega * dt;
    this.car.wheels.forEach((w) => (w.rotation.x = this.wheelAngle));
    const blur = THREE.MathUtils.smoothstep(omega, 12, 40);
    this.car.rimBlur.opacity = blur;
    this.car.rimSharp.opacity = 1 - blur * 0.85;
    const p = this.track.at(this.s + 6);
    const steer = THREE.MathUtils.clamp(-Math.atan(3.4 * p.curvature) * 1.1, -0.38, 0.38);
    this.car.steer.forEach((u) => (u.rotation.y = THREE.MathUtils.lerp(u.rotation.y, steer, 1 - Math.exp(-dt * 12))));

    // Active aero: flaps swing to their target over about a fifth of a second.
    const k = 1 - Math.exp(-dt * 11);
    const front = this.straightMode ? AERO.frontStraight : AERO.frontCorner;
    this.flapFront = this.flapFront.map((a, i) => THREE.MathUtils.lerp(a, front[i], k));
    this.flapRear = THREE.MathUtils.lerp(this.flapRear, this.straightMode ? AERO.rearStraight : AERO.rearCorner, k);
    this.car.frontFlaps.forEach((f, i) => (f.rotation.x = this.flapFront[i]));
    this.car.rearFlap.rotation.x = this.flapRear;

    // Rear light blinks while harvesting; brake discs glow after big stops.
    const blinkOn = this.phase === "racing" && this.harvesting && Math.floor(this.clock * 8) % 2 === 0;
    this.car.rearLight.color.set(blinkOn ? "#ff3322" : "#3a0806");
    (this.car.rearGlow.material as THREE.SpriteMaterial).opacity = blinkOn ? 0.9 : 0;
    const heating = this.input.brake && this.v * 3.6 > 110 ? 1 : 0;
    this.brakeHeat = THREE.MathUtils.clamp(this.brakeHeat + (heating ? dt * 2.4 : -dt * 0.7), 0, 1);
    this.car.brakeGlows.forEach((g) => ((g.material as THREE.SpriteMaterial).opacity = this.brakeHeat * 0.85));
  }

  private updateGhost() {
    const ref = this.referenceTrace();
    if (!ref || this.lapTime == null || this.phase !== "racing") {
      this.ghost.root.visible = false;
      return;
    }
    const gs = distanceAt(ref.trace, this.lapTime);
    const p = this.track.at(gs);
    this.ghost.root.visible = true;
    this.ghost.root.position.set(p.x, p.y, p.z);
    this.ghost.root.rotation.set(-Math.atan(p.gradient), Math.atan2(p.tx, p.tz), 0);
  }

  private snapCamera() {
    this.chaseTarget(this.camPos, this.camLook);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  private chaseTarget(pos: THREE.Vector3, look: THREE.Vector3) {
    const p = this.track.at(this.s);
    const behind = this.track.at(this.s - 7.5);
    const ahead = this.track.at(this.s + 14);
    pos.set(behind.x, Math.max(behind.y, p.y) + 2.3, behind.z);
    look.set(ahead.x, ahead.y + 0.8, ahead.z);
  }

  private updateCamera(dt: number) {
    const kmh = this.v * 3.6;
    const reduce = this.opts.reducedMotion;
    const target = new THREE.Vector3();
    const look = new THREE.Vector3();
    let fov = 60;

    if (this.phase === "intro") {
      // Drone shot: from high over the circuit down onto the grid.
      const f = THREE.MathUtils.smootherstep(this.phaseTime / INTRO_S, 0, 1);
      const centre = this.track.at(this.track.length * 0.5);
      const grid = this.track.at(this.s);
      const orbit = 0.9 - this.phaseTime * 0.08;
      const aerial = new THREE.Vector3(
        grid.x + Math.cos(orbit) * 520,
        340,
        grid.z + Math.sin(orbit) * 520,
      );
      const chasePos = new THREE.Vector3();
      const chaseLook = new THREE.Vector3();
      this.chaseTarget(chasePos, chaseLook);
      target.copy(aerial).lerp(chasePos, f);
      look.set(centre.x, 0, centre.z).lerp(chaseLook, THREE.MathUtils.smoothstep(f, 0.2, 1));
      this.camera.position.copy(target);
      this.camera.fov = THREE.MathUtils.lerp(48, 60, f);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(look);
      return;
    }

    if (this.camMode === "tv") {
      // Trackside broadcast cameras, cut to whichever is nearest — only
      // when another is clearly closer, so the edit doesn't flicker.
      const cams = this.world.tvCameras;
      const dist = (i: number) => this.car.root.position.distanceTo(cams[i].position);
      let best = this.tvIndex;
      cams.forEach((_, i) => {
        if (dist(i) < dist(best) * 0.72) best = i;
      });
      this.tvIndex = best;
      const cam = cams[best];
      const d = dist(best);
      this.camera.position.copy(cam.position);
      look.copy(this.car.root.position).add(new THREE.Vector3(0, 0.6, 0));
      this.camLook.lerp(look, 1 - Math.exp(-dt * 9));
      this.camera.lookAt(this.camLook);
      this.camera.fov = THREE.MathUtils.clamp((2 * Math.atan(8 / d) * 180) / Math.PI, 5, 48);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.camMode === "tcam") {
      const p = this.track.at(this.s);
      const heading = new THREE.Vector3(p.tx, 0, p.tz);
      target.set(p.x, p.y + 1.42, p.z).addScaledVector(heading, -0.25);
      const ahead = this.track.at(this.s + 26);
      look.set(ahead.x, ahead.y + 0.9, ahead.z);
      this.camPos.copy(target);
      this.camLook.lerp(look, 1 - Math.exp(-dt * 14));
      fov = reduce ? 70 : 68 + 10 * THREE.MathUtils.smoothstep(kmh, 120, 330);
    } else {
      this.chaseTarget(target, look);
      this.camPos.lerp(target, 1 - Math.exp(-dt * 7));
      this.camLook.lerp(look, 1 - Math.exp(-dt * 10));
      fov = reduce ? 62 : 58 + 16 * THREE.MathUtils.smoothstep(kmh, 90, 330);
    }

    this.camera.position.copy(this.camPos);
    if (!reduce) {
      // Buzz at speed, a hard jolt on an off.
      const buzz = THREE.MathUtils.smoothstep(kmh, 220, 340) * 0.03 + this.shake * 0.35;
      this.camera.position.x += (Math.sin(this.clock * 67) + Math.sin(this.clock * 41)) * buzz * 0.5;
      this.camera.position.y += Math.sin(this.clock * 53) * buzz * 0.5;
      // Bank into the corner a touch.
      const p = this.track.at(this.s + 10);
      this.camera.up.set(THREE.MathUtils.clamp(p.curvature * this.v * 0.02, -0.06, 0.06), 1, 0).normalize();
    } else {
      this.camera.up.set(0, 1, 0);
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 4));
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.camLook);
  }

  private respawnStreak(pos: Float32Array, i: number, anywhere: boolean) {
    const a = Math.random() * Math.PI * 2;
    // Kept to the edges of the frame, where speed is felt, not read.
    const r = 3.4 + Math.random() * 5;
    const z = anywhere ? -8 - Math.random() * 70 : -78;
    pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.6, z, Math.cos(a) * r, Math.sin(a) * r * 0.6, z - 1], i * 6);
  }

  private updateEffects(dt: number) {
    const kmh = this.v * 3.6;
    const streakMat = this.streaks.material as THREE.LineBasicMaterial;
    const on = !this.opts.reducedMotion && this.camMode !== "tv" && this.phase === "racing";
    streakMat.opacity = on ? THREE.MathUtils.smoothstep(kmh, 230, 330) * 0.16 : 0;
    if (streakMat.opacity > 0) {
      const pos = this.streaks.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const len = 0.6 + kmh * 0.012;
      for (let i = 0; i < 90; i += 1) {
        arr[i * 6 + 2] += this.v * dt * 1.6;
        arr[i * 6 + 5] = arr[i * 6 + 2] - len;
        if (arr[i * 6 + 2] > -3) this.respawnStreak(arr, i, false);
      }
      pos.needsUpdate = true;
    }

    // Gravel dust after an off.
    this.dustAge += dt;
    const dustMat = this.dust.material as THREE.PointsMaterial;
    dustMat.opacity = Math.max(0, 0.7 - this.dustAge * 0.5);
    if (dustMat.opacity > 0) {
      const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        this.dustVel[i + 1] -= 9.8 * dt * 0.35;
        arr[i] += this.dustVel[i] * dt;
        arr[i + 1] = Math.max(this.car.root.position.y, arr[i + 1] + this.dustVel[i + 1] * dt);
        arr[i + 2] += this.dustVel[i + 2] * dt;
      }
      pos.needsUpdate = true;
    }

    // The sun and its shadow follow the car.
    const c = this.car.root.position;
    this.sun.position.copy(c).addScaledVector(SUN_DIRECTION, 200);
    this.sun.target.position.copy(c);
  }

  private spawnDust() {
    this.dustAge = 0;
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const c = this.car.root.position;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = c.x + (Math.random() - 0.5) * 2;
      arr[i + 1] = c.y + 0.2;
      arr[i + 2] = c.z + (Math.random() - 0.5) * 2;
      this.dustVel[i] = (Math.random() - 0.5) * 9;
      this.dustVel[i + 1] = 2 + Math.random() * 5;
      this.dustVel[i + 2] = (Math.random() - 0.5) * 9;
    }
    pos.needsUpdate = true;
  }

  private emitFrame() {
    const kmh = this.v * 3.6;
    const gear = gearFor(kmh);
    const rpm = this.phase === "racing" ? rpmFor(kmh, gear) : 4200;
    const ref = this.referenceTrace();
    const next = this.track.nextCorner(this.s);
    let ghost: FrameTelemetry["ghost"] = null;
    if (ref && this.lapTime != null && this.phase === "racing") {
      const p = this.track.at(distanceAt(ref.trace, this.lapTime));
      ghost = { x: p.x, z: p.z, label: ref.label };
    }
    const here = this.track.at(this.s);
    this.opts.events.frame({
      kmh,
      gear: kmh < 1 && this.phase !== "racing" ? 0 : gear,
      rpm,
      shift: shiftLights(rpm),
      throttle: this.input.throttle,
      brake: this.input.brake,
      boost: this.deploying,
      battery: this.battery,
      harvesting: this.harvesting && this.phase === "racing",
      deploying: this.deploying,
      straightMode: this.straightMode,
      lapTime: this.lapTime,
      delta: ref && this.lapTime != null && this.lapTime > 1 ? deltaTo(ref.trace, this.lapTime, this.s) : null,
      lap: Math.max(1, this.lap),
      sector: sectorOf(this.s, this.track.sectorEnds),
      s: this.s,
      x: here.x,
      z: here.z,
      ghost,
      next: { turn: next.corner.turn, label: next.corner.label, apexKmh: next.corner.apexKmh, distance: next.distance },
      safeKmh: this.track.safeKmh(this.s),
    });
  }
}
