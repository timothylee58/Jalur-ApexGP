# Blender scene generator (optional, untested from this repo)

`sepang_circuit_scene.py` is a much richer alternative to
`scripts/generate_circuit_models.py` (the trimesh script actually wired
into `frontend/public/models/sepang.glb` today) — full grandstands, pit
building, sponsor boards, palm trees, golden-hour lighting. It's Blender-
only (`bpy`/`bmesh`, not a pip package) and hasn't been run successfully
by anyone yet: not by whoever originally wrote it (its own docstring says
so), and not from this repo's side either — no Blender is available in
the sandbox that reviewed it.

To try it:

1. Open Blender 4.x → Scripting tab → open this file → Run Script (Alt+P).
2. Check the two orientation gotchas flagged at the top of the file first
   (road profile rotation, sun/sky alignment) — likely the first things
   to need a manual nudge.
3. `export_glb()` at the bottom writes the scene to a `.glb` — update the
   hardcoded path in `main()` to point at your own
   `frontend/public/models/sepang.glb` first.
4. Before committing the result: check the file size (~8MB guideline, see
   `frontend/public/models/README.md`) and confirm it actually renders in
   the site's own three.js scene (`CircuitModelPreview.tsx`) — a Blender
   viewport render succeeding doesn't guarantee that; see this project's
   own history with the trimesh script for the kind of thing that can go
   wrong silently (a mesh that loads but renders unlit/invisible because
   the exporter dropped normals).
