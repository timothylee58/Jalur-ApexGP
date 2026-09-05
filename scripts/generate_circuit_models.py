"""Generate the procedural Sepang circuit ribbon and a generic race-car
model as glTF binaries for the landing page's "Orbit Sepang" 3D stage
(frontend/components/hero/CircuitModelPreview.tsx) and the corner-by-corner
explorer's animated car (frontend/components/circuit/CircuitExplorer3D.tsx).

Requires numpy, scipy, and trimesh (`pip install numpy scipy trimesh`).

Usage:
    python scripts/generate_circuit_models.py
    python scripts/generate_circuit_models.py --out-dir some/other/dir

Both models are entirely procedural — box/cylinder primitives and a spline
swept into a ribbon, no scanned or reference geometry — so they're
"original assets" per frontend/public/models/README.md's own standard, and
the car is deliberately unbranded (no team livery, no sponsor marks, no
race number) per docs/BRAND.md.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import trimesh
from scipy.interpolate import splev, splprep

# Loosely-shaped anchor points for a closed circuit loop (main straight,
# a hairpin complex, a sweeping middle sector, a back straight, a final
# hairpin) — a stylized impression, not survey data, same "traced by eye"
# standard CircuitExplorer3D.tsx's own TRACK_POINTS already holds itself
# to. Not meant to line up with that component's separate 2D trace.
TRACK_ANCHORS = np.array(
    [
        [-15.0, 0.0, 5.0],
        [-20.0, 0.0, 5.0],
        [-24.0, 0.0, 2.0],
        [-23.0, 0.0, -1.0],
        [-18.0, 0.0, -4.0],
        [-10.0, 0.0, -6.0],
        [-3.0, 0.0, -9.0],
        [2.0, 0.0, -8.0],
        [6.0, 0.0, -4.0],
        [4.0, 0.0, 0.0],
        [8.0, 0.0, 4.0],
        [15.0, 0.0, 7.0],
        [22.0, 0.0, 8.0],
        [24.0, 0.0, -2.0],
        [23.0, 0.0, -7.0],
        [0.0, 0.0, 5.0],
    ]
)

TRACK_WIDTH = 1.2
TRACK_SAMPLES = 300


def create_sepang_circuit(out_path: Path) -> None:
    tck, _ = splprep(TRACK_ANCHORS.T, s=0, per=True)
    # endpoint=False: a periodic spline's u=0 and u=1 land on (almost) the
    # same point, so including both would duplicate the seam vertex. The
    # face loop below wraps the last sample back to sample 0 itself, which
    # is what actually closes the ribbon.
    u = np.linspace(0, 1, TRACK_SAMPLES, endpoint=False)
    centerline = np.array(splev(u, tck)).T

    n = len(centerline)
    vertices = np.zeros((n * 2, 3))
    for i in range(n):
        point = centerline[i]
        next_point = centerline[(i + 1) % n]
        tangent = next_point - point
        # In-plane sideways offset (perpendicular to the direction of
        # travel, not the surface normal — the mesh is flat at y=0, so its
        # actual surface normal is simply straight up, set explicitly
        # below rather than derived from this).
        lateral = np.array([-tangent[2], 0.0, tangent[0]])
        length = np.linalg.norm(lateral)
        # A repeated or collinear anchor could zero out the tangent; fall
        # back to the previous vertex's offset rather than dividing by
        # zero. Doesn't happen with TRACK_ANCHORS as given, but a mesh
        # generator that can silently emit NaN vertices on bad input is a
        # worse failure mode than a rare visible kink.
        if length < 1e-9:
            lateral = (vertices[(i - 1) * 2] - vertices[(i - 1) * 2 + 1]) if i > 0 else np.array([1.0, 0.0, 0.0])
            length = np.linalg.norm(lateral) or 1.0
        lateral /= length
        vertices[i * 2] = point + lateral * (TRACK_WIDTH / 2.0)
        vertices[i * 2 + 1] = point - lateral * (TRACK_WIDTH / 2.0)

    # Both winding orders for every quad: trimesh's GLB export doesn't
    # attach a material to a pure-vertex-color mesh (confirmed by
    # inspecting the exported JSON — no material, so viewers fall back to
    # a default single-sided one), and this ribbon's own winding direction
    # from these anchor points isn't something worth hand-deriving. Two
    # opposite-wound copies of every triangle render correctly regardless
    # of which way any given viewer treats as "front".
    faces = []
    for i in range(n):
        a = i * 2
        b = ((i + 1) % n) * 2
        faces.append([a, a + 1, b])
        faces.append([a + 1, b + 1, b])
        faces.append([a, b, a + 1])
        faces.append([a + 1, b, b + 1])

    # process=False skips trimesh's default vertex-merge pass — unnecessary
    # here since every vertex is already exactly where it should be, and
    # merging by proximity risks welding the ribbon's two near-parallel
    # edges together wherever the track pinches tight.
    track_mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces), process=False)
    # Explicit straight-up normals rather than fix_normals(): this is a
    # flat mesh at y=0, so "up" is trivially correct, and fix_normals()'s
    # winding-based inference has no reliable "outward" to find on an
    # open, doubled-winding strip like this one anyway.
    track_mesh.vertex_normals = np.tile([0.0, 1.0, 0.0], (len(vertices), 1))
    # This app's own `paper.dim` token (#a39b8f) — a warm gray already
    # vetted in docs/BRAND.md as legible against the asphalt background,
    # not a shade picked freehand. Two darker grays tried first (matching
    # the asphalt tokens, then a mid gray) both nearly disappeared against
    # the scene's equally-dark background under single-directional-light
    # shading; this is the first one that actually reads as a track line
    # at the preview's small on-page size.
    track_mesh.visual.vertex_colors = [163, 155, 143, 255]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # include_normals=True: trimesh's own heuristic for whether to bother
    # writing a NORMAL accessor skipped it here by default even with
    # vertex_normals explicitly set, which left the previous export with
    # no NORMAL attribute at all — invisible (unlit black) once loaded,
    # since three.js's GLTFLoader doesn't compute missing normals itself.
    track_mesh.export(str(out_path), include_normals=True)
    print(f"Wrote {out_path} ({len(vertices)} vertices, {len(faces)} faces)")


def create_generic_car(out_path: Path) -> None:
    # Matte graphite chassis with an amber accent (this app's own `amber`
    # token, #f5a623) — the same "unbranded single-seater" language as the
    # site's other stock-footage-derived car imagery, not any real team's
    # livery. No race number, no sponsor decals.
    chassis = trimesh.creation.box(extents=[0.7, 0.22, 1.8])
    chassis.apply_translation([0, 0.15, 0])

    cockpit = trimesh.creation.box(extents=[0.4, 0.18, 0.5])
    cockpit.apply_translation([0, 0.3, -0.1])

    front_wing = trimesh.creation.box(extents=[1.2, 0.05, 0.3])
    front_wing.apply_translation([0, 0.08, 0.9])

    rear_wing = trimesh.creation.box(extents=[1.0, 0.05, 0.25])
    rear_wing.apply_translation([0, 0.45, -0.85])

    graphite = [40, 42, 48, 255]
    amber = [245, 166, 35, 255]
    chassis.visual.vertex_colors = graphite
    cockpit.visual.vertex_colors = graphite
    front_wing.visual.vertex_colors = amber
    rear_wing.visual.vertex_colors = amber
    car_body = trimesh.util.concatenate([chassis, cockpit, front_wing, rear_wing])

    wheel_geom = trimesh.creation.cylinder(radius=0.18, height=0.14)
    wheel_geom.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 0, 1]))
    wheel_offsets = [
        (-0.45, 0.18, 0.65),
        (0.45, 0.18, 0.65),
        (-0.48, 0.18, -0.65),
        (0.48, 0.18, -0.65),
    ]
    wheels = trimesh.util.concatenate([wheel_geom.copy().apply_translation(pos) for pos in wheel_offsets])
    wheels.visual.vertex_colors = [20, 20, 20, 255]

    car = trimesh.util.concatenate([car_body, wheels])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # include_normals=True — see the matching note in create_sepang_circuit;
    # applies here too even though box()/cylinder() are solid primitives
    # with well-defined normals of their own.
    car.export(str(out_path), include_normals=True)
    print(f"Wrote {out_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out-dir",
        default="frontend/public/models",
        help="Output directory for sepang.glb and car.glb",
    )
    args = parser.parse_args()
    out_dir = Path(args.out_dir)
    create_sepang_circuit(out_dir / "sepang.glb")
    create_generic_car(out_dir / "car.glb")


if __name__ == "__main__":
    main()
