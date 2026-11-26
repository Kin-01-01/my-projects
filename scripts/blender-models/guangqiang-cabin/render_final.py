import bpy
import os
from mathutils import Vector

ROOT = r"D:/workBuddy/2026-11-25-08-52-59/guangqiang_cabin"
RENDER_DIR = os.path.join(ROOT, "renders")
s = bpy.context.scene
s.render.resolution_x = 3840
s.render.resolution_y = 2880
s.render.resolution_percentage = 100
s.eevee.taa_render_samples = 64
s.eevee.shadow_pool_size = "2048"
s.eevee.shadow_resolution_scale = 0.5

roof = bpy.data.collections.get("Roof")
near = bpy.data.collections.get("House_Cutaway_Near")
vehicle = bpy.data.collections.get("Yard_Vehicle")
yard_props = bpy.data.collections.get("Yard_Props")
cam_pos = Vector((14.2, -19.0, 12.0))


def hide_cutaway(hidden):
    roof.hide_render = hidden
    near.hide_render = hidden
    for o in bpy.data.objects:
        if o.type != "EMPTY" or not o.name.startswith("TREE_"):
            continue
        dist = (Vector((o.location.x, o.location.y, 0.0)) -
                Vector((cam_pos.x, cam_pos.y, 0.0))).length
        for child in [o] + list(o.children_recursive):
            child.hide_render = hidden and dist < 22.0


shots = (
    ("01_isometric_cutaway", "CAM_IsometricCutaway", True, False),
    ("02_exterior", "CAM_Exterior", False, False),
    ("03_bedroom", "CAM_BedroomCloseup", True, True),
    ("04_kitchen_bathroom", "CAM_KitchenBathCloseup", True, True),
)
for filename, cam_name, cut, hide_vehicle in shots:
    hide_cutaway(cut)
    vehicle.hide_render = hide_vehicle
    yard_props.hide_render = hide_vehicle
    s.camera = bpy.data.objects[cam_name]
    s.render.filepath = os.path.join(RENDER_DIR, filename + ".png")
    bpy.ops.render.render(write_still=True)

hide_cutaway(True)
vehicle.hide_render = False
yard_props.hide_render = False
s.camera = bpy.data.objects["CAM_IsometricCutaway"]
s.render.filepath = ""
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "Guangqiang_Cabin.blend"))
print("FINAL_RENDER_DONE")
