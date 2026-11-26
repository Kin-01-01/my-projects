"""One-shot exterior style test: blue weathered roof, rugged terrain, detailed pines.

Run from the current final .blend; saves a separate test .blend and one image.
"""

import bpy
import math
import os
import random
import sys
from mathutils import Vector

ROOT = r"D:/workBuddy/2026-11-25-08-52-59/guangqiang_cabin"
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
import cabin_lib as L
from cabin_lib import (box, quad_tube, quad_sphere, rod, ribbon, torus,
                       new_obj, lin)

OUT_DIR = os.path.join(ROOT, "style_test")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_BLEND = os.path.join(OUT_DIR, "Guangqiang_StyleTest.blend")
OUT_IMG = os.path.join(OUT_DIR, "style_test_exterior_v2.png")
RNG = random.Random(31415)
random.seed(31415)

scene = bpy.context.scene
print("START", len(bpy.data.objects))


# ---------------------------------------------------------------- materials
def pbr(name, base_hex, second_hex=None, rough=0.8, metal=0.0,
        noise_scale=4.0, bump=0.25, coord="Object"):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (700, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (350, 100)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Specular IOR Level"].default_value = 0.35

    tc = nt.nodes.new("ShaderNodeTexCoord")
    tc.location = (-850, 0)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-650, 0)
    noise.inputs["Scale"].default_value = noise_scale
    noise.inputs["Detail"].default_value = 6.0
    noise.inputs["Roughness"].default_value = 0.62
    if coord == "Object":
        nt.links.new(tc.outputs["Object"], noise.inputs["Vector"])
    else:
        nt.links.new(tc.outputs["Generated"], noise.inputs["Vector"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-430, 0)
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = lin(base_hex)
    if second_hex:
        ramp.color_ramp.elements[1].position = 0.78
        ramp.color_ramp.elements[1].color = lin(second_hex)
    else:
        ramp.color_ramp.elements[1].position = 0.78
        ramp.color_ramp.elements[1].color = tuple(min(1.0, c * 1.16) for c in lin(base_hex)[:3]) + (1.0,)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])

    bump_node = nt.nodes.new("ShaderNodeBump")
    bump_node.location = (100, -130)
    bump_node.inputs["Strength"].default_value = bump
    bump_node.inputs["Distance"].default_value = 0.16
    nt.links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    nt.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


ST_ROOF = pbr("ST_RoofBlue", "#2E5870", "#668693", rough=0.48, metal=0.35,
              noise_scale=3.0, bump=0.32)
ST_RUST = pbr("ST_Rust", "#7A4A35", "#4D3028", rough=0.92, noise_scale=7.0, bump=0.25)
ST_SEAM = pbr("ST_RoofSeam", "#1F3139", "#3C4F56", rough=0.4, metal=0.5,
              noise_scale=5.0, bump=0.2)
ST_DECK = pbr("ST_RoofDeck", "#1B2A30", "#30434A", rough=0.86, metal=0.12,
              noise_scale=4.0, bump=0.3)
ST_GRASS = pbr("ST_Grass", "#55753A", "#8A7B48", rough=0.93, noise_scale=18.0, bump=0.2)
ST_DIRT = pbr("ST_Dirt", "#69503B", "#947455", rough=0.98, noise_scale=12.0, bump=0.28)
ST_ROCK = pbr("ST_Rock", "#4F504A", "#777367", rough=0.9, noise_scale=8.0, bump=0.4)
ST_PINE_D = pbr("ST_PineDark", "#264A32", "#3C633D", rough=0.93, noise_scale=9.0, bump=0.15)
ST_PINE_L = pbr("ST_PineLight", "#365E3E", "#527B49", rough=0.92, noise_scale=9.0, bump=0.15)
ST_BARK = pbr("ST_Bark", "#50341F", "#715033", rough=0.95, noise_scale=6.0, bump=0.3)
ST_MOSS = pbr("ST_Moss", "#4B6B36", "#6A8245", rough=0.97, noise_scale=14.0, bump=0.2)


# ---------------------------------------------------------------- collections / visibility
def new_collection(name):
    c = bpy.data.collections.get(name)
    if c:
        return c
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


ROOF_COLL = new_collection("STYLE_Roof")
LAND_COLL = new_collection("STYLE_Land")
FOREST_COLL = new_collection("STYLE_Forest")
DETAIL_COLL = new_collection("STYLE_Details")

for c in bpy.data.collections:
    c.hide_render = False
    c.hide_viewport = False
for o in bpy.data.objects:
    o.hide_render = False
    try:
        o.hide_set(False)
    except Exception:
        pass


def hide_prefixes(prefixes):
    for o in bpy.data.objects:
        if o.name.startswith(prefixes):
            o.hide_render = True


def hide_tree_groups():
    for o in bpy.data.objects:
        if o.type == "EMPTY" and o.name.startswith(("TREE_", "TREE_Sapling_")):
            for child in [o] + list(o.children_recursive):
                child.hide_render = True


hide_prefixes((
    "ROOF_Plank_", "ROOF_Moss_", "ROOF_RidgeCap_", "ROOF_RidgeBeam",
    "SIDE_RoofPlank_", "SIDE_RoofUnder", "SIDE_RoofFascia",
    "YARD_Ground", "YARD_Meadow", "YARD_Path", "YARD_GrassTufts",
    "YARD_Flower_", "YARD_Rock_", "YARD_Bush_", "YARD_TireStackBlue",
    "YARD_Barrel", "YARD_Pickup", "PICKUP_",
))

# make sure the main structure is visible


# ---------------------------------------------------------------- detailed pines
def group(name, loc):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    FOREST_COLL.objects.link(e)
    e.empty_display_size = 0.5
    return e


def pine(name, x, y, height, radius):
    g = group(name, (x, y, 0.0))
    trunk_h = height * 0.58
    trunk = quad_tube(name + "_Trunk", radius, radius * 0.48, trunk_h,
                      (0, 0, trunk_h / 2), "ST_Bark", FOREST_COLL, segments=8)
    trunk.parent = g
    # exposed lower branches
    for i, a in enumerate((0.2, 1.5, 2.8, 4.2)):
        rod(name + "_Root_{:02d}".format(i),
            (x, y, 0.04),
            (x + math.cos(a) * radius * 2.2, y + math.sin(a) * radius * 2.2, 0.0),
            radius * 0.25, "ST_Bark", FOREST_COLL, segments=8)
    tiers = 11
    for i in range(tiers):
        t = i / (tiers - 1)
        z = height * 0.24 + t * height * 0.75
        rr = max(0.22, radius * (3.7 - 3.05 * t))
        clumps = 5 if i < tiers - 2 else 3
        for k in range(clumps):
            a = 2 * math.pi * k / clumps + random.uniform(-0.45, 0.45)
            radial = rr * random.uniform(0.68, 1.05)
            px = math.cos(a) * radial
            py = math.sin(a) * radial
            pz = z + random.uniform(-0.12, 0.12)
            mat = ST_PINE_L if (i + k) % 3 else ST_PINE_D
            clump = quad_sphere(
                "{}_{:02d}_{:02d}".format(name, i, k),
                random.uniform(0.36, 0.62) * (1.0 - t * 0.35),
                (px, py, pz), mat, FOREST_COLL,
                scale=(random.uniform(1.05, 1.8), random.uniform(0.55, 0.90),
                       random.uniform(0.24, 0.40)),
                subdiv=1)
            clump.parent = g
            clump.rotation_euler[2] = a
    crown = quad_sphere(name + "_Crown", radius * 0.42, (0, 0, height * 0.985),
                        ST_PINE_L, FOREST_COLL, scale=(1.0, 1.0, 1.45), subdiv=2)
    crown.parent = g
    return g


pine_positions = [
    (-14.5, -8.0, 16.0, 0.58), (-11.0, 1.0, 17.0, 0.62),
    (-8.5, 10.0, 15.0, 0.55), (-2.0, 13.0, 16.5, 0.60),
    (5.0, 11.5, 14.0, 0.52), (11.0, 7.0, 14.5, 0.52),
    (15.5, 0.0, 15.0, 0.56), (13.0, -8.0, 12.5, 0.46),
    (-15.0, -13.0, 13.0, 0.50), (7.0, -13.0, 12.0, 0.44),
    (-19.0, 5.0, 15.5, 0.55), (19.0, 6.5, 13.5, 0.48),
    (0.0, 17.0, 14.5, 0.52), (-7.0, -16.0, 12.0, 0.44),
    (-18.0, -6.0, 14.0, 0.52), (17.0, -4.0, 13.0, 0.48),
    (-12.5, -5.5, 18.0, 0.70), (12.0, -5.0, 17.0, 0.65),
]
# Keep the base low-poly pine forest; the cabin/roof/terrain carry the test.
# (The experimental clump pine prototype is left in the script for later refinement.)



# ---------------------------------------------------------------- terrain
def terrain_z(x, y):
    mound = 0.13 * math.exp(-((x / 8.5) ** 2 + ((y + 0.8) / 7.0) ** 2))
    ripple = 0.022 * math.sin(x * 0.34) * math.cos(y * 0.29)
    ripple += 0.012 * math.sin(x * 0.95 + y * 0.18) * math.cos(y * 0.65)
    return -0.035 + mound + ripple


def build_terrain():
    x0, x1, y0, y1 = -23.0, 23.0, -19.0, 15.0
    nx, ny = 58, 46
    verts = []
    for j in range(ny + 1):
        y = y0 + (y1 - y0) * j / ny
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            verts.append((x, y, terrain_z(x, y)))
    faces = []
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    new_obj("STYLE_Terrain", verts, faces, "ST_Grass", LAND_COLL, smooth=False)


build_terrain()

# dirt path and worn patches
ribbon("STYLE_Path", [(0.0, -8.4), (-0.2, -7.6), (0.15, -6.9), (-0.1, -6.2),
                      (-0.55, -5.5), (-0.55, -4.9)], [2.5, 2.25, 2.1, 2.0, 1.9, 1.8],
       0.16, "ST_Dirt", LAND_COLL)
ribbon("STYLE_DirtPatch_L", [(-7.8, -5.0), (-6.5, -4.5), (-5.4, -4.7), (-4.8, -5.4)],
       [1.2, 1.5, 1.3, 0.8], 0.15, "ST_Dirt", LAND_COLL)
ribbon("STYLE_DirtPatch_R", [(3.2, -6.8), (4.6, -6.4), (5.8, -6.3), (6.8, -6.8)],
       [1.0, 1.7, 1.5, 0.7], 0.15, "ST_Dirt", LAND_COLL)


# rocks / boulders
for i in range(42):
    angle = random.uniform(0, 6.28)
    dist = random.uniform(5.5, 10.5)
    x = math.cos(angle) * dist
    y = math.sin(angle) * dist * 0.9 - 0.5
    if abs(x) < 5.8 and abs(y) < 3.8:
        continue
    z = terrain_z(x, y)
    size = random.uniform(0.18, 0.62)
    r = quad_sphere("STYLE_Rock_{:02d}".format(i), size, (x, y, z + size * 0.25),
                    "ST_Rock", LAND_COLL,
                    scale=(random.uniform(1.1, 1.7), random.uniform(0.75, 1.2),
                           random.uniform(0.45, 0.75)), subdiv=2)
    if random.random() < 0.35:
        m = quad_sphere("STYLE_RockMoss_{:02d}".format(i), size * 0.62,
                        (x, y, z + size * 0.44), "ST_Moss", LAND_COLL,
                        scale=(1.2, 0.8, 0.22), subdiv=2)

# tall grass clumps
def build_tall_grass():
    verts = []
    faces = []
    for i in range(820):
        x = random.uniform(-14.5, 14.5)
        y = random.uniform(-11.5, 10.0)
        if abs(x) < 6.8 and abs(y) < 3.9:
            continue
        if abs(x) < 1.7 and -8.8 < y < -4.5:
            continue
        base_z = terrain_z(x, y) + 0.02
        for blade in range(4):
            a = random.uniform(0, 6.28)
            h = random.uniform(0.25, 0.85)
            w = random.uniform(0.018, 0.035)
            dx, dy = math.cos(a) * w, math.sin(a) * w
            bend = random.uniform(-0.16, 0.16)
            start = len(verts)
            for seg in range(4):
                t = seg / 3
                zz = base_z + h * t
                px = x + bend * t * t
                py = y + bend * 0.4 * t * t
                ww = 1.0 - t * 0.86
                verts.append((px - dx * ww, py - dy * ww, zz))
                verts.append((px + dx * ww, py + dy * ww, zz))
            for seg in range(3):
                a0 = start + seg * 2
                faces.append((a0, a0 + 1, a0 + 3, a0 + 2))
    new_obj("STYLE_TallGrass", verts, faces, "ST_Grass", LAND_COLL)


build_tall_grass()

# small wildflowers
for i in range(26):
    a = random.uniform(0, 6.28)
    dist = random.uniform(6.0, 10.0)
    x = math.cos(a) * dist
    y = math.sin(a) * dist * 0.8 - 0.4
    z = terrain_z(x, y)
    if abs(x) < 5.8 and abs(y) < 3.6:
        continue
    stem = rod("STYLE_FlowerStem_{:02d}".format(i), (x, y, z), (x, y, z + 0.30),
               0.012, "ST_PineLight", LAND_COLL, segments=8)
    for k in range(5):
        ang = 2 * math.pi * k / 5
        box("STYLE_Flower_{:02d}_{:02d}".format(i, k), (0.07, 0.11, 0.018),
            (x + math.cos(ang) * 0.05, y + math.sin(ang) * 0.05, z + 0.30),
            "ST_Rust" if i % 3 == 0 else "ST_Grass", LAND_COLL,
            rotation=(0, 0, ang))

# bushes
for i in range(11):
    a = random.uniform(0, 6.28)
    dist = random.uniform(6.2, 9.8)
    x = math.cos(a) * dist
    y = math.sin(a) * dist * 0.8 - 0.4
    z = terrain_z(x, y)
    if abs(x) < 5.8 and abs(y) < 3.6:
        continue
    for k in range(5):
        ox = random.uniform(-0.45, 0.45)
        oy = random.uniform(-0.35, 0.35)
        quad_sphere("STYLE_Bush_{:02d}_{:02d}".format(i, k),
                    random.uniform(0.35, 0.68),
                    (x + ox, y + oy, z + random.uniform(0.18, 0.45)),
                    "ST_PineLight" if k % 2 else "ST_PineDark", LAND_COLL,
                    scale=(1.3, 0.9, 0.65), subdiv=2)


# ---------------------------------------------------------------- blue weathered roof
def blue_roof():
    front_angle = math.atan2(1.78, 4.80)
    back_angle = math.atan2(1.78, 3.90)
    for side in (-1, 1):
        if side < 0:
            eave_y, ridge_y = -4.80, 0.0
            ang = front_angle
            rot = (ang, 0, 0)
            normal = (0, -math.sin(ang), math.cos(ang))
        else:
            eave_y, ridge_y = 3.90, 0.0
            ang = back_angle
            rot = (math.pi - ang, 0, 0)
            normal = (0, math.sin(ang), math.cos(ang))
        rows, cols = 8, 14
        # a thick dark deck below, so gaps read as real roof construction
        deck_len = math.hypot(abs(ridge_y - eave_y), 1.76)
        deck_center_z = 3.82
        deck_center_y = (eave_y + ridge_y) * 0.5
        deck_rot = (front_angle, 0, 0) if side < 0 else (math.pi - back_angle, 0, 0)
        box("STYLE_RoofDeck_{:s}".format("F" if side < 0 else "B"),
            (13.9, deck_len, 0.18), (0, deck_center_y, deck_center_z),
            "ST_DECK", ROOF_COLL, rotation=deck_rot)
        # thick old timber rafters under the eave
        for j, x in enumerate((-6.0, -4.6, -3.2, -1.8, -0.4, 1.0, 2.4, 3.8, 5.2, 6.3)):
            quad_tube("STYLE_EaveRafter_{:s}_{:02d}".format("F" if side < 0 else "B", j),
                      0.085, 0.085, 0.78,
                      (x, -4.98 if side < 0 else 4.08, 2.93), "ST_Bark", ROOF_COLL,
                      segments=8, rotation=(math.pi / 2, 0, 0))
        # thick fascia board, visible from the side
        box("STYLE_EaveFascia_{:s}".format("F" if side < 0 else "B"),
            (13.85, 0.26, 0.24), (0, -4.86 if side < 0 else 4.00, 2.94),
            "ST_Bark", ROOF_COLL)
        rows, cols = 3, 14
        slope_len = math.hypot(abs(ridge_y - eave_y), 1.76)
        for r in range(rows):
            t = (r + 0.52) / rows
            by = eave_y + (ridge_y - eave_y) * t
            bz = 3.02 + 1.76 * t
            for c in range(cols):
                if random.random() < 0.025:
                    continue
                stagger = (r % 2) * (13.1 / cols) * 0.18
                x = -6.6 + 13.2 * (c + 0.5) / cols + stagger + random.uniform(-0.04, 0.04)
                w = 1.15 * random.uniform(0.94, 1.06)
                ln = slope_len / rows + 0.34 + random.uniform(-0.04, 0.05)
                lift = 0.16 + r * 0.018 + random.uniform(0.0, 0.035)
                loc = (x, by + normal[1] * lift, bz + normal[2] * lift)
                rr = (rot[0] + random.uniform(-0.028, 0.028), 0,
                      random.uniform(-0.018, 0.018))
                box("STYLE_RoofPanel_{:s}_{:02d}_{:02d}".format(
                        "F" if side < 0 else "B", r, c),
                    (w, ln, 0.095), loc, "ST_RoofBlue", ROOF_COLL, rotation=rr)
        # horizontal sheet breaks / folded seams
        for j, tt in enumerate((0.34, 0.67)):
            by = eave_y + (ridge_y - eave_y) * tt
            bz = 3.02 + 1.76 * tt
            loc = (0, by + normal[1] * 0.27, bz + normal[2] * 0.27)
            box("STYLE_CrossSeam_{:s}_{:02d}".format("F" if side < 0 else "B", j),
                (13.4, 0.16, 0.055), loc, "ST_RoofSeam", ROOF_COLL, rotation=rot)
        # thick, slightly lifted eave planks and a few crooked ends
        for j in range(11):
            x = -6.35 + j * 1.27
            if random.random() < 0.18:
                continue
            box("STYLE_EavePlank_{:s}_{:02d}".format("F" if side < 0 else "B", j),
                (random.uniform(0.92, 1.18), random.uniform(0.30, 0.48), 0.14),
                (x, (-4.87 if side < 0 else 3.97) + random.uniform(-0.08, 0.08),
                 2.98 + random.uniform(-0.03, 0.08)),
                "ST_RoofBlue", ROOF_COLL,
                rotation=(rot[0] + random.uniform(-0.04, 0.08), 0,
                          random.uniform(-0.05, 0.05)))
        # long seam ribs down the slope
        for j in range(7):
            x = -6.2 + j * 2.05
            by = (eave_y + ridge_y) * 0.5
            bz = 3.90
            loc = (x, by + normal[1] * 0.27, bz + normal[2] * 0.27)
            box("STYLE_RoofSeam_{:s}_{:02d}".format("F" if side < 0 else "B", j),
                (0.075, 4.9, 0.085), loc, "ST_RoofSeam", ROOF_COLL, rotation=rot)
        # rusty patches
        for j in range(9):
            c = random.randrange(cols)
            r = random.randrange(rows)
            t = (r + 0.52) / rows
            x = -6.5 + 13.0 * (c + 0.5) / cols + random.uniform(-0.25, 0.25)
            by = eave_y + (ridge_y - eave_y) * t
            bz = 3.08 + 1.76 * t
            loc = (x, by + normal[1] * 0.27, bz + normal[2] * 0.27)
            box("STYLE_RustPatch_{:s}_{:02d}".format("F" if side < 0 else "B", j),
                (random.uniform(0.2, 0.5), random.uniform(0.1, 0.28), 0.012),
                loc, "ST_Rust", ROOF_COLL, rotation=rot)
    # ridge cap
    for i in range(18):
        x = -6.55 + i * 0.77
        box("STYLE_RidgeCap_{:02d}".format(i), (0.82, 0.48, 0.14),
            (x, 0, 4.84), "ST_RoofSeam", ROOF_COLL, rotation=(math.pi / 4, 0, 0))
    # blue panels over the right lean-to
    ang = math.atan2(0.58, 1.70)
    for i in range(5):
        y = -3.42 + i * 1.02
        box("STYLE_SideRoofPanel_{:02d}".format(i), (2.02, 0.96, 0.12),
            (7.07, y, 2.79), "ST_RoofBlue", ROOF_COLL,
            rotation=(0, ang + random.uniform(-0.02, 0.02),
                      random.uniform(-0.02, 0.02)))
    # moss at the eave
    for i in range(22):
        side = random.choice((-1, 1))
        x = random.uniform(-6.3, 6.3)
        y = -4.55 + random.uniform(-0.1, 0.1) if side < 0 else 3.65 + random.uniform(-0.1, 0.1)
        z = 3.10
        m = quad_sphere("STYLE_RoofMoss_{:02d}".format(i), 0.16,
                        (x, y, z + random.uniform(0.0, 0.05)), "ST_Moss", ROOF_COLL,
                        scale=(random.uniform(1.0, 1.8), random.uniform(0.7, 1.1),
                               random.uniform(0.2, 0.35)), subdiv=2)


blue_roof()


# ---------------------------------------------------------------- lighting / camera / render
def set_world():
    world = scene.world
    if world is None:
        world = bpy.data.worlds.new("STYLE_World")
        scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get("Background")
    if bg is None:
        nt.nodes.clear()
        bg = nt.nodes.new("ShaderNodeBackground")
        out = nt.nodes.new("ShaderNodeOutputWorld")
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bg.inputs["Color"].default_value = lin("#6BB3D6")
    bg.inputs["Strength"].default_value = 0.52


set_world()
sun = bpy.data.objects.get("LGT_Sun")
if sun:
    sun.data.energy = 5.2
    sun.data.color = lin("#FFD6A0")[:3]
    sun.data.angle = 0.10
    sun.rotation_euler = (math.radians(65), math.radians(-25), math.radians(-28))
else:
    d = bpy.data.lights.new("STYLE_Sun", "SUN")
    sun = bpy.data.objects.new("STYLE_Sun", d)
    scene.collection.objects.link(sun)
    sun.data.energy = 4.6
    sun.rotation_euler = (math.radians(58), math.radians(-18), math.radians(32))

# extra cool fill from the sky side
fill_data = bpy.data.lights.new("STYLE_SkyFill", "AREA")
fill_data.energy = 320
fill_data.color = lin("#B9DCF0")[:3]
fill_data.shape = "DISK"
fill_data.size = 12
fill = bpy.data.objects.new("STYLE_SkyFill", fill_data)
fill.location = (-8, -15, 12)
fill.rotation_euler = (math.radians(55), 0, math.radians(-25))
scene.collection.objects.link(fill)

# low warm bounce just off the porch
warm_data = bpy.data.lights.new("STYLE_WarmBounce", "AREA")
warm_data.energy = 70
warm_data.color = lin("#FFC88D")[:3]
warm_data.shape = "DISK"
warm_data.size = 3.0
warm = bpy.data.objects.new("STYLE_WarmBounce", warm_data)
warm.location = (0.0, -6.0, 2.0)
warm.rotation_euler = (math.radians(80), 0, 0)
scene.collection.objects.link(warm)

# camera
cam_data = bpy.data.cameras.new("STYLE_Camera")
cam_data.lens = 44
cam_data.clip_start = 0.1
cam_data.clip_end = 250
cam = bpy.data.objects.new("STYLE_Camera", cam_data)
scene.collection.objects.link(cam)
cam.location = (12.8, -24.5, 7.2)
target = Vector((-0.2, -0.8, 2.35))
cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 96
scene.eevee.taa_samples = 24
scene.eevee.use_shadows = True
scene.eevee.shadow_pool_size = "2048"
scene.eevee.shadow_resolution_scale = 0.65
if hasattr(scene.eevee, "use_raytracing"):
    scene.eevee.use_raytracing = True
if hasattr(scene.eevee, "use_fast_gi"):
    scene.eevee.use_fast_gi = True
scene.render.resolution_x = 2560
scene.render.resolution_y = 1440
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = 0.22
scene.render.filepath = OUT_IMG

bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
print("SAVED", OUT_BLEND)
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT_IMG)
