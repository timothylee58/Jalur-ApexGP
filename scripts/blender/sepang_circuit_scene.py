"""
=====================================================================
Sepang International Circuit -- Blender Scene Generator
=====================================================================
NOTE ON THIS SCRIPT'S PLACE IN jalur-apexgp: an alternative, much
higher-fidelity generator than scripts/generate_circuit_models.py (the
trimesh-based one actually wired into frontend/public/models/sepang.glb
today). This one is Blender-only -- it needs the full Blender
application, not a pip package -- and untested end-to-end from this
repo's side too: no Blender is available in the sandbox that reviewed
it, on top of the original author's own "never test-rendered" caveat
below. Treat it as a richer optional path to regenerate sepang.glb from,
not the current source of truth for that file. The generic "SponsorBoard"
boxes it builds are plain colored blocks (no logo texture), so nothing
here reproduces a real sponsor's actual branding -- still worth a look
against docs/BRAND.md's "no sponsor logos" rule before using the result.

Golden-hour 3D scene of the full 15-turn Grand Prix layout (5.543 km,
clockwise): track ribbon, Main Grandstand, K1 Grandstand, Pit
Building, paddock sponsor boards, scattered palm trees, and a
blurred distant grandstand roofline (via camera depth of field).

HOW TO RUN
----------
Blender 4.x -> Scripting tab -> open/paste this file -> Run Script
(Alt+P). Scene, camera and render settings are all set up by the
time it finishes; hit F12 to render the golden-hour still, or see
export_glb() at the bottom (added for jalur-apexgp, not part of the
original script, and just as untested) to write the scene out as
frontend/public/models/sepang.glb instead.

If it doesn't look right on first run, the two most likely culprits
(flagged again inline where they happen, since this was written and
never test-rendered -- no Blender/GPU is available in the environment
that authored this script):
  1. ROAD PROFILE ORIENTATION -- create_road_profile()'s cross-section
     may come out rotated 90 deg (a tall thin wall instead of a flat
     wide road) depending on how your Blender build interprets curve
     bevel-object planes. Fix: add a 90 deg X-rotation to the
     "RoadProfile" object, or swap the width/thickness axes in that
     function.
  2. SUN vs SKY TEXTURE alignment -- the World's Sky Texture sun
     angle and the separate Sun light object's rotation are two
     independent settings in Blender; they're both set to a similar
     low golden-hour angle here but may need nudging to match
     exactly in your viewport.

=====================================================================
ACCURACY NOTES -- READ BEFORE TREATING THIS AS A SURVEY
=====================================================================
Cross-checked against Wikipedia, Formula1.com, motorsportguides.com,
liquipedia.net and sepangcircuit.com before this was written, then
UPDATED against the more detailed spec sheet you supplied in round 2:
  - Direction: clockwise. Length: 5.543 km. Turns: 15 (5 left,
    10 right). Width: 16-22 m (varies -- see WIDTH_RADIUS below).
    Pit/main straight: 927 m. Back straight: 920 m. Pit lane:
    ~421 m. (Note: my earlier round-1 pass had these two straight
    lengths swapped, per a Wikipedia footnote that labelled the
    927 m one "back straight" -- your spec sheet's pit-straight/
    back-straight assignment is what's used now.)
  - Elevation change: 22 m total. High point ~38-40 m ASL near the
    T3/T4 crest, low point ~16-18 m ASL near the T11/T12 dip -- the
    per-corner table below now targets those absolute bands, and the
    T1-T2 (-6.2%) and T2-T3 (+5.5%) sourced gradients check out
    almost exactly against the resulting point-to-point distances.
  - Turn 15's post-2016-resurfacing reverse camber (-1.0% crossfall)
    is now modelled as a small negative tilt, alongside Turn 2's
    negative camber (still qualitative -- no exact figure was given
    for T2, unlike T15).
  - Main Grandstand: dual-frontage, sits between the pit straight
    and the back straight near Start/Finish; Pit Building faces it
    across the pit straight, with the pit lane and a low pit wall
    between them (sepangcircuit.com/architecture). K1 Grandstand
    really is at Turn 1/2 (sepangcircuit.com/k1-grandstand).

NOT independently verifiable -- treated as best-effort:
  - The 18 apex/GPS points below are the ones you supplied. There's
    no way for me to check them to survey precision, and 18 points
    describing a 5.5 km lap means the smooth AUTO-handle curve
    through them will round off corners that are sharper in real
    life. Close centerline, not a laser-scanned one.
  - Per-corner ELEVATION values are MY interpolation. Only the total
    22 m range and the T3-high / T11-low extremes are sourced;
    everything between is estimated from the "uphill" / "downhill"
    wording already in your own corner notes.
  - "B", "C", "F" grandstands from your reference image: I could not
    find their real names or locations in public sources, so they're
    placed at plausible, spread-out corners purely for visual
    variety -- don't treat their siting as verified.
  - Your GPS data implies the pit straight runs roughly 21 deg off
    true north, but sepangcircuit.com states the Main Grandstand is
    "east-west aligned." Rather than force a mismatch between the
    grandstand and the track shape built from your data, this script
    orients every stand PARALLEL TO THE TRACK GEOMETRY it actually
    built. Flag it if true compass heading matters to your shot.
  - Pit lane WIDTH isn't in any source I found (only its 420-422.7 m
    LENGTH is sourced) -- 11 m is a reasonable single-lane-plus-pit-box
    estimate, flagged again at PIT_LANE_WIDTH below.
  - The 22 m max width is applied at Start/Finish, the T1 braking
    zone and the back straight (per "opening up... into Turn 1 and
    the two primary straights"); every other point stays at the 16 m
    minimum. Real width almost certainly tapers more gradually than
    this waypoint-to-waypoint step change -- Blender's curve `radius`
    interpolation smooths it somewhat, but it's not a measured taper.
  - Palm trees, grandstands and the pit building are simple
    procedural stand-ins (correct proportions and rough massing, not
    photoreal) -- swap in real asset-library models for a production
    render. SIC's real landscaping is mixed tropical planting, not
    pure palms; palms here are the stylistic choice you asked for.

In short: the LAYOUT -- shape, direction, elevation trend, straight
lengths, which grandstand sits where relative to what -- is the part
that should read as ~90% correct. The finished look of any single
tree or building is intentionally stylised, not a materials-accurate
asset.
"""

import bpy
import bmesh
import math
import random
from mathutils import Vector

# ---------------------------------------------------------------
# 0. CONFIG
# ---------------------------------------------------------------
random.seed(42)                 # reproducible palm-tree scatter between runs

TRACK_WIDTH = 16.0              # meters -- sourced, motorsportguides.com
CURB_WIDTH = 1.2                # meters, stylistic
NUM_PALMS = 260
RESOLUTION = (1920, 1080)
RENDER_ENGINE = 'CYCLES'
SAMPLES = 128
INCLUDE_PADDOCK = True          # full paddock + sponsor boards, as requested

# ---------------------------------------------------------------
# 1. TRACK DATA
# name, lat, lon, elevation_m (see accuracy notes), tilt_deg, description
# ---------------------------------------------------------------
# Elevation is now in approx. meters ASL (matches your ~16-18m low /
# ~38-40m high bands). Chosen so the T1->T2 drop (-6.2%) and T2->T3
# climb (+5.5%) match your sourced max gradients against the actual
# point-to-point distances -- see the top-of-file notes.
TRACK_POINTS = [
    ("Start/Finish",      2.76070, 101.73830, 27, 0,    "Pit straight (927m, per spec sheet)"),
    ("T1 Entry",          2.76455, 101.73975, 26, 0,    "End of pit straight, heavy braking, widens to 22m"),
    ("T1 Apex",           2.76560, 101.74020, 25, 0,    "Tight right-hand hairpin"),
    ("T2 Apex",           2.76525, 101.74085, 20, -8,   "Downhill left switchback -- ~-6.2% grade, negative camber"),
    ("T3 Apex",           2.76280, 101.74270, 39, 0,    "Long sweeping uphill right -- ~+5.5% grade, elevation high point"),
    ("T4 Apex",           2.75790, 101.74310, 36, 0,    "90-degree medium-speed left, past the T3/T4 crest"),
    ("T5 Apex",           2.75470, 101.74040, 33, 0,    "High-speed sweeping left"),
    ("T6 Apex",           2.75405, 101.73880, 31, 0,    "Fast right flick"),
    ("T7 Apex",           2.75230, 101.73600, 28, 0,    "Medium-speed right entry"),
    ("T8 Apex",           2.75250, 101.73420, 26, 0,    "Double-apex right exit"),
    ("T9 Apex",           2.75620, 101.73350, 30, 0,    "Off-camber tight left, uphill"),
    ("T10 Apex",          2.75780, 101.73480, 27, 0,    "Acceleration curve right"),
    ("T11 Apex",          2.75920, 101.73280, 17, 0,    "Medium-speed downhill right -- elevation low point"),
    ("T12 Apex",          2.75750, 101.73080, 18, 0,    "Flat-out left sweep, still in the T11/T12 dip"),
    ("T13 Apex",          2.75630, 101.72890, 23, 0,    "Medium-speed right onto back section"),
    ("T14 Apex",          2.75820, 101.72750, 26, 0,    "Right-hander leading onto Back Straight"),
    ("Back Straight Mid", 2.76180, 101.73710, 29, 0,    "Back straight (920m), parallel to pit straight, widens to 22m"),
    ("T15 Hairpin",       2.76495, 101.73835, 26, -0.6, "Final hairpin -- sourced -1.0% reverse crossfall since 2016 resurfacing"),
]

# "Opening up across the wide braking zones into Turn 1 and the two
# primary straights" -- 22m max width applied at these points, 16m
# (radius 1.0, the default) everywhere else. See accuracy notes.
MAX_TRACK_WIDTH = 22.0
WIDTH_RADIUS = {
    "Start/Finish": MAX_TRACK_WIDTH / 16.0,
    "T1 Entry": MAX_TRACK_WIDTH / 16.0,
    "T1 Apex": 19.0 / 16.0,          # transitional, tapering out of the braking zone
    "Back Straight Mid": MAX_TRACK_WIDTH / 16.0,
}

LAT0, LON0 = TRACK_POINTS[0][1], TRACK_POINTS[0][2]   # Start/Finish = local origin
M_PER_DEG_LAT = 110540.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT0))


def gps_to_local(lat, lon, elev):
    """Flat-earth equirectangular projection centered on Start/Finish.
    Error is negligible (<0.1%) at this track's ~2km scale."""
    x = (lon - LON0) * M_PER_DEG_LON
    y = (lat - LAT0) * M_PER_DEG_LAT
    return x, y, elev


# ---------------------------------------------------------------
# 2. SCENE / MATERIAL HELPERS
# ---------------------------------------------------------------
def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block_type in (bpy.data.meshes, bpy.data.curves, bpy.data.materials,
                        bpy.data.lights, bpy.data.cameras):
        for block in list(block_type):
            if block.users == 0:
                block_type.remove(block)


def make_material(name, color_rgb, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color_rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def rotation_from_facing(facing):
    """Z-rotation (radians) so an object's local +Y axis (its 'depth',
    pointing away from the track) matches the given outward-facing
    vector, with local +X (its 'length') running along the track."""
    n = Vector((facing.x, facing.y, 0))
    if n.length < 1e-6:
        n = Vector((0, 1, 0))
    n.normalize()
    return math.atan2(-n.x, n.y)


# ---------------------------------------------------------------
# 3. TRACK RIBBON
# ---------------------------------------------------------------
def create_road_profile(width, thickness, name="RoadProfile"):
    # See the ROAD PROFILE ORIENTATION note at the top of this file --
    # this is the one piece of geometry most likely to need a manual
    # 90-degree nudge depending on your Blender build's bevel-object
    # convention.
    curve_data = bpy.data.curves.new(name, type='CURVE')
    curve_data.dimensions = '3D'
    spline = curve_data.splines.new('POLY')
    hw, ht = width / 2, thickness / 2
    pts = [(-hw, -ht, 0), (hw, -ht, 0), (hw, ht, 0), (-hw, ht, 0)]
    spline.points.add(len(pts) - 1)
    for i, (x, y, z) in enumerate(pts):
        spline.points[i].co = (x, y, z, 1)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    return obj


def build_track_curve():
    profile = create_road_profile(TRACK_WIDTH, 0.4)

    track_xyz = []
    curve_data = bpy.data.curves.new("TrackCenterline", type='CURVE')
    curve_data.dimensions = '3D'
    curve_data.resolution_u = 24
    spline = curve_data.splines.new('BEZIER')
    spline.bezier_points.add(len(TRACK_POINTS) - 1)

    for i, (name, lat, lon, elev, tilt_deg, note) in enumerate(TRACK_POINTS):
        x, y, z = gps_to_local(lat, lon, elev)
        track_xyz.append((name, (x, y, z)))
        bp = spline.bezier_points[i]
        bp.co = (x, y, z)
        bp.handle_type = 'AUTO'
        bp.tilt = math.radians(tilt_deg)
        bp.radius = WIDTH_RADIUS.get(name, 1.0)   # scales the 16m profile up to 22m

    spline.use_cyclic_u = True
    curve_data.bevel_mode = 'OBJECT'
    curve_data.bevel_object = profile
    curve_data.use_fill_caps = True

    curve_obj = bpy.data.objects.new("TrackCenterline", curve_data)
    bpy.context.collection.objects.link(curve_obj)
    profile.hide_render = True
    profile.hide_viewport = True

    return curve_obj, track_xyz


def add_start_finish_line(track_xyz, names, material):
    coords = dict(zip(names, [p[1] for p in track_xyz]))
    sf = Vector(coords["Start/Finish"])
    nxt = Vector(coords["T1 Entry"])
    tangent = (nxt - sf).normalized()
    normal = Vector((-tangent.y, tangent.x, 0))

    mesh = bpy.data.meshes.new("StartFinishLine")
    bm = bmesh.new()
    hw = TRACK_WIDTH / 2
    p0 = sf - normal * hw
    p1 = sf + normal * hw
    p2 = p1 + tangent * 2.0
    p3 = p0 + tangent * 2.0
    for p in (p0, p1, p2, p3):
        bm.verts.new(p + Vector((0, 0, 0.02)))
    bm.faces.new(bm.verts[:])
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("StartFinishLine", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def add_curbs(track_xyz, names, material):
    # Only the tightest, most recognisable corners -- a full 15-corner
    # curb pass would triple this function's length for little visual
    # payoff at the scale this scene will typically be viewed at.
    coords = [p[1] for p in track_xyz]
    tight_corners = ["T1 Apex", "T2 Apex", "T9 Apex", "T15 Hairpin"]
    n_pts = len(track_xyz)
    for name in tight_corners:
        idx = names.index(name)
        p_prev = Vector(coords[idx - 1])
        p_here = Vector(coords[idx])
        p_next = Vector(coords[(idx + 1) % n_pts])
        tangent = (p_next - p_prev).normalized()
        normal = Vector((-tangent.y, tangent.x, 0))

        mesh = bpy.data.meshes.new(f"Curb_{name.replace(' ', '_')}")
        bm = bmesh.new()
        hw = TRACK_WIDTH / 2 + CURB_WIDTH / 2
        for s in (-1, 1):
            center = p_here + normal * hw * s
            for i in range(9):
                t = (i - 4) * 4.0
                v = center + tangent * t
                bm.verts.new(v + Vector((0, 0, 0.04)))
        bm.verts.ensure_lookup_table()
        for i in range(8):
            bm.faces.new((bm.verts[i], bm.verts[i + 1],
                           bm.verts[i + 10], bm.verts[i + 9]))
        bm.normal_update()
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(mesh.name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)


# ---------------------------------------------------------------
# 4. BUILDINGS
# ---------------------------------------------------------------
def build_flat_box(name, center, length, depth, height, facing, material=None):
    """Simple flat-roofed box (pit building, sponsor boards, distant
    stand silhouettes). Symmetric front-to-back, so 'facing' only
    controls which axis becomes length vs. depth, not a directional
    near/far edge."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.scale = (length, depth, height)
    obj.location = (center[0], center[1], center[2] + height / 2)
    obj.rotation_euler[2] = rotation_from_facing(facing)
    if material:
        obj.data.materials.append(material)
    return obj


def build_grandstand(name, center, length, depth, height, facing,
                      roof_overhang=6.0, material=None):
    """Raked single-tier seating wedge + cantilevered roof canopy.
    'center' is the NEAR (trackside) edge, at local y=0 -- the stand
    extends away from the track along 'facing' up to y=depth."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    hl = length / 2
    profile = [(0, 0), (depth, 0), (depth, height)]   # rake: low-near -> tall-far
    v_front, v_back = [], []
    for (y, z) in profile:
        v_front.append(bm.verts.new((-hl, y, z)))
        v_back.append(bm.verts.new((hl, y, z)))
    bm.faces.new((v_front[0], v_front[1], v_front[2]))
    bm.faces.new((v_back[2], v_back[1], v_back[0]))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((v_front[i], v_back[i], v_back[j], v_front[j]))
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = center
    rot = rotation_from_facing(facing)
    obj.rotation_euler[2] = rot
    if material:
        obj.data.materials.append(material)

    roof_mesh = bpy.data.meshes.new(name + "_Roof")
    rb = bmesh.new()
    rz = height
    verts = [
        rb.verts.new((-hl - 2, depth - roof_overhang, rz)),
        rb.verts.new((hl + 2, depth - roof_overhang, rz)),
        rb.verts.new((hl + 2, depth + 1.5, rz + 3)),
        rb.verts.new((-hl - 2, depth + 1.5, rz + 3)),
    ]
    rb.faces.new(verts)
    rb.normal_update()
    rb.to_mesh(roof_mesh)
    rb.free()
    roof_obj = bpy.data.objects.new(name + "_Roof", roof_mesh)
    bpy.context.collection.objects.link(roof_obj)
    roof_obj.location = center
    roof_obj.rotation_euler[2] = rot
    if material:
        roof_obj.data.materials.append(material)

    return obj, roof_obj


def build_grandstands_and_pits(track_xyz, names, mat_stand, mat_pit):
    coords = dict(zip(names, [p[1] for p in track_xyz]))
    sf, t1e = Vector(coords["Start/Finish"]), Vector(coords["T1 Entry"])
    t1a, t2a = Vector(coords["T1 Apex"]), Vector(coords["T2 Apex"])
    tangent = (t1e - sf).normalized()
    normal = Vector((-tangent.y, tangent.x, 0))   # toward back straight / median

    # Main Grandstand -- median side, near Start/Finish. Real spec is
    # ~1.3km dual-frontage; shortened here to fit this sparse 18-point
    # geometry without overshooting past T1 (see accuracy notes).
    gs_len = 700.0
    gs_edge = sf.lerp(t1e, 0.5) + normal * (TRACK_WIDTH / 2 + 20)
    build_grandstand("MainGrandstand", gs_edge, gs_len, 22, 16,
                      facing=normal, material=mat_stand)

    # Pit Building -- opposite side of the pit straight, facing the
    # Main Grandstand (sepangcircuit.com/architecture): 33 pits x 8m.
    pit_center = sf.lerp(t1e, 0.35) - normal * (TRACK_WIDTH / 2 + 15)
    build_flat_box("PitBuilding", pit_center, 264, 24, 12,
                    facing=normal, material=mat_pit)

    # K1 Grandstand -- real location, Turn 1/2 (sepangcircuit.com/k1-grandstand)
    k1_seg = (t1a - t2a).normalized()
    k1_normal = Vector((-k1_seg.y, k1_seg.x, 0))
    k1_edge = t1a.lerp(t2a, 0.5) + k1_normal * (TRACK_WIDTH / 2 + 18)
    build_grandstand("K1_Grandstand", k1_edge, 160, 16, 12,
                      facing=k1_normal, material=mat_stand)

    # "B" / "C" / "F" stands from your reference image -- identity and
    # exact location not found in public sources, so spread across
    # visually distinct sectors instead of guessed at precisely.
    for label, corner_a, corner_b, side in (
        ("B_Grandstand", "T5 Apex", "T6 Apex", 1),
        ("C_Grandstand", "T9 Apex", "T10 Apex", -1),
        ("F_Grandstand", "T12 Apex", "T13 Apex", 1),
    ):
        pa, pb = Vector(coords[corner_a]), Vector(coords[corner_b])
        mid = pa.lerp(pb, 0.5)
        seg = (pb - pa).normalized()
        n = Vector((-seg.y, seg.x, 0)) * side
        edge = mid + n * (TRACK_WIDTH / 2 + 15)
        build_grandstand(label, edge, 110, 13, 9, facing=n, material=mat_stand)


def build_sponsor_boards(track_xyz, names, material):
    coords = dict(zip(names, [p[1] for p in track_xyz]))
    sf, t1e = Vector(coords["Start/Finish"]), Vector(coords["T1 Entry"])
    tangent = (t1e - sf).normalized()
    normal = Vector((-tangent.y, tangent.x, 0))
    for i in range(10):
        t = i / 9
        base = sf.lerp(t1e, t)
        pos = base + normal * (TRACK_WIDTH / 2 + 12)
        build_flat_box(f"SponsorBoard_{i}", pos, 9, 0.4, 2.2,
                        facing=normal, material=material)


def build_pit_lane(track_xyz, names, mat_lane, mat_wall):
    """Pit lane: ~421m (midpoint of the sourced 420-422.7m), running
    on the Pit Building side of the pit straight, separated from the
    racing surface by a low pit wall. Width isn't published anywhere
    I found -- PIT_LANE_WIDTH below is an estimate, flagged in the
    top-of-file notes."""
    coords = dict(zip(names, [p[1] for p in track_xyz]))
    sf, t1e = Vector(coords["Start/Finish"]), Vector(coords["T1 Entry"])
    tangent = (t1e - sf).normalized()
    normal = Vector((-tangent.y, tangent.x, 0))

    PIT_LANE_LENGTH = 421.0
    PIT_LANE_WIDTH = 11.0                       # ESTIMATED, not sourced
    wall_offset = MAX_TRACK_WIDTH / 2 + 3.0      # gap from the racing surface
    lane_offset = wall_offset + 2.0 + PIT_LANE_WIDTH / 2

    start_pt = sf - tangent * 60 - normal * lane_offset
    end_pt = start_pt + tangent * PIT_LANE_LENGTH

    mesh = bpy.data.meshes.new("PitLane")
    bm = bmesh.new()
    hw = PIT_LANE_WIDTH / 2
    corners = [start_pt - normal * hw, start_pt + normal * hw,
               end_pt + normal * hw, end_pt - normal * hw]
    verts = [bm.verts.new(c + Vector((0, 0, 0.03))) for c in corners]
    bm.faces.new(verts)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    lane_obj = bpy.data.objects.new("PitLane", mesh)
    bpy.context.collection.objects.link(lane_obj)
    lane_obj.data.materials.append(mat_lane)

    wall_center = sf - tangent * 60 - normal * wall_offset
    build_flat_box("PitWall", wall_center, PIT_LANE_LENGTH, 0.5, 1.1,
                    facing=normal, material=mat_wall)

    return lane_obj


def add_distant_grandstand_silhouette(track_xyz, names, material):
    """Low-detail rooflines placed well back from the track, purely
    for atmosphere -- setup_camera()'s shallow depth of field throws
    these out of focus for the 'blurred grandstand roofline in the
    background' from the brief. NOT the accurate Main/K1 stands built
    above."""
    coords = dict(zip(names, [p[1] for p in track_xyz]))
    anchor = Vector(coords["T4 Apex"])
    for i in range(5):
        pos = anchor + Vector((250 + i * 140, 320, 0))
        build_flat_box(f"DistantStand_{i}", pos, 120, 14,
                        random.uniform(14, 22),
                        facing=Vector((0, 1, 0)), material=material)


# ---------------------------------------------------------------
# 5. PALM TREES
# ---------------------------------------------------------------
def make_palm_tree_mesh(name="PalmTree"):
    bm = bmesh.new()
    trunk_height = 6.0
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=8,
                           radius1=0.22, radius2=0.10, depth=trunk_height)
    bmesh.ops.translate(bm, verts=bm.verts[:], vec=(0, 0, trunk_height / 2))

    # natural lean in the upper half of the trunk
    for v in bm.verts:
        if v.co.z > trunk_height * 0.4:
            t = v.co.z / trunk_height
            v.co.x += (t ** 2) * 1.1

    top = Vector((1.1, 0, trunk_height))
    frond_count, frond_len = 7, 3.2
    for i in range(frond_count):
        ang = math.radians(i * (360 / frond_count) + random.uniform(-10, 10))
        droop = math.radians(random.uniform(25, 45))

        v0 = bm.verts.new(top)
        v_mid_l = bm.verts.new(top + Vector((-0.35, frond_len * 0.5,
                                              -frond_len * 0.5 * math.sin(droop))))
        v_mid_r = bm.verts.new(top + Vector((0.35, frond_len * 0.5,
                                              -frond_len * 0.5 * math.sin(droop))))
        v_tip = bm.verts.new(top + Vector((0, frond_len * math.cos(droop),
                                            -frond_len * math.sin(droop))))
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


def scatter_palms(track_xyz, names, count, material):
    palm_mesh = make_palm_tree_mesh()
    palm_mesh.materials.append(material)
    coords = dict(zip(names, [p[1] for p in track_xyz]))

    zones = []  # (p1, p2, side) -- straights only; real trackside
                # safety practice keeps trees off apex run-off areas
    def zone(n1, n2, side):
        zones.append((Vector(coords[n1]), Vector(coords[n2]), side))

    zone("Start/Finish", "T1 Entry", 1)
    zone("T14 Apex", "Back Straight Mid", -1)
    zone("Back Straight Mid", "T15 Hairpin", -1)

    placed, attempts = 0, 0
    while placed < count and attempts < count * 8:
        attempts += 1
        p1, p2, side = random.choice(zones)
        t = random.uniform(0.05, 0.95)
        base = p1.lerp(p2, t)
        tangent = (p2 - p1).normalized()
        normal = Vector((-tangent.y, tangent.x, 0)) * side
        offset = random.uniform(25, 70)
        jitter = Vector((random.uniform(-4, 4), random.uniform(-4, 4), 0))
        loc = base + normal * offset + jitter
        loc.z = base.z

        obj = bpy.data.objects.new(f"Palm_{placed:03d}", palm_mesh)
        bpy.context.collection.objects.link(obj)
        obj.location = loc
        obj.rotation_euler[2] = random.uniform(0, math.tau)
        s = random.uniform(0.75, 1.35)
        obj.scale = (s, s, s * random.uniform(0.9, 1.15))
        placed += 1


# ---------------------------------------------------------------
# 6. GROUND
# ---------------------------------------------------------------
def setup_ground_plane(track_xyz, material):
    xs = [p[1][0] for p in track_xyz]
    ys = [p[1][1] for p in track_xyz]
    margin = 400
    minx, maxx = min(xs) - margin, max(xs) + margin
    miny, maxy = min(ys) - margin, max(ys) + margin
    size_x, size_y = maxx - minx, maxy - miny
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2

    bpy.ops.mesh.primitive_grid_add(x_subdivisions=64, y_subdivisions=64,
                                     size=1.0, location=(cx, cy, 0))
    ground = bpy.context.active_object
    ground.name = "Ground"
    ground.scale = (size_x / 2, size_y / 2, 1)

    # Gentle rolling undulation -- STYLISED, not a survey-accurate DEM.
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(ground.data)
    for v in bm.verts:
        wx = v.co.x * ground.scale.x + cx
        wy = v.co.y * ground.scale.y + cy
        v.co.z = (3.0 * math.sin(wx / 260.0) * math.cos(wy / 300.0)
                  + 1.4 * math.sin(wx / 90.0 + wy / 140.0))
    bmesh.update_edit_mesh(ground.data)
    bpy.ops.object.mode_set(mode='OBJECT')

    ground.data.materials.append(material)
    return ground


# ---------------------------------------------------------------
# 7. LIGHTING / CAMERA / RENDER
# ---------------------------------------------------------------
def setup_lighting_golden_hour():
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(6.0)     # low sun -> golden hour
    sky.sun_rotation = math.radians(250.0)
    sky.air_density = 1.2
    sky.dust_density = 3.0                    # warmer, hazier tropical dusk

    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs['Strength'].default_value = 1.1
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    sun_data = bpy.data.lights.new("SunLight", type='SUN')
    sun_data.energy = 3.0
    sun_data.angle = math.radians(1.2)        # soft-edged shadows
    sun_data.color = (1.0, 0.72, 0.45)        # warm golden-hour tint
    sun_obj = bpy.data.objects.new("SunLight", sun_data)
    bpy.context.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(84), 0, math.radians(250))
    return sun_obj


def setup_camera(track_xyz, names):
    coords = dict(zip(names, [p[1] for p in track_xyz]))
    sf = Vector(coords["Start/Finish"])
    t1a = Vector(coords["T1 Apex"])

    cam_data = bpy.data.cameras.new("MainCamera")
    cam_data.lens = 35
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 2.0
    cam_obj = bpy.data.objects.new("MainCamera", cam_data)
    bpy.context.collection.objects.link(cam_obj)

    cam_pos = sf + Vector((-180, -260, 55))
    cam_obj.location = cam_pos

    target = sf.lerp(t1a, 0.5)
    direction = target - cam_pos
    cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

    focus_empty = bpy.data.objects.new("FocusTarget", None)
    focus_empty.location = target
    bpy.context.collection.objects.link(focus_empty)
    cam_data.dof.focus_object = focus_empty

    bpy.context.scene.camera = cam_obj
    return cam_obj


def setup_render_settings():
    scene = bpy.context.scene
    scene.render.engine = RENDER_ENGINE
    scene.render.resolution_x, scene.render.resolution_y = RESOLUTION
    if RENDER_ENGINE == 'CYCLES':
        scene.cycles.samples = SAMPLES
        scene.cycles.use_denoising = True
        try:
            scene.cycles.device = 'GPU'
        except Exception:
            pass
    # AgX + a punchier look reads well for a warm, saturated golden-hour
    # shot; both are standard presets in default Blender 4.x installs.
    try:
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'Medium High Contrast'
    except TypeError:
        pass  # color management presets differ slightly by build; skip rather than crash


# ---------------------------------------------------------------
# 8. EXPORT (added for jalur-apexgp -- not in the original script,
#    and not test-run any more than the rest of it; see the module
#    docstring's "NOTE ON THIS SCRIPT'S PLACE" above)
# ---------------------------------------------------------------
def export_glb(filepath):
    """Write everything currently in the scene to a glTF binary. Palm
    trees all share one mesh datablock (see scatter_palms/make_palm_tree_mesh)
    so glTF's mesh instancing should keep file size well under the ~8MB
    guideline in frontend/public/models/README.md even at NUM_PALMS=260 --
    not confirmed against a real export, so check the resulting file size
    before committing it.

    If export_scene.gltf's exact keyword arguments have drifted in your
    Blender version and this errors, use Blender's own Export panel once
    by hand (File -> Export -> glTF 2.0), then check the Info panel or
    Window -> Toggle System Console for the equivalent operator call it
    logged -- that's the authoritative signature for your build, not this.
    """
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=False,
        export_apply=True,  # bake modifiers/curve bevels to real geometry
        export_yup=True,  # matches three.js's convention (see CircuitModelPreview.tsx)
    )
    print(f"Exported {filepath}")


# ---------------------------------------------------------------
# 9. MAIN
# ---------------------------------------------------------------
def main():
    clear_scene()

    mat_asphalt = make_material("Asphalt", (0.035, 0.035, 0.038), roughness=0.85)
    mat_curb = make_material("Curb", (0.8, 0.05, 0.05), roughness=0.5)
    mat_checker = make_material("StartFinish", (0.9, 0.9, 0.9), roughness=0.4)
    mat_stand = make_material("GrandstandSteel", (0.55, 0.56, 0.58), roughness=0.4, metallic=0.3)
    mat_pit = make_material("PitBuilding", (0.85, 0.85, 0.82), roughness=0.55)
    mat_sponsor = make_material("SponsorBoard", (0.1, 0.35, 0.65), roughness=0.3)
    mat_lane = make_material("PitLaneAsphalt", (0.06, 0.06, 0.07), roughness=0.8)
    mat_wall = make_material("PitWall", (0.9, 0.9, 0.88), roughness=0.5)
    mat_ground = make_material("Ground", (0.09, 0.22, 0.07), roughness=0.9)
    mat_frond = make_material("PalmFrond", (0.08, 0.32, 0.1), roughness=0.7)
    mat_distant = make_material("DistantStand", (0.5, 0.5, 0.55), roughness=0.6)

    curve_obj, track_xyz = build_track_curve()
    curve_obj.data.materials.append(mat_asphalt)
    names = [p[0] for p in track_xyz]

    add_start_finish_line(track_xyz, names, mat_checker)
    add_curbs(track_xyz, names, mat_curb)
    build_grandstands_and_pits(track_xyz, names, mat_stand, mat_pit)
    if INCLUDE_PADDOCK:
        build_sponsor_boards(track_xyz, names, mat_sponsor)
        build_pit_lane(track_xyz, names, mat_lane, mat_wall)
    setup_ground_plane(track_xyz, mat_ground)
    scatter_palms(track_xyz, names, NUM_PALMS, mat_frond)
    add_distant_grandstand_silhouette(track_xyz, names, mat_distant)
    setup_lighting_golden_hour()
    setup_camera(track_xyz, names)
    setup_render_settings()

    print(f"Sepang circuit scene build complete -- {len(track_xyz)} reference "
          f"points, {NUM_PALMS} palms placed.")

    # Comment this out if you just want the scene open for F12 stills —
    # exporting isn't why the original script existed, only why this copy
    # of it does. bpy.data.filepath is empty for a script run without a
    # saved .blend, so this can't use a "//relative" path; point it
    # somewhere real for your machine.
    export_glb(filepath="/absolute/path/to/frontend/public/models/sepang.glb")


if __name__ == "__main__":
    main()
