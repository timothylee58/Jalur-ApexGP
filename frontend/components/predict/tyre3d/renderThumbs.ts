import { COMPOUNDS, type Compound } from "@/types";
import { buildTyre } from "./buildTyre";
import { createRenderer, createStage } from "./stage";

export type Thumbs = Record<Compound, string>;

export function renderThumbs(size: number): Thumbs | null {
  const renderer = createRenderer(undefined, true);
  if (!renderer) return null;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  const stage = createStage(renderer);
  stage.camera.aspect = 1;
  // Tighter than the showcase: a thumbnail is all tyre, no stage.
  stage.camera.fov = 25;
  stage.camera.updateProjectionMatrix();

  const out = {} as Thumbs;
  for (const compound of COMPOUNDS) {
    const tyre = buildTyre(compound);
    // A quarter-turn so the lettering sits where the eye lands.
    tyre.wheel.rotation.z = -0.35;
    stage.scene.add(tyre.root);
    renderer.render(stage.scene, stage.camera);
    out[compound] = renderer.domElement.toDataURL("image/webp", 0.9);
    stage.scene.remove(tyre.root);
    tyre.dispose();
  }
  stage.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
