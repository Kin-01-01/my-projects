"""Eiffel Tower v3 — 对照实景照片打磨：
- 四条格构式主腿（不再是实心锥体），底部开敞可透视
- 底部四座开敞大拱门（主拱 + 副拱）
- 三层平台带宽檐与托架
- 顶部塔楼 + 尖顶 + 天线
- 密集 X 形钢架，写实棕铁材质
- 草坡 + 蓝天 + 低角度仰拍机位，对齐参考照片构图
GUI: 注入执行（只建模+存盘）。后台: blender -b --python 本脚本（建模+glb+渲染）。
"""
import bpy
import math
import os
from mathutils import Vector

OUT = r'D:\workBuddy\2026-11-24-22-09-52\eiffel_tower'
TOP = 300.0
ANTENNA_TOP = 324.0

# 塔中心线半宽（真实比例：基座 125m 见方，总高 324m）
PROFILE = [
    (0, 62.5), (10, 63.0), (20, 62.0), (30, 59.5), (40, 55.0), (50, 49.5), (57, 45.0),
    (70, 38.5), (85, 33.0), (100, 29.0), (115, 26.0),
    (130, 22.5), (150, 18.5), (170, 15.0), (190, 12.0), (210, 9.6),
    (230, 7.7), (250, 6.4), (265, 5.8), (276, 5.3),
    (284, 4.2), (293, 3.2), (300, 2.4),
]
LEGS = [(-1, -1), (-1, 1), (1, 1), (1, -1)]
DECKS = [(57.0, 3.0, 9.0), (115.0, 2.6, 9.5), (276.0, 2.0, 3.2)]


def half(z):
    z = max(0.0, min(float(z), TOP))
    for (z0, w0), (z1, w1) in zip(PROFILE, PROFILE[1:]):
        if z <= z1:
            return w0 + (w1 - w0) * ((z - z0) / (z1 - z0))
    return PROFILE[-1][1]


def corner(sx, sy, z):
    return (sx * half(z), sy * half(z), z)


def leg_half(z):
    """单条腿格构柱的截面半宽：底部约 12m，顶部约 0.7m。"""
    return 11.6 * (1 - z / TOP) ** 0.78 + 0.62


def leg_rod(z):
    return 0.46 * (1 - z / TOP) ** 0.7 + 0.10


class MeshAcc:
    def __init__(self):
        self.vs = []
        self.fs = []

    def beam(self, p1, p2, r1, r2=None, sides=7):
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

    def sphere(self, center, radius, segs=10, rings=6):
        cx, cy, cz = center
        base = len(self.vs)
        for i in range(1, rings):
            th = math.pi * i / rings
            for j in range(segs):
                ph = 2 * math.pi * j / segs
                self.vs.append((cx + radius * math.sin(th) * math.cos(ph),
                                cy + radius * math.sin(th) * math.sin(ph),
                                cz + radius * math.cos(th)))
        top = len(self.vs)
        self.vs.append((cx, cy, cz + radius))
        bot = len(self.vs)
        self.vs.append((cx, cy, cz - radius))
        ring = lambda i, j: base + (i - 1) * segs + (j % segs)
        for i in range(1, rings - 2):
            for j in range(segs):
                self.fs.append((ring(i, j), ring(i, j + 1), ring(i + 1, j + 1), ring(i + 1, j)))
        for j in range(segs):
            self.fs.append((top, ring(1, j + 1), ring(1, j)))
            self.fs.append((bot, ring(rings - 2, j), ring(rings - 2, j + 1)))

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


# ============ 0. 清空 ============
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for mesh in list(bpy.data.meshes):
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)

iron = material("Eiffel Iron", (0.26, 0.17, 0.09), 0.25, 0.62)
deck_mat = material("Deck Iron", (0.22, 0.15, 0.09), 0.20, 0.65)
concrete = material("Concrete", (0.64, 0.63, 0.60), 0.0, 0.88)
grass = material("Grass", (0.17, 0.31, 0.10), 0.0, 1.0)
path_mat = material("Path", (0.62, 0.60, 0.53), 0.0, 0.95)
trunk_mat = material("Trunk", (0.24, 0.17, 0.10), 0.0, 0.9)
leaf_mat = material("Leaves", (0.16, 0.30, 0.09), 0.0, 0.95)

lattice = MeshAcc()
details = MeshAcc()
decks = MeshAcc()
footings = MeshAcc()
scenery = MeshAcc()
walkway = MeshAcc()
foliage = MeshAcc()

# ============ 1. 四条格构式主腿（开敞、可透视） ============
LEG_STEP = 5.5
for sx, sy in LEGS:
    z = 0.0
    while z < TOP - 1e-6:
        z2 = min(z + LEG_STEP, TOP)
        ca, cb = corner(sx, sy, z), corner(sx, sy, z2)
        wa, wb = leg_half(z), leg_half(z2)
        ra, rb = leg_rod(z), leg_rod(z2)
        A = [(ca[0] + dx * wa, ca[1] + dy * wa, z) for dx, dy in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
        B = [(cb[0] + dx * wb, cb[1] + dy * wb, z2) for dx, dy in ((1, 1), (1, -1), (-1, -1), (-1, 1))]
        for i in range(4):
            j = (i + 1) % 4
            lattice.beam(A[i], B[i], ra, rb, 6)              # 纵杆
            lattice.beam(B[i], B[j], ra * 0.55, ra * 0.55, 5)  # 横隔
            lattice.beam(A[i], B[j], ra * 0.40, ra * 0.40, 5)  # 斜撑
            lattice.beam(A[j], B[i], ra * 0.40, ra * 0.40, 5)
        z = z2

# ============ 2. 分层 X 形钢架（57m 以上；底部留给拱门） ============
levels = sorted(set([float(v) for v in range(0, 301, 7)] + [d[0] for d in DECKS] + [TOP]))
for z1, z2 in zip(levels, levels[1:]):
    if z2 <= 57.0:
        continue
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        p1, p2 = corner(*a, z1), corner(*b, z1)
        q1, q2 = corner(*a, z2), corner(*b, z2)
        rr = 0.24 * (1 - z1 / TOP) ** 0.5 + 0.10
        lattice.beam(p1, q2, rr, rr, 5)
        lattice.beam(p2, q1, rr, rr, 5)
        lattice.beam(q1, q2, rr * 1.35, rr * 1.35, 5)

# 内部对角（双向，保证对称）
for i, (z1, z2) in enumerate(zip(levels, levels[1:])):
    if z2 <= 57.0 or i % 2:
        continue
    lattice.beam(corner(*LEGS[0], z1), corner(*LEGS[2], z2), 0.22, 0.22, 5)
    lattice.beam(corner(*LEGS[1], z1), corner(*LEGS[3], z2), 0.22, 0.22, 5)

# ============ 3. 底部四座开敞大拱门（单道拱肋 + 拱肩花格） ============
INNER = half(0) - leg_half(0)   # 腿内侧 ~50.3m
for k in range(4):
    a, b = LEGS[k], LEGS[(k + 1) % 4]
    n = 32
    outer = []
    for i in range(n + 1):
        t = i / n
        ux = (a[0] * (1 - t) + b[0] * t) * INNER
        uy = (a[1] * (1 - t) + b[1] * t) * INNER
        outer.append((ux, uy, 50.0 * 4 * t * (1 - t)))   # 拱顶 50m
    # 拱肋：单道主肋（真实铁塔的拱是细拱肋，不是管道）
    for p1, p2 in zip(outer, outer[1:]):
        lattice.beam(p1, p2, 0.95, 0.95, 9)
    # 径向短吊杆：把拱肋锚到腿的内缘，形成拱腹
    for i in range(2, n - 1, 5):
        t = i / n
        zz = 50.0 * 4 * t * (1 - t)
        px = (a[0] * (1 - t) + b[0] * t) * INNER
        py = (a[1] * (1 - t) + b[1] * t) * INNER
        # 腿在这个高度的内缘点
        lgx = (a[0] * (1 - t) + b[0] * t) * (half(zz) - leg_half(zz) * 0.5)
        lgy = (a[1] * (1 - t) + b[1] * t) * (half(zz) - leg_half(zz) * 0.5)
        details.beam((px, py, zz), (lgx, lgy, zz + 3.0), 0.20, 0.20, 5)
    # 拱肩花格：拱线到第一平台之间的竖向填充
    for i in range(1, n, 3):
        t = i / n
        zz = 50.0 * 4 * t * (1 - t)
        gap = 57.0 - zz
        if gap > 4.0:
            px = (a[0] * (1 - t) + b[0] * t) * INNER
            py = (a[1] * (1 - t) + b[1] * t) * INNER
            details.beam((px, py, zz), (px, py, 57.0), 0.18, 0.18, 5)
    # 拱脚竖向墩
    for t in (0.0, 1.0):
        px = (a[0] * (1 - t) + b[0] * t) * INNER
        py = (a[1] * (1 - t) + b[1] * t) * INNER
        details.beam((px, py, 0), (px, py, 18), 0.55, 0.55, 7)

# ============ 4. 三层平台：宽檐 + 托架 + 护栏 ============
for z, thick, overhang in DECKS:
    h = half(z) + overhang
    decks.box((0, 0, z), (2 * h, 2 * h, thick))
    deck_top = z + thick / 2
    rail_z = deck_top + 1.8
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        # 檐口边梁（上下两道，做出厚度感）
        lattice.beam((a[0] * h, a[1] * h, deck_top), (b[0] * h, b[1] * h, deck_top), 0.55, 0.55, 7)
        details.beam((a[0] * h, a[1] * h, z - thick / 2), (b[0] * h, b[1] * h, z - thick / 2), 0.34, 0.34, 6)
        # 护栏
        for i in range(13):
            t = i / 12
            px = (a[0] * (1 - t) + b[0] * t) * h
            py = (a[1] * (1 - t) + b[1] * t) * h
            details.beam((px, py, deck_top), (px, py, rail_z), 0.15, 0.15, 5)
        details.beam((a[0] * h, a[1] * h, rail_z), (b[0] * h, b[1] * h, rail_z), 0.20, 0.20, 6)
    # 平台下托架：从檐口斜撑回主腿
    for sx, sy in LEGS:
        lattice.beam((sx * h, sy * h, z - thick / 2), corner(sx, sy, z - 13), 0.55, 0.55, 7)
        lattice.beam((sx * h, sy * h, z - thick / 2), corner(sx, sy, z - 4), 0.40, 0.40, 6)

# 第一层平台下方裙边（照片里明显的宽裙收拢）
h1 = half(57) + 8.0
for k in range(4):
    a, b = LEGS[k], LEGS[(k + 1) % 4]
    for i in range(7):
        t = i / 6
        px = (a[0] * (1 - t) + b[0] * t) * h1
        py = (a[1] * (1 - t) + b[1] * t) * h1
        details.beam((px, py, 54.0), (px, py, 45.5), 0.30, 0.30, 5)

# ============ 5. 顶部：塔楼 + 尖顶 + 天线 ============
# 276 平台之上方形塔楼（照片里带窗的观景建筑）
TOWER_W = 5.6
for z in (277.0, 283.0, 289.0):
    w = TOWER_W
    for k in range(4):
        a, b = LEGS[k], LEGS[(k + 1) % 4]
        details.beam((a[0] * w, a[1] * w, z), (b[0] * w, b[1] * w, z), 0.30, 0.30, 6)
    for sx, sy in LEGS:
        details.beam((sx * w, sy * w, z), (sx * w, sy * w, z + 6), 0.34, 0.34, 6)
# 塔楼四面外墙（深色板，模拟实体建筑 + 窗）
for sx in (-1, 1):
    decks.box((sx * TOWER_W, 0, 283.5), (0.5, 2 * TOWER_W, 11))
for sy in (-1, 1):
    decks.box((0, sy * TOWER_W, 283.5), (2 * TOWER_W, 0.5, 11))
# 塔楼顶檐
decks.box((0, 0, 290.2), (2 * TOWER_W + 2.4, 2 * TOWER_W + 2.4, 1.4))
decks.box((0, 0, 291.6), (2 * TOWER_W + 0.8, 2 * TOWER_W + 0.8, 1.2))

# 尖顶：逐级收窄
lattice.beam((0, 0, 291.0), (0, 0, 301.0), 1.45, 0.85, 12)
lattice.beam((0, 0, 301.0), (0, 0, 310.0), 0.72, 0.34, 10)
details.beam((0, 0, 303.0), (0, 0, 303.0), 0.01, 0.01, 4)
# 顶部小平台与横担
decks.box((0, 0, 301.6), (4.2, 4.2, 0.9))
for zc in (305.5, 308.5):
    details.beam((-1.6, 0, zc), (1.6, 0, zc), 0.13, 0.13, 5)
    details.beam((0, -1.6, zc), (0, 1.6, zc), 0.13, 0.13, 5)
# 天线
lattice.beam((0, 0, 310.0), (0, 0, 318.0), 0.26, 0.12, 8)
lattice.beam((0, 0, 318.0), (0, 0, ANTENNA_TOP), 0.11, 0.045, 6)

# ============ 6. 四座混凝土基座（台阶式，与腿对齐） ============
for sx, sy in LEGS:
    bx, by = sx * 62.5, sy * 62.5
    footings.box((bx, by, 1.6), (26, 26, 3.2))
    footings.box((bx, by, 4.8), (21, 21, 3.2))
    footings.box((bx, by, 7.6), (15, 15, 2.4))

# ============ 7. 场景：草地 + 园路 + 行道树 ============
scenery.box((0, 0, -1.2), (2400, 2400, 2.0))                       # 草地
walkway.box((0, -520, 0.06), (34, 900, 0.3))                       # 中轴步道
for sx in (-1, 1):
    for i in range(16):
        ty = -110 - i * 46
        fx = sx * (72 + (i % 3) * 11)
        hgt = 6.5 + (i % 4) * 0.9
        foliage.beam((fx, ty, 0), (fx, ty, hgt), 0.75, 0.5, 6)
        for dz, rr in ((hgt + 0.8, 4.0), (hgt + 3.2, 3.2), (hgt + 5.2, 2.2)):
            foliage.sphere((fx, ty, dz), rr, 9, 6)

scenery.object("Ground", grass)
walkway.object("Walkway", path_mat)
foliage.object("Trees", leaf_mat)
lattice.object("Eiffel Tower - Latticed Legs", iron)
details.object("Eiffel Tower - Truss Details", iron)
decks.object("Eiffel Tower - Platforms", deck_mat)
footings.object("Eiffel Tower - Masonry Bases", concrete)

# ============ 8. 天空、日光、低角度仰拍相机 ============
world = bpy.context.scene.world or bpy.data.worlds.new("World")
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
bg.inputs["Color"].default_value = (0.28, 0.52, 0.85, 1)
bg.inputs["Strength"].default_value = 0.55

sun_data = bpy.data.lights.new("Sun", 'SUN')
sun_data.energy = 2.6
sun_data.angle = math.radians(2.2)
sun = bpy.data.objects.new("Sun", sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(54), 0, math.radians(-38))


def area(name, loc, energy, size, target=(0, 0, 150)):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


area("Fill", (-260, 240, 200), 32000, 320, (0, 0, 120))

cam_data = bpy.data.cameras.new("Camera")
cam = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (0, -540, 14)
cam.rotation_euler = (Vector((0, 0, 168)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 55
cam_data.sensor_width = 36
bpy.context.scene.camera = cam

scene = bpy.context.scene
scene.render.resolution_x = 1120
scene.render.resolution_y = 1500
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = os.path.join(OUT, "preview.png")
try:
    scene.render.engine = 'BLENDER_EEVEE'
except TypeError:
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = -0.25

# ============ 9. GUI 视口对准 ============
if not bpy.app.background:
    for screen in bpy.data.screens:
        for a in screen.areas:
            if a.type == 'VIEW_3D':
                a.spaces.active.shading.type = 'MATERIAL'
                r3d = a.spaces.active.region_3d
                r3d.view_location = (0, 0, 165)
                r3d.view_distance = 460
                a.tag_redraw()

# ============ 10. 保存 / 后台导出与渲染 ============
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "eiffel_tower.blend"))
if bpy.app.background:
    try:
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "eiffel_tower.glb"),
                                  export_format='GLB', export_apply=True)
    except Exception as exc:
        print("GLB_SKIP", exc)
    bpy.ops.render.render(write_still=True)
print("EIFFEL_V3_DONE objects=%d" % len(bpy.data.objects))
