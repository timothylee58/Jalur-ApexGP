# 3D models

`sepang.glb` (served at `/models/sepang.glb`) and `car.glb` are
**procedurally generated** by `scripts/generate_circuit_models.py`
(regenerate with `python scripts/generate_circuit_models.py`).
`sepang.glb` is a spline-swept track *slab* — a real extrusion (top +
two side walls + bottom), not a flat zero-thickness plane — projected
from the circuit's own 18-point apex + elevation data (the same
centreline as `scripts/blender/sepang_circuit_scene.py` and
`frontend/data/sepangCircuit.ts`), so its shape and ~22&nbsp;m elevation
change are real (vertical exaggerated ~6× for readability), not a
traced-by-eye loop. The top face's normals follow the actual 3D tangent
rather than a hardcoded straight-up vector, so a directional light
visibly shades the climbs/descents instead of lighting the whole loop
identically; the top (road) and walls/bottom use two different vertex
colors so the ribbon reads as a raised shape even before lighting. Both
`sepang.glb` and the client-side scene in `CircuitModelPreview.tsx`
matter for how this actually looks — the component overrides the
mesh's material on load (see the comment there) since three.js's
`GLTFLoader` default material for a mesh with no material index
(`metalness:1, roughness:1`) reads as flat and washed-out under this
scene's lighting. `car.glb` is box/cylinder primitives, no scanned or
reference geometry.
`sepang.glb` powers the landing page's "Orbit Sepang" stage
(`CircuitModelPreview.tsx`, which auto-detects it and otherwise links to
the procedural `/circuit` explorer); `car.glb` runs a lap of that
explorer's own traced curve (`CircuitExplorer3D.tsx`), and separately
loops the real apex-point centreline (`lib/circuitFlyoverTrack.ts`) in the
landing hero's opt-in "3D flyover" toggle (`CircuitFlyoverHero.tsx`) — two
different curves, so the car's lap shape differs slightly between the two.
The car is deliberately unbranded — no team livery, no sponsor marks, no
race number, per docs/BRAND.md.

A much higher-fidelity Blender-based generator also exists at
`scripts/blender/sepang_circuit_scene.py` — now actually run and debugged
(see `scripts/blender/README.md` for what was found and fixed), but still
an optional alternative path, not currently wired into either file below;
its environment/architecture detail hasn't been checked against real
reference photos of the venue yet.

To replace either with a hand-authored model instead, drop a compressed
glTF binary at the matching filename:

Tips:
- Export glTF 2.0 from Blender (Y-up)
- Keep under ~8 MB; use Draco / gltf-transform if larger
- Original / licensed assets only — same standard as tourism copy
- Include vertex/face normals in the export — a mesh with none renders
  unlit (black) under this app's `MeshStandardMaterial` scenes, since
  three.js's `GLTFLoader` doesn't compute missing normals itself. This bit
  the procedural generator above too (trimesh's GLB exporter silently
  omits the `NORMAL` accessor by default even when normals are set on the
  mesh — `include_normals=True` on `.export()` is required).
