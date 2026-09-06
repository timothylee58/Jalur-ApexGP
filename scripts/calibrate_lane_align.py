#!/usr/bin/env python3
"""Offline grid search for terrain registration knobs (dev server on :3000)."""

import asyncio
import json
import math
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SEPANG = json.loads((ROOT / "frontend/data/sepang.json").read_text())

LAT0 = SEPANG["points"][0]["lat"]
LON0 = SEPANG["points"][0]["lon"]
M_PER_DEG_LAT = 110540
M_PER_DEG_LON = 111320 * math.cos(LAT0 * math.pi / 180)

PROJECTED = [
    {
        "x": (p["lon"] - LON0) * M_PER_DEG_LON,
        "z": -(p["lat"] - LAT0) * M_PER_DEG_LAT,
    }
    for p in SEPANG["points"]
]
xs = [p["x"] for p in PROJECTED]
zs = [p["z"] for p in PROJECTED]
cx = (min(xs) + max(xs)) / 2
cz = (min(zs) + max(zs)) / 2
span = max(max(xs) - min(xs), max(zs) - min(zs)) or 1
scene_scale = 6 / span
RIBBON_RAW = [{"x": (p["x"] - cx) * scene_scale, "z": (p["z"] - cz) * scene_scale} for p in PROJECTED]
N = len(RIBBON_RAW)


def _catmull(p0, p1, p2, p3, t):
    t2 = t * t
    t3 = t2 * t
    return {
        "x": 0.5
        * (
            (2 * p1["x"])
            + (-p0["x"] + p2["x"]) * t
            + (2 * p0["x"] - 5 * p1["x"] + 4 * p2["x"] - p3["x"]) * t2
            + (-p0["x"] + 3 * p1["x"] - 3 * p2["x"] + p3["x"]) * t3
        ),
        "z": 0.5
        * (
            (2 * p1["z"])
            + (-p0["z"] + p2["z"]) * t
            + (2 * p0["z"] - 5 * p1["z"] + 4 * p2["z"] - p3["z"]) * t2
            + (-p0["z"] + 3 * p1["z"] - 3 * p2["z"] + p3["z"]) * t3
        ),
    }


def build_ribbon_samples(segments: int = 240) -> list[dict[str, float]]:
    samples = []
    for i in range(segments):
        u = i / segments * N
        seg = int(math.floor(u)) % N
        t = u - math.floor(u)
        p0 = RIBBON_RAW[(seg - 1) % N]
        p1 = RIBBON_RAW[seg % N]
        p2 = RIBBON_RAW[(seg + 1) % N]
        p3 = RIBBON_RAW[(seg + 2) % N]
        samples.append(_catmull(p0, p1, p2, p3, t))
    return samples


RIBBON = build_ribbon_samples(240)

CALIB_JS = """
async (ribbon) => {
  const THREE = await import("https://esm.sh/three@0.174.0");
  const { DRACOLoader } = await import(
    "https://esm.sh/three@0.174.0/examples/jsm/loaders/DRACOLoader.js?deps=three@0.174.0",
  );
  const { GLTFLoader } = await import(
    "https://esm.sh/three@0.174.0/examples/jsm/loaders/GLTFLoader.js?deps=three@0.174.0",
  );

  const isAsphalt = (c) => {
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    const mean = (c.r + c.g + c.b) / 3;
    return mean > 35 && mean < 135 && max - min < 28;
  };

  const sampleMapRgb = (map, u, v, cache) => {
    let entry = cache.get(map);
    if (!entry) {
      const img = map.image;
      if (!img?.width || !img?.height) return null;
      const w = Math.min(img.width, 256);
      const h = Math.min(img.height, 256);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      entry = { w, h, data: ctx.getImageData(0, 0, w, h).data };
      cache.set(map, entry);
    }
    const x = Math.floor((((u % 1) + 1) % 1) * (entry.w - 1));
    const y = Math.floor((1 - (((v % 1) + 1) % 1)) * (entry.h - 1));
    const i = (y * entry.w + x) * 4;
    return { r: entry.data[i], g: entry.data[i + 1], b: entry.data[i + 2] };
  };

  const sampleAsphalt = (terrain) => {
    terrain.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const cache = new Map();
    const points = [];
    terrain.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || child.name.startsWith("Palm")) return;
      const pos = child.geometry.getAttribute("position");
      const uv = child.geometry.getAttribute("uv");
      if (!uv) return;
      const mat = Array.isArray(child.material) ? child.material[0] : child.material;
      if (!mat?.map) return;
      const step = Math.max(1, Math.floor(pos.count / 6000));
      for (let i = 0; i < pos.count; i += step) {
        const rgb = sampleMapRgb(mat.map, uv.getX(i), uv.getY(i), cache);
        if (!rgb || !isAsphalt(rgb)) continue;
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
        points.push({ x: v.x, z: v.z });
      }
    });
    return points;
  };

  const planarPCA = (points) => {
    let sx = 0;
    let sz = 0;
    for (const p of points) {
      sx += p.x;
      sz += p.z;
    }
    const n = points.length;
    const mx = sx / n;
    const mz = sz / n;
    let cxx = 0;
    let czz = 0;
    let cxz = 0;
    for (const p of points) {
      const dx = p.x - mx;
      const dz = p.z - mz;
      cxx += dx * dx;
      czz += dz * dz;
      cxz += dx * dz;
    }
    cxx /= n;
    czz /= n;
    cxz /= n;
    const trace = cxx + czz;
    const det = cxx * czz - cxz * cxz;
    const l1 = trace / 2 + Math.sqrt(Math.max(trace * trace / 4 - det, 0));
    const angle = cxz !== 0 ? Math.atan2(l1 - cxx, cxz) : cxx >= czz ? 0 : Math.PI / 2;
    return { mean: { x: mx, z: mz }, majorStd: Math.sqrt(l1), majorAngle: angle };
  };

  const meshPCA = (root) => {
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    const pts = [];
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || child.name.startsWith("Palm")) return;
      const pos = child.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
        pts.push({ x: v.x, z: v.z });
      }
    });
    return planarPCA(pts);
  };

  const nearest = (asphalt, query, cell = 0.07) => {
    const grid = new Map();
    const key = (ix, iz) => `${ix},${iz}`;
    for (const p of asphalt) {
      const ix = Math.floor(p.x / cell);
      const iz = Math.floor(p.z / cell);
      const k = key(ix, iz);
      (grid.get(k) ?? grid.set(k, []).get(k)).push(p);
    }
    const ix = Math.floor(query.x / cell);
    const iz = Math.floor(query.z / cell);
    let best = Infinity;
    let hit = null;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const bucket = grid.get(key(ix + dx, iz + dz));
        if (!bucket) continue;
        for (const p of bucket) {
          const d = (query.x - p.x) ** 2 + (query.z - p.z) ** 2;
          if (d < best) {
            best = d;
            hit = p;
          }
        }
      }
    }
    return hit;
  };

  const meanDist = (ribbonPts, asphalt) => {
    let t = 0;
    let n = 0;
    for (const r of ribbonPts) {
      const h = nearest(asphalt, r);
      if (!h) continue;
      t += Math.hypot(r.x - h.x, r.z - h.z);
      n++;
    }
    return n ? t / n : Infinity;
  };

  const refine = (ribbonPts, asphalt, iters = 5) => {
    const shifted = asphalt.map((p) => ({ x: p.x, z: p.z }));
    for (let iter = 0; iter < iters; iter++) {
      let sx = 0;
      let sz = 0;
      let n = 0;
      for (const r of ribbonPts) {
        const h = nearest(shifted, r);
        if (!h) continue;
        sx += r.x - h.x;
        sz += r.z - h.z;
        n++;
      }
      if (n < ribbonPts.length * 0.5) break;
      const ox = sx / n;
      const oz = sz / n;
      if (Math.abs(ox) < 1e-4 && Math.abs(oz) < 1e-4) break;
      for (const p of shifted) {
        p.x += ox;
        p.z += oz;
      }
    }
    return shifted;
  };

  const alignCentroid = (ribbonPts, asphalt) => {
    let ax = 0;
    let az = 0;
    for (const p of asphalt) {
      ax += p.x;
      az += p.z;
    }
    ax /= asphalt.length;
    az /= asphalt.length;
    let rx = 0;
    let rz = 0;
    for (const p of ribbonPts) {
      rx += p.x;
      rz += p.z;
    }
    rx /= ribbonPts.length;
    rz /= ribbonPts.length;
    const ox = rx - ax;
    const oz = rz - az;
    for (const p of asphalt) {
      p.x += ox;
      p.z += oz;
    }
  };

  const transformAsphalt = (local, knobs, ctx) => {
    const scale = (ctx.ribbonPCA.majorStd / ctx.terrainPCA.majorStd) * knobs.scaleMultiplier;
    const mirror = knobs.mirrorX ? -1 : 1;
    const cos = Math.cos(knobs.rotationRad);
    const sin = Math.sin(knobs.rotationRad);
    const tx =
      ctx.ribbonPCA.mean.x -
      (ctx.terrainPCA.mean.x * scale * mirror * cos - ctx.terrainPCA.mean.z * scale * sin);
    const tz =
      ctx.ribbonPCA.mean.z -
      (ctx.terrainPCA.mean.x * scale * mirror * sin + ctx.terrainPCA.mean.z * scale * cos);
    return local.map((p) => {
      const sx = p.x * scale * mirror;
      const sz = p.z * scale;
      return { x: sx * cos - sz * sin + tx, z: sx * sin + sz * cos + tz };
    });
  };

  const score = (ribbonPts, local, ctx, knobs) => {
    const asphalt = transformAsphalt(local, knobs, ctx);
    alignCentroid(ribbonPts, asphalt);
    return meanDist(ribbonPts, refine(ribbonPts, asphalt));
  };

  const draco = new DRACOLoader();
  draco.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  const gltf = await new Promise((resolve, reject) =>
    loader.load("/models/sepang.glb", resolve, undefined, reject),
  );
  const terrain = gltf.scene;

  const terrainPCA = meshPCA(terrain);
  const localAsphalt = sampleAsphalt(terrain);
  const ribbonPCA = planarPCA(ribbon);
  const ctx = { terrainPCA, ribbonPCA };

  const seed = { rotationRad: (-28.1 * Math.PI) / 180, scaleMultiplier: 0.65, mirrorX: false };
  const rotStep = (2.5 * Math.PI) / 180;
  const rotSpan = (12 * Math.PI) / 180;
  const scaleFactors = [0.85, 0.92, 1, 1.08, 1.15];

  let best = { ...seed, error: Infinity };
  for (const mirrorX of [false, true]) {
    for (let rot = seed.rotationRad - rotSpan; rot <= seed.rotationRad + rotSpan; rot += rotStep) {
      for (const sf of scaleFactors) {
        const knobs = { rotationRad: rot, scaleMultiplier: seed.scaleMultiplier * sf, mirrorX };
        const err = score(ribbon, localAsphalt, ctx, knobs);
        if (err < best.error) best = { ...knobs, error: err };
      }
    }
  }

  return {
    rotationDeg: (best.rotationRad * 180) / Math.PI,
    scaleMultiplier: best.scaleMultiplier,
    mirrorX: best.mirrorX,
    error: best.error,
    asphaltSamples: localAsphalt.length,
    seedError: score(ribbon, localAsphalt, ctx, seed),
  };
}
"""


async def main() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--use-angle=swiftshader", "--disable-dev-shm-usage"],
        )
        page = await browser.new_page()
        await page.goto("http://127.0.0.1:3000/", wait_until="domcontentloaded", timeout=60_000)
        result = await page.evaluate(CALIB_JS, RIBBON)
        await browser.close()
    print(json.dumps(result, indent=2))
    if result["error"] > 0.05:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())
