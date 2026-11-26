"""Eiffel Tower v2 —写实、对称、分层精细钢架。
GUI 执行：通过 bridge 注入（不渲染，只建模+保存）。
后台执行：blender -b --python build_eiffel_v2.py（建模+导出glb+渲染预览）。
"""
import bpy
import math
import os
from mathutils import Vector

OUT = r'D:\workBuddy\2026-11-24-22-09-52\eiffel_tower'
TOP = 300.0
ANTENNA_TOP = 324.0

# 半宽轮廓：底部轻微外鼓 → 三层平台逐级收窄（真实比例 125m 基座 / 324m 总高）
PROFILE = [
    (0, 62.5), (15, 63.5), (30, 61), (45, 54), (57, 45),
    (70, 39), (85, 34), (100, 30.5), (115, 27.5),
    (135, 23), (155, 19), (175, 15.5), (195, 12.5),
    (215, 10), (240, 7.5), (260, 6.2), (276, 5.5),
    (288, 4), (300, 2.2),
]
LEGS = [(-1, -1), (-1, 1), (1, 1), (1, -1)]  # 顺时针，保证四向对称
DECKS = [(57.0, 2.6, 4.5), (115.0, 2.2, 3.5), (276.0, 1.8, 2.5)]


def half(z):
    z = max(0.0, min(float(z), TOP))
    for (z0, w0), (z1, w1) in zip(PROFILE, PROFILE[1:]):
        if z <= z1:
            return w0 + (w1 - w0) * ((z - z0) / (z1 - z0))
    return PROFILE[-1][1]


def corner(sx, sy, z):
    return (sx * half(z), sy * half(z), z)


class MeshAcc:
    """批量把杆件/箱体塞进一个 mesh，减少对象数、保证对称一致。"""
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

    def object(self, name, material):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vs, [], self.fs)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        return obj


def material(name, rgb, metallic, roughness):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


# ============ 1. 清空当前场景全部对象 ============
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for mesh in list(bpy.data.meshes):
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)

iron = material("Wrought Iron", (0.40, 0.30, 0.20), 0.72, 0.48)
deck_mat = material("Deck Iron", (0.32, 0.28, 0.23), 0.45, 0.62)
concrete = material("Concrete", (0.60, 0.59, 0.56), 0.0, 0.9)
ground_mat = material("Ground", (0.55, 0.60, 0.55), 0.0, 1.0)

lattice = MeshAcc()   # 主钢架
details = MeshAcc()   # 栏杆/细部
platforms = MeshAcc() # 三层平台
footings = MeshAcc()  # 基座
ground = MeshAcc()

# ============ 2. 四条弧形主腿（对称） ============
for sx, sy in LEGS:
    z = 0.0
    while z < TOP - 1e-6:
        z2 = min(z + 5.0, TOP)
        r1 = 2.45 * (1 - z / TOP) ** 1.05 + 0.38
        r2 = 2.45 * (1 - z2 / TOP) ** 1.05 + 0.38
        lattice.beam(corner(sx, sy, z), corner(sx, sy, z2), r1, r2, 10)
        z = z2

# ============ 3. 分层水平环梁 + X 形斜撑（每 9m 一格） ============
levels = sorted(set([float(v) for v in range(0, 301, 9)] + [d[0] for d in DECKS] + [TOP]))
for z in levels:
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        lattice.beam(corner(*a, z), corner(*b, z), 0.62, 0.62, 8)
for z1, z2 in zip(levels, levels[1:]):
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        lattice.beam(corner(*a, z1), corner(*b, z2), 0.36, 0.36, 6)
        lattice.beam(corner(*b, z1), corner(*a, z2), 0.36, 0.36, 6)

# 次水平梁（每格中间再分一道，增加钢架密度与写实感）
for z1, z2 in zip(levels, levels[1:]):
    zm = (z1 + z2) / 2
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        details.beam(corner(*a, zm), corner(*b, zm), 0.22, 0.22, 5)

# 内部对角交叉（对称双向）
for i, (z1, z2) in enumerate(zip(levels, levels[1:])):
    if i % 2:
        continue
    lattice.beam(corner(*LEGS[0], z1), corner(*LEGS[2], z2), 0.28, 0.28, 6)
    lattice.beam(corner(*LEGS[1], z1), corner(*LEGS[3], z2), 0.28, 0.28, 6)

# ============ 4. 第一平台下方四座大拱门（双拱，标志细节） ============
for k in range(4):
    a, b = LEGS[k], LEGS[(k + 1) % 4]
    for scale, rise, radius, sides in ((1.0, 52.0, 1.30, 10), (0.72, 41.0, 0.55, 7)):
        pts = []
        n = 24
        for i in range(n + 1):
            t = i / n
            x = (a[0] * (1 - t) + b[0] * t) * half(0) * scale
            y = (a[1] * (1 - t) + b[1] * t) * half(0) * scale
            pts.append((x, y, rise * 4 * t * (1 - t)))
        for p1, p2 in zip(pts, pts[1:]):
            lattice.beam(p1, p2, radius, radius, sides)

# ============ 5. 三层观景平台 + 护栏 + 底部支撑 ============
for z, thick, overhang in DECKS:
    h = half(z) + overhang
    platforms.box((0, 0, z), (2 * h, 2 * h, thick))
    deck_top = z + thick / 2
    rail_z = deck_top + 1.7
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        # 边缘梁
        lattice.beam((a[0] * h, a[1] * h, deck_top),
                     (b[0] * h, b[1] * h, deck_top), 0.42, 0.42, 7)
        # 护栏：立柱 + 扶手
        posts = 9
        for i in range(posts + 1):
            t = i / posts
            px = (a[0] * (1 - t) + b[0] * t) * h
            py = (a[1] * (1 - t) + b[1] * t) * h
            details.beam((px, py, deck_top), (px, py, rail_z), 0.16, 0.16, 5)
        details.beam((a[0] * h, a[1] * h, rail_z),
                     (b[0] * h, b[1] * h, rail_z), 0.20, 0.20, 6)
    # 平台下方斜撑连到四腿
    for sx, sy in LEGS:
        lattice.beam(corner(sx, sy, z - 9), (sx * h, sy * h, z - thick / 2), 0.42, 0.42, 7)

# ============ 6. 顶部塔身收窄 + 观景台 + 塔尖 + 天线 ============
lattice.beam((0, 0, 276), (0, 0, 300), 2.05, 1.20, 12)
platforms.box((0, 0, 300), (7.5, 7.5, 2.0))
lattice.beam((0, 0, 301), (0, 0, 313), 1.05, 0.48, 10)
lattice.beam((0, 0, 313), (0, 0, ANTENNA_TOP), 0.30, 0.07, 8)
for zc in (304.5, 308.5):
    details.beam((-2.4, 0, zc), (2.4, 0, zc), 0.14, 0.14, 5)
    details.beam((0, -2.4, zc), (0, 2.4, zc), 0.14, 0.14, 5)

# ============ 7. 四座混凝土基座（台阶状，对称） ============
for sx, sy in LEGS:
    bx, by = sx * 62.5, sy * 62.5
    footings.box((bx, by, 1.5), (22, 22, 3))
    footings.box((bx, by, 4.5), (17, 17, 3))
    footings.box((bx, by, 7.0), (12, 12, 2))

ground.box((0, 0, -4), (1400, 1400, 2))

lattice.object("Eiffel Tower - Steel Lattice", iron)
details.object("Eiffel Tower - Detail Bars", iron)
platforms.object("Eiffel Tower - Decks", deck_mat)
footings.object("Eiffel Tower - Footings", concrete)
ground.object("Ground", ground_mat)

# ============ 8. 灯光与相机 ============
world = bpy.context.scene.world or bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.44, 0.56, 0.72, 1)
bg.inputs["Strength"].default_value = 0.55


def area(name, loc, energy, size, target=(0, 0, 150)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


area("Key", (280, -260, 380), 320000, 300)
area("Fill", (-260, 180, 240), 160000, 260)
area("Rim", (60, 320, 400), 200000, 220)

cam_data = bpy.data.cameras.new("Camera")
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (470, -470, 175)
cam.rotation_euler = (Vector((0, 0, 150)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
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
    scene.cycles.samples = 32
scene.view_settings.view_transform = 'Standard'

# ============ 9. GUI 视口对准模型 ============
if not bpy.app.background:
    for screen in bpy.data.screens:
        for a in screen.areas:
            if a.type == 'VIEW_3D':
                a.spaces.active.shading.type = 'MATERIAL'
                r3d = a.spaces.active.region_3d
                r3d.view_location = (0, 0, 150)
                r3d.view_distance = 440
                a.tag_redraw()

# ============ 10. 保存 / 后台导出 ============
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "eiffel_tower.blend"))
if bpy.app.background:
    try:
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "eiffel_tower.glb"),
                                  export_format='GLB', export_apply=True)
    except Exception as exc:
        print("GLB_SKIP", exc)
    bpy.ops.render.render(write_still=True)
print("EIFFEL_V2_DONE objects=%d" % len(bpy.data.objects))
