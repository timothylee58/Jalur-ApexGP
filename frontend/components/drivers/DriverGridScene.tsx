"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildF1Car, type CarRig } from "@/components/drive/scene/f1car";
import { asphaltTexture, crowdTexture, kerbTexture } from "@/components/drive/scene/textures";
import type { Driver } from "@/data/drivers";
import { circuitCentrelineMetres } from "@/data/sepangCircuit";
import { teams } from "@/data/teams";
import { accentForDriver, inkForAccent } from "@/lib/driverAccent";
import { driverCode, gridSlot, GRID_SPACING_M, historyPlinth } from "@/lib/driverGridLayout";
import { photoForDriver } from "@/lib/driverPhotos";

interface DriverGridSceneProps {
  drivers: Driver[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Short line for the corner of the frame, e.g. "Championship order · after R15". */
  caption?: string;
  /** Open framed on the selected driver (a ?driver= deep link) instead of the whole field. */
  focusOnOpen?: boolean;
}

interface Slot {
  id: string;
  /** World point the camera frames when this driver is picked. */
  anchor: THREE.Vector3;
  /** Which side the focus camera swings to, so it frames the car from outside the grid. */
  side: number;
  redrawTag: (selected: boolean, hovered: boolean) => void;
  tag: THREE.Sprite;
  tagScale: THREE.Vector2;
  ring: THREE.Mesh;
}

interface CameraPose {
  target: THREE.Vector3;
  radius: number;
  az: number;
  el: number;
}

interface SceneApi {
  focus: (id: string | null) => void;
  select: (id: string | null) => void;
}

const AMBER = "#f5a623";

function canvasTexture(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext("2d")!, texture };
}

// next/font hashes family names, so the canvas has to ask the page which
// family the CSS variable resolved to rather than naming "Bebas Neue".
function fontFamily(variable: string, fallback: string): string {
  const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

interface TagContent {
  code: string;
  topLine: string;
  bottomLine: string;
  number: string;
  primary: string;
  secondary: string;
  initials: string;
}

/** The floating name plate over each car or plinth — broadcast timing-tower
 * styling: team bar, headshot, three-letter code, number. */
function makeTag(content: TagContent, photoUrl: string | null, fonts: { display: string; mono: string }) {
  const W = 512;
  const H = 160;
  const { ctx, texture } = canvasTexture(W, H);
  let photo: HTMLImageElement | null = null;
  let state = { selected: false, hovered: false };

  const draw = () => {
    const { selected, hovered } = state;
    ctx.clearRect(0, 0, W, H);
    roundRect(ctx, 6, 6, W - 12, H - 12, 24);
    ctx.fillStyle = selected ? "rgba(20,17,10,0.94)" : "rgba(10,12,14,0.88)";
    ctx.fill();
    ctx.lineWidth = selected ? 6 : 3;
    ctx.strokeStyle = selected ? AMBER : hovered ? "rgba(244,239,230,0.55)" : "rgba(244,239,230,0.16)";
    ctx.stroke();

    ctx.save();
    roundRect(ctx, 6, 6, W - 12, H - 12, 24);
    ctx.clip();
    ctx.fillStyle = content.primary;
    ctx.fillRect(6, 6, 14, H - 12);
    ctx.restore();

    const cx = 98;
    const cy = H / 2;
    const r = 52;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = content.primary;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (photo) {
      const scale = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
      const w = photo.width * scale;
      const h = photo.height * scale;
      ctx.fillStyle = "#1a1e22";
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.drawImage(photo, cx - w / 2, cy - r, w, h);
    } else {
      const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      g.addColorStop(0, content.primary);
      g.addColorStop(1, content.secondary);
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = inkForAccent(content.primary);
      ctx.font = `700 40px ${fonts.mono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(content.initials, cx, cy + 2);
    }
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = selected ? AMBER : "rgba(244,239,230,0.6)";
    ctx.font = `600 22px ${fonts.mono}`;
    ctx.fillText(content.topLine, 172, 48);
    ctx.fillStyle = "#f4efe6";
    ctx.font = `76px ${fonts.display}`;
    ctx.fillText(content.code, 170, 112);
    ctx.fillStyle = "rgba(244,239,230,0.55)";
    ctx.font = `500 19px ${fonts.mono}`;
    ctx.fillText(content.bottomLine, 172, 140);

    if (content.number) {
      ctx.textAlign = "right";
      ctx.fillStyle = content.primary;
      ctx.globalAlpha = 0.95;
      ctx.font = `92px ${fonts.display}`;
      ctx.fillText(content.number, W - 30, 116);
      ctx.globalAlpha = 1;
    }
    texture.needsUpdate = true;
  };

  if (photoUrl) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      photo = img;
      draw();
    };
    img.src = photoUrl;
  }
  draw();

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 10;

  return {
    sprite,
    redraw: (selected: boolean, hovered: boolean) => {
      if (state.selected === selected && state.hovered === hovered) return;
      state = { selected, hovered };
      draw();
    },
    dispose: () => {
      texture.dispose();
      material.dispose();
    },
  };
}

function radialTexture(inner: string, outer: string) {
  const { canvas, ctx, texture } = canvasTexture(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  texture.needsUpdate = true;
  return texture;
}

function skyTexture() {
  const { ctx, texture } = canvasTexture(4, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#04060a");
  g.addColorStop(0.55, "#0b1119");
  g.addColorStop(0.8, "#1b1a1c");
  g.addColorStop(1, "#2a1f14");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  texture.needsUpdate = true;
  return texture;
}

function labelTexture(text: string, font: string, color: string, width = 256, height = 256) {
  const { ctx, texture } = canvasTexture(width, height);
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 + 6);
  texture.needsUpdate = true;
  return texture;
}

function checkerTexture() {
  const { ctx, texture } = canvasTexture(128, 16);
  for (let x = 0; x < 16; x += 1) {
    for (let y = 0; y < 2; y += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#f2efe8" : "#121417";
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function teamName(driver: Driver): string {
  return teams.find((team) => team.driverIds.includes(driver.id))?.name ?? driver.team;
}

export function DriverGridScene({ drivers, selectedId, onSelect, caption, focusOnOpen = false }: DriverGridSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const builtSelectionRef = useRef<string | null>(null);
  const focusOnOpenRef = useRef(focusOnOpen);
  focusOnOpenRef.current = focusOnOpen;
  const [focused, setFocused] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [failed, setFailed] = useState(false);
  const isHistory = drivers[0]?.era === "sepang-history";

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || drivers.length === 0) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      return;
    }
    setFailed(false);
    setFocused(false);
    const history = drivers[0].era === "sepang-history";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = mount.clientWidth < 640;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.touchAction = "pan-y";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T) => {
      disposables.push(item);
      return item;
    };

    scene.background = track(skyTexture());
    scene.fog = new THREE.Fog(0x0b0f14, history ? 18 : 45, history ? 60 : 170);

    const camera = new THREE.PerspectiveCamera(history ? 38 : 34, mount.clientWidth / mount.clientHeight, 0.1, 400);

    scene.add(new THREE.HemisphereLight(0xbcd0e6, 0x1c1a17, history ? 0.55 : 0.85));
    const key = new THREE.DirectionalLight(0xfff1dc, history ? 1.4 : 2.1);
    key.position.set(30, 40, 30);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8fb8ff, history ? 0.2 : 0.55);
    fill.position.set(-25, 18, -40);
    scene.add(fill);

    const fonts = {
      display: fontFamily("--font-display", "'Bebas Neue', Impact, sans-serif"),
      mono: fontFamily("--font-geist-mono", "ui-monospace, monospace"),
    };

    const slots = new Map<string, Slot>();
    const pickables: THREE.Object3D[] = [];
    const cars: CarRig[] = [];
    const ringGeo = track(new THREE.RingGeometry(1, 1.12, 64));
    const shadowTex = track(radialTexture("rgba(0,0,0,0.7)", "rgba(0,0,0,0)"));
    const shadowMat = track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    const pickMat = track(new THREE.MeshBasicMaterial({ visible: false }));

    let overview: CameraPose;

    if (!history) {
      // ---- the start straight ------------------------------------------
      const length = drivers.length * GRID_SPACING_M + 90;
      const midZ = -length / 2 + 30;
      const asphalt = track(asphaltTexture());
      asphalt.repeat.set(3, length / 5);
      const road = new THREE.Mesh(
        track(new THREE.PlaneGeometry(16, length)),
        track(new THREE.MeshStandardMaterial({ map: asphalt, color: 0x9aa0a8, roughness: 0.92, metalness: 0.02 })),
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, midZ);
      scene.add(road);

      const grass = new THREE.Mesh(
        track(new THREE.PlaneGeometry(400, length + 200)),
        track(new THREE.MeshStandardMaterial({ color: 0x15301d, roughness: 1 })),
      );
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(0, -0.03, midZ);
      scene.add(grass);

      const kerb = track(kerbTexture());
      kerb.center.set(0.5, 0.5);
      kerb.rotation = Math.PI / 2;
      kerb.repeat.set(length / 3, 1);
      const kerbMat = track(new THREE.MeshStandardMaterial({ map: kerb, roughness: 0.8 }));
      const kerbGeo = track(new THREE.PlaneGeometry(1.1, length));
      const lineMat = track(new THREE.MeshStandardMaterial({ color: 0xf2efe8, emissive: 0xf2efe8, emissiveIntensity: 0.12, roughness: 0.7 }));
      const edgeGeo = track(new THREE.PlaneGeometry(0.2, length));
      for (const side of [-1, 1]) {
        const strip = new THREE.Mesh(kerbGeo, kerbMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(side * 8.55, 0.006, midZ);
        scene.add(strip);
        const edge = new THREE.Mesh(edgeGeo, lineMat);
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(side * 7.75, 0.008, midZ);
        scene.add(edge);
      }

      const checker = new THREE.Mesh(
        track(new THREE.PlaneGeometry(15.5, 1.2)),
        track(new THREE.MeshStandardMaterial({ map: track(checkerTexture()), roughness: 0.7 })),
      );
      checker.rotation.x = -Math.PI / 2;
      checker.position.set(0, 0.009, 6.2);
      scene.add(checker);

      // Pit wall on the camera's side, the grandstand across the track as
      // the backdrop the overview shot looks into.
      const wall = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.7, 1.15, length)),
        track(new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.85 })),
      );
      wall.position.set(11.5, 0.575, midZ);
      scene.add(wall);
      const crowd = track(crowdTexture());
      crowd.repeat.set(length / 14, 3);
      const stand = new THREE.Mesh(
        track(new THREE.PlaneGeometry(length, 12)),
        track(new THREE.MeshStandardMaterial({ map: crowd, color: 0x6a6b70, roughness: 0.95 })),
      );
      stand.rotation.set(0, Math.PI / 2, 0);
      stand.rotateX(-0.62);
      stand.position.set(-17.5, 4.2, midZ);
      scene.add(stand);

      // Start gantry with its five (unlit) red lights.
      const steel = track(new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.6, roughness: 0.45 }));
      const postGeo = track(new THREE.BoxGeometry(0.45, 7.2, 0.45));
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, steel);
        post.position.set(side * 9.4, 3.6, 14);
        scene.add(post);
      }
      const beam = new THREE.Mesh(track(new THREE.BoxGeometry(19.3, 1.1, 0.7)), steel);
      beam.position.set(0, 6.9, 14);
      scene.add(beam);
      const podGeo = track(new THREE.CircleGeometry(0.28, 24));
      const podMat = track(new THREE.MeshStandardMaterial({ color: 0x3a0806, emissive: 0xe0301f, emissiveIntensity: 0.35 }));
      for (let i = 0; i < 5; i += 1) {
        const pod = new THREE.Mesh(podGeo, podMat);
        pod.position.set((i - 2) * 1.2, 6.9, 13.62);
        pod.rotation.y = Math.PI;
        scene.add(pod);
      }

      // ---- grid boxes, cars, plates --------------------------------------
      const boxFront = track(new THREE.PlaneGeometry(2.7, 0.18));
      const boxTick = track(new THREE.PlaneGeometry(0.18, 1.3));
      const numberGeo = track(new THREE.PlaneGeometry(1.5, 1.5));

      drivers.forEach((driver, index) => {
        const { x, z } = gridSlot(index);
        const accent = accentForDriver(driver);
        const name = teamName(driver);

        const front = new THREE.Mesh(boxFront, lineMat);
        front.rotation.x = -Math.PI / 2;
        front.position.set(x, 0.01, z + 3.4);
        scene.add(front);
        for (const dx of [-1.26, 1.26]) {
          const tick = new THREE.Mesh(boxTick, lineMat);
          tick.rotation.x = -Math.PI / 2;
          tick.position.set(x + dx, 0.01, z + 2.84);
          scene.add(tick);
        }
        const numberMat = track(
          new THREE.MeshBasicMaterial({
            map: track(labelTexture(String(index + 1), `128px ${fonts.display}`, "rgba(242,239,232,0.85)")),
            transparent: true,
            depthWrite: false,
          }),
        );
        const painted = new THREE.Mesh(numberGeo, numberMat);
        painted.rotation.x = -Math.PI / 2;
        painted.position.set(x + (x > 0 ? 2.3 : -2.3), 0.012, z + 2.6);
        scene.add(painted);

        const car = buildF1Car({
          name,
          primary: accent.primary,
          secondary: accent.secondary,
          accent: inkForAccent(accent.primary),
          number: driver.number !== null ? String(driver.number) : "",
        });
        car.root.position.set(x, 0, z);
        scene.add(car.root);
        cars.push(car);

        const blob = new THREE.Mesh(track(new THREE.PlaneGeometry(2.6, 6.4)), shadowMat);
        blob.rotation.x = -Math.PI / 2;
        blob.position.set(x, 0.011, z + 0.05);
        scene.add(blob);

        const ring = new THREE.Mesh(
          ringGeo,
          track(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false })),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.scale.set(1.6, 3.3, 1);
        ring.position.set(x, 0.013, z + 0.1);
        scene.add(ring);

        const tag = makeTag(
          {
            code: driverCode(driver.name),
            topLine: `P${index + 1}`,
            bottomLine: name.toUpperCase(),
            number: driver.number !== null ? String(driver.number) : "",
            primary: accent.primary,
            secondary: accent.secondary,
            initials: driver.initials,
          },
          photoForDriver(driver.id),
          fonts,
        );
        disposables.push(tag);
        const tagScale = new THREE.Vector2(3.6, 1.125);
        tag.sprite.scale.set(tagScale.x, tagScale.y, 1);
        tag.sprite.position.set(x, 1.55, z - 0.4);
        tag.sprite.userData.driverId = driver.id;
        scene.add(tag.sprite);

        const pick = new THREE.Mesh(track(new THREE.BoxGeometry(2.2, 1.4, 5.8)), pickMat);
        pick.position.set(x, 0.7, z);
        pick.userData.driverId = driver.id;
        scene.add(pick);
        pickables.push(pick, tag.sprite);

        slots.set(driver.id, {
          id: driver.id,
          anchor: new THREE.Vector3(x, 1.2, z - 0.6),
          side: x > 0 ? 1 : -1,
          redrawTag: tag.redraw,
          tag: tag.sprite,
          tagScale,
          ring,
        });
      });

      // From ahead and to the right of pole, looking back down the field.
      overview = {
        target: new THREE.Vector3(0.5, 0.8, -Math.min(drivers.length, 12) * GRID_SPACING_M * 0.36),
        radius: small ? 62 : 50,
        az: small ? 0.26 : 0.34,
        el: 0.27,
      };
    } else {
      // ---- Sepang history: podium plinths on the circuit's outline ------
      const floor = new THREE.Mesh(
        track(new THREE.PlaneGeometry(90, 60)),
        track(new THREE.MeshStandardMaterial({ color: 0x0e1114, roughness: 0.75, metalness: 0.1 })),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(0, 0, -6);
      scene.add(floor);

      // The real Sepang centreline, laid on the floor as a glowing ribbon.
      const pts = circuitCentrelineMetres;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const span = Math.max(maxX - minX, maxY - minY);
      const s = 26 / span;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const flat = pts.map((p) => new THREE.Vector2((p.x - cx) * s, (p.y - cy) * s - 10));
      const positions: number[] = [];
      const half = 0.11;
      for (let i = 0; i <= flat.length; i += 1) {
        const a = flat[(i - 1 + flat.length) % flat.length];
        const b = flat[i % flat.length];
        const c = flat[(i + 1) % flat.length];
        const dir = new THREE.Vector2(c.x - a.x, c.y - a.y).normalize();
        const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(half);
        positions.push(b.x + n.x, 0.012, b.y + n.y, b.x - n.x, 0.012, b.y - n.y);
      }
      const index: number[] = [];
      for (let i = 0; i < flat.length; i += 1) {
        const k = i * 2;
        index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
      const ribbonGeo = track(new THREE.BufferGeometry());
      ribbonGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      ribbonGeo.setIndex(index);
      const ribbon = new THREE.Mesh(
        ribbonGeo,
        track(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })),
      );
      scene.add(ribbon);

      const plinthMat = track(new THREE.MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.45, roughness: 0.38 }));
      const coneGeo = track(new THREE.ConeGeometry(1.7, 9, 32, 1, true));
      drivers.forEach((driver, i) => {
        const plinth = historyPlinth(driver.id, i);
        const accent = accentForDriver(driver);
        const block = new THREE.Mesh(track(new THREE.BoxGeometry(2.1, plinth.height, 2.1)), plinthMat);
        block.position.set(plinth.x, plinth.height / 2, 0);
        scene.add(block);

        const trim = new THREE.Mesh(
          track(new THREE.BoxGeometry(2.14, 0.05, 2.14)),
          track(new THREE.MeshStandardMaterial({ color: accent.primary, emissive: accent.primary, emissiveIntensity: 0.2, roughness: 0.5 })),
        );
        trim.position.set(plinth.x, plinth.height + 0.02, 0);
        scene.add(trim);

        const { ctx, texture } = canvasTexture(512, 256);
        ctx.fillStyle = "#f4efe6";
        ctx.textAlign = "center";
        ctx.font = `150px ${fonts.display}`;
        ctx.fillText(plinth.year, 256, 150);
        ctx.fillStyle = accent.primary;
        ctx.font = `600 34px ${fonts.mono}`;
        ctx.fillText(`${plinth.result} · ${driver.team.toUpperCase()}`, 256, 214);
        texture.needsUpdate = true;
        track(texture);
        const face = new THREE.Mesh(
          track(new THREE.PlaneGeometry(1.9, 0.95)),
          track(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false })),
        );
        face.position.set(plinth.x, Math.min(plinth.height / 2, 0.6), 1.06);
        scene.add(face);

        const cone = new THREE.Mesh(
          coneGeo,
          track(
            new THREE.MeshBasicMaterial({
              color: 0xfff1dc,
              transparent: true,
              opacity: 0.032,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          ),
        );
        cone.position.set(plinth.x, plinth.height + 4.5, 0);
        scene.add(cone);

        const pool = new THREE.Mesh(
          track(new THREE.CircleGeometry(1.9, 48)),
          track(new THREE.MeshBasicMaterial({ map: track(radialTexture("rgba(255,241,220,0.22)", "rgba(255,241,220,0)")), transparent: true, depthWrite: false })),
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(plinth.x, 0.014, 0);
        scene.add(pool);

        const ring = new THREE.Mesh(
          ringGeo,
          track(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false })),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.scale.set(1.75, 1.75, 1);
        ring.position.set(plinth.x, 0.016, 0);
        scene.add(ring);

        const tag = makeTag(
          {
            code: driverCode(driver.name),
            topLine: `SEPANG ${plinth.year} · ${plinth.result}`,
            bottomLine: driver.team.toUpperCase(),
            number: driver.number !== null ? String(driver.number) : "",
            primary: accent.primary,
            secondary: accent.secondary,
            initials: driver.initials,
          },
          photoForDriver(driver.id),
          fonts,
        );
        disposables.push(tag);
        const tagScale = new THREE.Vector2(3.0, 0.94);
        tag.sprite.scale.set(tagScale.x, tagScale.y, 1);
        tag.sprite.position.set(plinth.x, plinth.height + 0.25, 0);
        tag.sprite.userData.driverId = driver.id;
        scene.add(tag.sprite);

        block.userData.driverId = driver.id;
        pickables.push(block, tag.sprite);
        slots.set(driver.id, {
          id: driver.id,
          anchor: new THREE.Vector3(plinth.x, plinth.height + 0.8, 0),
          side: plinth.x > 0 ? 1 : -1,
          redrawTag: tag.redraw,
          tag: tag.sprite,
          tagScale,
          ring,
        });
      });

      overview = { target: new THREE.Vector3(-1.3, 1.4, -1), radius: small ? 19.5 : 14.5, az: 0.08, el: 0.2 };
    }

    // ---- camera: damped orbit around a goal pose ---------------------------
    const goal: CameraPose = { target: overview.target.clone(), radius: overview.radius, az: overview.az, el: overview.el };
    const cam: CameraPose = {
      target: overview.target.clone(),
      radius: overview.radius * (reduceMotion ? 1 : 1.35),
      az: overview.az + (reduceMotion ? 0 : 0.35),
      el: overview.el + (reduceMotion ? 0 : 0.12),
    };
    let baseAz = goal.az;
    let lastInput = -Infinity;

    const applyCamera = () => {
      const r = cam.radius;
      camera.position.set(
        cam.target.x + r * Math.cos(cam.el) * Math.sin(cam.az),
        cam.target.y + r * Math.sin(cam.el),
        cam.target.z + r * Math.cos(cam.el) * Math.cos(cam.az),
      );
      camera.lookAt(cam.target);
    };
    applyCamera();

    const focus = (id: string | null) => {
      const slot = id ? slots.get(id) : undefined;
      if (!slot) {
        goal.target.copy(overview.target);
        goal.radius = overview.radius;
        goal.az = overview.az;
        goal.el = overview.el;
        setFocused(false);
      } else {
        goal.target.copy(slot.anchor);
        goal.radius = history ? (small ? 8.5 : 7) : small ? 15 : 12;
        goal.az = history ? slot.side * 0.18 : slot.side * 0.72;
        goal.el = history ? 0.16 : 0.28;
        setFocused(true);
      }
      baseAz = goal.az;
      if (reduceMotion) {
        cam.target.copy(goal.target);
        cam.radius = goal.radius;
        cam.az = goal.az;
        cam.el = goal.el;
      }
    };

    let hoveredId: string | null = null;
    const refreshTags = () => {
      slots.forEach((slot) => {
        const selected = slot.id === selectedRef.current;
        slot.redrawTag(selected, slot.id === hoveredId);
        const grow = selected ? 1.18 : slot.id === hoveredId ? 1.06 : 1;
        slot.tag.scale.set(slot.tagScale.x * grow, slot.tagScale.y * grow, 1);
        (slot.tag.material as THREE.SpriteMaterial).opacity = selected || slot.id === hoveredId ? 1 : 0.9;
      });
    };
    refreshTags();

    apiRef.current = {
      focus,
      select: () => refreshTags(),
    };
    builtSelectionRef.current = selectedRef.current;
    if (focusOnOpenRef.current && selectedRef.current) focus(selectedRef.current);

    // ---- input ------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false;
    let downAt = { x: 0, y: 0 };
    let last = { x: 0, y: 0 };
    let moved = 0;

    const pick = (event: PointerEvent | MouseEvent): string | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      return (hit?.object.userData.driverId as string | undefined) ?? null;
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      moved = 0;
      downAt = { x: event.clientX, y: event.clientY };
      last = downAt;
      lastInput = performance.now();
      setInteracted(true);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragging) {
        const dx = event.clientX - last.x;
        const dy = event.clientY - last.y;
        last = { x: event.clientX, y: event.clientY };
        moved += Math.abs(dx) + Math.abs(dy);
        goal.az -= dx * 0.006;
        baseAz = goal.az;
        // Touch keeps vertical for page scroll (touch-action: pan-y).
        if (event.pointerType === "mouse") goal.el = THREE.MathUtils.clamp(goal.el + dy * 0.004, 0.06, 1.2);
        lastInput = performance.now();
        if (moved > 4 && event.pointerType === "mouse") renderer.domElement.setPointerCapture(event.pointerId);
        return;
      }
      if (event.pointerType !== "mouse") return;
      const id = pick(event);
      if (id !== hoveredId) {
        hoveredId = id;
        renderer.domElement.style.cursor = id ? "pointer" : "grab";
        refreshTags();
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch {
        // not captured
      }
      const dx = event.clientX - downAt.x;
      const dy = event.clientY - downAt.y;
      if (dx * dx + dy * dy > 49) return;
      const id = pick(event);
      if (id) onSelectRef.current(id);
    };
    const onPointerLeave = () => {
      if (hoveredId) {
        hoveredId = null;
        refreshTags();
      }
    };

    const el = renderer.domElement;
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", () => (dragging = false));
    el.addEventListener("pointerleave", onPointerLeave);

    const resize = new ResizeObserver(() => {
      if (mount.clientWidth === 0 || mount.clientHeight === 0) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });
    resize.observe(mount);

    // Only spend frames while the scene is actually on screen.
    let visible = true;
    const clock = new THREE.Clock();
    let frameId = 0;
    const animate = () => {
      if (!visible || document.hidden) {
        frameId = 0;
        return;
      }
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      if (!reduceMotion && !dragging && performance.now() - lastInput > 3500) {
        goal.az = baseAz + Math.sin(t * 0.12) * (history ? 0.22 : 0.16);
      }
      const k = 1 - Math.exp(-dt * (dragging ? 10 : 2.6));
      cam.target.lerp(goal.target, k);
      cam.radius += (goal.radius - cam.radius) * k;
      cam.az += (goal.az - cam.az) * k;
      cam.el += (goal.el - cam.el) * k;
      applyCamera();

      slots.forEach((slot) => {
        const mat = slot.ring.material as THREE.MeshBasicMaterial;
        const on = slot.id === selectedRef.current;
        mat.opacity += ((on ? 0.55 + Math.sin(t * 3.2) * 0.25 : 0) - mat.opacity) * 0.2;
        if (history) slot.tag.position.y = slot.anchor.y - 0.55 + (on && !reduceMotion ? Math.sin(t * 2) * 0.05 : 0);
      });
      renderer.render(scene, camera);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frameId) frameId = requestAnimationFrame(animate);
    });
    io.observe(mount);
    const onVisibility = () => {
      if (!document.hidden && visible && !frameId) frameId = requestAnimationFrame(animate);
    };
    document.addEventListener("visibilitychange", onVisibility);
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      frameId = -1;
      io.disconnect();
      resize.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      apiRef.current = null;
      cars.forEach((car) => car.dispose());
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      if (el.parentElement === mount) mount.removeChild(el);
    };
  }, [drivers]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.select(selectedId);
    // The selection the scene was built with is the page's default, not a
    // pick — only fly the camera for choices made afterwards.
    if (selectedId && selectedId !== builtSelectionRef.current) {
      builtSelectionRef.current = null;
      api.focus(selectedId);
    }
  }, [selectedId]);

  return (
    <div
      className="relative h-[62vw] max-h-[520px] min-h-[300px] w-full overflow-hidden rounded-lg border border-paper/10 bg-[#080a0c] sm:h-[420px] lg:h-[460px]"
      role="group"
      aria-label={
        isHistory
          ? "3D podium plinths for the Sepang history drivers, set on the circuit's outline. Drag to orbit; tap a driver to select them."
          : "3D start-grid view of the 2026 field in team liveries. Drag to orbit; tap a car to select that driver."
      }
    >
      <div ref={mountRef} className="absolute inset-0" />
      {failed ? (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-paper-dim">
          3D view unavailable on this device — the list below has every driver.
        </p>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/55 to-transparent p-3">
        {caption ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/80">{caption}</p>
        ) : (
          <span />
        )}
        {focused ? (
          <button
            type="button"
            onClick={() => apiRef.current?.focus(null)}
            className="pointer-events-auto shrink-0 rounded-full border border-paper/20 bg-black/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper backdrop-blur transition-colors hover:border-amber hover:text-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
          >
            {isHistory ? "All three" : "Whole grid"}
          </button>
        ) : null}
      </div>
      {!interacted && !failed ? (
        <p className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-paper/70 backdrop-blur">
          Drag to orbit · tap a {isHistory ? "driver" : "car"}
        </p>
      ) : null}
    </div>
  );
}
