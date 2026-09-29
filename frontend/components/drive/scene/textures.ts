import * as THREE from "three";

/**
 * Every texture /drive uses, drawn on canvases at start-up: no image
 * downloads, and each one is tuned to read at racing speed rather than up
 * close. Callers own disposal (they're returned, not cached).
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

// Deterministic noise, so the track looks the same on every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function finish(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Asphalt: fine aggregate speckle over a slightly mottled grey, with a
 * darker rubbered-in band where the racing line runs. */
export function asphaltTexture() {
  const { c, g } = canvas(512, 512);
  const r = rng(7);
  g.fillStyle = "#3a3d41";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i += 1) {
    const v = 40 + r() * 50;
    g.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.35 + r() * 0.4})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 1.6, 1 + r() * 1.6);
  }
  // Rubber laid down along the racing line (the texture's middle).
  const band = g.createLinearGradient(0, 0, 512, 0);
  band.addColorStop(0, "rgba(0,0,0,0)");
  band.addColorStop(0.36, "rgba(8,8,10,0.28)");
  band.addColorStop(0.5, "rgba(8,8,10,0.34)");
  band.addColorStop(0.64, "rgba(8,8,10,0.28)");
  band.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = band;
  g.fillRect(0, 0, 512, 512);
  return finish(c);
}

/** Gravel trap: pale stones and their shadows. */
export function gravelTexture() {
  const { c, g } = canvas(256, 256);
  const r = rng(17);
  g.fillStyle = "#c8b28a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i += 1) {
    const light = 48 + r() * 30;
    g.fillStyle = `hsla(${36 + r() * 10}, ${18 + r() * 14}%, ${light}%, ${0.5 + r() * 0.5})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  return finish(c);
}

/** Tropical grass with faint mowing stripes. */
export function grassTexture() {
  const { c, g } = canvas(512, 512);
  const r = rng(11);
  g.fillStyle = "#4f7a2c";
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 64) {
    g.fillStyle = (y / 64) % 2 === 0 ? "rgba(255,255,220,0.035)" : "rgba(0,20,0,0.05)";
    g.fillRect(0, y, 512, 64);
  }
  for (let i = 0; i < 30000; i += 1) {
    const hue = 78 + r() * 34;
    const light = 22 + r() * 22;
    g.fillStyle = `hsla(${hue},${45 + r() * 25}%,${light}%,${0.25 + r() * 0.35})`;
    g.fillRect(r() * 512, r() * 512, 1, 2 + r() * 3);
  }
  return finish(c);
}

/** Kerb: red and white blocks, one pair per texture repeat. */
export function kerbTexture() {
  const { c, g } = canvas(64, 16);
  g.fillStyle = "#d42b20";
  g.fillRect(0, 0, 32, 16);
  g.fillStyle = "#f2efe8";
  g.fillRect(32, 0, 32, 16);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(0, 13, 64, 3);
  return finish(c);
}

/** Spectators: packed specks of shirt colour over dark seating. */
export function crowdTexture() {
  const { c, g } = canvas(512, 256);
  const r = rng(23);
  g.fillStyle = "#1c1f24";
  g.fillRect(0, 0, 512, 256);
  const shirts = ["#e8e2d6", "#d6312a", "#f5a623", "#2e6fd8", "#1e8f4e", "#f4d03f", "#ff8000", "#101214", "#8f1d2c", "#27f4d2"];
  for (let row = 0; row < 256; row += 8) {
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(0, row + 7, 512, 1);
    for (let x = 0; x < 512; x += 3 + r() * 2) {
      if (r() < 0.12) continue;
      g.fillStyle = shirts[Math.floor(r() * shirts.length)];
      g.fillRect(x, row + 2 + r() * 2, 2.2, 3.4);
      g.fillStyle = `rgba(${150 + r() * 60},${110 + r() * 50},${80 + r() * 40},1)`;
      g.fillRect(x + 0.4, row + 0.6, 1.4, 1.6);
    }
  }
  return finish(c);
}

/** One palm frond: a midrib with leaflets, alpha-cut. */
export function frondTexture() {
  const { c, g } = canvas(256, 64);
  g.clearRect(0, 0, 256, 64);
  g.strokeStyle = "#6f7a3a";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 32);
  g.lineTo(256, 32);
  g.stroke();
  for (let x = 6; x < 250; x += 5) {
    const reach = 30 * Math.sin((x / 256) * Math.PI) * 0.95 + 2;
    const tone = 30 + Math.sin(x) * 6;
    g.strokeStyle = `hsl(${92 + (x % 3) * 4}, 48%, ${tone}%)`;
    g.lineWidth = 2.4;
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(x, 32);
      g.quadraticCurveTo(x + 6, 32 + dir * reach * 0.6, x + 12, 32 + dir * reach);
      g.stroke();
    }
  }
  return finish(c, false);
}

/** A text board (braking markers, hoardings, decals). */
export function textTexture(
  text: string,
  { w = 512, h = 128, bg = "#f4efe6", fg = "#0a0c0e", font = "700 88px 'Helvetica Neue', Arial, sans-serif" } = {},
) {
  const { c, g } = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 4);
  return finish(c, false);
}

/** Wheel face: dark rim with ten spokes and a centre lock; `blurred` is
 * the same wheel smeared by rotation, crossfaded in at speed so the
 * spokes don't strobe. */
export function rimTexture(blurred: boolean) {
  const { c, g } = canvas(256, 256);
  g.clearRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.fillStyle = "#1a1d21";
  g.beginPath();
  g.arc(0, 0, 124, 0, Math.PI * 2);
  g.fill();
  if (blurred) {
    const rings = g.createRadialGradient(0, 0, 10, 0, 0, 124);
    rings.addColorStop(0, "#4a4f55");
    rings.addColorStop(0.25, "#2c3035");
    rings.addColorStop(0.6, "#3a3f45");
    rings.addColorStop(0.9, "#23272b");
    rings.addColorStop(1, "#15181b");
    g.fillStyle = rings;
    g.beginPath();
    g.arc(0, 0, 120, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = "#555b62";
    g.lineWidth = 12;
    g.lineCap = "round";
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 22, Math.sin(a) * 22);
      g.lineTo(Math.cos(a + 0.18) * 112, Math.sin(a + 0.18) * 112);
      g.stroke();
    }
    g.strokeStyle = "#2a2e33";
    g.lineWidth = 8;
    g.beginPath();
    g.arc(0, 0, 114, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#c9a227";
  g.beginPath();
  g.arc(0, 0, 16, 0, Math.PI * 2);
  g.fill();
  return finish(c, false);
}

/** Soft round glow for lamps and brake discs (additive sprites). */
export function glowTexture() {
  const { c, g } = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return finish(c, false, false);
}

/** Pit garages: a row of lit bays between concrete pillars. */
export function garageTexture() {
  const { c, g } = canvas(1024, 128);
  const r = rng(31);
  g.fillStyle = "#d8d4cc";
  g.fillRect(0, 0, 1024, 128);
  const teams = ["#ff8000", "#dc0000", "#27f4d2", "#1e2b58", "#229971", "#0093cc", "#64c4ff", "#b6babd", "#6692ff", "#52e252", "#c8102e"];
  for (let i = 0; i < 16; i += 1) {
    const x = 8 + i * 64;
    g.fillStyle = "#101316";
    g.fillRect(x, 26, 52, 102);
    g.fillStyle = teams[Math.floor(r() * teams.length)];
    g.fillRect(x, 26, 52, 8);
    g.fillStyle = "rgba(255,244,214,0.18)";
    g.fillRect(x + 4, 40, 44, 50);
  }
  return finish(c);
}
