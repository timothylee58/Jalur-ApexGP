# 3D models

`sepang.glb` (served at `/models/sepang.glb`) and `car.glb` are currently
both **procedurally generated** by `scripts/generate_circuit_models.py`
(box/cylinder primitives and a spline-swept ribbon, no scanned or reference
geometry — regenerate with `python scripts/generate_circuit_models.py`).
`sepang.glb` powers the landing page's "Orbit Sepang" stage
(`CircuitModelPreview.tsx`, which auto-detects it and otherwise links to
the procedural `/circuit` explorer); `car.glb` runs a lap of that
explorer's own traced curve (`CircuitExplorer3D.tsx`). The car is
deliberately unbranded — no team livery, no sponsor marks, no race number,
per docs/BRAND.md.

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
