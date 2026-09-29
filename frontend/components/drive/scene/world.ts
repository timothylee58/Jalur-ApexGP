import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { DriveTrack, TrackPoint } from "@/lib/drive/track";
import {
  asphaltTexture,
  crowdTexture,
  gravelTexture,
  frondTexture,
  garageTexture,
  glowTexture,
  grassTexture,
  kerbTexture,
  textTexture,
} from "./textures";

/**
 * Sepang International Circuit around the /drive lap: the real centreline
 * at its surveyed elevation, laid on terrain that rises and falls with it;
 * kerbs and run-off where the corners actually are; the Main Grandstand
 * between the two straights under its row of leaf-shaped canopies; the pit
 * building and control tower opposite; the start gantry; grandstands and
 * hillstands at the corners the real K1/K2/F/C/B stands overlook; and the
 * oil-palm country Sepang sits in, running out to hazy hills.
 */

const HALF = 7.5; // track half-width, metres
const up = new THREE.Vector3(0, 1, 0);

export interface StartLamps {
  /** One material per column of red lights, lit by the start sequence. */
  columns: THREE.MeshBasicMaterial[];
  glows: THREE.Sprite[][];
}

export interface TvCamera {
  position: THREE.Vector3;
  /** Lap distance this camera covers. */
  s: number;
}

export interface World {
  group: THREE.Group;
  lamps: StartLamps;
  tvCameras: TvCamera[];
  /** Terrain height at a ground position. */
  heightAt: (x: number, z: number) => number;
  dispose: () => void;
}

interface Options {
  /** Fewer plantation palms and a coarser terrain on phones. */
  lite: boolean;
}

const right = (p: TrackPoint) => new THREE.Vector3(-p.tz, 0, p.tx);

export function buildWorld(track: DriveTrack, { lite }: Options): World {
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };

  const pts = track.points;
  const centre = new THREE.Vector3();
  pts.forEach((p) => centre.add(new THREE.Vector3(p.x, 0, p.z)));
  centre.divideScalar(pts.length);

  // Coarse track samples for "how far from the track, and how high is it
  // there" queries while laying out terrain and scenery.
  const coarse = pts.filter((_, i) => i % 5 === 0);
  const nearestTrack = (x: number, z: number) => {
    let best = coarse[0];
    let bestD = Infinity;
    for (const p of coarse) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return { point: best, distance: Math.sqrt(bestD) };
  };

  // --- Terrain ---------------------------------------------------------------
  // Heights blend the track's own elevation (inverse-distance weighted, so
  // the ground meets the asphalt everywhere) with gentle rolling noise away
  // from it; right beside the track the ground sits just under the surface.
  const heightSamples = pts.filter((_, i) => i % 10 === 0);
  const meanY = heightSamples.reduce((a, p) => a + p.y, 0) / heightSamples.length;
  const roll = (x: number, z: number) =>
    Math.sin(x * 0.0041 + 1.3) * Math.cos(z * 0.0037 - 0.4) * 5 + Math.sin(x * 0.011 + z * 0.009) * 1.6;
  const heightAt = (x: number, z: number) => {
    let wSum = 0;
    let hSum = 0;
    let nearest = Infinity;
    // The ground may not rise above any stretch of track it sits beside —
    // not just the nearest one. Where a hairpin's legs sit at different
    // heights (T2 to T3 climbs 19 m), a coarse terrain triangle spanning
    // both would otherwise bridge over the lower leg. The cap eases off at
    // a 15% grade beyond the verges.
    let cap = Infinity;
    for (const p of heightSamples) {
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      nearest = Math.min(nearest, d2);
      cap = Math.min(cap, p.y - 0.35 + Math.max(0, Math.sqrt(d2) - 38) * 0.15);
      // Squared, so only nearby track pulls on the ground: a straight
      // 100 m away at another height mustn't lift the grass through this one.
      const w = 1 / (d2 + 400) ** 2;
      wSum += w;
      hSum += w * p.y;
    }
    const d = Math.sqrt(nearest);
    const trackH = hSum / wSum;
    const far = THREE.MathUtils.smoothstep(d, 60, 900);
    const blended = THREE.MathUtils.lerp(trackH, meanY, far * 0.6);
    // Tuck the ground a little under the track so the coarse terrain grid
    // never pokes through it; the verges below cover the difference.
    const dip = 0.8 * (1 - THREE.MathUtils.smoothstep(d, 12, 45));
    const h = blended + roll(x, z) * THREE.MathUtils.smoothstep(d, 30, 160) - 0.18 - dip;
    return Math.min(h, cap);
  };

  const SIZE = 5200;
  const segs = lite ? 110 : 170;
  const terrainGeo = new THREE.PlaneGeometry(SIZE, SIZE, segs, segs);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position as THREE.BufferAttribute;
  const tUv = terrainGeo.attributes.uv as THREE.BufferAttribute;
  const colours = new Float32Array(tPos.count * 3);
  // Vertex colours are multipliers over the grass texture: near white,
  // with broad darker and drier patches so the ground isn't one flat tone.
  const grassA = new THREE.Color(1, 1, 1);
  const grassB = new THREE.Color(0.72, 0.8, 0.66);
  const soil = new THREE.Color(1.25, 1.1, 0.78);
  for (let i = 0; i < tPos.count; i += 1) {
    const x = tPos.getX(i) + centre.x;
    const z = tPos.getZ(i) + centre.z;
    tPos.setXYZ(i, x, heightAt(x, z), z);
    tUv.setXY(i, x / 14, z / 14);
    const n = (Math.sin(x * 0.013) * Math.cos(z * 0.017) + 1) / 2;
    const c = grassA.clone().lerp(grassB, n);
    if (Math.sin(x * 0.0023 + z * 0.0031) > 0.93) c.lerp(soil, 0.35);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  terrainGeo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  terrainGeo.computeVertexNormals();
  const grass = keep(grassTexture());
  const groundMat = keep(new THREE.MeshLambertMaterial({ map: grass, vertexColors: true }));
  const terrain = new THREE.Mesh(keep(terrainGeo), groundMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // --- Track surfaces ----------------------------------------------------------
  /** A strip between two lateral offsets (metres right of centre) over a
   * range of samples, lifted `lift` above the track surface. */
  const strip = (from: number, to: number, lift: number, i0 = 0, i1 = pts.length, vPerMetre = 0.1) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const count = i1 - i0 + 1;
    for (let k = 0; k < count; k += 1) {
      const i = (i0 + k) % pts.length;
      const p = pts[i];
      const r = right(p);
      const s = (i0 + k) * track.step;
      const a = Math.abs(from) <= HALF + 0.01 ? from : clampOffset(i, from);
      const b = Math.abs(to) <= HALF + 0.01 ? to : clampOffset(i, to);
      // Inside the asphalt edge, sit on the track; beyond it, on the verge.
      const yFrom = Math.abs(a) <= HALF + 0.01 ? p.y + lift : besideTrack(p, a) + lift;
      const yTo = Math.abs(b) <= HALF + 0.01 ? p.y + lift : besideTrack(p, b) + lift;
      positions.push(p.x + r.x * a, yFrom, p.z + r.z * a, p.x + r.x * b, yTo, p.z + r.z * b);
      uvs.push(0, s * vPerMetre, 1, s * vPerMetre);
      if (k < count - 1) {
        const a = k * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // Strips are wound for a camera above; make sure they face up.
    const n = geo.attributes.normal as THREE.BufferAttribute;
    if (n.count && n.getY(0) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    return keep(geo);
  };

  /** A vertical face along a lateral offset — tyre walls and barriers. */
  const wall = (offset: number, height: number, i0: number, i1: number, uPerMetre = 0.5) => {
    const positions: number[] = [];
    const uvs: number[] = [];
    const idx: number[] = [];
    const count = i1 - i0 + 1;
    for (let k = 0; k < count; k += 1) {
      const i = (i0 + k) % pts.length;
      const p = pts[i];
      const r = right(p);
      const o = clampOffset(i, offset);
      const x = p.x + r.x * o;
      const z = p.z + r.z * o;
      const y = besideTrack(p, o) - 0.05;
      const s = (i0 + k) * track.step;
      positions.push(x, y, z, x, y + height, z);
      uvs.push(s * uPerMetre, 0, s * uPerMetre, 1);
      if (k < count - 1) {
        const a = k * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return keep(geo);
  };

  const VERGE_OUT = HALF + 30;
  const reachOf = (side: number) =>
    pts.map((p) => {
      const r = right(p).multiplyScalar(side);
      let reach = Infinity;
      for (const q of coarse) {
        // Skip only this point's immediate neighbours: a hairpin's other
        // leg is close along the lap too, and has to count.
        const ds = Math.abs(q.s - p.s);
        if (Math.min(ds, track.length - ds) < 40) continue;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const lateral = dx * r.x + dz * r.z;
        const along = Math.abs(dx * p.tx + dz * p.tz);
        if (lateral > HALF * 2 && along < 25) reach = Math.min(reach, lateral / 2);
      }
      return Math.max(HALF + 1.5, reach);
    });
  const reachRight = reachOf(1);
  const reachLeft = reachOf(-1);
  /** Clamp a signed lateral offset at sample i to its side's reach. */
  const clampOffset = (i: number, offset: number) => {
    const limit = offset >= 0 ? reachRight[i] : reachLeft[i];
    return Math.sign(offset) * Math.min(Math.abs(offset), limit);
  };
  /** Height of the ground beside the track at a lateral offset: level with
   * the asphalt at its edge, easing down onto the terrain by VERGE_OUT. */
  const besideTrack = (p: TrackPoint, offset: number) => {
    const r = right(p);
    const x = p.x + r.x * offset;
    const z = p.z + r.z * offset;
    const f = THREE.MathUtils.clamp((Math.abs(offset) - (HALF - 0.2)) / (VERGE_OUT - (HALF - 0.2)), 0, 1);
    return THREE.MathUtils.lerp(p.y + 0.012, Math.min(p.y - 0.05, heightAt(x, z) + 0.05), f * f);
  };

  /** Grass verge from the track edge outward, sloping from the track's
   * height down onto the terrain, in the terrain's own texture space. */
  const verge = (side: number) => {
    const offsets = [HALF - 0.2, HALF + 4, HALF + 10, HALF + 18, VERGE_OUT];
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const idx: number[] = [];
    const cols = offsets.length;
    pts.forEach((p, k) => {
      const r = right(p);
      // On the inside of a bend the verge can't reach past the bend's own
      // centre, or a hairpin's verge would lay grass over the other leg.
      let bend = 0;
      for (let d = -10; d <= 10; d += 2) bend += pts[(k + d + pts.length) % pts.length].curvature;
      bend /= 11;
      const inside = Math.sign(bend) === side;
      const bendReach = inside && Math.abs(bend) > 1e-4 ? Math.max(HALF + 1.5, 0.75 / Math.abs(bend)) : Infinity;
      const reach = Math.min(bendReach, side > 0 ? reachRight[k] : reachLeft[k]);
      offsets.forEach((o, j) => {
        const lateral = Math.min(o, reach);
        const x = p.x + r.x * lateral * side;
        const z = p.z + r.z * lateral * side;
        positions.push(x, besideTrack(p, lateral * side), z);
        uvs.push(x / 14, z / 14);
        colors.push(1, 1, 1);
      });
      const next = (k + 1) % pts.length;
      for (let j = 0; j < cols - 1; j += 1) {
        const a = k * cols + j;
        const b = next * cols + j;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const n = geo.attributes.normal as THREE.BufferAttribute;
    if (n.getY(0) < 0) {
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      geo.setIndex(idx);
      geo.computeVertexNormals();
    }
    return keep(geo);
  };
  for (const side of [-1, 1]) {
    const v = new THREE.Mesh(verge(side), groundMat);
    v.receiveShadow = true;
    group.add(v);
  }

  const asphalt = keep(asphaltTexture());
  asphalt.repeat.set(1, 1);
  const asphaltMat = keep(new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92, metalness: 0 }));
  const surface = new THREE.Mesh(strip(-HALF, HALF, 0.02, 0, pts.length, 1 / 12), asphaltMat);
  surface.receiveShadow = true;
  group.add(surface);

  const lineMat = keep(new THREE.MeshBasicMaterial({ color: "#eeebe4", polygonOffset: true, polygonOffsetFactor: -2 }));
  group.add(new THREE.Mesh(strip(-HALF + 0.35, -HALF + 0.6, 0.035), lineMat));
  group.add(new THREE.Mesh(strip(HALF - 0.6, HALF - 0.35, 0.035), lineMat));

  // Kerbs and run-off where the corner is tight enough to use them: kerbs
  // on the inside, and on the outside of the tightest; run-off beyond.
  const kerb = keep(kerbTexture());
  const kerbMat = keep(new THREE.MeshLambertMaterial({ map: kerb }));
  // Run-off is the same asphalt, older and paler; the tint is a
  // multiplier over the texture, so it's above 1 to lighten it.
  const runoffMat = keep(new THREE.MeshLambertMaterial({ color: new THREE.Color(1.55, 1.55, 1.5), map: asphalt }));
  const gravel = keep(gravelTexture());
  const gravelMat = keep(new THREE.MeshLambertMaterial({ map: gravel }));
  const tyreWallMat = keep(new THREE.MeshLambertMaterial({ map: kerb, side: THREE.DoubleSide }));
  const spans: { i0: number; i1: number; sign: number; tight: boolean }[] = [];
  let open: { i0: number; sign: number; tight: boolean } | null = null;
  pts.forEach((p, i) => {
    const r = Math.abs(p.curvature) > 1e-6 ? 1 / Math.abs(p.curvature) : Infinity;
    const cornering = r < 170;
    const sign = Math.sign(p.curvature);
    if (cornering && (!open || open.sign !== sign)) {
      if (open) spans.push({ ...open, i1: i });
      open = { i0: i, sign, tight: r < 60 };
    } else if (cornering && open && r < 60) {
      open.tight = true;
    } else if (!cornering && open) {
      spans.push({ ...open, i1: i });
      open = null;
    }
  });
  for (const span of spans) {
    if (span.i1 - span.i0 < 6) continue;
    const inside = span.sign; // right turn: inside is to the right
    const i0 = Math.max(0, span.i0 - 4);
    const i1 = Math.min(pts.length - 1, span.i1 + 4);
    const kerbIn = inside > 0 ? [HALF, HALF + 1.3] : [-HALF - 1.3, -HALF];
    group.add(new THREE.Mesh(strip(kerbIn[0], kerbIn[1], 0.05, i0, i1, 1 / 3), kerbMat));
    if (span.tight) {
      const kerbOut = inside > 0 ? [-HALF - 1.3, -HALF] : [HALF, HALF + 1.3];
      group.add(new THREE.Mesh(strip(kerbOut[0], kerbOut[1], 0.05, i0, i1, 1 / 3), kerbMat));
    }
    const out = inside > 0 ? [-HALF - 16, -HALF - 1.3] : [HALF + 1.3, HALF + 16];
    const r0 = Math.max(0, i0 - 10);
    const r1 = Math.min(pts.length - 1, i1 + 20);
    const runoff = new THREE.Mesh(strip(out[0], out[1], 0.01, r0, r1, 1 / 12), runoffMat);
    runoff.receiveShadow = true;
    group.add(runoff);
    if (span.tight) {
      // Beyond the asphalt: a gravel bed, then a red-and-white tyre wall.
      const outward = inside > 0 ? -1 : 1;
      const gravel = new THREE.Mesh(
        strip(outward > 0 ? HALF + 16 : -HALF - 30, outward > 0 ? HALF + 30 : -HALF - 16, 0.005, r0, r1, 1 / 8),
        gravelMat,
      );
      gravel.receiveShadow = true;
      group.add(gravel);
      group.add(new THREE.Mesh(wall(outward * (HALF + 30), 1.1, r0, r1, 0.4), tyreWallMat));
    }
  }

  // --- Start / finish, grid, gantry ------------------------------------------
  const line = pts[0];
  const lineRight = right(line);
  const fwd = new THREE.Vector3(line.tx, 0, line.tz);
  const yaw = Math.atan2(line.tx, line.tz);
  const chequer = new THREE.Group();
  const cheqMat = keep(new THREE.MeshBasicMaterial({ color: "#f4efe6", polygonOffset: true, polygonOffsetFactor: -3 }));
  const cheqGeo = keep(new THREE.PlaneGeometry(0.75, 0.75));
  for (let a = 0; a < 20; a += 1) {
    for (let b = 0; b < 2; b += 1) {
      if ((a + b) % 2) continue;
      const m = new THREE.Mesh(cheqGeo, cheqMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(-HALF + 0.375 + a * 0.75, 0, b * 0.75);
      chequer.add(m);
    }
  }
  chequer.position.set(line.x, line.y + 0.04, line.z);
  chequer.rotation.y = yaw;
  group.add(chequer);

  // Grid slots behind the line, staggered left and right.
  const slotMat = lineMat;
  const slotGeo = keep(new THREE.PlaneGeometry(3.4, 0.22));
  for (let k = 0; k < 10; k += 1) {
    const p = track.at(track.length - 8 - k * 8);
    const r = right(p);
    const lateral = k % 2 === 0 ? -2.8 : 2.8;
    const bar = new THREE.Mesh(slotGeo, slotMat);
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = Math.atan2(-p.tx, -p.tz);
    bar.position.set(p.x + r.x * lateral + p.tx * 2.6, p.y + 0.04, p.z + r.z * lateral + p.tz * 2.6);
    group.add(bar);
  }

  const steel = keep(new THREE.MeshStandardMaterial({ color: "#8d949b", metalness: 0.6, roughness: 0.45 }));
  const concrete = keep(new THREE.MeshLambertMaterial({ color: "#c9c3b8" }));
  const darkMat = keep(new THREE.MeshLambertMaterial({ color: "#16191d" }));
  const gantry = new THREE.Group();
  const gx = line.x + fwd.x * 6;
  const gz = line.z + fwd.z * 6;
  gantry.position.set(gx, line.y, gz);
  gantry.rotation.y = yaw;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, 8, 0.5)), steel);
    post.position.set(side * (HALF + 2.2), 4, 0);
    gantry.add(post);
  }
  const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(HALF * 2 + 5, 0.9, 0.7)), darkMat);
  beam.position.set(0, 7.6, 0);
  gantry.add(beam);
  const glowTex = keep(glowTexture());
  const columns: THREE.MeshBasicMaterial[] = [];
  const glows: THREE.Sprite[][] = [];
  const lampGeo = keep(new THREE.CircleGeometry(0.2, 20));
  for (let c = 0; c < 5; c += 1) {
    const x = (c - 2) * 1.3;
    const pod = new THREE.Mesh(keep(new THREE.BoxGeometry(0.8, 1.9, 0.4)), darkMat);
    pod.position.set(x, 6.55, -0.1);
    gantry.add(pod);
    const mat = keep(new THREE.MeshBasicMaterial({ color: "#2a0806" }));
    columns.push(mat);
    const colGlows: THREE.Sprite[] = [];
    for (const y of [6.1, 6.62]) {
      const lamp = new THREE.Mesh(lampGeo, mat);
      lamp.position.set(x, y, -0.31);
      lamp.rotation.y = Math.PI;
      gantry.add(lamp);
      const glow = new THREE.Sprite(
        keep(new THREE.SpriteMaterial({ map: glowTex, color: "#ff2410", blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })),
      );
      glow.scale.set(1.6, 1.6, 1);
      glow.position.set(x, y, -0.45);
      gantry.add(glow);
      colGlows.push(glow);
    }
    glows.push(colGlows);
  }
  group.add(gantry);

  // --- Main grandstand, pit building, tower ----------------------------------
  // The Main Grandstand sits between the start/finish and back straights;
  // work out which side of the start/finish straight that is.
  const back = track.at(track.anchorS["Back Straight Mid"]);
  const standSide = Math.sign(new THREE.Vector3(back.x - line.x, 0, back.z - line.z).dot(lineRight)) || 1;
  const pitSide = -standSide;

  const crowd = keep(crowdTexture());
  crowd.repeat.set(6, 1);
  const crowdMat = keep(new THREE.MeshLambertMaterial({ map: crowd }));
  const canopyMat = keep(
    new THREE.MeshStandardMaterial({ color: "#f3efe7", roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }),
  );

  /** A frame at lap distance s: origin on the centreline, x across (to the
   * given side), z along the track. */
  const frameAt = (s: number, side: number, offset: number, height = 0) => {
    const p = track.at(s);
    const r = right(p).multiplyScalar(side);
    const o = new THREE.Object3D();
    o.position.set(p.x + r.x * offset, heightAt(p.x + r.x * offset, p.z + r.z * offset) + height, p.z + r.z * offset);
    // Local +Z faces back toward the track.
    o.rotation.y = Math.atan2(-r.x, -r.z);
    return o;
  };

  // Seating: a raked bank of spectators, then the leaf canopies over it.
  const leaf = (length: number, width: number, tilt: number) => {
    const g = new THREE.PlaneGeometry(1, 1, 24, 12);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      const u = pos.getX(i) * 2; // along the leaf, -1..1
      const v = pos.getY(i) * 2; // across it, -1..1
      const halfW = (width / 2) * Math.pow(Math.max(0, 1 - u * u), 0.7);
      const arch = 2.4 * (1 - v * v) * Math.pow(Math.max(0, 1 - u * u), 0.6);
      pos.setXYZ(i, v * halfW, arch + tilt * u + 1.6 * u * u, (u * length) / 2);
    }
    g.computeVertexNormals();
    return keep(g);
  };
  const STAND_FROM = -240;
  const STAND_TO = 300;
  const seatingGeo = keep(new THREE.PlaneGeometry(10.2, 26));
  const standWallGeo = keep(new THREE.BoxGeometry(10.2, 1.4, 0.4));
  const mastGeo = keep(new THREE.CylinderGeometry(0.28, 0.4, 22, 8));
  const cableMat = keep(new THREE.LineBasicMaterial({ color: "#9aa1a8" }));
  for (let s = STAND_FROM; s <= STAND_TO; s += 10) {
    const f = frameAt(s, standSide, HALF + 20);
    const seating = new THREE.Mesh(seatingGeo, crowdMat);
    seating.rotation.x = -Math.PI / 2 + 0.42;
    seating.position.set(0, 6.2, -1);
    f.add(seating);
    const front = new THREE.Mesh(standWallGeo, concrete);
    front.position.set(0, 0.7, 11);
    f.add(front);
    group.add(f);
  }
  let alternate = 1;
  for (let s = STAND_FROM + 12; s <= STAND_TO - 12; s += 27) {
    const f = frameAt(s, standSide, HALF + 30, 15);
    const canopy = new THREE.Mesh(leaf(52, 30, 2.2 * alternate), canopyMat);
    f.add(canopy);
    const mast = new THREE.Mesh(mastGeo, steel);
    mast.position.set(0, -4, 0);
    f.add(mast);
    // Stay cables from the mast head to the leaf's two tips.
    const cable = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 6, 0),
      new THREE.Vector3(0, 1.6 + 2.2 * alternate, 26),
      new THREE.Vector3(0, 6, 0),
      new THREE.Vector3(0, 1.6 - 2.2 * alternate, -26),
    ]);
    f.add(new THREE.LineSegments(keep(cable), cableMat));
    group.add(f);
    alternate *= -1;
  }

  // Pit wall, pit lane, garages with the paddock-club glazing above, tower.
  const pitLane = new THREE.Mesh(
    strip(pitSide > 0 ? HALF + 9 : -HALF - 21, pitSide > 0 ? HALF + 21 : -HALF - 9, 0.015, pts.length - 150, pts.length + 150, 1 / 12),
    runoffMat,
  );
  group.add(pitLane);
  const garages = keep(garageTexture());
  garages.repeat.set(1, 1);
  const garageMat = keep(new THREE.MeshLambertMaterial({ map: garages }));
  const glass = keep(new THREE.MeshStandardMaterial({ color: "#3b5670", metalness: 0.7, roughness: 0.15 }));
  const hoardings = ["SEPANG INTERNATIONAL CIRCUIT", "MALAYSIA", "JALUR APEXGP", "SELAMAT DATANG"];
  const hoardTex = hoardings.map((t) =>
    keep(textTexture(t, { w: 1024, h: 96, bg: "#0e1115", fg: "#f5a623", font: "600 58px 'Helvetica Neue', Arial, sans-serif" })),
  );
  const hoardMats = hoardTex.map((t) => keep(new THREE.MeshBasicMaterial({ map: t })));
  const pitWallGeo = keep(new THREE.BoxGeometry(25, 1.3, 0.5));
  const hoardGeo = keep(new THREE.PlaneGeometry(24, 0.9));
  const blockGeo = keep(new THREE.BoxGeometry(25, 13, 16));
  const doorsGeo = keep(new THREE.PlaneGeometry(25, 6.5));
  const glazingGeo = keep(new THREE.PlaneGeometry(25, 3.6));
  const pitRoofGeo = keep(new THREE.BoxGeometry(25.2, 0.5, 20));
  const standBoardGeo = keep(new THREE.PlaneGeometry(24, 1.1));
  for (let s = -300, k = 0; s <= 300; s += 25, k += 1) {
    const pitWallFrame = frameAt(s, pitSide, HALF + 8.5);
    const pitWall = new THREE.Mesh(pitWallGeo, concrete);
    pitWall.position.y = 0.65;
    pitWallFrame.add(pitWall);
    const board = new THREE.Mesh(hoardGeo, hoardMats[k % hoardMats.length]);
    board.position.set(0, 0.7, 0.27);
    pitWallFrame.add(board);
    group.add(pitWallFrame);

    const bay = frameAt(s, pitSide, HALF + 30);
    const block = new THREE.Mesh(blockGeo, concrete);
    block.position.y = 6.5;
    bay.add(block);
    const doors = new THREE.Mesh(doorsGeo, garageMat);
    doors.position.set(0, 3.25, 8.02);
    bay.add(doors);
    const glazing = new THREE.Mesh(glazingGeo, glass);
    glazing.position.set(0, 9.4, 8.03);
    bay.add(glazing);
    const roof = new THREE.Mesh(pitRoofGeo, steel);
    roof.position.set(0, 13.2, 2);
    bay.add(roof);
    group.add(bay);

    // Hoardings on the grandstand side's barrier too.
    const barrier = frameAt(s, standSide, HALF + 9);
    const standBoard = new THREE.Mesh(standBoardGeo, hoardMats[(k + 2) % hoardMats.length]);
    standBoard.position.y = 0.6;
    barrier.add(standBoard);
    group.add(barrier);
  }
  const tower = frameAt(40, pitSide, HALF + 44);
  const shaft = new THREE.Mesh(keep(new THREE.BoxGeometry(9, 30, 9)), concrete);
  shaft.position.y = 15;
  tower.add(shaft);
  const cab = new THREE.Mesh(keep(new THREE.CylinderGeometry(9, 7, 7, 12)), glass);
  cab.position.y = 33;
  tower.add(cab);
  const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(10, 10, 0.8, 12)), steel);
  cap.position.y = 37;
  tower.add(cap);
  group.add(tower);

  // --- Corner grandstands and hillstands --------------------------------------
  const outsideOf = (s: number) => {
    let sum = 0;
    for (let d = -40; d <= 40; d += 4) sum += track.at(s + d).curvature;
    return sum > 0 ? -1 : 1; // right-hander: the outside is to the left
  };
  const grassy = keep(new THREE.MeshLambertMaterial({ color: "#58843a" }));
  const stands: { anchor: string; kind: "grand" | "hill" }[] = [
    { anchor: "T1 Apex", kind: "grand" },
    { anchor: "T3 Apex", kind: "hill" },
    { anchor: "T6 Apex", kind: "grand" },
    { anchor: "T10 Apex", kind: "hill" },
    { anchor: "T13 Apex", kind: "hill" },
  ];
  const cornerSeatsGeo = keep(new THREE.PlaneGeometry(15.2, 20));
  const cornerRoofGeo = keep(new THREE.BoxGeometry(15.4, 0.4, 14));
  const cornerPostsGeo = keep(new THREE.BoxGeometry(15, 9, 0.6));
  const slopeGeo = keep(new THREE.PlaneGeometry(15.2, 34));
  const fansGeo = keep(new THREE.PlaneGeometry(15.2, 12));
  for (const stand of stands) {
    const s = track.anchorS[stand.anchor];
    if (s == null) continue;
    const side = outsideOf(s);
    for (let d = -45; d <= 45; d += 15) {
      const f = frameAt(s + d, side, HALF + 42);
      if (stand.kind === "grand") {
        const seats = new THREE.Mesh(cornerSeatsGeo, crowdMat);
        seats.rotation.x = -Math.PI / 2 + 0.45;
        seats.position.y = 5;
        f.add(seats);
        const roof = new THREE.Mesh(cornerRoofGeo, steel);
        roof.position.set(0, 12, -3);
        f.add(roof);
        const posts = new THREE.Mesh(cornerPostsGeo, concrete);
        posts.position.set(0, 4.5, -9.5);
        f.add(posts);
      } else {
        const slope = new THREE.Mesh(slopeGeo, grassy);
        slope.rotation.x = -Math.PI / 2 + 0.28;
        slope.position.y = 3.6;
        f.add(slope);
        const fans = new THREE.Mesh(fansGeo, crowdMat);
        fans.rotation.x = -Math.PI / 2 + 0.28;
        fans.position.set(0, 2.2, 6);
        f.add(fans);
      }
      group.add(f);
    }
  }

  // --- Braking boards before the slow corners ---------------------------------
  const boardTex = [150, 100, 50].map((n) =>
    keep(textTexture(String(n), { w: 128, h: 128, bg: "#f4efe6", fg: "#0a0c0e", font: "800 64px 'Helvetica Neue', Arial, sans-serif" })),
  );
  const boardMats = boardTex.map((t) => keep(new THREE.MeshBasicMaterial({ map: t })));
  const boardGeo = keep(new THREE.PlaneGeometry(1.6, 1.6));
  const postGeo = keep(new THREE.CylinderGeometry(0.06, 0.06, 1.8, 6));
  for (const corner of track.corners) {
    if (corner.apexKmh > 200) continue;
    const side = outsideOf(corner.s);
    [150, 100, 50].forEach((metres, k) => {
      const f = frameAt(corner.s - corner.lengthM / 2 - metres, side, HALF + 4.5);
      // Face oncoming cars: turn the board to look back up the track.
      f.rotation.y += (side * Math.PI) / 2;
      const board = new THREE.Mesh(boardGeo, boardMats[k]);
      board.position.y = 2.3;
      f.add(board);
      const post = new THREE.Mesh(postGeo, steel);
      post.position.y = 0.9;
      f.add(post);
      group.add(f);
    });
  }

  // --- Palms: landscaped groves near the track, plantation beyond --------------
  const frond = keep(frondTexture());
  const frondMat = keep(new THREE.MeshLambertMaterial({ map: frond, alphaTest: 0.45, side: THREE.DoubleSide }));
  const trunkMat = keep(new THREE.MeshLambertMaterial({ color: "#6b5b45" }));

  const crownGeometry = (fronds: number, segments: number) => {
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < fronds; k += 1) {
      const g = new THREE.PlaneGeometry(1, 1, segments, 1);
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 1) {
        const u = pos.getX(i) + 0.5; // 0 at the crown, 1 at the tip
        const v = pos.getY(i);
        const reach = u * 5.2;
        pos.setXYZ(i, reach, 1.1 * u - 2.6 * u * u, v * 1.1 * (1 - 0.3 * u));
      }
      g.rotateX(0.35 * (k % 2 ? 1 : -1));
      g.rotateY((k / fronds) * Math.PI * 2 + k * 0.4);
      parts.push(g);
    }
    const merged = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    merged.computeVertexNormals();
    return keep(merged);
  };
  const trunkGeometry = keep(new THREE.CylinderGeometry(0.2, 0.32, 1, 6, 4).translate(0, 0.5, 0));
  const farTrunkGeometry = keep(new THREE.CylinderGeometry(0.22, 0.3, 1, 4, 1).translate(0, 0.5, 0));

  const placePalms = (spots: { x: number; z: number; h: number }[], crown: THREE.BufferGeometry, trunk: THREE.BufferGeometry) => {
    const trunks = new THREE.InstancedMesh(trunk, trunkMat, spots.length);
    const crowns = new THREE.InstancedMesh(crown, frondMat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tint = new THREE.Color();
    spots.forEach((spot, i) => {
      const y = heightAt(spot.x, spot.z);
      const lean = new THREE.Euler((Math.sin(i * 12.9) * 0.08), i * 2.1, Math.cos(i * 7.3) * 0.08);
      q.setFromEuler(lean);
      m.compose(new THREE.Vector3(spot.x, y, spot.z), q, new THREE.Vector3(1, spot.h, 1));
      trunks.setMatrixAt(i, m);
      const top = new THREE.Vector3(0, spot.h, 0).applyQuaternion(q).add(new THREE.Vector3(spot.x, y, spot.z));
      m.compose(top, new THREE.Quaternion().setFromAxisAngle(up, i * 1.7), new THREE.Vector3(1, 1, 1).multiplyScalar(0.85 + (i % 5) * 0.06));
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, tint.setHSL(0.24 + (i % 7) * 0.008, 0.45, 0.42 + (i % 3) * 0.05));
    });
    trunks.castShadow = false;
    crowns.castShadow = false;
    group.add(trunks, crowns);
    disposables.push({ dispose: () => { trunks.dispose(); crowns.dispose(); } });
  };

  const rand = (() => {
    let s = 20260929;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const bbox = new THREE.Box3().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  const isClear = (x: number, z: number, min: number) => nearestTrack(x, z).distance > min;
  const inBuildings = (x: number, z: number) => {
    // Keep palms out of the grandstand and pit complex along the main straight.
    const { point, distance } = nearestTrack(x, z);
    const s = point.s;
    const nearStraight = s > track.length - 320 || s < 330;
    return nearStraight && distance < 75;
  };

  const groves: { x: number; z: number; h: number }[] = [];
  for (let tries = 0; groves.length < (lite ? 260 : 560) && tries < 24000; tries += 1) {
    const p = coarse[Math.floor(rand() * coarse.length)];
    const r = right(p).multiplyScalar(rand() < 0.5 ? -1 : 1);
    const d = 30 + rand() * 130;
    const x = p.x + r.x * d + (rand() - 0.5) * 30;
    const z = p.z + r.z * d + (rand() - 0.5) * 30;
    if (!isClear(x, z, 26) || inBuildings(x, z)) continue;
    groves.push({ x, z, h: 8 + rand() * 7 });
  }
  placePalms(groves, crownGeometry(9, 6), trunkGeometry);

  const plantation: { x: number; z: number; h: number }[] = [];
  const spacing = lite ? 64 : 48;
  const margin = 170;
  const reach = 1100;
  for (let x = bbox.min.x - reach; x <= bbox.max.x + reach; x += spacing) {
    for (let z = bbox.min.z - reach; z <= bbox.max.z + reach; z += spacing) {
      const jx = x + (rand() - 0.5) * spacing * 0.5;
      const jz = z + (rand() - 0.5) * spacing * 0.5;
      const insideCore =
        jx > bbox.min.x - margin && jx < bbox.max.x + margin && jz > bbox.min.z - margin && jz < bbox.max.z + margin;
      if (insideCore && !isClear(jx, jz, 170)) continue;
      if (!isClear(jx, jz, 120)) continue;
      plantation.push({ x: jx, z: jz, h: 7 + rand() * 4 });
    }
  }
  placePalms(plantation, crownGeometry(5, 3), farTrunkGeometry);

  // --- Hills on the horizon, lost in the haze ---------------------------------
  const hillGeo = new THREE.CylinderGeometry(3300, 3300, 1, 160, 1, true);
  const hp = hillGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < hp.count; i += 1) {
    if (hp.getY(i) > 0) {
      const a = Math.atan2(hp.getZ(i), hp.getX(i));
      const h = 70 + 60 * Math.sin(a * 3 + 1) + 40 * Math.sin(a * 7 + 2) + 25 * Math.sin(a * 17);
      hp.setY(i, Math.max(30, h));
    } else hp.setY(i, -20);
  }
  hillGeo.computeVertexNormals();
  const hills = new THREE.Mesh(keep(hillGeo), keep(new THREE.MeshLambertMaterial({ color: "#3e5a44", side: THREE.BackSide })));
  hills.position.set(centre.x, meanY, centre.z);
  group.add(hills);

  // --- Broadcast camera positions: one outside every corner, plus the straights.
  const tvCameras: TvCamera[] = [];
  for (const corner of track.corners) {
    const side = outsideOf(corner.s);
    const f = frameAt(corner.s - 40, side, HALF + 34, 9);
    tvCameras.push({ position: f.position.clone(), s: corner.s });
  }
  for (const s of [track.length - 120, track.anchorS["Back Straight Mid"], 330]) {
    const f = frameAt(s, standSide, HALF + 26, 11);
    tvCameras.push({ position: f.position.clone(), s });
  }
  tvCameras.sort((a, b) => a.s - b.s);

  return {
    group,
    lamps: { columns, glows },
    tvCameras,
    heightAt,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
      group.traverse((o) => {
        if (o instanceof THREE.LineSegments) o.geometry.dispose();
      });
    },
  };
}
