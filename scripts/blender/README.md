# Blender scene generator

`sepang_circuit_scene.py` is a much richer alternative to
`scripts/generate_circuit_models.py` (the trimesh script actually wired
into `frontend/public/models/sepang.glb` today) — full grandstands, pit
building, palm trees, golden-hour lighting. It's Blender-only
(`bpy`/`bmesh`), but the standalone `bpy` PyPI wheel (`pip install bpy`,
~374MB, 5.0.x matching this repo's Python) runs it headlessly without
the full Blender application.

**Now actually run and debugged** — confirmed against bpy 5.0.1, the
first time anyone had a way to test it. Real findings from that pass
(all fixed in the script, see its module docstring's "UPDATE" section
for the full list):

- Three real Blender API incompatibilities (a spline-point attribute
  name, a sky-texture enum value, a renamed property) blocked it from
  running at all — fixed.
- The two risks the original author flagged as untested guesses (road
  profile orientation, sun/sky alignment) turned out to be a mixed bag:
  the road profile renders correctly (verified from a true cross-section
  camera angle, not just assumed) — the predicted fix wasn't needed.
  Sun/sky alignment hasn't been checked yet.
- Two real proportion bugs only visible once actually rendered: two
  grandstands were longer than the short track segments they're centered
  on, swinging tens of meters into unrelated corners — fixed by sizing
  them to the real segment lengths instead of guessed round numbers.
- The ground plane and camera far-clip distance were both too small for
  this ~1.7km-wide layout, letting the sky shader show through below the
  horizon as a false "ocean" band — both enlarged.
- The generic "SponsorBoard" paddock feature (plain colored blocks, no
  logo texture) was removed entirely per `docs/BRAND.md`'s "no sponsor
  logos" rule, rather than kept as an unused option someone could
  re-enable without thinking about brand safety.

To try it:

```
pip install bpy
python scripts/blender/sepang_circuit_scene.py
```

(or open in the full Blender application → Scripting tab → Run Script,
same result). `export_glb()` at the bottom writes the scene to a
`.glb` — update the hardcoded path in `main()` first, or point it at a
scratch path while iterating rather than overwriting the real
`frontend/public/models/sepang.glb` until the result is actually good.

**Still open, not yet done:**
- Sun/sky alignment (the original author's risk #2) — not checked
  against a render yet.
- The golden-hour color grade hasn't been checked at full quality (128
  samples, denoised) — testing so far used 32-48 samples for speed.
- The scene's environment/architecture detail (grandstand look, palm
  placement density, ground texture) is still the original author's
  best-effort stand-in, not checked against real reference photos of the
  venue — see the project's own tracking for that follow-up before this
  becomes the actual `sepang.glb`.
- Before committing any exported result: check the file size (~8MB
  guideline, see `frontend/public/models/README.md`) and confirm it
  actually renders correctly in the site's own three.js scene
  (`CircuitModelPreview.tsx`) — a Blender-side render succeeding doesn't
  guarantee that; see this project's own history with the trimesh script
  for the kind of thing that can go wrong silently (a mesh that loads
  but renders unlit/invisible because the exporter dropped normals, or
  washed-out because of three.js's default material for an unassigned
  glTF material).
