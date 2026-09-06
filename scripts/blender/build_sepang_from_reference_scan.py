"""Build frontend/public/models/sepang.glb from a real, licensed 3D scan of
the actual circuit, instead of the procedural apex-point ribbon
(scripts/generate_circuit_models.py) or the never-rendered from-scratch
scene (scripts/blender/sepang_circuit_scene.py).

SOURCE, LICENSE, ATTRIBUTION
----------------------------
"Sepang International Circuit 2025 layout" by Dave Love (Sketchfab:
@Tyler_Dave) — https://sketchfab.com/3d-models/sepang-international-circuit-2025-layout-590bf243480e43f18e588a3908daa4df
Licensed CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/), which
permits this — reuse, modification, commercial use — provided attribution
is kept. Attribution lives in frontend/public/models/README.md and
docs/BRAND.md; keep it there if this pipeline is ever re-run, and update
it if the source model changes.

This is a real photogrammetry/reference-informed model — the actual
circuit shape, curb striping, grandstand, pit building, and real
elevation (verified: real, non-zero Z variation across the terrain mesh,
not flat), not a hallucinated or from-scratch approximation. What it
does NOT already include: any trees. Palm trees are added by this script
(see add_palm_trees() below), scaled to this model's own coordinate
space (NOT real-world meters — the source model's Z axis doesn't appear
uniformly scaled against its X/Y, so no meters-per-unit conversion is
assumed or claimed anywhere here).

WHAT GETS REMOVED, AND WHY
---------------------------
Two categories of objects are stripped before export (see
EXCLUDED_MATERIAL_NAMES and remove_flagged_objects() below), identified
by inspecting each low-vertex-density material's actual baked texture
(scripts here don't ship the textures — this was a one-time manual
inspection of the imported source, recorded here so it's reproducible
without repeating that inspection):

1. Real third-party trademarks baked into trackside sponsor-board
   textures — PETRONAS, PETRONAS PRIMAX, ROLEX (two separate board
   materials), and an "Assetto Corsa" (racing-sim game) logo board.
   The Assetto Corsa board is itself a strong signal this Sketchfab
   upload is a repackaged Assetto Corsa circuit mod rather than
   independent photogrammetry — real-world-accurate in shape either way
   (AC mods are themselves usually built from real reference), but
   worth knowing. Either way, shipping real sponsor trademarks conflicts
   with this repo's own docs/BRAND.md rule (already enforced by
   sepang_circuit_scene.py's build_sponsor_boards() removal) — not this
   project's marks to use, licensed source model or not.
2. Flat "backdrop matte" planes — huge-footprint, near-zero-vertex-count
   quads textured with a distant treeline/mountain photo, meant to be
   viewed edge-on from one fixed original camera angle as a cheap fake
   horizon. Under this app's free-orbiting camera they're visible from
   angles that break the illusion, rendering as a dark, unlit-looking
   silhouette disconnected from the real geometry — which is what
   actually surfaced this whole investigation (a rendering-glitch report
   that turned out to be one of these seen edge-on). They're also not
   real captured geometry of the circuit itself, just a 2D dressing
   trick, so excluding them is consistent with this file's own "real,
   not hallucinated" standard.

WHY DECIMATE
------------
The source is dense: ~840k vertices across 103 separate mesh objects
and ~98 baked textures (30MB as USDZ). A straight Draco-compressed
export of the *undecimated* mesh already lands at ~8.2MB — right at
frontend/public/models/README.md's ~8MB guideline with zero margin for
the added palm trees. Decimating first buys real headroom.

HOW TO RUN
----------
Requires the standalone `bpy` PyPI wheel (`pip install bpy`, ~374MB;
matches this repo's Python 3.11) — no full Blender application needed.
Download the source model from the Sketchfab URL above (a Sketchfab
account and their standard model-download flow; not redistributed in
this repo — see the size note above) as a .usdz, then:

    python scripts/blender/build_sepang_from_reference_scan.py \
        --source path/to/sepang-international-circuit-2025-layout.usdz \
        --out frontend/public/models/sepang.glb

Check the resulting file size against the ~8MB guideline before
committing, and confirm it actually renders in CircuitModelPreview.tsx —
same standard every other model-generating script in this repo holds
itself to.
"""

from __future__ import annotations

import argparse
import math
import random
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

# Reproducible palm scatter between runs.
random.seed(11)

DECIMATE_RATIO = 0.45
PALM_COUNT = 140
# Palms only ever get placed outside this central fraction of the model's
# own bounding box (a normalized -1..1 range per axis) — the track loop
# and every building in this model cluster near the middle, so this
# avoids needing to semantically identify "is this point a road or a
# building" at all: just stay out of the crowded core.
CORE_EXCLUSION_FRACTION = 0.55
# A palm is only placed if raycasting straight down from above the model
# actually hits something at this point — skips gaps outside the mesh's
# real footprint (its bounding box is rectangular, the terrain isn't).
RAYCAST_START_MARGIN = 5.0

# Source-model material names to strip before export — see "WHAT GETS
# REMOVED, AND WHY" in the module docstring. Keyed by what each one
# actually is, purely so a future re-inspection doesn't have to guess
# why a name is here.
EXCLUDED_MATERIAL_NAMES = {
    "Sepang691Mtl_61": "Assetto Corsa logo board",
    "Sepang691Mtl_66": "PETRONAS sponsor board",
    "Sepang691Mtl_68": "PETRONAS PRIMAX sponsor board",
    "Sepang691Mtl_69": "ROLEX sponsor board",
    "Sepang691Mtl_62": "ROLEX sponsor board (second instance)",
    "Sepang691Mtl_18": "Allianz sponsor board",
    "Sepang691Mtl_10": "backdrop matte (dark mountain treeline)",
    "Sepang691Mtl_13": "backdrop matte (mountain silhouette)",
    "Sepang691Mtl_14": "backdrop matte (dark treeline)",
    "Sepang691Mtl_15": "backdrop matte (green treeline)",
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_source(source_path: Path) -> None:
    bpy.ops.wm.usd_import(filepath=str(source_path))


def remove_flagged_objects() -> None:
    removed = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        flagged = next(
            (
                EXCLUDED_MATERIAL_NAMES[slot.material.name]
                for slot in obj.material_slots
                if slot.material and slot.material.name in EXCLUDED_MATERIAL_NAMES
            ),
            None,
        )
        if flagged:
            removed.append((obj.name, flagged))
            bpy.data.objects.remove(obj, do_unlink=True)

    print(f"Removed {len(removed)} flagged objects:")
    for name, reason in removed:
        print(f"  {name}: {reason}")
    found_reasons = {reason for _, reason in removed}
    missing = set(EXCLUDED_MATERIAL_NAMES.values()) - found_reasons
    if missing:
        print(
            "WARNING: expected but did not find these flagged materials — "
            f"the source model may have changed: {sorted(missing)}"
        )


def decimate_all_meshes(ratio: float) -> None:
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mod = obj.modifiers.new(name="Decimate", type="DECIMATE")
        mod.ratio = ratio
        with bpy.context.temp_override(object=obj):
            bpy.ops.object.modifier_apply(modifier=mod.name)


def compute_bounds() -> tuple[Vector, Vector]:
    bmin = Vector((math.inf, math.inf, math.inf))
    bmax = Vector((-math.inf, -math.inf, -math.inf))
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world_co = obj.matrix_world @ Vector(corner)
            bmin.x, bmin.y, bmin.z = min(bmin.x, world_co.x), min(bmin.y, world_co.y), min(bmin.z, world_co.z)
            bmax.x, bmax.y, bmax.z = max(bmax.x, world_co.x), max(bmax.y, world_co.y), max(bmax.z, world_co.z)
    return bmin, bmax


def make_palm_tree_mesh(name: str, height: float) -> bpy.types.Mesh:
    """Adapted from sepang_circuit_scene.py's make_palm_tree_mesh(), scaled
    down to whatever `height` fits this model's own coordinate space —
    that script's original trunk_height=6.0 assumed a roughly-real-meters
    scene; this one doesn't assume real units at all (see module
    docstring), so height is passed in relative to the model's own
    measured span instead."""
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=True, segments=8,
        radius1=height * 0.037, radius2=height * 0.017, depth=height,
    )
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0, 0, height / 2))

    for v in bm.verts:
        if v.co.z > height * 0.4:
            t = v.co.z / height
            v.co.x += (t**2) * height * 0.18

    top = Vector((height * 0.18, 0, height))
    frond_count, frond_len = 7, height * 0.53
    for i in range(frond_count):
        ang = math.radians(i * (360 / frond_count) + random.uniform(-10, 10))
        droop = math.radians(random.uniform(25, 45))

        v0 = bm.verts.new(top)
        v_mid_l = bm.verts.new(top + Vector((-height * 0.058, frond_len * 0.5, -frond_len * 0.5 * math.sin(droop))))
        v_mid_r = bm.verts.new(top + Vector((height * 0.058, frond_len * 0.5, -frond_len * 0.5 * math.sin(droop))))
        v_tip = bm.verts.new(top + Vector((0, frond_len * math.cos(droop), -frond_len * math.sin(droop))))
        bm.faces.new((v0, v_mid_l, v_tip, v_mid_r))

        for v in (v0, v_mid_l, v_tip, v_mid_r):
            local = v.co - top
            x = local.x * math.cos(ang) - local.y * math.sin(ang)
            y = local.x * math.sin(ang) + local.y * math.cos(ang)
            v.co = top + Vector((x, y, local.z))

    bm.normal_update()
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def add_palm_trees(bmin: Vector, bmax: Vector, count: int) -> None:
    center = (bmin + bmax) / 2
    half = (bmax - bmin) / 2
    span = max(bmax.x - bmin.x, bmax.y - bmin.y)
    palm_height = span * 0.02  # sized relative to the model's own span, see module docstring

    mat_trunk = bpy.data.materials.new("PalmTrunk")
    mat_trunk.use_nodes = True
    mat_trunk.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.25, 0.16, 0.08, 1.0)
    mat_frond = bpy.data.materials.new("PalmFrond")
    mat_frond.use_nodes = True
    mat_frond.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.08, 0.32, 0.1, 1.0)

    palm_mesh = make_palm_tree_mesh("PalmTree", palm_height)
    palm_mesh.materials.append(mat_trunk)
    palm_mesh.materials.append(mat_frond)
    # Trunk = the cone's first faces, fronds appended after — reassign the
    # frond faces (everything past the cone's own face count) to slot 1.
    cone_face_count = len(palm_mesh.polygons) - 7  # 7 fronds, one quad face each
    for i, poly in enumerate(palm_mesh.polygons):
        poly.material_index = 0 if i < cone_face_count else 1

    depsgraph = bpy.context.evaluated_depsgraph_get()
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 12:
        attempts += 1
        x = random.uniform(bmin.x, bmax.x)
        y = random.uniform(bmin.y, bmax.y)
        nx = (x - center.x) / half.x
        ny = (y - center.y) / half.y
        if abs(nx) < CORE_EXCLUSION_FRACTION and abs(ny) < CORE_EXCLUSION_FRACTION:
            continue  # inside the crowded core (track + buildings) — skip

        origin = Vector((x, y, bmax.z + RAYCAST_START_MARGIN))
        result, loc, _normal, _idx, _obj, _matrix = bpy.context.scene.ray_cast(
            depsgraph, origin, Vector((0, 0, -1))
        )
        if not result:
            continue  # outside the model's actual (non-rectangular) footprint

        obj = bpy.data.objects.new(f"Palm_{placed:03d}", palm_mesh)
        bpy.context.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler[2] = random.uniform(0, math.tau)
        s = random.uniform(0.8, 1.3)
        obj.scale = (s, s, s * random.uniform(0.9, 1.15))
        placed += 1

    print(f"Placed {placed} palm trees (height ~{palm_height:.3f} units) after {attempts} attempts")


def export_glb(out_path: Path) -> None:
    bpy.ops.object.select_all(action="SELECT")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14,
        export_draco_texcoord_quantization=12,
        export_yup=True,
    )
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Exported {out_path} ({size_mb:.2f} MB)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Path to the downloaded .usdz source model")
    parser.add_argument("--out", default="frontend/public/models/sepang.glb", help="Output GLB path")
    parser.add_argument("--decimate-ratio", type=float, default=DECIMATE_RATIO)
    parser.add_argument("--palm-count", type=int, default=PALM_COUNT)
    args = parser.parse_args()

    clear_scene()
    import_source(Path(args.source))
    remove_flagged_objects()
    decimate_all_meshes(args.decimate_ratio)
    bmin, bmax = compute_bounds()
    add_palm_trees(bmin, bmax, args.palm_count)
    export_glb(Path(args.out))


if __name__ == "__main__":
    main()
