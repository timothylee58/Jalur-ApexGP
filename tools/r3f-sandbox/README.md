# R3F sandbox

A dev-only Vite + React Three Fiber app for iterating on this project's 3D
scenes against the real, production assets — without the Next.js
edit → build → restart → screenshot loop those scenes would otherwise need.
**Not deployed** and not linked from the production app; it exists purely
as a faster workbench for tuning the two scenes below.

## Run it

```
npm install
npm run dev
```

## Scenes

- **Orbit Sepang** — live-tunable port of
  `frontend/components/hero/CircuitModelPreview.tsx`'s landing-page model:
  target display size, ground-shadow margin, lighting, auto-rotate speed.
- **Circuit explorer** — live-tunable port of
  `frontend/components/circuit/CircuitExplorer3D.tsx`'s racing-line +
  terrain overlay: ribbon width/color/opacity, and the terrain
  registration knobs (`rotationDeg`, `mirrorX`, `scaleMultiplier`,
  `offsetX`/`offsetZ`, `yOffset`) that align the real terrain scan against
  the real apex-point centreline — see `src/lib/pca.ts` and that
  production component's own comments for how and why. **This is where
  that registration was actually derived**: PCA (`src/lib/pca.ts`) gives a
  rotation candidate and a scale, but a major axis has no inherent
  direction (so the true rotation is that candidate or candidate−180°)
  and PCA can't rule out mirrored handedness either — both were resolved
  here by dragging the sliders against the live render and eyeballing
  which one actually traced the terrain's real track path, not derived
  algebraically. If the terrain model or the real apex data
  (`frontend/data/sepang.json`) ever changes, re-do that check here before
  trusting the production constants (`TERRAIN_ROTATION_OFFSET_RAD`,
  `TERRAIN_SCALE_CORRECTION`) again.
- **Calibrate terrain** — a one-off diagnostic used while deriving the
  above: renders the terrain at identity transform from a straight-down
  orthographic camera, reports world (x,z) under the mouse on hover, and
  logs a PCA fit to the console. Not needed for routine tuning of the
  other two scenes; kept in case the registration ever needs re-deriving
  from scratch.

## How it reaches the real assets

`public/models` and `public/draco` are symlinks into `frontend/public/`,
and `src/data/sepang.json` symlinks to `frontend/data/sepang.json` — this
sandbox always tunes against whatever the production app currently ships,
never a stale copy. `src/lib/circuitTrack.ts` is a from-scratch port of
`frontend/lib/circuitFlyoverTrack.ts` + the lat/lon projection in
`frontend/data/sepangCircuit.ts` (re-implemented here rather than
imported, since pulling in the Next app's `@/` path aliases wasn't worth
it for two small pure functions) — if that production projection logic
ever changes, re-port it here too.

## Porting a tuned value back

Nothing here writes back to the Next app automatically. Once a slider
value looks right, copy it into the matching constant/prop in the
production component by hand, then verify it there too — the two apps'
camera/lighting setups differ enough that "looks right here" is a
starting point, not a guarantee.

`three` is pinned here to match `frontend/package.json` exactly. That
turned out not to matter for the one thing it was suspected of during
this sandbox's build (`sepang.glb`'s decoded vertex coordinates come out
at a different absolute scale than the file's own declared accessor
bounds — confirmed unrelated to the `three` version, still unexplained,
and harmless in practice since every measurement this sandbox takes
reads the actually-loaded geometry rather than assuming it matches the
file's declared bounds) — kept pinned anyway since there's no reason for
the two apps to drift apart on it.
