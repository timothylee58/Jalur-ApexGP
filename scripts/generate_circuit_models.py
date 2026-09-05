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
import json
import math
from pathlib import Path

import numpy as np
import trimesh
from scipy.interpolate import splev, splprep

ROOT = Path(__file__).resolve().parents[1]
SEPANG_JSON = ROOT / "frontend" / "data" / "sepang.json"

# Horizontal size of the exported loop (three.js units). CircuitModelPreview
# re-normalises on load, so this is just an authoring scale.
PLANAR_TARGET = 34.0
# Vertical is exaggerated relative to horizontal so the 22 m real elevation
# change actually reads on a ~1.5 km-wide layout — flagged so it's not mistaken
# for true-scale relief.
VERT_EXAGGERATION = 6.0


def _load_apex_points() -> list[tuple[str, float, float, float]]:
    """Load shared centreline from frontend/data/sepang.json (same file the
    2D map + CircuitViewer + flyover read). Falls back to an inline copy
    only if the JSON is missing — keep them in sync."""
    if SEPANG_JSON.is_file():
        payload = json.loads(SEPANG_JSON.read_text())
        return [
            (p["name"], float(p["lat"]), float(p["lon"]), float(p["elevM"]))
            for p in payload["points"]
        ]
    # Fallback mirrors sepang.json — do not invent a second centreline.
    return [
        ("Start/Finish", 2.76070, 101.73830, 27.0),
        ("T1 Entry", 2.76455, 101.73975, 26.0),
        ("T1 Apex", 2.76560, 101.74020, 25.0),
        ("T2 Apex", 2.76525, 101.74085, 20.0),
        ("T3 Apex", 2.76280, 101.74270, 39.0),
        ("T4 Apex", 2.75790, 101.74310, 36.0),
        ("T5 Apex", 2.75470, 101.74040, 33.0),
        ("T6 Apex", 2.75405, 101.73880, 31.0),
        ("T7 Apex", 2.75230, 101.73600, 28.0),
        ("T8 Apex", 2.75250, 101.73420, 26.0),
        ("T9 Apex", 2.75620, 101.73350, 30.0),
        ("T10 Apex", 2.75780, 101.73480, 27.0),
        ("T11 Apex", 2.75920, 101.73280, 17.0),
        ("T12 Apex", 2.75750, 101.73080, 18.0),
        ("T13 Apex", 2.75630, 101.72890, 23.0),
        ("T14 Apex", 2.75820, 101.72750, 26.0),
        ("Back Straight Mid", 2.76180, 101.73710, 29.0),
        ("T15 Hairpin", 2.76495, 101.73835, 26.0),
    ]


APEX_POINTS = _load_apex_points()


def _projected_anchors() -> np.ndarray:
    """Project the apex lat/lon/elev to centred three.js (x, y=up, z) units."""
    lat0, lon0 = APEX_POINTS[0][1], APEX_POINTS[0][2]
    m_per_deg_lat = 110540.0
    m_per_deg_lon = 111320.0 * math.cos(math.radians(lat0))

    xs = np.array([(lon - lon0) * m_per_deg_lon for _, _, lon, _ in APEX_POINTS])
    zs = np.array([-(lat - lat0) * m_per_deg_lat for _, lat, _, _ in APEX_POINTS])
    elev = np.array([e for *_, e in APEX_POINTS])

    span = max(xs.max() - xs.min(), zs.max() - zs.min()) or 1.0
    scale = PLANAR_TARGET / span
    xs = (xs - xs.mean()) * scale
    zs = (zs - zs.mean()) * scale
    ys = (elev - elev.min()) * scale * VERT_EXAGGERATION

    return np.column_stack([xs, ys, zs])


TRACK_ANCHORS = _projected_anchors()

# v1 was a single flat, zero-thickness ribbon with every normal hardcoded
# straight up — at this scale (0.9 units wide against a 34-unit loop) that
# rendered as a near-invisible hairline outline with no shading variation
# at all, so the whole point of this model (a *visible* ~22 m elevation
# change) never actually read on screen. v2 extrudes a real slab (top +
# two side walls + bottom) with the top face's normals derived from the
# actual 3D tangent, so a directional light visibly shades the climbs and
# descents instead of lighting the whole loop uniformly.
TRACK_WIDTH = 1.6
SLAB_HEIGHT = 0.6
TRACK_SAMPLES = 400
# This app's own `paper.dim` token (#a39b8f) — a warm gray already vetted
# in docs/BRAND.md as legible against the asphalt background. Kept as the
# top/road face only now; the walls below get a second, darker tone so the
# ribbon reads as a raised shape by color contrast alone, before lighting
# even factors in.
ROAD_COLOR = [163, 155, 143, 255]
# `asphalt.line` (#2a3036) — an existing border/divider token, not a new
# color introduced for this model (docs/BRAND.md's "every color should be
# legible as a signal" / no arbitrary decorative colors).
WALL_COLOR = [42, 48, 54, 255]


def create_sepang_circuit(out_path: Path) -> None:
    tck, _ = splprep(TRACK_ANCHORS.T, s=0, per=True)
    # endpoint=False: a periodic spline's u=0 and u=1 land on (almost) the
    # same point, so including both would duplicate the seam vertex. The
    # face loop below wraps the last sample back to sample 0 itself, which
    # is what actually closes the ribbon.
    u = np.linspace(0, 1, TRACK_SAMPLES, endpoint=False)
    centerline = np.array(splev(u, tck)).T

    n = len(centerline)
    # Eight vertex rings, each n long: the top face (road) and the two
    # walls + bottom face (all sharing the same edge *positions* as the
    # top ring but needing their own vertex copies, since each face needs
    # its own flat-shaded normal — a shared vertex can only carry one
    # normal, and a road top and a vertical wall meeting at a hard edge
    # need genuinely different ones).
    top_l = np.zeros((n, 3))
    top_r = np.zeros((n, 3))
    wall_l_top = np.zeros((n, 3))
    wall_l_bot = np.zeros((n, 3))
    wall_r_top = np.zeros((n, 3))
    wall_r_bot = np.zeros((n, 3))
    bot_l = np.zeros((n, 3))
    bot_r = np.zeros((n, 3))
    normal_top = np.zeros((n, 3))
    normal_wall_l = np.zeros((n, 3))
    normal_wall_r = np.zeros((n, 3))

    for i in range(n):
        point = centerline[i]
        next_point = centerline[(i + 1) % n]
        tangent = next_point - point
        horizontal_tangent = np.array([tangent[0], 0.0, tangent[2]])
        # In-plane sideways offset (perpendicular to the *horizontal*
        # direction of travel — width is measured across the ground, not
        # along the slope, so a steep section isn't narrower than a flat
        # one).
        lateral = np.array([-horizontal_tangent[2], 0.0, horizontal_tangent[0]])
        length = np.linalg.norm(lateral)
        # A repeated or collinear anchor could zero out the tangent; fall
        # back to the previous station's lateral rather than dividing by
        # zero. Doesn't happen with TRACK_ANCHORS as given, but a mesh
        # generator that can silently emit NaN vertices on bad input is a
        # worse failure mode than a rare visible kink.
        if length < 1e-9:
            lateral = lateral if i == 0 else (top_l[i - 1] - top_r[i - 1])
            length = np.linalg.norm(lateral) or 1.0
        lateral /= length

        # The top face's real surface normal — cross(lateral, tangent),
        # not a hardcoded straight-up vector — so it tilts forward/back
        # with the actual climb or descent between these two samples.
        # That tilt is what lets a directional light shade the hills at
        # all; a flat up-normal lit the whole loop identically regardless
        # of elevation.
        n_top = np.cross(lateral, tangent)
        n_top_len = np.linalg.norm(n_top)
        n_top = n_top / n_top_len if n_top_len > 1e-9 else np.array([0.0, 1.0, 0.0])
        if n_top[1] < 0:
            n_top = -n_top  # keep it pointing generally upward

        top_l[i] = point + lateral * (TRACK_WIDTH / 2.0)
        top_r[i] = point - lateral * (TRACK_WIDTH / 2.0)
        drop = np.array([0.0, SLAB_HEIGHT, 0.0])
        wall_l_top[i] = top_l[i]
        wall_l_bot[i] = top_l[i] - drop
        wall_r_top[i] = top_r[i]
        wall_r_bot[i] = top_r[i] - drop
        bot_l[i] = wall_l_bot[i]
        bot_r[i] = wall_r_bot[i]
        normal_top[i] = n_top
        normal_wall_l[i] = lateral  # outer wall faces outward, +lateral
        normal_wall_r[i] = -lateral  # inner wall faces outward, -lateral

    rings = [top_l, top_r, wall_l_top, wall_l_bot, wall_r_top, wall_r_bot, bot_l, bot_r]
    vertices = np.concatenate(rings, axis=0)
    normals = np.concatenate(
        [
            normal_top, normal_top,  # top face: both edges share the station's tilt
            normal_wall_l, normal_wall_l,
            normal_wall_r, normal_wall_r,
            -normal_top, -normal_top,  # bottom face: mirror of the top tilt, facing down
        ],
        axis=0,
    )
    colors = np.concatenate(
        [
            np.tile(ROAD_COLOR, (2 * n, 1)),  # top_l, top_r
            np.tile(WALL_COLOR, (6 * n, 1)),  # both walls + bottom
        ],
        axis=0,
    )

    # Both winding orders for every quad: trimesh's GLB export doesn't
    # attach a material to a pure-vertex-color mesh (confirmed by
    # inspecting the exported JSON — no material, so viewers fall back to
    # a default single-sided one), and deriving the "correct" winding by
    # hand for four different face strips isn't worth it when the actual
    # shading now comes entirely from the explicit per-vertex normals
    # above (winding order plays no part in that). Two opposite-wound
    # copies of every triangle render correctly regardless of which way
    # any given viewer treats as "front".
    def strip_faces(ring_a: np.ndarray, ring_b: np.ndarray) -> list[list[int]]:
        faces = []
        for i in range(n):
            a, b = ring_a[i], ring_b[i]
            a2, b2 = ring_a[(i + 1) % n], ring_b[(i + 1) % n]
            faces.append([a, a2, b])
            faces.append([a2, b2, b])
            faces.append([a, b, a2])
            faces.append([a2, b, b2])
        return faces

    idx = np.arange(8 * n).reshape(8, n)
    top_l_idx, top_r_idx, wl_top_idx, wl_bot_idx, wr_top_idx, wr_bot_idx, bot_l_idx, bot_r_idx = idx
    faces = (
        strip_faces(top_l_idx, top_r_idx)
        + strip_faces(wl_top_idx, wl_bot_idx)
        + strip_faces(wr_top_idx, wr_bot_idx)
        + strip_faces(bot_l_idx, bot_r_idx)
    )

    # process=False skips trimesh's default vertex-merge pass — unnecessary
    # here since every vertex is already exactly where it should be, and
    # merging by proximity would weld faces that are deliberately
    # duplicated (same position, different normal) at every hard edge.
    track_mesh = trimesh.Trimesh(vertices=vertices, faces=np.array(faces), process=False)
    track_mesh.vertex_normals = normals
    track_mesh.visual.vertex_colors = colors
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
