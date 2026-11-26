"""Parametric Eiffel Tower for Blender 5.x (headless-safe). Run with:
   blender -b --factory-startup --python build_eiffel.py
Outputs: eiffel_tower.blend, eiffel_tower.glb, preview.png
"""
import bpy
import math
import os
from mathutils import Vector

OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)

TOP = 300.0          # structural top, metres
ANTENNA_TOP = 324.0
PROFILE = [           # (height, half-width of square footprint) - curved flare at the base
    (0, 70), (20, 64), (40, 54), (57, 43), (85, 34.5), (115, 28),
    (150, 21), (200, 13), (240, 8.5), (276, 5.5), (300, 2.2),
]


def half(z):
    z = max(0.0, min(z, TOP))
    for (z0, w0), (z1, w1) in zip(PROFILE, PROFILE[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return w0 + (w1 - w0) * t
    return PROFILE[-1][1]


class MeshAcc:
    """Accumulates cylinder segments into one mesh -> few objects, fast render."""
    def __init__(self):
        self.vs = []
        self.fs = []

    def beam(self, p1, p2, r1, r2=None, sides=8):
        if r2 is None:
            r2 = r1
        a, b = Vector(p1), Vector(p2)
        d = b - a
        if d.length < 1e-5:
            return
        d.normalize()
        ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        u = d.cross(ref).normalized()
        v = d.cross(u).normalized()
        base = len(self.vs)
        for center, radius in ((a, r1), (b, r2)):
            for i in range(sides):
                ang = 2 * math.pi * i / sides
                self.vs.append(tuple(center + (u * math.cos(ang) + v * math.sin(ang)) * radius))
        for i in range(sides):
            j = (i + 1) % sides
            self.fs.append((base + i, base + j, base + sides + j, base + sides + i))
        self.fs.append(tuple(base + i for i in range(sides - 1, -1, -1)))
        self.fs.append(tuple(base + sides + i for i in range(sides)))

    def box(self, center, size):
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        base = len(self.vs)
        for dx in (-sx, sx):
            for dy in (-sy, sy):
                for dz in (-sz, sz):
                    self.vs.append((cx + dx, cy + dy, cz + dz))
        idx = lambda i, j, k: base + (4 * i + 2 * j + k)
        self.fs.extend([
            (idx(0,0,0), idx(0,0,1), idx(0,1,1), idx(0,1,0)),
            (idx(1,0,0), idx(1,1,0), idx(1,1,1), idx(1,0,1)),
            (idx(0,0,0), idx(1,0,0), idx(1,0,1), idx(0,0,1)),
            (idx(0,1,0), idx(0,1,1), idx(1,1,1), idx(1,1,0)),
            (idx(0,0,0), idx(0,1,0), idx(1,1,0), idx(1,0,0)),
            (idx(0,0,1), idx(1,0,1), idx(1,1,1), idx(0,1,1)),
        ])

    def make_object(self, name, material):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vs, [], self.fs)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        for poly in mesh.polygons:
            poly.use_smooth = False
        return obj


def mat(name, color, metallic=0.0, roughness=0.6):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


# ---- clean scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

iron = mat("Wrought Iron", (0.58, 0.43, 0.29), 0.55, 0.55)
concrete = mat("Concrete", (0.62, 0.61, 0.58), 0.0, 0.9)
deck = mat("Deck", (0.40, 0.34, 0.27), 0.25, 0.7)

structure = MeshAcc()
platforms = MeshAcc()
bases = MeshAcc()

legs = [(-1, -1), (-1, 1), (1, 1), (1, -1)]  # clockwise ring
corner = lambda sx, sy, z: (sx * half(z), sy * half(z), z)

# --- four curved legs, tapering
for sx, sy in legs:
    z = 0.0
    while z < TOP - 1e-6:
        z2 = min(z + 6, TOP)
        r1 = 2.3 * (1 - z / TOP) + 0.45
        r2 = 2.3 * (1 - z2 / TOP) + 0.45
        structure.beam(corner(sx, sy, z), corner(sx, sy, z2), r1, r2, 10)
        z = z2

# --- level lines + X bracing on all four faces
levels = sorted(set([0.0, 57.0, 115.0, 276.0, TOP] + [float(v) for v in range(0, 301, 12)]))
for z1, z2 in zip(levels, levels[1:]):
    for k in range(4):
        a, b = legs[k], legs[(k + 1) % 4]
        structure.beam(corner(*a, z2), corner(*b, z2), 0.6, 0.6, 7)
        structure.beam(corner(*a, z1), corner(*b, z1), 0.55, 0.55, 7)
        structure.beam(corner(*a, z1), corner(*b, z2), 0.36, 0.36, 6)
        structure.beam(corner(*b, z1), corner(*a, z2), 0.36, 0.36, 6)

# --- internal diagonal lattice (lighter above the arches; kept clear below so arches read)
for z1, z2 in zip(levels, levels[1:]):
    if z2 <= 57:          # leave the ground-level bay open for the arches
        continue
    structure.beam(corner(*legs[0], z1), corner(*legs[2], z2), 0.26, 0.26, 6)
    structure.beam(corner(*legs[1], z1), corner(*legs[3], z2), 0.26, 0.26, 6)

# --- the four grand arches under the first platform (the tower's signature)
for k in range(4):
    a, b = legs[k], legs[(k + 1) % 4]
    n = 22
    pts = []
    for i in range(n + 1):
        t = i / n
        x = a[0] * half(0) * (1 - t) + b[0] * half(0) * t
        y = a[1] * half(0) * (1 - t) + b[1] * half(0) * t
        pts.append((x, y, 54 * 4 * t * (1 - t)))   # crown just under the 1st deck
    for p1, p2 in zip(pts, pts[1:]):
        structure.beam(p1, p2, 1.35, 1.35, 10)

# --- three observation decks + railings
for z, thick, overhang in ((57, 2.6, 4.5), (115, 2.2, 3.5), (276, 1.8, 2.5)):
    h = half(z) + overhang
    platforms.box((0, 0, z), (2 * h, 2 * h, thick))
    rail_z = z + thick / 2 + 1.4
    for k in range(4):
        a, b = legs[k], legs[(k + 1) % 4]
        structure.beam((a[0] * h, a[1] * h, rail_z), (b[0] * h, b[1] * h, rail_z), 0.22, 0.22, 6)
    for sx, sy in legs:
        structure.beam((sx * h, sy * h, z), (sx * h, sy * h, rail_z), 0.22, 0.22, 6)

# --- upper column, top platform, spire and antenna
structure.beam((0, 0, 276), (0, 0, 302), 2.0, 1.25, 12)
platforms.box((0, 0, 302), (7, 7, 1.8))
structure.beam((0, 0, 302), (0, 0, 312), 1.1, 0.7, 10)
structure.beam((0, 0, 312), (0, 0, ANTENNA_TOP), 0.35, 0.12, 8)

# --- four concrete footings
for sx, sy in legs:
    bases.box((sx * 62.5, sy * 62.5, -2.0), (19, 19, 4))

structure.make_object("Eiffel Tower - Iron Lattice", iron)
platforms.make_object("Eiffel Tower - Decks", deck)
bases.make_object("Eiffel Tower - Footings", concrete)

# --- ground plane for the preview
ground = MeshAcc()
ground.box((0, 0, -4.5), (1400, 1400, 1))
ground.make_object("Ground", mat("Ground", (0.62, 0.64, 0.62), 0.0, 1.0))

# --- lighting & camera
world = bpy.context.scene.world or bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.44, 0.56, 0.70, 1)
bg.inputs["Strength"].default_value = 0.45

def area(name, loc, energy, size, target=(0, 0, 150)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

area("Key", (280, -260, 380), 320000, 300)
area("Fill", (-260, 180, 240), 160000, 260)
area("Rim", (60, 320, 400), 200000, 220)

cam_data = bpy.data.cameras.new("Camera")
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (470, -470, 165)
target = Vector((0, 0, 150))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 46
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.resolution_x = 1100
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT, "preview.png")
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 24
scene.view_settings.view_transform = 'Standard'

# --- save + export
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "eiffel_tower.blend"))
try:
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "eiffel_tower.glb"),
                              export_format='GLB', export_apply=True)
    print("GLB_OK")
except Exception as exc:
    print("GLB_SKIP", exc)
bpy.ops.render.render(write_still=True)
print("DONE", OUT)
