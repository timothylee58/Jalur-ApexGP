import * as THREE from "three";
import { LIVERIES, type Livery } from "./liveries";
import { glowTexture, rimTexture, textTexture } from "./textures";

export { LIVERIES, type Livery };

/**
 * A 2026-regulation Formula 1 car, built procedurally to the published
 * proportions: 3.4 m wheelbase, 1.9 m wide, 18-inch wheels, a low nose,
 * sidepods with deep undercuts, the halo, an airbox over the driver, and
 * the two things 2026 made move — active aero, where the front-wing flaps
 * and the rear-wing flap swing flat on the straights (Straight Mode), and
 * the rear light that blinks while the car is harvesting energy.
 *
 * Local frame: +Z forward, +Y up, ground at y = 0. Everything the game
 * animates is returned as a handle.
 */

export interface CarRig {
  root: THREE.Group;
  /** Pitches and rolls with the load; everything above the wheels. */
  body: THREE.Group;
  wheels: THREE.Object3D[];
  /** Front uprights, rotate about Y to steer. */
  steer: THREE.Object3D[];
  frontFlaps: THREE.Object3D[];
  rearFlap: THREE.Object3D;
  rearLight: THREE.MeshBasicMaterial;
  rearGlow: THREE.Sprite;
  brakeGlows: THREE.Sprite[];
  /** Sharp and motion-blurred rim faces, crossfaded by wheel speed. */
  rimSharp: THREE.MeshBasicMaterial;
  rimBlur: THREE.MeshBasicMaterial;
  materials: THREE.Material[];
  setLivery: (livery: Livery) => void;
  dispose: () => void;
}

const WHEEL_R = 0.36;
const FRONT_AXLE = 1.72;
const REAR_AXLE = -1.68;

interface Station {
  z: number;
  w: number;
  h: number;
  y: number;
}

/**
 * Skin a body from cross-sections: at each station a rounded-rectangle
 * (superellipse) of the given width and height, joined into one smooth
 * mesh and capped at both ends.
 */
function loft(stations: Station[], radial = 20, exponent = 3.2): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const ring = (st: Station) => {
    for (let k = 0; k < radial; k += 1) {
      const a = (k / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      // Flatter underneath: a floor, not a bottle.
      const e = s < 0 ? exponent * 1.9 : exponent;
      const x = (st.w / 2) * Math.sign(c) * Math.abs(c) ** (2 / e);
      const y = st.y + (st.h / 2) * Math.sign(s) * Math.abs(s) ** (2 / e);
      positions.push(x, y, st.z);
    }
  };
  stations.forEach(ring);
  for (let i = 0; i < stations.length - 1; i += 1) {
    for (let k = 0; k < radial; k += 1) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      const c = (i + 1) * radial + k;
      const d = (i + 1) * radial + ((k + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }
  // End caps, fanned from each end's centre.
  for (const [i, flip] of [
    [0, true],
    [stations.length - 1, false],
  ] as const) {
    const centre = positions.length / 3;
    positions.push(0, stations[i].y, stations[i].z);
    for (let k = 0; k < radial; k += 1) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      if (flip) indices.push(centre, a, b);
      else indices.push(centre, b, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function box(w: number, h: number, d: number, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function rod(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
  const dir = to.clone().sub(from);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 6), material);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

export function buildF1Car(livery: Livery = LIVERIES[0], compoundColour = "#e0301f"): CarRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: livery.primary, metalness: 0.35, roughness: 0.32 });
  const paint2 = new THREE.MeshStandardMaterial({ color: livery.secondary, metalness: 0.3, roughness: 0.36 });
  const accent = new THREE.MeshStandardMaterial({ color: livery.accent, metalness: 0.2, roughness: 0.4 });
  const carbon = new THREE.MeshStandardMaterial({ color: "#121417", metalness: 0.4, roughness: 0.48 });
  const rubber = new THREE.MeshStandardMaterial({ color: "#0c0d0f", metalness: 0, roughness: 0.92 });
  const stripe = new THREE.MeshBasicMaterial({ color: compoundColour });
  const dark = new THREE.MeshBasicMaterial({ color: "#050607" });
  const visor = new THREE.MeshStandardMaterial({ color: "#0b0d10", metalness: 0.9, roughness: 0.12 });
  const rimSharpTex = rimTexture(false);
  const rimBlurTex = rimTexture(true);
  const rimSharp = new THREE.MeshBasicMaterial({ map: rimSharpTex, transparent: true });
  const rimBlur = new THREE.MeshBasicMaterial({ map: rimBlurTex, transparent: true, opacity: 0 });
  const glowTex = glowTexture();
  const rearLight = new THREE.MeshBasicMaterial({ color: "#3a0806" });
  const numberTex = textTexture(livery.number, {
    w: 128,
    h: 128,
    bg: livery.primary,
    fg: livery.accent,
    font: "800 92px 'Helvetica Neue', Arial, sans-serif",
  });
  const numberMat = new THREE.MeshBasicMaterial({ map: numberTex, transparent: true });
  const materials: THREE.Material[] = [paint, paint2, accent, carbon, rubber, stripe, dark, visor, rimSharp, rimBlur, rearLight, numberMat];

  // --- Monocoque, nose and engine cover: one lofted skin -----------------
  const chassis = new THREE.Mesh(
    loft([
      { z: 2.66, w: 0.12, h: 0.09, y: 0.23 },
      { z: 2.4, w: 0.2, h: 0.14, y: 0.26 },
      { z: 2.0, w: 0.3, h: 0.22, y: 0.31 },
      { z: 1.5, w: 0.42, h: 0.3, y: 0.37 },
      { z: 1.0, w: 0.54, h: 0.4, y: 0.43 },
      { z: 0.5, w: 0.64, h: 0.48, y: 0.47 },
      { z: 0.0, w: 0.7, h: 0.52, y: 0.49 },
      { z: -0.45, w: 0.74, h: 0.6, y: 0.52 },
      { z: -0.95, w: 0.58, h: 0.5, y: 0.49 },
      { z: -1.5, w: 0.4, h: 0.38, y: 0.44 },
      { z: -2.0, w: 0.24, h: 0.27, y: 0.4 },
      { z: -2.24, w: 0.15, h: 0.17, y: 0.38 },
    ]),
    paint,
  );
  chassis.castShadow = true;
  body.add(chassis);

  // Livery stripe along the spine of the nose and engine cover.
  const spine = new THREE.Mesh(
    loft([
      { z: 2.5, w: 0.06, h: 0.02, y: 0.34 },
      { z: 1.0, w: 0.12, h: 0.02, y: 0.64 },
      { z: 0.55, w: 0.12, h: 0.02, y: 0.72 },
    ], 8),
    paint2,
  );
  body.add(spine);
  const coverStripe = new THREE.Mesh(
    loft([
      { z: -0.7, w: 0.2, h: 0.03, y: 0.79 },
      { z: -1.4, w: 0.14, h: 0.03, y: 0.64 },
      { z: -2.0, w: 0.08, h: 0.03, y: 0.54 },
    ], 8),
    paint2,
  );
  body.add(coverStripe);

  // --- Sidepods with the undercut, and their dark inlets -----------------
  const sidepods = new THREE.Mesh(
    loft([
      { z: 0.62, w: 1.22, h: 0.26, y: 0.36 },
      { z: 0.3, w: 1.4, h: 0.34, y: 0.37 },
      { z: -0.35, w: 1.34, h: 0.33, y: 0.37 },
      { z: -1.0, w: 0.96, h: 0.27, y: 0.35 },
      { z: -1.6, w: 0.5, h: 0.2, y: 0.33 },
    ]),
    paint,
  );
  sidepods.castShadow = true;
  body.add(sidepods);
  for (const side of [-1, 1]) {
    const inlet = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), dark);
    inlet.position.set(side * 0.44, 0.38, 0.625);
    body.add(inlet);
    // A secondary-colour flash along each sidepod flank.
    const flash = box(0.01, 0.07, 1.25, paint2, side * 0.705, 0.42, -0.2);
    flash.castShadow = false;
    body.add(flash);
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), numberMat);
    decal.position.set(side * 0.71, 0.36, -0.75);
    decal.rotation.y = side * Math.PI / 2;
    body.add(decal);
  }

  // --- Floor and diffuser -----------------------------------------------
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.28, 1.25);
  floorShape.lineTo(-0.82, 0.9);
  floorShape.lineTo(-0.86, -1.2);
  floorShape.lineTo(-0.55, -1.95);
  floorShape.lineTo(0.55, -1.95);
  floorShape.lineTo(0.86, -1.2);
  floorShape.lineTo(0.82, 0.9);
  floorShape.lineTo(0.28, 1.25);
  floorShape.closePath();
  const floor = new THREE.Mesh(new THREE.ExtrudeGeometry(floorShape, { depth: 0.035, bevelEnabled: false }), carbon);
  floor.rotation.x = Math.PI / 2;
  floor.position.y = 0.09;
  floor.castShadow = true;
  body.add(floor);
  const diffuser = box(1.06, 0.02, 0.5, carbon, 0, 0.16, -2.12);
  diffuser.rotation.x = -0.32;
  body.add(diffuser);

  // --- Airbox, roll hoop, fin, T-cam -----------------------------------
  const airbox = new THREE.Mesh(
    loft([
      { z: -0.18, w: 0.2, h: 0.24, y: 0.86 },
      { z: -0.5, w: 0.28, h: 0.32, y: 0.85 },
      { z: -0.95, w: 0.16, h: 0.16, y: 0.72 },
    ], 12),
    paint,
  );
  body.add(airbox);
  const intake = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), dark);
  intake.position.set(0, 0.9, -0.175);
  body.add(intake);
  const tcam = box(0.16, 0.05, 0.08, paint2, 0, 1.03, -0.36);
  body.add(tcam);
  const finShape = new THREE.Shape();
  finShape.moveTo(-0.6, 0.97);
  finShape.lineTo(-1.95, 0.68);
  finShape.lineTo(-1.95, 0.52);
  finShape.lineTo(-0.7, 0.74);
  finShape.closePath();
  const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.018, bevelEnabled: false }), paint);
  fin.rotation.y = -Math.PI / 2;
  fin.position.x = -0.009;
  body.add(fin);

  // --- Cockpit, driver, halo, mirrors -------------------------------------
  const cockpit = new THREE.Mesh(new THREE.CircleGeometry(1, 24), dark);
  cockpit.scale.set(0.24, 0.42, 1);
  cockpit.rotation.x = -Math.PI / 2;
  cockpit.position.set(0, 0.755, 0.05);
  body.add(cockpit);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), accent);
  helmet.position.set(0, 0.8, -0.04);
  helmet.scale.set(1, 0.95, 1.12);
  body.add(helmet);
  const visorBand = new THREE.Mesh(new THREE.SphereGeometry(0.132, 20, 8, -0.9, 1.8, 1.25, 0.5), visor);
  visorBand.position.copy(helmet.position);
  visorBand.scale.copy(helmet.scale);
  body.add(visorBand);

  const haloPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.34, 0.66, -0.36),
    new THREE.Vector3(0.36, 0.86, -0.12),
    new THREE.Vector3(0.28, 0.93, 0.2),
    new THREE.Vector3(0, 0.95, 0.36),
    new THREE.Vector3(-0.28, 0.93, 0.2),
    new THREE.Vector3(-0.36, 0.86, -0.12),
    new THREE.Vector3(-0.34, 0.66, -0.36),
  ]);
  const halo = new THREE.Mesh(new THREE.TubeGeometry(haloPath, 40, 0.03, 8, false), carbon);
  halo.castShadow = true;
  body.add(halo);
  body.add(rod(new THREE.Vector3(0, 0.74, 0.5), new THREE.Vector3(0, 0.95, 0.36), 0.028, carbon));
  for (const side of [-1, 1]) {
    body.add(rod(new THREE.Vector3(side * 0.3, 0.68, 0.34), new THREE.Vector3(side * 0.44, 0.7, 0.36), 0.012, carbon));
    body.add(box(0.13, 0.065, 0.03, paint, side * 0.48, 0.71, 0.36));
  }

  // --- Front wing: mainplane, two active flaps, endplates -----------------
  const frontWing = new THREE.Group();
  frontWing.position.set(0, 0.1, 2.48);
  body.add(frontWing);
  const mainplane = box(1.84, 0.022, 0.32, carbon);
  mainplane.rotation.x = 0.05;
  frontWing.add(mainplane);
  const frontFlaps: THREE.Object3D[] = [];
  for (const [i, y, z] of [
    [0, 0.05, -0.16],
    [1, 0.1, -0.27],
  ] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(0, y, z + 0.08);
    const flap = box(1.72, 0.016, 0.16, i === 0 ? paint : paint2, 0, 0, -0.08);
    pivot.add(flap);
    frontWing.add(pivot);
    frontFlaps.push(pivot);
  }
  for (const side of [-1, 1]) frontWing.add(box(0.022, 0.2, 0.5, paint, side * 0.93, 0.07, -0.08));

  // --- Rear wing: endplates, mainplane, active upper flap -----------------
  const rearWing = new THREE.Group();
  rearWing.position.set(0, 0.84, -2.3);
  body.add(rearWing);
  for (const side of [-1, 1]) rearWing.add(box(0.022, 0.44, 0.58, paint, side * 0.52, 0, 0));
  const rearMain = box(1.02, 0.022, 0.26, carbon, 0, -0.03, 0.02);
  rearMain.rotation.x = 0.12;
  rearWing.add(rearMain);
  const rearFlap = new THREE.Group();
  rearFlap.position.set(0, 0.08, 0.12);
  rearFlap.add(box(1.02, 0.018, 0.22, paint2, 0, 0, -0.11));
  rearWing.add(rearFlap);
  body.add(rod(new THREE.Vector3(0, 0.46, -2.12), new THREE.Vector3(0, 0.8, -2.26), 0.03, carbon));

  // --- Rear light: blinks while harvesting ---------------------------------
  const light = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.06), rearLight);
  light.position.set(0, 0.38, -2.245);
  light.rotation.y = Math.PI;
  body.add(light);
  const rearGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, color: "#ff2a1a", blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
  );
  rearGlow.scale.set(0.9, 0.9, 1);
  rearGlow.position.set(0, 0.38, -2.3);
  body.add(rearGlow);
  materials.push(rearGlow.material);

  // --- Wheels, uprights, suspension ----------------------------------------
  const wheels: THREE.Object3D[] = [];
  const steer: THREE.Object3D[] = [];
  const brakeGlows: THREE.Sprite[] = [];
  const tyreGeo = (width: number) => new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, width, 32, 1, false);
  for (const [axle, width, trackHalf] of [
    [FRONT_AXLE, 0.3, 0.76],
    [REAR_AXLE, 0.4, 0.72],
  ] as const) {
    for (const side of [-1, 1]) {
      const upright = new THREE.Group();
      upright.position.set(side * trackHalf, WHEEL_R, axle);
      root.add(upright);
      if (axle === FRONT_AXLE) steer.push(upright);

      const wheel = new THREE.Group();
      upright.add(wheel);
      const tyre = new THREE.Mesh(tyreGeo(width), rubber);
      tyre.rotation.z = Math.PI / 2;
      tyre.castShadow = true;
      wheel.add(tyre);
      // Compound stripe on the outer sidewall, and the rim face.
      const ring = new THREE.Mesh(new THREE.RingGeometry(WHEEL_R * 0.78, WHEEL_R * 0.84, 40), stripe);
      ring.position.x = side * (width / 2 + 0.002);
      ring.rotation.y = side * Math.PI / 2;
      wheel.add(ring);
      for (const mat of [rimSharp, rimBlur]) {
        const face = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R * 0.74, 32), mat);
        face.position.x = side * (width / 2 + 0.004);
        face.rotation.y = side * Math.PI / 2;
        wheel.add(face);
      }
      wheels.push(wheel);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: glowTex, color: "#ff6a1a", blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }),
      );
      glow.scale.set(0.55, 0.55, 1);
      glow.position.set(side * (trackHalf - width / 2 - 0.06), WHEEL_R, axle);
      root.add(glow);
      brakeGlows.push(glow);
      materials.push(glow.material);

      // Upper and lower wishbones back to the chassis.
      const hub = new THREE.Vector3(side * (trackHalf - width / 2), WHEEL_R, axle);
      for (const dy of [-0.1, 0.12]) {
        root.add(rod(new THREE.Vector3(side * 0.2, WHEEL_R + dy, axle + 0.28), hub.clone().setY(WHEEL_R + dy), 0.014, carbon));
        root.add(rod(new THREE.Vector3(side * 0.2, WHEEL_R + dy, axle - 0.28), hub.clone().setY(WHEEL_R + dy), 0.014, carbon));
      }
    }
  }

  // Nose number.
  const nose = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), numberMat);
  nose.rotation.x = -Math.PI / 2 + 0.2;
  nose.position.set(0, 0.35, 1.95);
  body.add(nose);

  body.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  const setLivery = (next: Livery) => {
    paint.color.set(next.primary);
    paint2.color.set(next.secondary);
    accent.color.set(next.accent);
    const tex = textTexture(next.number, {
      w: 128,
      h: 128,
      bg: next.primary,
      fg: next.accent,
      font: "800 92px 'Helvetica Neue', Arial, sans-serif",
    });
    numberMat.map?.dispose();
    numberMat.map = tex;
    numberMat.needsUpdate = true;
  };

  const dispose = () => {
    root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) o.geometry.dispose();
    });
    materials.forEach((m) => m.dispose());
    [rimSharpTex, rimBlurTex, glowTex, numberMat.map].forEach((t) => t?.dispose());
  };

  return { root, body, wheels, steer, frontFlaps, rearFlap, rearLight, rearGlow, brakeGlows, rimSharp, rimBlur, materials, setLivery, dispose };
}

/** Flap angles in Corner Mode vs Straight Mode, radians (trailing edge up is positive — more angle, more downforce). */
export const AERO = { frontCorner: [0.28, 0.44], frontStraight: [0.06, 0.1], rearCorner: 0.5, rearStraight: 0.08 };

/** A see-through copy of a car for ghosts: one flat translucent colour. */
export function ghostOf(rig: CarRig, colour: string): { root: THREE.Object3D; wheels: THREE.Object3D[]; dispose: () => void } {
  const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.28, depthWrite: false });
  const root = rig.root.clone(true);
  const wheels: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.material = material;
      o.castShadow = false;
    }
    if (o instanceof THREE.Sprite) o.visible = false;
  });
  // Wheels are the groups directly under each upright.
  root.children.forEach((c) => {
    if (c instanceof THREE.Group && c.children[0] instanceof THREE.Group && c !== root.children[0]) wheels.push(c.children[0]);
  });
  return { root, wheels, dispose: () => material.dispose() };
}
