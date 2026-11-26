"""Build the Guangqiang cabin (熊出没 光头强的小木屋) as an editable Blender scene.

Run headless:
  blender --background --factory-startup --python build_cabin.py
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
from cabin_lib import (box, quad_tube, quad_sphere, torus, rod, ribbon,
                       grid_plane, bowl, join_objects, empty, lin)

OUT_BLEND = os.path.join(ROOT, "Guangqiang_Cabin.blend")
RENDER_DIR = os.path.join(ROOT, "renders")
os.makedirs(RENDER_DIR, exist_ok=True)

# ---------------------------------------------------------------- collections & materials
C = {}


def setup_collections():
    C["root"] = L.make_collection("GUANGQIANG_CABIN")
    C["house"] = L.make_collection("House", C["root"])
    C["arch"] = L.make_collection("House_Structure", C["house"])
    C["near"] = L.make_collection("House_Cutaway_Near", C["house"])
    C["roof"] = L.make_collection("Roof", C["house"])
    C["bed"] = L.make_collection("Interior_Bedroom", C["house"])
    C["kit"] = L.make_collection("Interior_Kitchen", C["house"])
    C["bath"] = L.make_collection("Interior_Bathroom", C["house"])
    C["yard"] = L.make_collection("Yard", C["root"])
    C["fence"] = L.make_collection("Yard_Fence", C["yard"])
    C["props"] = L.make_collection("Yard_Props", C["yard"])
    C["vehicle"] = L.make_collection("Yard_Vehicle", C["yard"])
    C["woodshed"] = L.make_collection("Yard_Woodshed", C["yard"])
    C["forest"] = L.make_collection("Forest", C["root"])
    C["lights"] = L.make_collection("Lighting", C["root"])
    C["cams"] = L.make_collection("Cameras", C["root"])


def setup_materials():
    L.make_wood("M_Log", "#7B4327", rough=0.86, scale=3.0)
    L.make_wood("M_LogCut", "#C7975B", rough=0.90, scale=6.0)
    L.make_wood("M_WoodWarm", "#A86536", rough=0.82, scale=4.5)
    L.make_wood("M_WoodDark", "#543321", rough=0.88, scale=4.0)
    L.make_wood("M_WoodLight", "#C08A4D", rough=0.82, scale=4.0)
    L.make_wood("M_WoodGray", "#7E6D58", rough=0.88, scale=4.0)
    L.make_wood("M_WoodFence", "#8A6747", rough=0.92, scale=3.5)
    L.make_wood("M_WoodDeck", "#9A6D43", rough=0.88, scale=4.0)
    L.make_planks("M_FloorWood", "#80654B", "#967957", "#4C3A2A",
                  scale=2.8, brick_width=1.1, row_height=0.16)
    L.make_planks("M_TileBath", "#8F9E99", "#A1ADA7", "#5E6B67",
                  scale=5.0, brick_width=0.45, row_height=0.45, mortar_size=0.004)
    L.make_planks("M_Brick", "#8A6B57", "#745443", "#4E372B",
                  scale=4.0, brick_width=0.42, row_height=0.22, mortar_size=0.012)
    L.make_toon("M_DoorRed", "#9E352D", rough=0.62, scale=4.0, variation=0.06)
    L.make_toon("M_RedTrim", "#B34737", rough=0.7, scale=4.5, variation=0.05)
    L.make_toon("M_Curtain", "#E8DDC6", rough=0.95, scale=5.0, variation=0.04)
    L.make_toon("M_CurtainRed", "#A94337", rough=0.92, scale=5.0, variation=0.05)
    L.make_toon("M_TireBlue", "#404D56", rough=0.86, scale=6.0, variation=0.07)
    L.make_toon("M_BarrelWood", "#86502C", rough=0.88, scale=4.0, variation=0.10)
    L.make_toon("M_Moss", "#5C7A3F", rough=0.96, scale=7.0, variation=0.12)
    L.make_toon("M_RoofPlum", "#694958", rough=0.9, scale=5.0, variation=0.12)
    L.make_toon("M_RoofRose", "#7B5962", rough=0.9, scale=5.0, variation=0.12)
    L.make_toon("M_RoofDeep", "#523A43", rough=0.92, scale=5.0, variation=0.12)
    L.make_toon("M_WallBlue", "#AEC6CE", rough=0.92, scale=3.0, variation=0.05)
    L.make_toon("M_WallMint", "#BFCDB3", rough=0.92, scale=3.0, variation=0.05)
    L.make_toon("M_WallYellow", "#D6B262", rough=0.9, scale=3.2, variation=0.06)
    L.make_toon("M_WallCream", "#D8CBB1", rough=0.9, scale=3.0, variation=0.05)
    L.make_toon("M_Grass", "#75A94C", rough=0.95, scale=8.0, variation=0.12)
    L.make_toon("M_GrassDark", "#557D3D", rough=0.96, scale=7.0, variation=0.12)
    L.make_toon("M_Dirt", "#8F6748", rough=0.98, scale=12.0, variation=0.12)
    L.make_toon("M_RoofBlue", "#4E6C7B", rough=0.9, scale=5.0, variation=0.12)
    L.make_toon("M_RoofSlate", "#7D7076", rough=0.92, scale=5.0, variation=0.12)
    L.make_toon("M_RoofBrown", "#5C4439", rough=0.9, scale=5.0, variation=0.12)
    L.make_toon("M_RoofMoss", "#5C6750", rough=0.94, scale=5.0, variation=0.12)
    L.make_toon("M_ShingleUnder", "#3E3129", rough=0.95, scale=4.0)
    L.make_toon("M_Metal", "#59656A", rough=0.38, metallic=0.75, scale=5.0, variation=0.06)
    L.make_toon("M_MetalDark", "#3B4244", rough=0.46, metallic=0.7, scale=5.0)
    L.make_toon("M_Chrome", "#B8C2C4", rough=0.22, metallic=0.9, scale=6.0)
    L.make_toon("M_Black", "#292A2A", rough=0.7, scale=4.0)
    L.make_toon("M_Tire", "#232322", rough=0.85, scale=6.0)
    L.make_glass("M_Glass")
    L.make_glass("M_GlassWarm", "#E8C98C", 0.5)
    L.make_emit("M_WarmGlow", "#FFD38B", 4.0)
    L.make_emit("M_Fire", "#FF7B2D", 5.0)
    L.make_toon("M_FabricGreen", "#78955E", rough=0.95, scale=5.0, variation=0.1)
    L.make_toon("M_FabricGreenLight", "#94AC73", rough=0.95, scale=5.0, variation=0.1)
    L.make_toon("M_FabricRed", "#A64C3E", rough=0.96, scale=5.0, variation=0.1)
    L.make_toon("M_FabricCream", "#E2D8C4", rough=0.96, scale=5.0, variation=0.06)
    L.make_toon("M_FabricBlue", "#4E708A", rough=0.96, scale=5.0, variation=0.08)
    L.make_toon("M_FabricYellow", "#D1A54B", rough=0.96, scale=5.0, variation=0.08)
    L.make_toon("M_Blanket", "#C6A05A", rough=0.96, scale=6.0, variation=0.08)
    L.make_toon("M_Ceramic", "#DAD6C9", rough=0.55, scale=5.0, variation=0.05)
    L.make_toon("M_CeramicBlue", "#A9C3C2", rough=0.7, scale=5.0, variation=0.06)
    L.make_toon("M_Clay", "#A76540", rough=0.9, scale=4.0, variation=0.08)
    L.make_toon("M_EnamelMint", "#8CBEB0", rough=0.42, metallic=0.12, scale=4.0, variation=0.05)
    L.make_toon("M_EnamelBlue", "#5D8E9E", rough=0.5, scale=4.0, variation=0.05)
    L.make_toon("M_Straw", "#C6A35F", rough=0.95, scale=7.0, variation=0.1)
    L.make_toon("M_Corn", "#D9B44A", rough=0.9, scale=7.0, variation=0.08)
    L.make_toon("M_Chili", "#A93228", rough=0.75, scale=8.0, variation=0.08)
    L.make_toon("M_Garlic", "#E4DBC8", rough=0.9, scale=8.0, variation=0.05)
    L.make_toon("M_Leaf", "#47733D", rough=0.95, scale=6.0, variation=0.1)
    L.make_toon("M_LeafDark", "#335B33", rough=0.96, scale=6.0, variation=0.1)
    L.make_toon("M_PickupBlue", "#3A6E9B", rough=0.38, metallic=0.25, scale=4.0, variation=0.08)
    L.make_toon("M_PickupRust", "#8A5134", rough=0.9, scale=5.0, variation=0.12)
    L.make_toon("M_Rope", "#A88958", rough=0.98, scale=8.0, variation=0.1)
    L.make_toon("M_Spider", "#BDB6A6", rough=0.98, scale=9.0, variation=0.05)
    L.make_toon("M_Stone", "#817B6B", rough=0.95, scale=6.0, variation=0.1)
    L.make_toon("M_SkinWood", "#D2B886", rough=0.9, scale=6.0, variation=0.05)


# ---------------------------------------------------------------- small generic builders
def grp(name, location, collection, rotation=(0, 0, 0)):
    e = empty(name, location, collection)
    e.rotation_euler = rotation
    return e


def bp(parent, name, size, local_loc, material, rotation=(0, 0, 0)):
    coll = parent.users_collection[0]
    o = box(name, size, local_loc, material, coll, rotation=rotation)
    o.parent = parent
    return o


def cp(parent, name, r1, r2, h, local_loc, material, cap_material=None,
       segments=8, rotation=(0, 0, 0)):
    coll = parent.users_collection[0]
    o = quad_tube(name, r1, r2, h, local_loc, material, coll,
                  cap_material=cap_material, segments=segments, rotation=rotation)
    o.parent = parent
    return o


def sp(parent, name, radius, local_loc, material, scale=(1, 1, 1), subdiv=2):
    coll = parent.users_collection[0]
    o = quad_sphere(name, radius, local_loc, material, coll, scale=scale, subdiv=subdiv)
    o.parent = parent
    return o


def wall_box(name, x0, x1, y0, y1, z0, z1, material, collection):
    return box(name, (x1 - x0, y1 - y0, z1 - z0),
               ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
               material, collection)


# ---------------------------------------------------------------- architecture
def build_architecture():
    arch = C["arch"]
    near = C["near"]

    # foundation and interior floor
    box("ARCH_Foundation", (12.7, 6.7, 0.24), (0, 0, 0.0), "M_Stone", arch)
    box("ARCH_FloorSlab", (12.25, 6.25, 0.10), (0, 0, 0.10), "M_WoodDark", arch)
    box("BED_Floor", (4.05, 5.95, 0.035), (-3.97, 0, 0.165), "M_FloorWood", C["bed"])
    box("KIT_Floor", (4.45, 5.95, 0.035), (0.28, 0, 0.165), "M_FloorWood", C["kit"])
    box("BATH_Floor", (3.45, 5.95, 0.04), (4.28, 0, 0.17), "M_TileBath", C["bath"])

    # back wall + left exterior wall
    wall_box("ARCH_Wall_Back", -6.05, 6.05, 2.95, 3.15, 0.12, 3.12, "M_Log", arch)
    wall_box("ARCH_Wall_Left", -6.15, -5.95, -3.05, 3.15, 0.12, 3.12, "M_Log", arch)
    wall_box("ARCH_Wall_Left_Inner", -5.94, -5.90, -2.9, 3.0, 0.16, 3.02,
             "M_WallBlue", C["bed"])
    wall_box("ARCH_Wall_Back_Inner_Bed", -5.9, -2.02, 2.90, 2.94, 0.16, 3.02,
             "M_WallBlue", C["bed"])
    wall_box("ARCH_Wall_Back_Inner_Kit", -1.86, 2.48, 2.90, 2.94, 0.16, 3.02,
             "M_WallMint", C["kit"])
    wall_box("ARCH_Wall_Back_Inner_Bath", 2.62, 5.9, 2.90, 2.94, 0.16, 3.02,
             "M_WallYellow", C["bath"])

    # right exterior wall is a separate cutaway piece
    wall_box("ARCH_Wall_Right", 5.95, 6.15, -3.05, 3.15, 0.12, 3.12, "M_Log", near)
    wall_box("ARCH_Wall_Right_Inner", 5.90, 5.94, -2.9, 3.0, 0.16, 3.02,
             "M_WallYellow", near)

    # front wall pieces around two doors
    wall_box("ARCH_Wall_Front_L", -6.05, -0.90, -3.15, -2.95, 0.12, 3.12, "M_Log", near)
    wall_box("ARCH_Wall_Front_M", 0.20, 4.125, -3.15, -2.95, 0.12, 3.12, "M_Log", near)
    wall_box("ARCH_Wall_Front_R", 4.975, 6.05, -3.15, -2.95, 0.12, 3.12, "M_Log", near)
    wall_box("ARCH_Wall_Front_HeaderDoor", -0.90, 0.20, -3.15, -2.95, 2.28, 3.12,
             "M_Log", near)
    wall_box("ARCH_Wall_Front_HeaderBath", 4.125, 4.975, -3.15, -2.95, 2.06, 3.12,
             "M_Log", near)

    # partitions, with a doorway near the porch side
    for x0, x1, left_mat, right_mat, coll_name in (
            (-2.02, -1.90, "M_WallBlue", "M_WallMint", "bed"),
            (2.49, 2.61, "M_WallMint", "M_WallYellow", "bath")):
        coll = C[coll_name]
        # rear portion
        wall_box("ARCH_Partition_Back_{:.2f}".format(x0), x0, x1, -1.55, 3.05,
                 0.12, 3.12, "M_WoodDark", arch)
        # short front portion
        wall_box("ARCH_Partition_Front_{:.2f}".format(x0), x0, x1, -3.05, -2.60,
                 0.12, 3.12, "M_WoodDark", arch)
        # header over doorway
        wall_box("ARCH_Partition_Header_{:.2f}".format(x0), x0, x1, -2.60, -1.55,
                 2.30, 3.12, "M_WoodDark", arch)
        # surface skins
        if x0 < 0:
            wall_box("BED_PartitionSkin", x0 - 0.035, x0, -1.52, 2.95, 0.18, 3.0,
                     left_mat, C["bed"])
            wall_box("KIT_PartitionSkin_L", x1, x1 + 0.035, -1.52, 2.95, 0.18, 3.0,
                     right_mat, C["kit"])
        else:
            wall_box("KIT_PartitionSkin_R", x0 - 0.035, x0, -1.52, 2.95, 0.18, 3.0,
                     left_mat, C["kit"])
            wall_box("BATH_PartitionSkin", x1, x1 + 0.035, -1.52, 2.95, 0.18, 3.0,
                     right_mat, C["bath"])
        # door frame verticals
        for y, name in ((-2.60, "F"), (-1.55, "B")):
            box("ARCH_DoorFrame_{}_{}".format(name, "L" if x0 < 0 else "R"),
                (0.14, 0.12, 2.28), (x0 - 0.02, y, 1.26), "M_WoodDark", arch)

    # door frames / front doors
    for cx, w, h, label in ((-0.35, 1.10, 2.16, "Main"), (4.55, 0.85, 1.94, "Bath")):
        for side in (-1, 1):
            box("ARCH_FrontDoorFrame_{}_{}".format(label, side),
                (0.12, 0.15, h + 0.10), (cx + side * (w / 2 + 0.03), -3.02, 1.20),
                "M_WoodDark", near)
        box("ARCH_FrontDoorHeader_{}".format(label),
            (w + 0.22, 0.15, 0.12), (cx, -3.02, h + 0.10), "M_WoodDark", near)
        # door leaf slightly recessed
        box("ARCH_DoorLeaf_{}".format(label), (w - 0.08, 0.06, h - 0.06),
            (cx, -2.99, h / 2 + 0.12), "M_DoorRed", near)
        for panel in (-0.26, 0.26):
            box("ARCH_DoorPanel_{}_{}".format(label, panel),
                (w * 0.36, 0.025, h * 0.28), (cx + panel * w, -2.955, h * 0.55),
                "M_RedTrim", near)
        cp(None, "x", 0.001, 0.001, 0.001, (0, 0, 0), "M_Metal") if False else None
        box("ARCH_DoorKnob_{}".format(label), (0.07, 0.07, 0.07),
            (cx + w * 0.30, -2.93, h * 0.52), "M_Chrome", near)

    # windows: back wall and left wall + front wall
    def window(name, center, width, height, normal_axis, collection, glass="M_Glass"):
        cx, cy, cz = center
        if normal_axis == "Y":
            box(name + "_FrameTop", (width + 0.18, 0.12, 0.10),
                (cx, cy, cz + height / 2), "M_WoodDark", collection)
            box(name + "_FrameBot", (width + 0.18, 0.12, 0.10),
                (cx, cy, cz - height / 2), "M_WoodDark", collection)
            box(name + "_FrameL", (0.10, 0.12, height),
                (cx - width / 2, cy, cz), "M_WoodDark", collection)
            box(name + "_FrameR", (0.10, 0.12, height),
                (cx + width / 2, cy, cz), "M_WoodDark", collection)
            box(name + "_MuntinV", (0.045, 0.07, height - 0.1),
                (cx, cy - 0.02, cz), "M_WoodDark", collection)
            box(name + "_MuntinH", (width - 0.08, 0.07, 0.045),
                (cx, cy - 0.02, cz), "M_WoodDark", collection)
            box(name + "_Glass", (width - 0.14, 0.025, height - 0.14),
                (cx, cy - 0.035, cz), glass, collection)
            box(name + "_Sill", (width + 0.24, 0.18, 0.06),
                (cx, cy - 0.10, cz - height / 2 - 0.05), "M_WoodLight", collection)
        else:
            box(name + "_FrameTop", (0.12, width + 0.18, 0.10),
                (cx, cy, cz + height / 2), "M_WoodDark", collection)
            box(name + "_FrameBot", (0.12, width + 0.18, 0.10),
                (cx, cy, cz - height / 2), "M_WoodDark", collection)
            box(name + "_FrameL", (0.12, 0.10, height),
                (cx, cy - width / 2, cz), "M_WoodDark", collection)
            box(name + "_FrameR", (0.12, 0.10, height),
                (cx, cy + width / 2, cz), "M_WoodDark", collection)
            box(name + "_MuntinV", (0.07, 0.045, height - 0.1),
                (cx - 0.02, cy, cz), "M_WoodDark", collection)
            box(name + "_MuntinH", (0.07, width - 0.08, 0.045),
                (cx - 0.02, cy, cz), "M_WoodDark", collection)
            box(name + "_Glass", (0.025, width - 0.14, height - 0.14),
                (cx - 0.035, cy, cz), glass, collection)
            box(name + "_Sill", (0.18, width + 0.24, 0.06),
                (cx - 0.10, cy, cz - height / 2 - 0.05), "M_WoodLight", collection)

    window("BED_Window_Back", (-4.15, 2.92, 1.95), 1.55, 1.30, "Y", C["bed"])
    window("KIT_Window_Back", (0.40, 2.92, 1.95), 1.50, 1.10, "Y", C["kit"])
    window("BATH_Window_Back", (4.35, 2.92, 2.05), 0.80, 0.70, "Y", C["bath"])
    window("BED_Window_Left", (-5.90, -0.55, 1.85), 1.15, 1.20, "X", C["bed"])
    window("BED_Window_Front", (-3.70, -3.18, 1.90), 1.20, 1.15, "Y", C["near"],
           glass="M_GlassWarm")
    window("KIT_Window_Front", (2.15, -3.18, 1.90), 1.20, 1.15, "Y", C["near"],
           glass="M_GlassWarm")

    # 春 paper cut on the bedroom window
    spring = grp("BED_SpringPaperCut", (-4.15, -3.00, 1.95), C["bed"], rotation=(0, 0, 0))
    # note: window is on the back wall; group is moved/rotated to sit on its glass
    spring.location = (-4.15, 2.84, 1.95)
    paper = bp(spring, "BED_Spring_RedPaper", (0.64, 0.012, 0.64), (0, 0, 0),
               "M_FabricRed")
    for i, (w, h, x, z, ry) in enumerate((
            (0.55, 0.045, 0.0, 0.25, 0.0),
            (0.64, 0.045, 0.0, 0.12, 0.0),
            (0.46, 0.040, -0.10, -0.02, 0.55),
            (0.44, 0.040, 0.10, -0.02, -0.55),
            (0.48, 0.045, 0.0, -0.15, 0.0),
            (0.26, 0.035, -0.14, -0.33, 0.0),
            (0.26, 0.035, 0.14, -0.33, 0.0),
            (0.26, 0.035, 0.0, -0.48, 0.0))):
        bp(spring, "BED_Spring_Stroke_{:02d}".format(i), (w, 0.014, h),
           (x, -0.015, z), "M_WoodDark", rotation=(0, ry, 0))
    for i, (x, z, h) in enumerate(((-0.14, -0.33, 0.22), (0.14, -0.33, 0.22),
                                   (0.0, -0.33, 0.22))):
        bp(spring, "BED_Spring_V_{:02d}".format(i), (0.035, 0.014, h),
           (x, -0.016, z), "M_WoodDark")

    # ceiling structure
    for i, y in enumerate((-2.55, -1.70, -0.85, 0.0, 0.85, 1.70, 2.55)):
        box("ARCH_CeilingBeam_{:02d}".format(i), (11.9, 0.16, 0.18),
            (0, y, 3.01), "M_WoodDark", near)
    box("ARCH_CeilingBeam_Long", (0.16, 5.9, 0.18), (-1.98, 0, 2.78), "M_WoodDark", near)

    # corner trim
    for x in (-5.97, 5.97):
        for y in (-2.97, 2.97):
            box("ARCH_CornerPost_{:.0f}_{:.0f}".format(x, y), (0.22, 0.22, 3.0),
                (x, y, 1.62), "M_WoodDark", arch)

    # exterior log courses on the two retained walls
    for i in range(11):
        z = 0.28 + i * 0.26
        if z > 2.95:
            continue
        quad_tube("ARCH_LogBack_{:02d}".format(i), 0.14, 0.14, 12.15, (0, 3.22, z),
                  "M_Log", arch, segments=8, rotation=(0, math.pi / 2, 0))
        quad_tube("ARCH_LogLeft_{:02d}".format(i), 0.14, 0.14, 6.15, (-6.22, 0, z),
                  "M_Log", arch, segments=8, rotation=(math.pi / 2, 0, 0))
        quad_tube("ARCH_LogRight_{:02d}".format(i), 0.14, 0.14, 6.15, (6.22, 0, z),
                  "M_Log", near, segments=8, rotation=(math.pi / 2, 0, 0))

    # gable ends: stacked logs with decreasing length
    for side, coll, is_near in ((-1, arch, False), (1, near, True)):
        x = side * 6.10
        for i, (ln, z) in enumerate(((5.9, 3.10), (5.1, 3.36), (4.25, 3.62),
                                      (3.45, 3.88), (2.65, 4.14), (1.85, 4.40),
                                      (1.10, 4.64))):
            quad_tube("ARCH_Gable_{}_{:02d}".format("L" if side < 0 else "R", i),
                      0.14, 0.14, ln, (x, 0, z), "M_Log", coll, segments=8,
                      rotation=(math.pi / 2, 0, 0))


def build_facade_and_porch_details():
    """Extra timber character based on the reference: red joinery, curtains, benches, rails."""
    near = C["near"]

    # horizontal log courses on the front wall, split around openings
    intervals = [(-6.00, -4.31), (-3.09, -0.90), (0.20, 1.55),
                 (2.75, 4.12), (4.98, 6.00)]
    for row in range(11):
        z = 0.30 + row * 0.255
        for i, (x0, x1) in enumerate(intervals):
            length = x1 - x0
            if length < 0.15:
                continue
            quad_tube("FACADE_Log_{:02d}_{:02d}".format(row, i), 0.105, 0.105,
                      length, ((x0 + x1) / 2, -3.225, z), "M_Log", near,
                      segments=8, rotation=(0, math.pi / 2, 0))

    # dark vertical posts and sill/header beams
    for i, x in enumerate((-5.98, -4.34, -3.05, 0.55, 3.35, 5.98)):
        box("FACADE_TimberPost_{:02d}".format(i), (0.16, 0.11, 2.94),
            (x, -3.30, 1.60), "M_WoodDark", near)
        box("FACADE_TimberFoot_{:02d}".format(i), (0.22, 0.16, 0.12),
            (x, -3.26, 0.19), "M_WoodDark", near)
    box("FACADE_TopBeam", (12.05, 0.12, 0.19), (0, -3.30, 3.00), "M_WoodDark", near)
    box("FACADE_BottomSill", (12.05, 0.14, 0.15), (0, -3.30, 0.18), "M_WoodDark", near)

    # red window joinery and cream curtains
    for tag, cx, cz, w, h in (("BED", -3.70, 1.90, 1.20, 1.15),
                                ("KIT", 2.15, 1.90, 1.20, 1.15)):
        # outer red frame
        box("FACADE_{}_RedTop".format(tag), (w + 0.24, 0.06, 0.075),
            (cx, -3.265, cz + h / 2 + 0.10), "M_RedTrim", near)
        box("FACADE_{}_RedBot".format(tag), (w + 0.24, 0.06, 0.075),
            (cx, -3.265, cz - h / 2 - 0.10), "M_RedTrim", near)
        for s in (-1, 1):
            box("FACADE_{}_RedSide_{}".format(tag, s), (0.075, 0.06, h + 0.24),
                (cx + s * (w / 2 + 0.10), -3.265, cz), "M_RedTrim", near)
        # red mullions over the dark ones
        box("FACADE_{}_RedMullionV".format(tag), (0.035, 0.035, h - 0.06),
            (cx, -3.25, cz), "M_RedTrim", near)
        box("FACADE_{}_RedMullionH".format(tag), (w - 0.08, 0.035, 0.035),
            (cx, -3.25, cz), "M_RedTrim", near)
        # cream curtains, gathered at both sides
        for s in (-1, 1):
            panel_x = cx + s * (w * 0.30)
            box("FACADE_{}_Curtain_{}".format(tag, s),
                (w * 0.22, 0.016, h * 0.92), (panel_x, -3.235, cz - 0.02),
                "M_Curtain", near, rotation=(0, 0, s * 0.03))
            box("FACADE_{}_CurtainTrim_{}".format(tag, s),
                (0.026, 0.018, h * 0.82),
                (panel_x - s * w * 0.09, -3.227, cz - 0.02), "M_CurtainRed", near)
        # little red diamond in the upper centre
        box("FACADE_{}_Diamond".format(tag), (0.14, 0.018, 0.14),
            (cx, -3.235, cz + h * 0.27), "M_CurtainRed", near,
            rotation=(0, math.pi / 4, 0))

    # red door, iron studs and hinges
    for tag, cx, w in (("Main", -0.35, 1.02), ("Bath", 4.55, 0.77)):
        h = 2.16 if tag == "Main" else 1.94
        box("FACADE_{}_DoorSeam".format(tag), (0.035, 0.025, h - 0.18),
            (cx, -3.035, 1.20), "M_WoodDark", near)
        for i, z in enumerate((0.50, 0.95, 1.40, 1.85)):
            box("FACADE_{}_Stud_{:02d}".format(tag, i), (0.05, 0.03, 0.05),
                (cx + (0.24 if i % 2 else -0.24), -3.04, z), "M_Black", near)
        for i, z in enumerate((0.62, 1.65)):
            box("FACADE_{}_Hinge_{:02d}".format(tag, i), (0.12, 0.035, 0.10),
                (cx - w / 2 + 0.06, -3.045, z), "M_MetalDark", near)
        box("FACADE_{}_DoorKick".format(tag), (w - 0.10, 0.035, 0.14),
            (cx, -3.04, 0.21), "M_WoodDark", near)

    # built-in benches below the front windows
    for tag, cx, cushion in (("L", -3.70, "M_FabricGreen"), ("R", 2.15, "M_FabricRed")):
        g = grp("PORCH_Bench_{}".format(tag), (cx, -3.72, 0.43), near)
        bp(g, "PORCH_Bench_{}_Seat".format(tag), (1.36, 0.52, 0.09), (0, 0, 0.37),
           "M_WoodWarm")
        bp(g, "PORCH_Bench_{}_Back".format(tag), (1.36, 0.10, 0.52), (0, 0.22, 0.63),
           "M_WoodWarm")
        bp(g, "PORCH_Bench_{}_Cushion".format(tag), (1.18, 0.40, 0.10), (0, -0.02, 0.45),
           cushion)
        for x in (-0.56, 0.56):
            for y in (-0.18, 0.18):
                bp(g, "PORCH_Bench_{}_Leg".format(tag), (0.08, 0.08, 0.36),
                   (x, y, 0.18), "M_WoodDark")

    # horizontal porch rails with X braces, leaving the stair opening free
    segments = [(-5.05, -2.00), (0.62, 1.05), (1.05, 3.05)]
    for j, (x0, x1) in enumerate(segments):
        box("PORCH_RailTop_{:02d}".format(j), (x1 - x0, 0.08, 0.09),
            ((x0 + x1) / 2, -4.53, 1.34), "M_WoodFence", near)
        box("PORCH_RailBottom_{:02d}".format(j), (x1 - x0, 0.07, 0.07),
            ((x0 + x1) / 2, -4.53, 0.58), "M_WoodFence", near)
        for k in range(2):
            a0, a1 = (x0, 0.60), (x1, 1.32)
            if k:
                a0, a1 = (x0, 1.32), (x1, 0.60)
            rod("PORCH_Brace_{:02d}_{:02d}".format(j, k),
                (a0[0], -4.53, a0[1]), (a1[0], -4.53, a1[1]), 0.038,
                "M_WoodFence", near, segments=8)
    for x in (-5.05, -2.0, 1.05, 3.05):
        quad_tube("PORCH_PostCap_{:.2f}".format(x), 0.12, 0.12, 0.07,
                  (x, -4.55, 3.19), "M_WoodDark", near, segments=8)

    # stair handrails
    for x in (-1.72, 0.62):
        for j, (y, z) in enumerate(((-5.12, 1.23), (-5.90, 0.94), (-6.68, 0.64))):
            box("PORCH_StairPost_{:.2f}_{:02d}".format(x, j), (0.08, 0.08, 0.78),
                (x, y, z - 0.20), "M_WoodFence", near)
        rod("PORCH_StairRail_A_{:.2f}".format(x), (x, -5.12, 1.23),
            (x, -5.90, 0.94), 0.038, "M_WoodFence", near, segments=8)
        rod("PORCH_StairRail_B_{:.2f}".format(x), (x, -5.90, 0.94),
            (x, -6.68, 0.64), 0.038, "M_WoodFence", near, segments=8)

    # pair of small lantern posts at the foot of the stairs
    for i, x in enumerate((-2.20, 0.92)):
        g = grp("PORCH_LampPost_{:02d}".format(i), (x, -6.92, 0.02), near)
        bp(g, "PORCH_LampPost_{}_Post".format(i), (0.14, 0.14, 1.75), (0, 0, 0.88),
           "M_WoodDark")
        bp(g, "PORCH_LampPost_{}_Foot".format(i), (0.26, 0.26, 0.16), (0, 0, 0.08),
           "M_Stone")
        bp(g, "PORCH_LampPost_{}_Head".format(i), (0.30, 0.30, 0.08), (0, 0, 1.79),
           "M_MetalDark")
        bp(g, "PORCH_LampPost_{}_Lantern".format(i), (0.18, 0.18, 0.28), (0, 0, 1.62),
           "M_WarmGlow")
        cp(g, "PORCH_LampPost_{}_Roof".format(i), 0.22, 0.10, 0.10, (0, 0, 1.95),
           "M_MetalDark", segments=8)


def build_interior_window_dressing():
    """Cream curtains and red trim on the two back-wall windows, visible in cutaway."""
    for tag, cx, cz, w, h, coll in (
            ("BED_Back", -4.15, 1.95, 1.55, 1.30, C["bed"]),
            ("KIT_Back", 0.40, 1.95, 1.50, 1.10, C["kit"])):
        # red inner frame
        for dz, name in ((1, "Top"), (-1, "Bot")):
            box("IWIN_{}_Red{}".format(tag, name), (w + 0.14, 0.045, 0.065),
                (cx, 2.855, cz + dz * (h / 2 + 0.06)), "M_RedTrim", coll)
        for side in (-1, 1):
            box("IWIN_{}_RedSide_{}".format(tag, side), (0.065, 0.045, h + 0.14),
                (cx + side * (w / 2 + 0.06), 2.855, cz), "M_RedTrim", coll)
        # curtain panels gathered at the sides
        for side in (-1, 1):
            px = cx + side * w * 0.28
            box("IWIN_{}_Curtain_{}".format(tag, side), (w * 0.23, 0.012, h * 0.88),
                (px, 2.865, cz - 0.02), "M_Curtain", coll, rotation=(0, 0, side * 0.03))
            box("IWIN_{}_CurtainTrim_{}".format(tag, side), (0.025, 0.014, h * 0.78),
                (px - side * w * 0.095, 2.858, cz - 0.02), "M_CurtainRed", coll)
        # valance
        box("IWIN_{}_Valance".format(tag), (w * 0.92, 0.018, 0.10),
            (cx, 2.852, cz + h / 2 - 0.05), "M_CurtainRed", coll)


def build_yard_extras():
    props = C["props"]
    # blue-grey tire stack, like the reference's three tires by the porch
    tg = grp("YARD_TireStackBlue", (4.08, -7.18, 0.02), props, rotation=(0, 0, 0.2))
    for i, z in enumerate((0.18, 0.47, 0.76)):
        t = torus("YARD_TireBlue_{:02d}".format(i), 0.40, 0.14, (0, 0, z),
                  "M_TireBlue", props, major_segments=28, minor_segments=10)
        t.parent = tg
        t.location = (0, 0, z)
        cp(tg, "YARD_TireBlueHub_{:02d}".format(i), 0.22, 0.22, 0.06,
           (0, 0, z + 0.01), "M_MetalDark", segments=12)
    # big wooden barrel
    bg = grp("YARD_Barrel", (-6.10, -4.55, 0.02), props, rotation=(0, 0, 0.12))
    cp(bg, "YARD_Barrel_Lower", 0.34, 0.42, 0.34, (0, 0, 0.17), "M_BarrelWood",
       cap_material="M_WoodDark", segments=16)
    cp(bg, "YARD_Barrel_Upper", 0.42, 0.33, 0.34, (0, 0, 0.51), "M_BarrelWood",
       cap_material="M_WoodDark", segments=16)
    cp(bg, "YARD_Barrel_Lid", 0.30, 0.27, 0.04, (0, 0, 0.70), "M_WoodDark",
       segments=16)
    for z, r in ((0.13, 0.36), (0.31, 0.42), (0.55, 0.40), (0.68, 0.34)):
        tp(bg, "YARD_Barrel_Hoop_{:.2f}".format(z), r, 0.016, (0, 0, z),
           "M_Metal", major_segments=20)
    for i in range(10):
        a = 2 * math.pi * i / 10
        bp(bg, "YARD_Barrel_Stave_{:02d}".format(i), (0.035, 0.035, 0.64),
           (math.cos(a) * 0.40, math.sin(a) * 0.40, 0.34), "M_WoodDark",
           rotation=(0, 0, a))




def build_roof():
    roof = C["roof"]
    # dark underlayer roof planes
    front_angle = math.atan2(1.78, 4.80)
    back_angle = math.atan2(1.78, 3.90)
    front_len = math.hypot(4.80, 1.78)
    back_len = math.hypot(3.90, 1.78)
    box("ROOF_FrontUnder", (13.7, front_len, 0.13), (0, -2.40, 3.89),
        "M_ShingleUnder", roof, rotation=(front_angle, 0, 0))
    box("ROOF_BackUnder", (13.7, back_len, 0.13), (0, 1.95, 3.89),
        "M_ShingleUnder", roof, rotation=(math.pi - back_angle, 0, 0))

    # larger, crooked over-lapping roof planks (reference: plum / rose / deep brown)
    mats = ["M_RoofPlum", "M_RoofRose", "M_RoofDeep", "M_RoofSlate", "M_RoofMoss"]
    weights = (52, 24, 12, 8, 4)
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
        rows = 9
        cols = 19
        for r in range(rows):
            t = (r + 0.54) / rows
            by = eave_y + (ridge_y - eave_y) * t
            bz = 3.02 + 1.76 * t
            for c in range(cols):
                if random.random() < 0.035:
                    continue
                stagger = (r % 2) * (13.1 / cols) * 0.30
                x = -6.55 + (13.1 * (c + 0.5) / cols) + stagger + random.uniform(-0.06, 0.06)
                w = 0.70 * random.uniform(0.92, 1.22)
                ln = 0.62 * random.uniform(0.92, 1.26)
                lift = random.uniform(0.055, 0.095)
                loc = (x, by + normal[1] * lift, bz + normal[2] * lift)
                rr = (rot[0] + random.uniform(-0.035, 0.035), 0,
                      random.uniform(-0.035, 0.035))
                box("ROOF_Plank_{:s}_{:02d}_{:02d}".format("F" if side < 0 else "B", r, c),
                    (w, ln, 0.06), loc,
                    random.choices(mats, weights=weights, k=1)[0], roof,
                    rotation=rr)

    # moss cushions growing between the roof planks
    for i in range(34):
        side = random.choice((-1, 1))
        if side < 0:
            eave_y, ridge_y = -4.80, 0.0
            ang = front_angle
            normal = (0, -math.sin(ang), math.cos(ang))
        else:
            eave_y, ridge_y = 3.90, 0.0
            ang = back_angle
            normal = (0, math.sin(ang), math.cos(ang))
        t = random.uniform(0.06, 0.94)
        x = random.uniform(-6.35, 6.35)
        by = eave_y + (ridge_y - eave_y) * t
        bz = 3.06 + 1.76 * t
        lift = random.uniform(0.10, 0.16)
        quad_sphere("ROOF_Moss_{:02d}".format(i), 0.14,
                    (x, by + normal[1] * lift, bz + normal[2] * lift),
                    "M_Moss", roof, scale=(random.uniform(1.0, 1.8),
                                           random.uniform(0.7, 1.2),
                                           random.uniform(0.22, 0.38)), subdiv=2)

    # short exposed round rafter ends under the eaves
    for side in (-1, 1):
        y = -4.95 if side < 0 else 4.05
        for i, x in enumerate((-5.9, -4.55, -3.2, -1.85, -0.5, 0.85, 2.2, 3.55, 4.9, 6.2)):
            quad_tube("ROOF_RafterEnd_{:s}_{:02d}".format("F" if side < 0 else "B", i),
                      0.065, 0.065, 0.58, (x, y, 2.99), "M_WoodDark", roof,
                      segments=8, rotation=(math.pi / 2, 0, 0))
    # heavy ridge beam
    box("ROOF_RidgeBeam", (13.35, 0.24, 0.18), (0, 0, 4.81), "M_WoodDark", roof)

    # simple TV aerial beside the chimney
    rod("ROOF_AerialMast", (1.15, 0.62, 5.70), (1.15, 0.62, 7.05), 0.018,
        "M_Metal", roof, segments=8)
    for i, z in enumerate((6.40, 6.64, 6.88)):
        rod("ROOF_AerialBar_{:02d}".format(i), (0.78, 0.62, z), (1.52, 0.62, z),
            0.012, "M_Metal", roof, segments=8)
    rod("ROOF_AerialDiag", (1.15, 0.62, 7.02), (1.45, 0.62, 6.75), 0.010,
        "M_Metal", roof, segments=8)

    # ridge caps
    for i in range(18):
        x = -6.5 + i * 0.76
        box("ROOF_RidgeCap_{:02d}".format(i), (0.78, 0.38, 0.075),
            (x, 0, 4.79), "M_RoofDeep", roof, rotation=(math.pi / 4, 0, 0))
    # fascia boards
    for side in (-1, 1):
        y = -4.82 if side < 0 else 3.92
        box("ROOF_Fascia_{}".format("F" if side < 0 else "B"), (13.8, 0.11, 0.23),
            (0, y, 3.01), "M_WoodDark", roof)
    for x in (-6.9, 6.9):
        box("ROOF_GableTrim_{:.0f}".format(x), (0.12, 7.8, 0.20),
            (x, 0.0, 4.0), "M_WoodDark", roof, rotation=(math.radians(0), 0, 0))

    # chimney
    box("ROOF_Chimney", (0.72, 0.72, 2.1), (1.75, 0.85, 4.55), "M_Metal", roof)
    box("ROOF_ChimneyCap", (0.94, 0.94, 0.14), (1.75, 0.85, 5.66), "M_MetalDark", roof)
    for z in (4.15, 4.85, 5.42):
        box("ROOF_ChimneyBand_{:.2f}".format(z), (0.78, 0.78, 0.07),
            (1.75, 0.85, z), "M_MetalDark", roof)
    box("ROOF_ChimneyHole", (0.46, 0.08, 0.32), (1.75, 0.47, 4.98), "M_Black", roof)



def build_side_lean_to():
    """A low right-hand woodshed roof, echoing the reference's asymmetric side mass."""
    roof = C["roof"]
    ang = math.atan2(0.58, 1.70)
    # main sloping board from the right wall down to the outer posts
    box("SIDE_RoofUnder", (1.82, 4.35, 0.13), (7.05, -1.40, 2.68), "M_ShingleUnder",
        roof, rotation=(0, ang, 0))
    for i in range(5):
        y = -3.45 + i * 1.02
        box("SIDE_RoofPlank_{:02d}".format(i), (1.95, 0.92, 0.055),
            (7.06, y, 2.73), ("M_RoofDeep", "M_RoofPlum", "M_RoofRose")[i % 3],
            roof, rotation=(0, ang + random.uniform(-0.015, 0.015),
                            random.uniform(-0.018, 0.018)))
    box("SIDE_RoofFascia", (0.12, 4.38, 0.18), (7.95, -1.40, 2.36),
        "M_WoodDark", roof)
    box("SIDE_RoofWallBeam", (0.12, 4.35, 0.16), (6.20, -1.40, 2.91),
        "M_WoodDark", roof)
    for i, y in enumerate((-3.42, 0.70)):
        box("SIDE_Post_{:02d}".format(i), (0.16, 0.16, 2.35), (7.78, y, 1.18),
            "M_WoodDark", roof)
        box("SIDE_PostFoot_{:02d}".format(i), (0.26, 0.26, 0.16), (7.78, y, 0.08),
            "M_Stone", roof)
    box("SIDE_OuterBeam", (0.14, 4.20, 0.16), (7.78, -1.36, 2.27),
        "M_WoodDark", roof)
    # end trim at the front of the lean-to
    box("SIDE_FrontTrim", (1.80, 0.12, 0.16), (7.05, -3.58, 2.46),
        "M_WoodDark", roof)
    # firewood under the little roof
    for i in range(10):
        cp(None, "x", 0.01, 0.01, 0.01, (0, 0, 0), "M_Log") if False else None
    for i in range(8):
        x = 6.42 + (i % 2) * 0.26
        z = 0.20 + (i // 2) * 0.24
        quad_tube("SIDE_Firewood_{:02d}".format(i), 0.10, 0.10, 3.8,
                  (x, -1.2, z), "M_Log", roof, segments=8,
                  rotation=(math.pi / 2, 0, 0))


def build_porch():
    arch = C["arch"]
    near = C["near"]
    # deck base
    box("PORCH_DeckBase", (8.6, 1.75, 0.20), (-1.05, -4.10, 0.30), "M_WoodDark", arch)
    for i in range(14):
        x = -5.15 + i * 0.61
        box("PORCH_DeckPlank_{:02d}".format(i), (0.58, 1.70, 0.075),
            (x, -4.10, 0.43), "M_WoodDeck", arch,
            rotation=(0, random.uniform(-0.004, 0.004), random.uniform(-0.006, 0.006)))
    # deck supports
    for x in (-5.0, -2.6, -0.2, 2.2, 3.0):
        for y in (-3.35, -4.82):
            cp(None, "x", 0.01, 0.01, 0.01, (0, 0, 0), "M_WoodDark") if False else None
            box("PORCH_Support_{:.1f}_{:.1f}".format(x, y), (0.18, 0.18, 0.42),
                (x, y, 0.20), "M_WoodDark", arch)
    # stairs: seven treads down from deck
    for i in range(7):
        z = 0.40 - i * 0.052
        y = -5.02 - i * 0.255
        box("PORCH_Step_{:02d}".format(i), (2.25, 0.28, 0.10),
            (-0.55, y, z), "M_WoodDeck", arch)
        box("PORCH_StepRiser_{:02d}".format(i), (2.25, 0.05, 0.12),
            (-0.55, y + 0.13, z - 0.06), "M_WoodWarm", arch)
    # stair stringers
    for x in (-1.72, 0.62):
        box("PORCH_Stringer_{:.1f}".format(x), (0.12, 2.25, 0.16),
            (x, -5.85, 0.19), "M_WoodDark", arch, rotation=(-0.20, 0, 0))
    # porch posts and beams (hidden in cutaway)
    for i, x in enumerate((-5.05, -2.0, 1.05, 3.05)):
        box("PORCH_Post_{:02d}".format(i), (0.18, 0.18, 2.72),
            (x, -4.55, 1.78), "M_WoodDark", near)
        box("PORCH_PostFoot_{:02d}".format(i), (0.28, 0.28, 0.16),
            (x, -4.55, 0.42), "M_Stone", near)
    box("PORCH_BeamFront", (8.35, 0.20, 0.22), (-1.0, -4.55, 3.03), "M_WoodDark", near)
    # simple rail at the two ends of the deck
    for x in (-5.03, 3.0):
        for z in (0.85, 1.28):
            box("PORCH_Rail_{:.1f}_{:.2f}".format(x, z), (0.10, 1.35, 0.10),
                (x, -3.90, z), "M_WoodFence", near)
        for y in (-3.30, -4.50):
            box("PORCH_RailPost_{:.1f}_{:.1f}".format(x, y), (0.12, 0.12, 1.05),
                (x, y, 0.95), "M_WoodFence", near)


def build_fence():
    fence = C["fence"]
    def superellipse(t, rx=10.1, ry=8.25, n=0.68, cy=-0.55):
        a = 2 * math.pi * t
        cx, sy = math.cos(a), math.sin(a)
        return (rx * math.copysign(abs(cx) ** n, cx),
                cy + ry * math.copysign(abs(sy) ** n, sy))
    n_posts = 42
    points = []
    for i in range(n_posts):
        t = i / n_posts
        x, y = superellipse(t)
        points.append((x, y))
    # gate opening centered on the front path
    posts = []
    for i, (x, y) in enumerate(points):
        in_gate = (abs(x) < 1.35 and y < -6.9)
        h = random.uniform(0.95, 1.30)
        if not in_gate:
            p = box("FENCE_Post_{:02d}".format(i), (0.14, 0.14, h),
                    (x, y, h / 2), "M_WoodFence", fence,
                    rotation=(random.uniform(-0.05, 0.05), random.uniform(-0.03, 0.03),
                              random.uniform(-0.08, 0.08)))
            posts.append((x, y, h, i))
        else:
            posts.append(None)
    for i in range(n_posts):
        a = posts[i]
        b = posts[(i + 1) % n_posts]
        if not a or not b:
            continue
        if random.random() < 0.08:
            continue
        for zoff, thick in ((0.56, 0.055), (1.00, 0.045)):
            za = min(a[2] - 0.10, zoff + 0.18)
            zb = min(b[2] - 0.10, zoff + 0.18)
            rod("FENCE_Rail_{:02d}_{:.2f}".format(i, zoff), (a[0], a[1], za),
                (b[0], b[1], zb), thick, "M_WoodFence", fence, segments=8)
    # a few missing/fallen rails, stacked near the gate
    for j in range(3):
        box("FENCE_FallenRail_{:02d}".format(j), (1.8, 0.08, 0.08),
            (-2.0 + j * 0.12, -7.9 + j * 0.25, 0.06), "M_WoodFence", fence,
            rotation=(0.04, 0.04, 0.30 + j * 0.2))
    # gate panels leaning open
    for side in (-1, 1):
        x = side * 1.15
        box("FENCE_GatePost_{}".format("L" if side < 0 else "R"), (0.18, 0.18, 1.25),
            (x, -8.08, 0.62), "M_WoodFence", fence)
        box("FENCE_GateRail_{}".format("L" if side < 0 else "R"), (1.35, 0.10, 0.10),
            (x + side * 0.64, -8.08, 0.65), "M_WoodFence", fence,
            rotation=(0, 0, side * 0.45))


def tp(parent, name, major, minor, local_loc, material, rotation=(0, 0, 0),
       major_segments=24, minor_segments=8):
    coll = parent.users_collection[0]
    o = torus(name, major, minor, local_loc, material, coll, rotation=rotation,
              major_segments=major_segments, minor_segments=minor_segments)
    o.parent = parent
    return o


def rp(parent, name, p1, p2, radius, material, segments=8, cap_material=None):
    coll = parent.users_collection[0]
    o = rod(name, p1, p2, radius, material, coll, segments=segments,
            cap_material=cap_material)
    if o:
        o.parent = parent
    return o


def label_group(name, loc, coll):
    return grp(name, loc, coll)


# ---------------------------------------------------------------- furniture / props
def build_chair(name, location, rotation, collection, wood="M_WoodWarm"):
    g = grp(name, location, collection, rotation=rotation)
    bp(g, name + "_Seat", (0.56, 0.54, 0.07), (0, 0, 0.47), wood)
    for x in (-0.22, 0.22):
        for y in (-0.21, 0.21):
            bp(g, name + "_Leg", (0.07, 0.07, 0.43), (x, y, 0.22), "M_WoodDark")
    for x in (-0.24, 0.24):
        bp(g, name + "_BackPost", (0.07, 0.07, 0.62), (x, 0.24, 0.78), wood)
    for z in (0.72, 0.90, 1.05):
        bp(g, name + "_BackSlat", (0.52, 0.055, 0.065), (0, 0.24, z), wood)
    for y in (-0.18, 0.18):
        bp(g, name + "_Stretcher", (0.50, 0.05, 0.05), (0, y, 0.24), "M_WoodDark")
    return g


def build_table(name, location, rotation, collection, width=1.8, depth=0.9,
                height=0.78, wood="M_WoodWarm"):
    g = grp(name, location, collection, rotation=rotation)
    bp(g, name + "_Top", (width, depth, 0.09), (0, 0, height), wood)
    bp(g, name + "_ApronX", (width - 0.18, 0.07, 0.12), (0, 0, height - 0.12), "M_WoodDark")
    bp(g, name + "_ApronY", (0.07, depth - 0.18, 0.12), (0, 0, height - 0.12), "M_WoodDark")
    for x in (-width / 2 + 0.13, width / 2 - 0.13):
        for y in (-depth / 2 + 0.13, depth / 2 - 0.13):
            bp(g, name + "_Leg", (0.10, 0.10, height - 0.10),
               (x, y, (height - 0.10) / 2), "M_WoodDark")
    for x in (-width / 2 + 0.13, width / 2 - 0.13):
        bp(g, name + "_Stretcher", (0.06, depth - 0.24, 0.06),
           (x, 0, height * 0.32), "M_WoodDark")
    return g


def build_sofa():
    g = grp("BED_Sofa", (-4.92, -1.40, 0.16), C["bed"], rotation=(0, 0, 0))
    bp(g, "BED_Sofa_Base", (0.92, 1.95, 0.34), (0, 0, 0.31), "M_FabricGreen")
    bp(g, "BED_Sofa_Back", (0.30, 1.95, 0.80), (-0.38, 0, 0.68), "M_FabricGreen")
    for y in (-0.90, 0.90):
        bp(g, "BED_Sofa_Arm", (0.92, 0.22, 0.53), (0, y, 0.58), "M_FabricGreenLight")
        bp(g, "BED_Sofa_ArmCap", (0.82, 0.16, 0.11), (0.06, y, 0.87), "M_FabricGreen")
    for i, y in enumerate((-0.61, 0.0, 0.61)):
        bp(g, "BED_Sofa_SeatCushion_{:02d}".format(i), (0.62, 0.56, 0.15),
           (0.16, y, 0.53), "M_FabricGreenLight")
        bp(g, "BED_Sofa_BackCushion_{:02d}".format(i), (0.15, 0.56, 0.46),
           (-0.19, y, 0.80), "M_FabricGreenLight")
    for x in (-0.33, 0.33):
        for y in (-0.78, 0.78):
            bp(g, "BED_Sofa_Leg", (0.10, 0.10, 0.19), (x, y, 0.09), "M_WoodDark")
    bp(g, "BED_Sofa_Patch", (0.28, 0.22, 0.015), (0.24, -0.45, 0.62), "M_FabricYellow",
       rotation=(0, 0.15, 0.12))
    bp(g, "BED_Sofa_Blanket", (0.52, 0.80, 0.04), (0.16, 0.62, 0.66), "M_FabricRed",
       rotation=(0, 0, 0.08))
    return g


def build_bed():
    g = grp("BED_Bed", (-4.15, 2.03, 0.16), C["bed"])
    bp(g, "BED_Bed_Base", (1.76, 2.14, 0.22), (0, 0, 0.34), "M_WoodWarm")
    bp(g, "BED_Bed_Headboard", (1.86, 0.13, 0.94), (0, 1.05, 0.86), "M_WoodWarm")
    bp(g, "BED_Bed_Footboard", (1.86, 0.11, 0.36), (0, -1.05, 0.50), "M_WoodWarm")
    for x in (-0.78, 0.78):
        for y in (-0.98, 0.98):
            bp(g, "BED_Bed_Leg", (0.12, 0.12, 0.26), (x, y, 0.15), "M_WoodDark")
    bp(g, "BED_Mattress", (1.58, 1.94, 0.24), (0, 0, 0.52), "M_FabricCream")
    bp(g, "BED_Blanket", (1.64, 1.38, 0.10), (0, -0.30, 0.66), "M_Blanket")
    bp(g, "BED_BlanketStripe", (1.65, 0.12, 0.015), (0, -0.80, 0.72), "M_FabricRed")
    sp(g, "BED_Pillow_L", 0.35, (-0.38, 0.70, 0.70), "M_FabricCream", scale=(1.45, 0.74, 0.34))
    sp(g, "BED_Pillow_R", 0.35, (0.38, 0.70, 0.70), "M_FabricCream", scale=(1.45, 0.74, 0.34))
    bp(g, "BED_QuiltFold", (1.60, 0.28, 0.09), (0, -0.82, 0.71), "M_FabricRed")
    for i, x in enumerate((-0.65, -0.22, 0.22, 0.65)):
        bp(g, "BED_BedSlat_{:02d}".format(i), (0.08, 1.90, 0.06),
           (x, 0, 0.38), "M_WoodDark")
    return g


def build_bedroom():
    bed = C["bed"]
    build_bed()
    build_sofa()

    # old table
    table = build_table("BED_OldTable", (-3.16, 0.24, 0.16), (0, 0, 0.04), bed,
                        width=1.55, depth=0.86, height=0.70, wood="M_WoodGray")
    bp(table, "BED_Table_Book", (0.34, 0.24, 0.08), (-0.28, 0.02, 0.79), "M_FabricBlue",
       rotation=(0, 0, 0.08))
    bp(table, "BED_Table_Book2", (0.30, 0.22, 0.05), (-0.23, 0.03, 0.85), "M_FabricRed",
       rotation=(0, 0, -0.10))
    cp(table, "BED_Table_Bottle", 0.055, 0.055, 0.30, (0.38, -0.04, 0.87),
       "M_EnamelBlue", cap_material="M_WoodDark", segments=8)
    sp(table, "BED_Table_Gourd", 0.15, (0.10, -0.22, 0.82), "M_Leaf",
       scale=(1.0, 0.85, 1.25))
    cp(table, "BED_Table_Bowl", 0.18, 0.12, 0.10, (0.02, 0.20, 0.80),
       "M_Clay", cap_material="M_Clay", segments=12)

    # TV cabinet and old CRT
    tv = grp("BED_TV", (-2.32, 1.16, 0.16), bed, rotation=(0, 0, 0.38))
    bp(tv, "BED_TV_Cabinet", (1.22, 0.58, 0.55), (0, 0, 0.31), "M_WoodWarm")
    for i, x in enumerate((-0.30, 0.30)):
        bp(tv, "BED_TV_Door_{:02d}".format(i), (0.48, 0.035, 0.39), (x, -0.30, 0.32),
           "M_WoodGray")
        bp(tv, "BED_TV_Knob_{:02d}".format(i), (0.035, 0.045, 0.035), (x + 0.10, -0.33, 0.32),
           "M_Chrome")
    bp(tv, "BED_TV_Body", (0.86, 0.50, 0.65), (0, 0, 0.92), "M_Black")
    bp(tv, "BED_TV_Screen", (0.66, 0.025, 0.44), (0, -0.265, 0.97), "M_GlassWarm")
    bp(tv, "BED_TV_FrontPanel", (0.14, 0.035, 0.58), (0.40, -0.27, 0.92), "M_MetalDark")
    for z in (1.08, 0.94, 0.80):
        bp(tv, "BED_TV_Dial_{:.2f}".format(z), (0.055, 0.025, 0.055),
           (0.40, -0.30, z), "M_Chrome")
    rp(tv, "BED_TV_Antenna_L", (-0.16, 0, 1.25), (-0.38, 0.03, 1.72), 0.012411,
       "M_Chrome", segments=8)
    rp(tv, "BED_TV_Antenna_R", (0.16, 0, 1.25), (0.38, 0.03, 1.72), 0.012411,
       "M_Chrome", segments=8)
    bp(tv, "BED_TV_Stand", (0.95, 0.52, 0.06), (0, 0, 0.59), "M_WoodDark")

    # wardrobe against left wall
    wd = grp("BED_Wardrobe", (-5.58, 1.55, 0.16), bed, rotation=(0, 0, math.pi / 2))
    bp(wd, "BED_Wardrobe_Body", (0.70, 1.55, 1.95), (0, 0, 0.98), "M_WoodWarm")
    for y in (-0.38, 0.38):
        bp(wd, "BED_Wardrobe_Door", (0.045, 0.71, 1.72), (-0.37, y, 1.02), "M_WoodGray")
        bp(wd, "BED_Wardrobe_Handle", (0.035, 0.035, 0.20), (-0.40, y + 0.24, 1.02),
           "M_Chrome")
    bp(wd, "BED_Wardrobe_Top", (0.74, 1.60, 0.08), (0, 0, 1.98), "M_WoodDark")

    # old stove and pipe
    st = grp("BED_WoodStove", (-5.35, -2.28, 0.16), bed, rotation=(0, 0, math.pi / 2))
    bp(st, "BED_Stove_Body", (0.62, 0.58, 0.72), (0, 0, 0.48), "M_MetalDark")
    bp(st, "BED_Stove_Door", (0.42, 0.035, 0.36), (0, -0.31, 0.48), "M_Metal")
    bp(st, "BED_Stove_DoorGlow", (0.25, 0.015, 0.16), (0, -0.33, 0.46), "M_Fire")
    bp(st, "BED_Stove_Leg", (0.10, 0.10, 0.22), (-0.23, -0.21, 0.12), "M_MetalDark")
    bp(st, "BED_Stove_Leg2", (0.10, 0.10, 0.22), (0.23, -0.21, 0.12), "M_MetalDark")
    cp(st, "BED_Stove_Pipe", 0.13, 0.13, 1.35, (0, 0.08, 1.36), "M_Metal",
       cap_material="M_MetalDark", segments=8)
    cp(st, "BED_Stove_PipeTop", 0.16, 0.16, 0.12, (0, 0.08, 2.03), "M_MetalDark",
       segments=8)
    for i, (y, z) in enumerate(((-0.22, 0.10), (0.05, 0.10), (0.20, 0.15))):
        rp(st, "BED_Stove_Log_{:02d}".format(i), (y, -0.40, z), (y, -0.05, z),
           0.055, "M_WoodDark", segments=8)

    # rug
    rug = grp("BED_Rug", (-3.72, -0.55, 0.18), bed)
    bp(rug, "BED_Rug_Base", (2.55, 1.95, 0.025), (0, 0, 0), "M_FabricRed")
    bp(rug, "BED_Rug_Inner", (2.30, 1.70, 0.012), (0, 0, 0.018), "M_FabricYellow")
    for i, x in enumerate((-0.92, -0.55, -0.18, 0.19, 0.56, 0.93)):
        bp(rug, "BED_Rug_Stripe_{:02d}".format(i), (0.035, 1.70, 0.008),
           (x, 0, 0.028), "M_FabricGreen")

    # backpack and shoes
    bp_ = grp("BED_Backpack", (-2.82, 1.42, 0.20), bed)
    sp(bp_, "BED_Backpack_Body", 0.32, (0, 0, 0.25), "M_FabricBlue",
       scale=(0.68, 0.46, 1.05), subdiv=3)
    bp(bp_, "BED_Backpack_Pocket", (0.28, 0.10, 0.26), (0, -0.20, 0.22), "M_FabricRed")
    for side in (-1, 1):
        rp(bp_, "BED_Backpack_Strap_{}".format(side), (side * 0.20, -0.06, 0.48),
           (side * 0.32, -0.04, 0.04), 0.025, "M_Rope", segments=8)

    for i, (x, y, angle, color) in enumerate((
            (-3.10, -1.55, 0.20, "M_WoodDark"), (-3.48, -1.80, 1.30, "M_FabricRed"),
            (-3.76, -1.60, 2.30, "M_WoodDark"), (-2.80, -2.02, 3.00, "M_FabricBlue"),
            (-4.15, -2.10, 1.00, "M_WoodDark"))):
        sh = grp("BED_Shoe_{:02d}".format(i), (x, y, 0.18), bed, rotation=(0, 0, angle))
        sp(sh, "BED_Shoe_Upper_{:02d}".format(i), 0.14, (0, 0, 0.10), color,
           scale=(0.50, 1.15, 0.58), subdiv=2)
        bp(sh, "BED_Shoe_Sole_{:02d}".format(i), (0.15, 0.31, 0.035), (0, 0, 0.02),
           "M_Black")

    # painting frames and simple hand-painted pictures
    def painting(name, location, rotation, scene_kind):
        g = grp(name, location, bed, rotation=rotation)
        bp(g, name + "_Frame", (0.62, 0.05, 0.78), (0, 0, 0), "M_WoodDark")
        bp(g, name + "_Canvas", (0.54, 0.025, 0.70), (0, -0.035, 0), "M_WallCream")
        if scene_kind == "tree":
            bp(g, name + "_Hill", (0.50, 0.012, 0.22), (0, -0.052, -0.22), "M_GrassDark")
            cp(g, name + "_Trunk", 0.025, 0.035, 0.30, (0, -0.058, -0.06), "M_WoodDark",
               segments=8)
            sp(g, name + "_Crown", 0.16, (0, -0.060, 0.12), "M_LeafDark",
               scale=(0.75, 0.20, 1.25), subdiv=2)
            sp(g, name + "_Sun", 0.08, (0.18, -0.061, 0.20), "M_Corn", subdiv=2)
        elif scene_kind == "fish":
            cp(g, name + "_Bowl", 0.20, 0.13, 0.10, (0, -0.058, -0.22), "M_EnamelBlue",
               cap_material="M_EnamelBlue", segments=12)
            sp(g, name + "_Fish", 0.10, (-0.08, -0.065, 0.05), "M_Corn",
               scale=(1.4, 0.25, 0.6), subdiv=2)
        else:
            bp(g, name + "_Window", (0.40, 0.012, 0.44), (0, -0.052, 0.02), "M_Glass")
            bp(g, name + "_WindowBar", (0.025, 0.014, 0.44), (0, -0.061, 0.02), "M_WoodDark")
        return g

    painting("BED_Painting_Tree", (-3.12, 2.88, 2.42), (0, 0, 0), "tree")
    painting("BED_Painting_Fish", (-2.40, 2.88, 2.42), (0, 0, 0), "fish")
    painting("BED_Painting_Window", (-5.86, -0.55, 2.64), (0, 0, math.pi / 2), "window")

    # straw hat on left wall
    hat = grp("BED_StrawHat", (-5.82, -2.25, 2.40), bed, rotation=(0, math.pi / 2, 0))
    tp(hat, "BED_Hat_Brim", 0.34, 0.035, (0, 0, 0), "M_Straw", major_segments=24)
    cp(hat, "BED_Hat_Crown", 0.19, 0.16, 0.22, (0, 0, 0.12), "M_Straw",
       cap_material="M_Straw", segments=12)
    bp(hat, "BED_Hat_Band", (0.38, 0.38, 0.045), (0, 0, 0.025), "M_FabricRed")

    # bow and arrows on the back wall above the bed
    bow = grp("BED_BowAndArrow", (-4.95, 2.78, 2.24), bed)
    pts = [(-0.30, 0, 0.55), (-0.52, 0, 0.20), (-0.46, 0, -0.20), (-0.24, 0, -0.55)]
    for i in range(len(pts) - 1):
        rp(bow, "BED_Bow_Limb_{:02d}".format(i), pts[i], pts[i + 1], 0.042,
           "M_WoodDark", segments=8)
    rp(bow, "BED_Bow_String", (-0.30, 0, 0.55), (-0.24, 0, -0.55), 0.008,
       "M_FabricCream", segments=8)
    for i, y in enumerate((0.18, 0.32, 0.46)):
        rp(bow, "BED_Arrow_Shaft_{:02d}".format(i), (-0.62, y, -0.42),
           (0.16, y, 0.40), 0.012, "M_WoodLight", segments=8)
        bp(bow, "BED_Arrow_Head_{:02d}".format(i), (0.10, 0.03, 0.10),
           (0.18, y, 0.42), "M_Metal", rotation=(0, 0.6, 0))
    bp(bow, "BED_Bow_Hanger", (0.06, 0.05, 0.08), (0.10, 0, 0.58), "M_Metal")

    # spider web in the dark back corner
    web = grp("BED_SpiderWeb", (-5.72, 2.84, 2.82), bed)
    anchors = []
    for i, ang in enumerate((0.05, 0.48, 0.95, 1.48, 1.95)):
        x = math.cos(ang) * 0.62
        z = math.sin(ang) * 0.50
        anchors.append((x, 0, z))
        rp(web, "BED_Web_Radial_{:02d}".format(i), (0, 0, 0), (x, 0, z), 0.008,
           "M_Spider", segments=8)
    for j, k in enumerate((0.32, 0.55, 0.78)):
        ring = []
        for a in anchors:
            ring.append((a[0] * k, 0.01, a[2] * k))
        for i in range(len(ring) - 1):
            rp(web, "BED_Web_Ring_{:02d}_{:02d}".format(j, i), ring[i], ring[i + 1],
               0.006, "M_Spider", segments=8)

    # corn hanging beside the bedroom window
    corn_string("BED_WindowCorn", (-4.95, 2.77, 2.55), C["bed"], count=2,
                length=0.55, orientation="back")
    # a couple of boots under the bed / crocks by the door
    for i, x in enumerate((-3.95, -3.55)):
        cp(None, "x", 0.01, 0.01, 0.01, (0, 0, 0), "M_Black") if False else None


def build_kitchen():
    kit = C["kit"]
    # fridge
    fr = grp("KIT_Fridge", (-1.40, 2.48, 0.16), kit)
    bp(fr, "KIT_Fridge_Body", (0.96, 0.72, 1.96), (0, 0, 0.98), "M_EnamelMint")
    bp(fr, "KIT_Fridge_Top", (1.00, 0.76, 0.10), (0, 0, 1.98), "M_EnamelMint")
    for z, h in ((1.25, 0.88), (0.66, 0.72)):
        bp(fr, "KIT_Fridge_Door_{:.2f}".format(z), (0.86, 0.045, h),
           (0, -0.38, z), "M_EnamelMint")
        bp(fr, "KIT_Fridge_Handle_{:.2f}".format(z), (0.045, 0.055, 0.32),
           (0.34, -0.41, z), "M_Chrome")
    bp(fr, "KIT_Fridge_FreezerLine", (0.88, 0.03, 0.035), (0, -0.405, 1.70), "M_WoodDark")
    bp(fr, "KIT_Fridge_Badge", (0.15, 0.012, 0.055), (-0.22, -0.415, 1.78), "M_GlassWarm")
    for i, (x, z) in enumerate(((-0.28, 0.24), (0.26, 0.24), (0.28, 0.10))):
        bp(fr, "KIT_Fridge_Vent_{:02d}".format(i), (0.20, 0.015, 0.018),
           (x, -0.415, z), "M_MetalDark")
    # little magnets
    for i, (x, z, m) in enumerate(((-0.25, 1.05, "M_Chili"), (0.20, 0.96, "M_Corn"),
                                   (0.25, 1.42, "M_FabricBlue"))):
        bp(fr, "KIT_Fridge_Magnet_{:02d}".format(i), (0.08, 0.018, 0.08),
           (x, -0.415, z), m, rotation=(0, 0, 0.3 + i))

    # long kitchen counter
    co = grp("KIT_Counter", (0.65, 2.56, 0.16), kit)
    bp(co, "KIT_Counter_Base", (2.95, 0.63, 0.78), (0, 0, 0.39), "M_WoodWarm")
    bp(co, "KIT_Counter_Top", (3.03, 0.70, 0.08), (0, 0, 0.82), "M_EnamelBlue")
    bp(co, "KIT_Counter_Kick", (2.90, 0.05, 0.12), (0, -0.31, 0.09), "M_WoodDark")
    for i, x in enumerate((-1.12, -0.55, 0.05, 0.62, 1.19)):
        bp(co, "KIT_Counter_Door_{:02d}".format(i), (0.48, 0.035, 0.60),
           (x, -0.335, 0.43), "M_EnamelMint")
        bp(co, "KIT_Counter_Handle_{:02d}".format(i), (0.19, 0.035, 0.03),
           (x, -0.36, 0.60), "M_Chrome")
    # sink
    bp(co, "KIT_Sink_Rim", (0.68, 0.48, 0.04), (0.78, 0.0, 0.875), "M_Metal")
    bp(co, "KIT_Sink_Basin", (0.55, 0.36, 0.12), (0.78, 0.0, 0.815), "M_MetalDark")
    rp(co, "KIT_Faucet_Stem", (0.78, 0.23, 0.88), (0.78, 0.23, 1.17), 0.035,
       "M_Chrome", segments=8)
    rp(co, "KIT_Faucet_Spout", (0.78, 0.23, 1.16), (0.78, 0.10, 1.09), 0.032,
       "M_Chrome", segments=8)
    # stove and wok
    bp(co, "KIT_Stove_Top", (0.78, 0.58, 0.045), (-0.76, 0.0, 0.875), "M_MetalDark")
    for bx in (-0.96, -0.56):
        cp(co, "KIT_Burner_{:.2f}".format(bx), 0.14, 0.14, 0.025,
           (bx, 0.0, 0.90), "M_Black", segments=12)
    bp(co, "KIT_Oven_Door", (0.70, 0.04, 0.45), (-0.76, -0.335, 0.43), "M_MetalDark")
    bp(co, "KIT_Oven_Window", (0.46, 0.015, 0.22), (-0.76, -0.36, 0.43), "M_GlassWarm")
    for i, bx in enumerate((-0.98, -0.76, -0.54)):
        bp(co, "KIT_Stove_Knob_{:02d}".format(i), (0.055, 0.025, 0.055),
           (bx, -0.36, 0.70), "M_Chrome")
    bowl_ = bowl("KIT_Wok", 0.34, 0.20, (-0.96, 0.0, 0.91), "M_Metal", kit, segments=16)
    bowl_.parent = co
    cp(co, "KIT_WokHandle", 0.035, 0.035, 0.58, (-0.96, -0.38, 1.02), "M_WoodDark",
       segments=8, rotation=(math.pi / 2, 0, 0))
    pot = bowl("KIT_Pot", 0.24, 0.20, (-0.56, 0.0, 0.91), "M_CeramicBlue", kit, segments=16)
    pot.parent = co
    cp(co, "KIT_PotLid", 0.25, 0.22, 0.05, (-0.56, 0.0, 1.14), "M_Metal",
       segments=16)
    cp(co, "KIT_PotLidKnob", 0.04, 0.04, 0.06, (-0.56, 0.0, 1.20), "M_Chrome",
       segments=8)

    # shelves and jars
    for i, x in enumerate((-1.15, -0.60, -0.05, 0.55, 1.10)):
        cp(co, "KIT_Jar_{:02d}".format(i), 0.07, 0.07, 0.22,
           (x, 0.22, 0.95), "M_Ceramic", cap_material="M_WoodDark", segments=8)
    bp(co, "KIT_Shelf", (1.72, 0.20, 0.06), (0.85, 0.22, 1.48), "M_WoodWarm")
    for i, x in enumerate((0.24, 0.65, 1.06, 1.47)):
        cp(co, "KIT_ShelfBowl_{:02d}".format(i), 0.10, 0.13, 0.08,
           (x, 0.20, 1.54), "M_Ceramic", cap_material="M_Ceramic", segments=12)
    # hanging utensils
    for i, x in enumerate((0.12, 0.33, 0.54)):
        rp(co, "KIT_Utensil_{:02d}".format(i), (x, 0.16, 1.86), (x, 0.16, 1.41),
           0.012, "M_MetalDark", segments=8)

    # dining table
    table = build_table("KIT_DiningTable", (0.22, -0.55, 0.16), (0, 0, 0.0), kit,
                        width=1.95, depth=0.92, height=0.78, wood="M_WoodWarm")
    bp(table, "KIT_Table_Cloth", (0.65, 0.80, 0.018), (0.30, 0, 0.83), "M_FabricCream")
    cp(table, "KIT_Table_Kettle", 0.17, 0.14, 0.24, (-0.28, -0.04, 0.94),
       "M_Metal", cap_material="M_MetalDark", segments=12)
    cp(table, "KIT_Table_KettleLid", 0.11, 0.08, 0.05, (-0.28, -0.04, 1.08),
       "M_MetalDark", segments=12)
    rp(table, "KIT_Table_KettleHandle", (-0.44, -0.04, 1.02),
       (-0.12, -0.04, 1.02), 0.026, "M_MetalDark", segments=8)
    for i, (x, y, kind) in enumerate(((0.18, -0.16, "M_Ceramic"),
                                      (0.45, 0.12, "M_CeramicBlue"),
                                      (-0.02, 0.18, "M_Clay"))):
        cp(table, "KIT_Table_Bowl_{:02d}".format(i), 0.13, 0.09, 0.09,
           (x, y, 0.86), kind, cap_material=kind, segments=12)
    bp(table, "KIT_Table_Board", (0.42, 0.28, 0.035), (0.52, -0.15, 0.85),
       "M_WoodLight")
    for i, (x, y, c) in enumerate(((0.46, -0.13, "M_Leaf"), (0.56, -0.10, "M_Chili"),
                                    (0.51, -0.20, "M_Corn"))):
        sp(table, "KIT_Table_Veg_{:02d}".format(i), 0.075, (x, y, 0.89), c,
           scale=(1.1, 0.8, 0.6), subdiv=2)
    for i, (x, y, c) in enumerate(((-0.62, 0.28, "M_EnamelBlue"),
                                    (-0.48, 0.30, "M_EnamelMint"))):
        cp(table, "KIT_Table_Bottle_{:02d}".format(i), 0.05, 0.045, 0.28,
           (x, y, 0.93), c, cap_material="M_WoodDark", segments=8)

    build_chair("KIT_Chair_L", (-1.30, -0.55, 0.16), (0, 0, -math.pi / 2), kit)
    build_chair("KIT_Chair_R", (1.72, -0.55, 0.16), (0, 0, math.pi / 2), kit)

    # veg basket on the floor
    bask = grp("KIT_VegBasket", (1.92, 0.74, 0.18), kit)
    bp(bask, "KIT_Basket_Body", (0.48, 0.40, 0.28), (0, 0, 0.16), "M_Rope")
    for i, (x, y) in enumerate(((-0.12, -0.06), (0.10, -0.08), (0.0, 0.08))):
        sp(bask, "KIT_Basket_Veg_{:02d}".format(i), 0.11, (x, y, 0.32),
           ("M_Leaf", "M_Chili", "M_Corn")[i], scale=(1.0, 0.8, 0.7), subdiv=2)
    tp(bask, "KIT_Basket_Rim", 0.25, 0.022, (0, 0, 0.31), "M_WoodLight",
       rotation=(0, 0, 0), major_segments=20)
    rp(bask, "KIT_Basket_Handle1", (-0.21, 0, 0.31), (-0.06, 0, 0.66), 0.018,
       "M_Rope", segments=8)
    rp(bask, "KIT_Basket_Handle2", (-0.06, 0, 0.66), (0.10, 0, 0.31), 0.018,
       "M_Rope", segments=8)

    # pendant lamp over table
    lamp = grp("KIT_Pendant", (0.22, -0.55, 2.95), kit)
    rp(lamp, "KIT_Pendant_Cord", (0, 0, 0), (0, 0, -0.44), 0.012, "M_Black", segments=8)
    cp(lamp, "KIT_Pendant_Shade", 0.34, 0.10, 0.28, (0, 0, -0.56), "M_EnamelMint",
       cap_material="M_WarmGlow", segments=12)
    sp(lamp, "KIT_Pendant_Bulb", 0.08, (0, 0, -0.62), "M_WarmGlow", subdiv=2)

    # wall chili and garlic
    chili_string("KIT_WallChili", (-1.72, 2.82, 2.58), kit, count=5, length=0.40,
                 orientation="back")
    garlic_string("KIT_WallGarlic", (-1.50, 2.82, 2.55), kit, count=4, length=0.42,
                  orientation="back")


def build_bathroom():
    bath = C["bath"]
    # pedestal sink
    sk = grp("BATH_Sink", (3.62, 2.42, 0.18), bath)
    cp(sk, "BATH_Sink_Pedestal", 0.16, 0.22, 0.62, (0, 0, 0.31), "M_Ceramic",
       cap_material="M_Ceramic", segments=12)
    sink_bowl = bowl("BATH_Sink_Bowl", 0.35, 0.17, (0, 0, 0.66), "M_Ceramic", bath, segments=16)
    sink_bowl.parent = sk
    bp(sk, "BATH_Sink_Rim", (0.68, 0.40, 0.045), (0, 0, 0.82), "M_Ceramic")
    rp(sk, "BATH_Faucet", (0, 0.17, 0.82), (0, 0.17, 1.05), 0.024, "M_Chrome", segments=8)
    rp(sk, "BATH_FaucetSpout", (0, 0.17, 1.05), (0, 0.05, 1.00), 0.022, "M_Chrome",
       segments=8)
    # mirror above sink
    bp(sk, "BATH_MirrorFrame", (0.55, 0.04, 0.68), (0, 0.31, 1.45), "M_WoodGray")
    bp(sk, "BATH_Mirror", (0.46, 0.02, 0.58), (0, 0.285, 1.45), "M_Glass")

    # little wooden table with basket
    table = build_table("BATH_SmallTable", (4.83, 1.50, 0.18), (0, 0, 0.12), bath,
                        width=0.92, depth=0.58, height=0.62, wood="M_WoodWarm")
    bask = grp("BATH_Basket", (4.83, 1.50, 0.80), bath)
    bp(bask, "BATH_Basket_Body", (0.36, 0.30, 0.24), (0, 0, 0.10), "M_Rope")
    tp(bask, "BATH_Basket_Rim", 0.19, 0.018, (0, 0, 0.23), "M_WoodLight",
       major_segments=16)
    rp(bask, "BATH_Basket_Handle", (-0.12, 0, 0.22), (0.0, 0, 0.48), 0.012,
       "M_Rope", segments=8)
    rp(bask, "BATH_Basket_Handle2", (0.0, 0, 0.48), (0.12, 0, 0.22), 0.012,
       "M_Rope", segments=8)

    # water bucket
    bucket = grp("BATH_Bucket", (4.95, -0.16, 0.18), bath)
    cp(bucket, "BATH_Bucket_Body", 0.27, 0.24, 0.38, (0, 0, 0.19), "M_WoodFence",
       cap_material="M_WaterDark" if False else "M_MetalDark", segments=16)
    tp(bucket, "BATH_Bucket_Band", 0.265, 0.02, (0, 0, 0.10), "M_Metal", major_segments=20)
    tp(bucket, "BATH_Bucket_Band2", 0.255, 0.02, (0, 0, 0.28), "M_Metal", major_segments=20)
    rp(bucket, "BATH_Bucket_Handle1", (-0.25, 0, 0.34), (0, 0, 0.62), 0.012,
       "M_Metal", segments=8)
    rp(bucket, "BATH_Bucket_Handle2", (0, 0, 0.62), (0.25, 0, 0.34), 0.012,
       "M_Metal", segments=8)

    # broom and mop leaning on the partition
    broom = grp("BATH_Broom", (3.12, 0.18, 0.18), bath, rotation=(0, 0, -0.08))
    rp(broom, "BATH_Broom_Handle", (0, 0, 0.05), (0, 0, 1.55), 0.022, "M_WoodLight",
       segments=8)
    bp(broom, "BATH_Broom_Head", (0.25, 0.10, 0.34), (0, 0, 0.16), "M_Straw")
    for i, x in enumerate((-0.09, -0.03, 0.03, 0.09)):
        bp(broom, "BATH_Broom_Bristle_{:02d}".format(i), (0.045, 0.11, 0.30),
           (x, 0, 0.02), "M_Straw")
    mop = grp("BATH_Mop", (3.42, 0.28, 0.18), bath, rotation=(0, 0, 0.10))
    rp(mop, "BATH_Mop_Handle", (0, 0, 0.03), (0, 0, 1.50), 0.022, "M_WoodGray",
       segments=8)
    bp(mop, "BATH_Mop_Binding", (0.20, 0.16, 0.12), (0, 0, 0.16), "M_MetalDark")
    for i, x in enumerate((-0.08, -0.03, 0.02, 0.07)):
        bp(mop, "BATH_Mop_Strip_{:02d}".format(i), (0.055, 0.10, 0.30),
           (x, 0, 0.0), "M_FabricCream", rotation=(0, 0.10, 0))

    # towel rail on back wall
    rod("BATH_TowelBar", (4.65, 2.83, 1.72), (5.35, 2.83, 1.72), 0.025,
       "M_Metal", bath, segments=8)
    box("BATH_Towel", (0.50, 0.06, 0.68), (4.98, 2.79, 1.36), "M_FabricBlue", bath)
    box("BATH_TowelFold", (0.50, 0.065, 0.08), (4.98, 2.755, 1.10), "M_FabricCream", bath)
    box("BATH_Towel2", (0.28, 0.05, 0.42), (4.55, 2.79, 1.47), "M_FabricRed", bath)

    # slippers near the door
    for i, (x, y, ang, col) in enumerate(((4.16, -2.48, 0.20, "M_FabricRed"),
                                           (4.50, -2.38, -0.15, "M_FabricBlue"))):
        sl = grp("BATH_Slipper_{:02d}".format(i), (x, y, 0.20), bath, rotation=(0, 0, ang))
        bp(sl, "BATH_Slipper_Sole_{:02d}".format(i), (0.16, 0.34, 0.035), (0, 0, 0.02),
           "M_WoodDark")
        sp(sl, "BATH_Slipper_Upper_{:02d}".format(i), 0.15, (0, -0.02, 0.09), col,
           scale=(0.52, 1.10, 0.42), subdiv=2)
        bp(sl, "BATH_Slipper_Strap_{:02d}".format(i), (0.17, 0.08, 0.035),
           (0, 0.05, 0.13), "M_FabricCream")

    # bath mat and small stool
    box("BATH_Mat", (0.95, 0.55, 0.02), (4.00, -1.50, 0.19), "M_FabricBlue", bath)
    st = grp("BATH_Stool", (3.90, 1.18, 0.18), bath)
    bp(st, "BATH_Stool_Top", (0.46, 0.40, 0.06), (0, 0, 0.38), "M_WoodWarm")
    for x in (-0.17, 0.17):
        for y in (-0.15, 0.15):
            bp(st, "BATH_Stool_Leg", (0.06, 0.06, 0.36), (x, y, 0.18), "M_WoodDark")


# ---------------------------------------------------------------- hanging produce
def corn_string(name, location, collection, count=2, length=0.55, orientation="back"):
    g = grp(name, location, collection)
    rp(g, name + "_Rope", (0, 0, 0), (0, 0, -length), 0.010, "M_Rope", segments=8)
    for i in range(count):
        z = -0.10 - i * 0.20
        x = (i - (count - 1) / 2) * 0.13
        cp(g, name + "_Cob_{:02d}".format(i), 0.055, 0.065, 0.24,
           (x, 0, z), "M_Corn", cap_material="M_Corn", segments=8,
           rotation=(0, 0, (i - 0.5) * 0.3))
        for j, a in enumerate((-0.55, 0.55)):
            bp(g, name + "_Husk_{:02d}_{:02d}".format(i, j), (0.06, 0.015, 0.30),
               (x, -0.02, z + 0.17), "M_Leaf",
               rotation=(0, a, (i - 0.5) * 0.25))
    return g


def chili_string(name, location, collection, count=5, length=0.40, orientation="back"):
    g = grp(name, location, collection)
    rp(g, name + "_Rope", (0, 0, 0), (0, 0, -length), 0.009, "M_Rope", segments=8)
    for i in range(count):
        x = (i - (count - 1) / 2) * 0.075
        z = -0.10 - (i % 3) * 0.07
        cp(g, name + "_Chili_{:02d}".format(i), 0.032, 0.010, 0.16,
           (x, 0.01, z), "M_Chili", cap_material="M_Chili", segments=8,
           rotation=(0.45 * (1 if i % 2 else -1), 0.20, 0.25 * (i - 2)))
        rp(g, name + "_Stem_{:02d}".format(i), (x, 0.01, z + 0.07),
           (x, 0.01, z + 0.13), 0.008, "M_Leaf", segments=8)
    return g


def garlic_string(name, location, collection, count=4, length=0.42, orientation="back"):
    g = grp(name, location, collection)
    rp(g, name + "_Rope", (0, 0, 0), (0, 0, -length), 0.008, "M_Rope", segments=8)
    for i in range(count):
        x = (i - (count - 1) / 2) * 0.10
        z = -0.10 - (i % 2) * 0.12
        sp(g, name + "_Bulb_{:02d}".format(i), 0.09, (x, 0, z), "M_Garlic",
           scale=(1.0, 0.9, 1.25), subdiv=2)
        rp(g, name + "_Neck_{:02d}".format(i), (x, 0, z + 0.10),
           (x, 0, z + 0.20), 0.008, "M_Leaf", segments=8)
    return g


# ---------------------------------------------------------------- exterior props
def build_log_pile():
    props = C["props"]
    g = grp("YARD_LogPile", (7.05, -1.55, 0.02), props, rotation=(0, 0, 0.14))
    for row in range(3):
        n = 4 - row
        for i in range(n):
            x = -0.42 + i * 0.28 + row * 0.14
            z = 0.20 + row * 0.31
            cp(g, "YARD_Log_{:02d}_{:02d}".format(row, i), 0.16, 0.16, 1.65,
               (x, 0, z), "M_Log", cap_material="M_LogCut", segments=8,
               rotation=(math.pi / 2, 0, 0))
    # loose logs on the ground
    for i in range(3):
        cp(g, "YARD_LogLoose_{:02d}".format(i), 0.14, 0.14, 1.40,
           (-0.72, -0.35 + i * 0.28, 0.15), "M_Log", cap_material="M_LogCut",
           segments=8, rotation=(math.pi / 2, 0, 0.08))


def build_tires():
    props = C["props"]
    g = grp("YARD_Tires", (-6.55, -6.35, 0.02), props, rotation=(0, 0, 0.25))
    for j, z in enumerate((0.17, 0.47)):
        torus("YARD_Tire_{:02d}".format(j), 0.40, 0.15, (0, 0, z), "M_Tire",
              C["props"], major_segments=28, minor_segments=10)
        ob = bpy.context.active_object
        ob.parent = g
        ob.location = (0, 0, z)
        cp(g, "YARD_TireHub_{:02d}".format(j), 0.24, 0.24, 0.06,
           (0, 0, z + 0.01), "M_MetalDark", segments=12)
        for k in range(8):
            ang = 2 * math.pi * k / 8
            bp(g, "YARD_Tread_{:02d}_{:02d}".format(j, k), (0.12, 0.10, 0.055),
               (math.cos(ang) * 0.50, math.sin(ang) * 0.50, z),
               "M_Tire", rotation=(0, 0, ang))
    for j in range(2):
        box("YARD_TireLoose_{:02d}".format(j), (0.55, 0.22, 0.85),
            (-7.08 + j * 0.28, -7.15, 0.24), "M_Tire", props,
            rotation=(0.20, 0.0, 0.85 + j * 0.12))


def build_stump():
    props = C["props"]
    g = grp("YARD_Stump", (3.05, -6.85, 0.02), props, rotation=(0, 0, 0.2))
    cp(g, "YARD_Stump_Body", 0.39, 0.34, 0.52, (0, 0, 0.26), "M_Log",
       cap_material="M_LogCut", segments=12)
    for i, r in enumerate((0.32, 0.22, 0.12)):
        cp(g, "YARD_Stump_Ring_{:02d}".format(i), r, r, 0.012,
           (0, 0, 0.525 + i * 0.002), "M_LogCut", segments=12)
    for i, a in enumerate((0.1, 2.0, 4.2)):
        cp(g, "YARD_Stump_Root_{:02d}".format(i), 0.10, 0.04, 0.52,
           (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.08), "M_Log",
           cap_material="M_LogCut", segments=8, rotation=(0.7, 0.2, a))
    # axe
    rp(g, "YARD_Axe_Handle", (0.05, -0.15, 0.52), (0.42, 0.30, 1.12), 0.035,
       "M_WoodLight", segments=8)
    bp(g, "YARD_Axe_Head", (0.28, 0.10, 0.18), (0.44, 0.33, 1.14), "M_Metal",
       rotation=(0, 0.2, -0.35))


def build_clay_jar():
    props = C["props"]
    g = grp("YARD_ClayJar", (-3.20, -5.50, 0.02), props, rotation=(0, 0, 0.2))
    sp(g, "YARD_Jar_Body", 0.48, (0, 0, 0.55), "M_Clay",
       scale=(1.0, 0.92, 1.35), subdiv=3)
    cp(g, "YARD_Jar_Neck", 0.28, 0.33, 0.22, (0, 0, 1.18), "M_Clay",
       cap_material="M_WoodDark", segments=12)
    tp(g, "YARD_Jar_Rim", 0.33, 0.045, (0, 0, 1.26), "M_Clay", major_segments=20)
    bp(g, "YARD_Jar_Band", (0.82, 0.82, 0.07), (0, 0, 0.72), "M_Rope")
    # a couple of dark cracks
    for i, (x, z, a) in enumerate(((-0.24, 0.64, 0.5), (0.30, 0.38, -0.3))):
        bp(g, "YARD_Jar_Crack_{:02d}".format(i), (0.02, 0.02, 0.28),
           (x, -0.44, z), "M_WoodDark", rotation=(0, a, 0.05))


def build_woodshed():
    shed = C["woodshed"]
    g = grp("YARD_Woodshed", (-8.35, -5.75, 0.02), shed, rotation=(0, 0, 0.15))
    for x in (-1.10, 1.10):
        for y in (-0.90, 0.90):
            bp(g, "SHED_Post_{:.1f}_{:.1f}".format(x, y), (0.16, 0.16, 2.15),
               (x, y, 1.08), "M_WoodDark")
    bp(g, "SHED_BackWall", (2.20, 0.08, 1.85), (0, 0.90, 1.00), "M_WoodFence")
    bp(g, "SHED_SideWallL", (0.08, 1.80, 1.75), (-1.10, 0, 0.95), "M_WoodFence")
    bp(g, "SHED_SideWallR", (0.08, 1.80, 1.75), (1.10, 0, 0.95), "M_WoodFence")
    bp(g, "SHED_Roof", (2.60, 2.30, 0.14), (0, -0.02, 2.18), "M_RoofSlate",
       rotation=(0.15, 0, 0))
    bp(g, "SHED_RoofTrim", (2.62, 0.12, 0.18), (0, -1.18, 2.04), "M_WoodDark")
    for i in range(18):
        row = i // 6
        col = i % 6
        cp(g, "SHED_Firewood_{:02d}".format(i), 0.11, 0.11, 1.85,
           (-0.85 + col * 0.33, 0.18 + row * 0.05, 0.18 + row * 0.24),
           "M_Log", cap_material="M_LogCut", segments=8,
           rotation=(math.pi / 2, 0, 0))
    # small chopping block
    cp(g, "SHED_Block", 0.24, 0.24, 0.38, (1.55, -0.95, 0.19), "M_Log",
       cap_material="M_LogCut", segments=12)
    rp(g, "SHED_Axe", (1.55, -0.95, 0.38), (1.70, -0.75, 0.95), 0.028,
       "M_WoodLight", segments=8)
    bp(g, "SHED_AxeHead", (0.20, 0.08, 0.14), (1.72, -0.73, 0.98), "M_Metal")


def build_pickup():
    veh = C["vehicle"]
    g = grp("YARD_Pickup", (8.25, -6.95, 0.02), veh, rotation=(0, 0, 0.18))
    # wheels
    for x in (-0.98, 1.02):
        for y in (-0.73, 0.73):
            w = torus("PICKUP_Tire_{:+.2f}_{:+.2f}".format(x, y), 0.38, 0.145,
                      (x, y, 0.40), "M_Tire", veh, rotation=(math.pi / 2, 0, 0),
                      major_segments=24, minor_segments=8)
            w.parent = g
            w.location = (x, y, 0.40)
            cp(g, "PICKUP_Hub_{:+.2f}_{:+.2f}".format(x, y), 0.17, 0.17, 0.12,
               (x, y + (0.09 if y > 0 else -0.09), 0.40), "M_Chrome",
               cap_material="M_MetalDark", segments=8, rotation=(math.pi / 2, 0, 0))
    # chassis / body
    bp(g, "PICKUP_Chassis", (2.90, 1.28, 0.26), (0, 0, 0.38), "M_MetalDark")
    bp(g, "PICKUP_BodyLower", (2.80, 1.43, 0.42), (0, 0, 0.64), "M_PickupBlue")
    bp(g, "PICKUP_Hood", (1.10, 1.32, 0.38), (-1.10, 0, 0.92), "M_PickupBlue")
    bp(g, "PICKUP_HoodTop", (0.92, 1.18, 0.08), (-1.06, 0, 1.13), "M_PickupBlue")
    bp(g, "PICKUP_Cab", (1.15, 1.30, 0.87), (-0.30, 0, 1.22), "M_PickupBlue")
    bp(g, "PICKUP_Roof", (1.06, 1.18, 0.08), (-0.22, 0, 1.67), "M_PickupBlue")
    bp(g, "PICKUP_BedFloor", (1.45, 1.28, 0.10), (0.91, 0, 0.84), "M_WoodLight")
    for y in (-0.66, 0.66):
        bp(g, "PICKUP_BedSide_{:+.1f}".format(y), (1.50, 0.10, 0.47),
           (0.94, y, 0.92), "M_PickupBlue")
    bp(g, "PICKUP_Tailgate", (0.10, 1.28, 0.42), (1.67, 0, 0.92), "M_PickupBlue")
    for i, x in enumerate((0.27, 0.55, 0.83, 1.11, 1.39)):
        bp(g, "PICKUP_BedSlat_{:02d}".format(i), (0.22, 1.24, 0.025),
           (x, 0, 0.90), "M_WoodLight")
    # windows
    bp(g, "PICKUP_Windshield", (0.035, 1.08, 0.45), (-0.92, 0, 1.42), "M_Glass")
    for y in (-0.68, 0.68):
        bp(g, "PICKUP_SideWindow_{:+.1f}".format(y), (0.66, 0.022, 0.38),
           (-0.28, y, 1.43), "M_Glass")
    bp(g, "PICKUP_RearWindow", (0.025, 0.96, 0.32), (0.30, 0, 1.43), "M_Glass")
    # front details
    bp(g, "PICKUP_Bumper", (0.12, 1.46, 0.16), (-1.65, 0, 0.56), "M_Chrome")
    bp(g, "PICKUP_Grille", (0.055, 0.78, 0.21), (-1.67, 0, 0.77), "M_MetalDark")
    for i, y in enumerate((-0.46, -0.15, 0.16, 0.47)):
        bp(g, "PICKUP_GrilleBar_{:02d}".format(i), (0.06, 0.035, 0.15),
           (-1.69, y, 0.77), "M_Chrome")
    for y in (-0.52, 0.52):
        cp(g, "PICKUP_Headlight_{:+.1f}".format(y), 0.12, 0.12, 0.055,
           (-1.67, y, 0.98), "M_GlassWarm", cap_material="M_Chrome",
           segments=8, rotation=(0, math.pi / 2, 0))
    # cab details
    for y in (-0.68, 0.68):
        bp(g, "PICKUP_DoorLine_{:+.1f}".format(y), (0.02, 0.02, 0.62),
           (-0.36, y, 1.20), "M_MetalDark")
        bp(g, "PICKUP_Handle_{:+.1f}".format(y), (0.16, 0.04, 0.045),
           (-0.18, y, 1.24), "M_Chrome")
        rp(g, "PICKUP_MirrorStem_{:+.1f}".format(y), (-0.74, y, 1.44),
           (-0.84, y + (0.11 if y > 0 else -0.11), 1.44), 0.018, "M_Chrome", segments=8)
        bp(g, "PICKUP_Mirror_{:+.1f}".format(y), (0.04, 0.14, 0.12),
           (-0.86, y + (0.11 if y > 0 else -0.11), 1.44), "M_Chrome")
    bp(g, "PICKUP_Step", (0.55, 1.22, 0.05), (-0.30, 0, 0.40), "M_MetalDark")
    # rust patches
    for i, (x, y, z) in enumerate(((-1.30, 0.56, 0.68), (0.72, -0.73, 0.74),
                                    (1.55, 0.50, 0.82))):
        bp(g, "PICKUP_Rust_{:02d}".format(i), (0.22, 0.02, 0.14), (x, y, z),
           "M_PickupRust", rotation=(0, 0, 0.15 * i))
    # cargo: a couple of logs/tools
    cp(g, "PICKUP_CargoLog", 0.10, 0.10, 0.82, (0.95, -0.22, 0.95),
       "M_Log", cap_material="M_LogCut", segments=8, rotation=(math.pi / 2, 0, 0))


def build_eave_goods():
    near = C["near"]
    for i, x in enumerate((-4.75, -2.30, 2.35, 4.75)):
        if i % 2 == 0:
            corn_string("EAVE_Corn_{:02d}".format(i), (x, -4.47, 2.96), near,
                        count=4, length=0.86)
        else:
            chili_string("EAVE_Chili_{:02d}".format(i), (x, -4.47, 2.96), near,
                         count=6, length=0.78)
    garlic_string("EAVE_Garlic_00", (-5.45, -4.47, 2.96), near, count=5, length=0.70)
    garlic_string("EAVE_Garlic_01", (3.55, -4.47, 2.96), near, count=5, length=0.70)


# ---------------------------------------------------------------- yard / forest
def build_yard():
    yard = C["yard"]
    # big forest floor and brighter yard patch
    grid_plane("YARD_Ground", -45, 45, -38, 38, 36, 32, -0.045,
               "M_GrassDark", yard,
               height_fn=lambda x, y: 0.018 * math.sin(x * 0.30) * math.cos(y * 0.24))
    grid_plane("YARD_Meadow", -16, 16, -12.5, 11.0, 30, 24, 0.006,
               "M_Grass", yard,
               height_fn=lambda x, y: 0.009 * math.sin(x * 0.65) * math.cos(y * 0.55))
    # dirt path from the gate to the stairs
    ribbon("YARD_Path", [(0.0, -8.25), (-0.05, -7.65), (0.12, -7.10), (-0.04, -6.50),
                         (-0.55, -5.95), (-0.55, -5.35)], [2.35, 2.20, 2.05, 1.95, 1.90, 1.85],
           0.045, "M_Dirt", yard)
    # smaller worn patch under the truck
    ribbon("YARD_TruckPatch", [(6.1, -6.95), (7.0, -6.70), (8.1, -6.65), (9.6, -6.90)],
           [1.1, 1.8, 1.7, 0.8], 0.038, "M_Dirt", yard)
    # grass tufts
    build_grass_tufts(yard)
    # stones and flowers
    for i in range(12):
        x = random.uniform(-9.0, 9.0)
        y = random.uniform(-8.0, 6.0)
        if abs(x) < 7 or abs(y) < 4:
            continue
        sp(None, "x", 0.1, (0, 0, 0), "M_Stone") if False else None
        g = grp("YARD_Rock_{:02d}".format(i), (x, y, 0.03), yard,
                rotation=(0, 0, random.uniform(0, 6.28)))
        sp(g, "YARD_Rock_Body_{:02d}".format(i), 0.18, (0, 0, 0.08), "M_Stone",
           scale=(1.0, 0.8, 0.55), subdiv=2)
    for i in range(16):
        x = random.uniform(-8.6, 8.6)
        y = random.uniform(-7.8, 5.8)
        if abs(x) < 6.5 and abs(y) < 4:
            continue
        g = grp("YARD_Flower_{:02d}".format(i), (x, y, 0.04), yard)
        rp(g, "YARD_Flower_Stem_{:02d}".format(i), (0, 0, 0), (0, 0, 0.22), 0.012,
           "M_Leaf", segments=8)
        for k in range(4):
            a = k * math.pi / 2
            bp(g, "YARD_Flower_Petal_{:02d}_{:02d}".format(i, k), (0.07, 0.11, 0.02),
               (math.cos(a) * 0.055, math.sin(a) * 0.055, 0.22), "M_FabricCream",
               rotation=(0, 0, a))
        sp(g, "YARD_Flower_Center_{:02d}".format(i), 0.045, (0, 0, 0.23), "M_Corn",
           subdiv=2)
    # bushes near the cabin and fence
    for i, (x, y, r) in enumerate(((-6.8, -4.3, 0.52), (-7.8, 2.6, 0.62),
                                    (8.2, 2.7, 0.70), (7.9, -3.8, 0.50),
                                    (-8.2, -2.1, 0.45), (8.6, -5.1, 0.40))):
        g = grp("YARD_Bush_{:02d}".format(i), (x, y, 0.03), yard,
                rotation=(0, 0, random.uniform(0, 6.28)))
        sp(g, "YARD_Bush_Body_{:02d}".format(i), r, (0, 0, r * 0.52), "M_LeafDark",
           scale=(1.25, 0.9, 0.72), subdiv=2)
        sp(g, "YARD_Bush_Body2_{:02d}".format(i), r * 0.72, (r * 0.5, 0.12, r * 0.4),
           "M_Leaf", scale=(0.95, 0.9, 0.72), subdiv=2)


def build_grass_tufts(collection):
    verts = []
    faces = []
    for i in range(320):
        x = random.uniform(-10.2, 10.2)
        y = random.uniform(-8.4, 7.8)
        if abs(x) < 6.6 and abs(y) < 3.8:
            continue
        # keep the path clear
        if abs(x) < 1.6 and -8.5 < y < -5.0:
            continue
        if abs(x - 5.8) < 2.0 and abs(y + 6.3) < 1.6:
            continue
        for blade in range(3):
            a = random.uniform(0, 6.28)
            h = random.uniform(0.18, 0.46)
            w = random.uniform(0.025, 0.045)
            dx, dy = math.cos(a) * w, math.sin(a) * w
            ox = x + random.uniform(-0.08, 0.08)
            oy = y + random.uniform(-0.08, 0.08)
            bend = random.uniform(-0.09, 0.09)
            base = len(verts)
            for seg in range(4):
                t = seg / 3
                z = 0.02 + h * t
                px = ox + bend * t * t
                py = oy + (bend * 0.6) * t * t
                ww = 1.0 - t * 0.82
                verts.append((px - dx * ww, py - dy * ww, z))
                verts.append((px + dx * ww, py + dy * ww, z))
            for seg in range(3):
                a0 = base + seg * 2
                faces.append((a0, a0 + 1, a0 + 3, a0 + 2))
    obj = L.new_obj("YARD_GrassTufts", verts, faces, "M_Grass", collection)
    return obj


def build_tree(name, location, height, radius, collection, tint=0):
    g = grp(name, location, collection, rotation=(0, 0, random.uniform(0, 6.28)))
    ch = height * 0.62
    cp(g, name + "_Trunk", radius, radius * 0.58, ch, (0, 0, ch / 2),
       "M_Log", cap_material="M_LogCut", segments=8)
    # a few roots / lower branches
    for i, a in enumerate((0.2, 2.2, 4.3)):
        rp(g, name + "_Root_{:02d}".format(i),
           (0, 0, 0.08), (math.cos(a) * radius * 1.9, math.sin(a) * radius * 1.9, 0.02),
           radius * 0.32, "M_Log", segments=8)
    tiers = 7
    for i in range(tiers):
        t = i / (tiers - 1)
        z = height * 0.30 + t * height * 0.68
        r = max(0.18, radius * (3.6 - 2.7 * t))
        h = height * 0.20 * (1.0 - t * 0.35)
        mat = ("M_LeafDark", "M_Leaf")[(i + tint) % 2]
        cp(g, name + "_Tier_{:02d}".format(i), r, r * 0.42, h,
           (0, 0, z + h * 0.15), mat, cap_material=mat, segments=8,
           rotation=(0, 0, random.uniform(-0.3, 0.3)))
    sp(g, name + "_Crown", radius * 0.45, (0, 0, height * 0.97), "M_Leaf",
       scale=(1.0, 1.0, 1.4), subdiv=2)
    return g


def build_forest():
    forest = C["forest"]
    positions = [
        (-15.5, -7.5, 14.0, 0.55), (-12.2, -13.0, 11.0, 0.44),
        (-6.6, -16.3, 15.0, 0.60), (-24.0, -12.0, 13.0, 0.50),
        (23.0, -9.0, 12.0, 0.48), (17.0, -9.5, 16.0, 0.62),
        (18.5, 0.5, 13.5, 0.52), (16.0, 8.0, 12.0, 0.46),
        (9.3, 14.0, 15.0, 0.58), (1.0, 17.0, 12.0, 0.48),
        (-7.0, 16.0, 14.0, 0.55), (-14.0, 11.0, 11.5, 0.44),
        (-17.0, 3.0, 15.5, 0.60), (-14.8, -2.0, 10.0, 0.40),
        (15.5, -3.0, 9.0, 0.36), (-4.0, -12.0, 8.5, 0.34),
        (19.0, -15.0, 9.5, 0.38), (14.5, 4.0, 10.5, 0.40),
        (-11.8, 14.0, 13.5, 0.50), (-3.8, 19.0, 14.5, 0.55),
        (4.8, 19.5, 13.0, 0.50), (11.8, 16.0, 12.5, 0.48),
        (-19.0, 7.0, 13.0, 0.52), (20.0, 8.0, 12.0, 0.48),
        (-8.4, 8.8, 9.2, 0.36), (-4.2, 9.5, 9.8, 0.40),
        (0.2, 9.9, 9.4, 0.38), (4.4, 9.3, 10.0, 0.40),
        (8.4, 8.8, 9.0, 0.36),
    ]
    for i, (x, y, h, r) in enumerate(positions):
        build_tree("TREE_{:02d}".format(i), (x, y, 0.0), h, r, forest, tint=i % 3)
    # small saplings closer to the yard
    for i, (x, y) in enumerate(((-10.6, -3.4), (11.8, -4.3), (-11.5, 5.5), (11.0, 6.4))):
        build_tree("TREE_Sapling_{:02d}".format(i), (x, y, 0.0), 4.2, 0.20, forest, tint=i % 2)


# ---------------------------------------------------------------- lighting / cameras / render
def make_light(name, light_type, location, energy, color, size=1.0, rotation=(0, 0, 0)):
    data = bpy.data.lights.new(name, light_type)
    data.energy = energy
    data.color = lin(color)[:3]
    if light_type in {"AREA", "POINT"}:
        data.shadow_soft_size = size
    if light_type == "AREA":
        data.shape = "DISK"
        data.size = size
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    obj.rotation_euler = rotation
    C["lights"].objects.link(obj)
    return obj


def setup_lighting_and_world():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("World_Guangqiang")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = lin("#8CCBEA")
    bg.inputs["Strength"].default_value = 0.78
    sky = nt.nodes.new("ShaderNodeTexGradient")
    sky.gradient_type = "QUADRATIC"
    out = nt.nodes.new("ShaderNodeOutputWorld")
    # Keep the world simple: a soft cool sky. A gradient would be less predictable.
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    sun_data = bpy.data.lights.new("LGT_Sun", "SUN")
    sun_data.energy = 3.8
    sun_data.color = lin("#FFE9C0")[:3]
    sun_data.angle = 0.12
    sun = bpy.data.objects.new("LGT_Sun", sun_data)
    sun.rotation_euler = (math.radians(48), math.radians(-14), math.radians(38))
    C["lights"].objects.link(sun)

    # broad cool fill from the forest side
    make_light("LGT_Fill", "AREA", (0, -11, 8.0), 420, "#CFE8F5", size=10.0,
               rotation=(math.radians(58), 0, 0))
    # warm room lights for the cutaway
    make_light("LGT_Bedroom", "AREA", (-4.15, -0.8, 2.52), 180, "#FFD9A3", size=1.8)
    make_light("LGT_BedroomBack", "AREA", (-4.15, 1.9, 2.35), 95, "#FFBF78", size=1.2)
    make_light("LGT_Kitchen", "AREA", (0.25, 0.4, 2.58), 200, "#FFD9A0", size=1.8)
    make_light("LGT_Bathroom", "AREA", (4.3, 0.0, 2.38), 150, "#FFD3A0", size=1.4)
    make_light("LGT_Stove", "POINT", (-5.35, -2.35, 0.65), 35, "#FF6A27", size=0.3)
    make_light("LGT_Pendant", "POINT", (0.22, -0.55, 2.32), 55, "#FFD18A", size=0.25)
    make_light("LGT_Porch", "POINT", (-0.50, -4.20, 2.55), 180, "#FFC47B", size=0.30)
    make_light("LGT_PorchFill", "POINT", (-0.10, -4.00, 2.10), 260, "#FFC787", size=0.45)
    make_light("LGT_PorchFill2", "POINT", (3.10, -4.00, 2.20), 120, "#FFCC92", size=0.40)
    make_light("LGT_StairLamp_L", "POINT", (-2.20, -6.92, 1.62), 55, "#FFD39A", size=0.22)
    make_light("LGT_StairLamp_R", "POINT", (0.92, -6.92, 1.62), 55, "#FFD39A", size=0.22)

    # porch lantern object
    lantern = grp("PORCH_Lantern", (-0.50, -4.18, 2.62), C["near"])
    bp(lantern, "PORCH_Lantern_Body", (0.20, 0.20, 0.32), (0, 0, 0), "M_MetalDark")
    bp(lantern, "PORCH_Lantern_Glass", (0.16, 0.16, 0.22), (0, 0, 0), "M_WarmGlow")
    cp(lantern, "PORCH_Lantern_Top", 0.10, 0.16, 0.08, (0, 0, 0.20), "M_MetalDark",
       segments=8)

    scene.render.engine = "BLENDER_EEVEE"
    ev = scene.eevee
    ev.taa_render_samples = 64
    ev.taa_samples = 16
    ev.use_shadows = True
    ev.shadow_pool_size = "2048"
    ev.shadow_resolution_scale = 0.5
    if hasattr(ev, "use_raytracing"):
        ev.use_raytracing = True
    if hasattr(ev, "use_fast_gi"):
        ev.use_fast_gi = True
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.compression = 15
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1800
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.render.fps = 24


def make_camera(name, location, target, lens=50, ortho_scale=None):
    data = bpy.data.cameras.new(name)
    if ortho_scale is not None:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    else:
        data.type = "PERSP"
        data.lens = lens
    data.clip_start = 0.1
    data.clip_end = 250
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    C["cams"].objects.link(obj)
    direction = Vector(target) - Vector(location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def setup_cameras():
    cams = {}
    cams["cutaway"] = make_camera("CAM_IsometricCutaway", (14.2, -19.0, 12.0),
                                  (0.0, -0.8, 1.2), ortho_scale=24.0)
    cams["exterior"] = make_camera("CAM_Exterior", (13.8, -27.0, 7.6),
                                   (0.0, -0.5, 2.0), lens=48)
    cams["bedroom"] = make_camera("CAM_BedroomCloseup", (-1.4, -9.8, 4.2),
                                  (-3.95, 0.95, 1.35), lens=38)
    cams["kitchen"] = make_camera("CAM_KitchenBathCloseup", (4.2, -14.0, 4.4),
                                   (2.2, 0.5, 1.35), ortho_scale=9.5)
    return cams


def set_cutaway(hidden=True):
    C["roof"].hide_render = hidden
    C["near"].hide_render = hidden
    for c in (C["roof"], C["near"]):
        c.hide_viewport = hidden
    cam_pos = Vector((14.2, -19.0, 12.0))
    for o in bpy.data.objects:
        if o.type != "EMPTY" or not o.name.startswith("TREE_"):
            continue
        near = (Vector((o.location.x, o.location.y, 0.0))
                - Vector((cam_pos.x, cam_pos.y, 0.0))).length < 22.0
        for child in [o] + list(o.children_recursive):
            child.hide_render = hidden and near


def render_all(cams):
    scene = bpy.context.scene
    shots = (
        ("01_isometric_cutaway", cams["cutaway"], True),
        ("02_exterior", cams["exterior"], False),
        ("03_bedroom", cams["bedroom"], True),
        ("04_kitchen_bathroom", cams["kitchen"], True),
    )
    for filename, cam, cutaway in shots:
        set_cutaway(cutaway)
        vehicle = bpy.data.collections.get("Yard_Vehicle")
        if vehicle:
            vehicle.hide_render = cutaway and filename in ("03_bedroom", "04_kitchen_bathroom")
        yard_props = bpy.data.collections.get("Yard_Props")
        if yard_props:
            yard_props.hide_render = cutaway and filename in ("03_bedroom", "04_kitchen_bathroom")
        scene.camera = cam
        scene.render.filepath = os.path.join(RENDER_DIR, filename + ".png")
        bpy.ops.render.render(write_still=True)
    set_cutaway(True)
    vehicle = bpy.data.collections.get("Yard_Vehicle")
    if vehicle:
        vehicle.hide_render = False
    yard_props = bpy.data.collections.get("Yard_Props")
    if yard_props:
        yard_props.hide_render = False
    scene.camera = cams["cutaway"]


def report():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    non_quad, degenerate = L.validate_quads()
    print("MESH OBJECTS:", len(meshes))
    print("NON_QUAD:", len(non_quad), list(non_quad.items())[:10])
    print("DEGENERATE:", len(degenerate), list(degenerate.items())[:10])
    leaf = sum(len(o.data.polygons) for o in meshes)
    print("FACES:", leaf)
    return non_quad, degenerate


def write_asset_list():
    lines = ["# 光头强小木屋 · 工程清单", "",
             "工程文件：`Guangqiang_Cabin.blend`", ""]
    for cname, c in L.COLLS.items():
        objs = [o for o in bpy.data.objects if o.type in {"MESH", "EMPTY"} and c in o.users_collection]
        if not objs:
            continue
        lines.append("## " + cname)
        for o in sorted(objs, key=lambda x: x.name):
            lines.append("- " + o.name)
        lines.append("")
    path = os.path.join(ROOT, "ASSET_LIST.md")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    print("ASSET LIST:", path)


def main():
    L.clear_scene()
    random.seed(20261125)
    setup_collections()
    setup_materials()
    build_architecture()
    build_roof()
    build_side_lean_to()
    build_porch()
    build_facade_and_porch_details()
    build_interior_window_dressing()
    build_fence()
    build_bedroom()
    build_kitchen()
    build_bathroom()
    build_yard()
    build_log_pile()
    build_tires()
    build_stump()
    build_clay_jar()
    build_woodshed()
    build_pickup()
    build_yard_extras()
    build_eave_goods()
    build_forest()
    setup_lighting_and_world()

    # make all objects independent, named, with real UV maps
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.type == "MESH":
            o.select_set(False)
    uv_count = L.make_uv_all()
    print("UV OBJECTS:", uv_count)

    non_quad, degenerate = report()
    cams = setup_cameras()
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print("SAVED:", OUT_BLEND)
    write_asset_list()
    render_all(cams)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    print("DONE")


if __name__ == "__main__":
    main()
