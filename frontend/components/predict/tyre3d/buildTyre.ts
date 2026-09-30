import * as THREE from "three";
import type { Compound } from "@/types";
import { TYRE_COLOR } from "@/lib/tyreColors";

/**
 * Procedural F1 wheel-and-tyre, modelled from photos of the real Pirelli
 * display set: a tall, wide 18" tyre on a black multi-spoke rim with a
 * centre-lock nut. Units: outer tyre radius = 1. The axle is +Z, so the
 * outer sidewall faces +Z and the tyre stands on its tread with Y up.
 *
 * What differs per compound is what differs on the real thing:
 *   - sidewall band colour and lettering (P ZERO slicks, CINTURATO wets)
 *   - tread: slicks are smooth; Intermediate has curved grooves sweeping from
 *     the centre to the shoulder; Full Wet has deeper, denser chevron blocks
 */

export const RIM_R = 0.655;
const HALF_W = 0.5;
const SHOULDER = 0.14;
const SIDEWALL_OUTER = 1 - SHOULDER;

const MODEL_NAME: Record<Compound, string> = {
  Soft: "P ZERO",
  Medium: "P ZERO",
  Hard: "P ZERO",
  Intermediate: "CINTURATO",
  Wet: "CINTURATO",
};

// Cross-section from the outer bead, over the shoulder and tread, back to the
// inner bead. LatheGeometry revolves it about Y; the mesh is then turned so
// that axis becomes the axle (Z).
function tyreProfile(segments = 10): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const shoulder = (zSign: 1 | -1, reverse: boolean) => {
    const arc: THREE.Vector2[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * (Math.PI / 2);
      arc.push(
        new THREE.Vector2(SIDEWALL_OUTER + SHOULDER * Math.sin(t), zSign * (HALF_W - SHOULDER + SHOULDER * Math.cos(t))),
      );
    }
    return reverse ? arc.reverse() : arc;
  };
  pts.push(new THREE.Vector2(RIM_R, -HALF_W + 0.02));
  pts.push(new THREE.Vector2(SIDEWALL_OUTER, -HALF_W));
  pts.push(...shoulder(-1, false));
  pts.push(...shoulder(1, true));
  pts.push(new THREE.Vector2(SIDEWALL_OUTER, HALF_W));
  pts.push(new THREE.Vector2(RIM_R, HALF_W - 0.02));
  return pts;
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { c, ctx };
}

/** Text laid clockwise along an arc, tops facing outward. */
function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  centreAngle: number,
  size: number,
  tracking: number,
) {
  ctx.font = `900 italic ${size}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  const widths = [...text].map((ch) => ctx.measureText(ch).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let angle = centreAngle - total / radius / 2;
  [...text].forEach((ch, i) => {
    const half = widths[i] / 2 / radius;
    angle += half;
    ctx.save();
    ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.rotate(angle + Math.PI / 2);
    // Stroke in the fill colour thickens the glyphs where the heavy face
    // isn't installed, so the moulded lettering keeps its weight.
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += half;
  });
}

// Mapped onto a RingGeometry whose outer radius is SIDEWALL_OUTER: canvas
// centre = axle, canvas half-size = SIDEWALL_OUTER. Two band arcs top and
// bottom, lettering in the gaps — the real sidewall layout.
function sidewallTexture(compound: Compound): THREE.CanvasTexture {
  const S = 1024;
  const { c, ctx } = canvas(S, S);
  const k = S / 2 / SIDEWALL_OUTER;
  const cx = S / 2;
  const colour = TYRE_COLOR[compound];
  const bandR = 0.785 * k;
  const bandW = 0.05 * k;

  ctx.strokeStyle = colour;
  ctx.lineWidth = bandW;
  ctx.lineCap = "butt";
  const arc = (from: number, to: number) => {
    ctx.beginPath();
    ctx.arc(cx, cx, bandR, (from * Math.PI) / 180, (to * Math.PI) / 180);
    ctx.stroke();
  };
  // Canvas angles run clockwise from 3 o'clock.
  arc(-142, -38);
  arc(38, 142);

  ctx.fillStyle = colour;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 0.007 * k;
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  arcText(ctx, "PIRELLI", cx, cx, bandR, Math.PI, 0.1 * k, 0.01 * k);
  arcText(ctx, MODEL_NAME[compound], cx, cx, bandR, 0, 0.1 * k, 0.016 * k);

  // Moulded technical markings: tone-on-tone, legible only in the light.
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.strokeStyle = "rgba(0,0,0,0)";
  ctx.font = `600 ${0.028 * k}px Arial, sans-serif`;
  arcText(ctx, "OUTSIDE · FOR MOTORSPORT USE ONLY", cx, cx, 0.715 * k, -Math.PI / 2, 0.028 * k, 0.004 * k);
  arcText(ctx, "305/720 R18", cx, cx, 0.715 * k, Math.PI / 2, 0.028 * k, 0.004 * k);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// u runs round the circumference, v across the width. Returns a colour map
// (grooves darker) and a bump map (grooves low) drawn from the same paths.
function treadTextures(compound: Compound): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } | null {
  if (compound !== "Intermediate" && compound !== "Wet") return null;
  const W = 2048;
  const H = 512;
  const colour = canvas(W, H);
  const bump = canvas(W, H);
  colour.ctx.fillStyle = "#15181b";
  colour.ctx.fillRect(0, 0, W, H);
  bump.ctx.fillStyle = "#b0b0b0";
  bump.ctx.fillRect(0, 0, W, H);

  const both = (draw: (ctx: CanvasRenderingContext2D) => void, colourFill: string, bumpFill: string) => {
    colour.ctx.strokeStyle = colourFill;
    bump.ctx.strokeStyle = bumpFill;
    draw(colour.ctx);
    draw(bump.ctx);
  };

  if (compound === "Intermediate") {
    // Swept grooves from near the centreline out to each shoulder,
    // alternating sides, as on the Cinturato green.
    const n = 30;
    const pitch = W / n;
    both(
      (ctx) => {
        ctx.lineWidth = H * 0.035;
        ctx.lineCap = "round";
        for (let i = -2; i <= n + 2; i++) {
          const x = i * pitch;
          ctx.beginPath();
          ctx.moveTo(x, H * 0.44);
          ctx.quadraticCurveTo(x + pitch * 0.9, H * 0.28, x + pitch * 1.9, H * 0.02);
          ctx.stroke();
          const xb = x + pitch / 2;
          ctx.beginPath();
          ctx.moveTo(xb, H * 0.56);
          ctx.quadraticCurveTo(xb + pitch * 0.9, H * 0.72, xb + pitch * 1.9, H * 0.98);
          ctx.stroke();
        }
      },
      "#070809",
      "#303030",
    );
  } else {
    // Full wet: two circumferential channels and dense chevron blocks
    // between them, cut deeper than the Intermediate's.
    const n = 44;
    const pitch = W / n;
    both(
      (ctx) => {
        ctx.lineCap = "square";
        ctx.lineWidth = H * 0.045;
        for (const v of [0.3, 0.7]) {
          ctx.beginPath();
          ctx.moveTo(0, H * v);
          ctx.lineTo(W, H * v);
          ctx.stroke();
        }
        ctx.lineWidth = H * 0.03;
        for (let i = -2; i <= n + 2; i++) {
          const x = i * pitch;
          ctx.beginPath();
          ctx.moveTo(x + pitch * 0.6, H * 0.02);
          ctx.lineTo(x, H * 0.3);
          ctx.lineTo(x + pitch * 0.35, H * 0.5);
          ctx.lineTo(x, H * 0.7);
          ctx.lineTo(x + pitch * 0.6, H * 0.98);
          ctx.stroke();
        }
        // Sipes: fine cuts across each block.
        ctx.lineWidth = H * 0.008;
        for (let i = -2; i <= n + 2; i++) {
          const x = i * pitch + pitch * 0.5;
          for (const [a, b] of [
            [0.08, 0.24],
            [0.36, 0.64],
            [0.76, 0.92],
          ]) {
            ctx.beginPath();
            ctx.moveTo(x, H * a);
            ctx.lineTo(x + pitch * 0.15, H * b);
            ctx.stroke();
          }
        }
      },
      "#050607",
      "#000000",
    );
  }

  const make = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(colour.c, true), bump: make(bump.c, false) };
}

function rim(): THREE.Group {
  const g = new THREE.Group();
  const gloss = new THREE.MeshPhysicalMaterial({
    color: 0x0b0c0e,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.14 });
  const cavity = new THREE.MeshStandardMaterial({ color: 0x040506, roughness: 0.9 });

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(RIM_R, RIM_R, HALF_W * 2 - 0.02, 72, 1, true), gloss);
  barrel.rotation.x = Math.PI / 2;
  barrel.material.side = THREE.DoubleSide;
  g.add(barrel);

  for (const z of [HALF_W - 0.02, -(HALF_W - 0.02)]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.016, 12, 96), gloss);
    lip.position.z = z;
    g.add(lip);
  }

  // Deep dish: the spoke face sits well back from the outer lip.
  const faceZ = HALF_W * 0.3;
  const back = new THREE.Mesh(new THREE.CircleGeometry(RIM_R, 64), cavity);
  back.position.z = -0.05;
  g.add(back);

  // Ten Y-spokes: a single arm from the hub that forks into two before the
  // barrel, as on the real forged wheel.
  const bar = (r0: number, a0: number, r1: number, a1: number, w: number) => {
    const x0 = Math.cos(a0) * r0;
    const y0 = Math.sin(a0) * r0;
    const x1 = Math.cos(a1) * r1;
    const y1 = Math.sin(a1) * r1;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.055), gloss);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, faceZ);
    m.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2;
    g.add(m);
  };
  const spokes = 10;
  const fork = 0.4;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    bar(0.13, a, fork, a, 0.05);
    bar(fork, a, RIM_R - 0.01, a - 0.12, 0.032);
    bar(fork, a, RIM_R - 0.01, a + 0.12, 0.032);
  }
  const spokeRing = new THREE.Mesh(new THREE.TorusGeometry(RIM_R - 0.02, 0.022, 10, 96), gloss);
  spokeRing.position.z = faceZ;
  g.add(spokeRing);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 40), gloss);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = faceZ + 0.03;
  g.add(hub);

  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.09, 6), chrome);
  nut.rotation.x = Math.PI / 2;
  nut.position.z = faceZ + 0.1;
  g.add(nut);

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 20), chrome);
  pin.rotation.x = Math.PI / 2;
  pin.position.z = faceZ + 0.17;
  g.add(pin);

  return g;
}

export interface TyreModel {
  /** Rotate this about Z to roll the tyre. */
  wheel: THREE.Group;
  root: THREE.Group;
  dispose: () => void;
}

export function buildTyre(compound: Compound): TyreModel {
  const root = new THREE.Group();
  const wheel = new THREE.Group();
  root.add(wheel);

  const slick = compound !== "Intermediate" && compound !== "Wet";
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x15181b,
    // A new slick has a satin sheen; treaded wets are matter.
    roughness: slick ? 0.52 : 0.72,
    metalness: 0,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(tyreProfile(), 128), rubber);
  body.rotation.x = Math.PI / 2;
  wheel.add(body);

  const tread = treadTextures(compound);
  if (tread) {
    const treadMat = new THREE.MeshStandardMaterial({
      map: tread.map,
      bumpMap: tread.bump,
      bumpScale: compound === "Wet" ? 6 : 4,
      roughness: 0.74,
    });
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.002, 1.002, (HALF_W - SHOULDER) * 2 + 0.06, 160, 1, true),
      treadMat,
    );
    band.rotation.x = Math.PI / 2;
    wheel.add(band);
  }

  const sideTex = sidewallTexture(compound);
  const sideMat = new THREE.MeshStandardMaterial({
    map: sideTex,
    transparent: true,
    roughness: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  for (const side of [1, -1] as const) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(RIM_R + 0.01, SIDEWALL_OUTER, 128, 1), sideMat);
    ring.position.z = side * (HALF_W + 0.002);
    if (side === -1) ring.rotation.y = Math.PI;
    wheel.add(ring);
  }

  wheel.add(rim());

  const dispose = () => {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          (m as THREE.MeshStandardMaterial).bumpMap?.dispose();
          m.dispose();
        });
      }
    });
  };

  return { wheel, root, dispose };
}

/** "Auto": the same tyre as an amber wireframe — a slot the engine fills. */
export function buildGhostTyre(): TyreModel {
  const root = new THREE.Group();
  const wheel = new THREE.Group();
  root.add(wheel);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf5a623, wireframe: true, transparent: true, opacity: 0.35 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(tyreProfile(3), 36), mat);
  body.rotation.x = Math.PI / 2;
  wheel.add(body);
  const hub = new THREE.Mesh(new THREE.RingGeometry(0.1, RIM_R, 12, 2), mat);
  hub.position.z = HALF_W * 0.3;
  wheel.add(hub);
  return {
    wheel,
    root,
    dispose: () => {
      body.geometry.dispose();
      hub.geometry.dispose();
      mat.dispose();
    },
  };
}

/** Soft contact shadow on the floor under the tread. */
export function contactShadow(): THREE.Mesh {
  const { c, ctx } = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -1.001;
  return mesh;
}
