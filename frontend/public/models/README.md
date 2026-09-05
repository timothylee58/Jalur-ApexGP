# 3D models

`sepang.glb` (served at `/models/sepang.glb`) and `car.glb` are
**procedurally generated** by `scripts/generate_circuit_models.py`
(regenerate with `python scripts/generate_circuit_models.py`).
`sepang.glb` is a spline-swept track ribbon projected from the circuit's
own 18-point apex + elevation data (the same centreline as
`scripts/blender/sepang_circuit_scene.py` and
`frontend/data/sepangCircuit.ts`), so its shape and ~22&nbsp;m elevation
change are real (vertical exaggerated ~6× for readability), not a
traced-by-eye loop. `car.glb` is box/cylinder primitives, no scanned or
reference geometry.
`sepang.glb` powers the landing page's "Orbit Sepang" stage
(`CircuitModelPreview.tsx`, which auto-detects it and otherwise links to
the procedural `/circuit` explorer); `car.glb` runs a lap of that
explorer's own traced curve (`CircuitExplorer3D.tsx`). The car is
deliberately unbranded — no team livery, no sponsor marks, no race number,
per docs/BRAND.md.

A much higher-fidelity but untested Blender-based generator also exists
at `scripts/blender/sepang_circuit_scene.py` — see `scripts/blender/README.md`
before using it; it's an optional alternative path, not currently wired
into either file below.

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
