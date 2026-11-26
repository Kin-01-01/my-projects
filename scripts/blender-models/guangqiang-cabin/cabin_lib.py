"""Quad-topology modelling helpers for the Guangqiang cabin scene."""

import bmesh
import bpy
import math
import random
from mathutils import Vector

MATS = {}
COLLS = {}
RNG = random.Random(20261125)


# ---------------------------------------------------------------- colour / material
def _s2l(u):
    return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4


def lin(hex_color):
    h = hex_color.lstrip("#")
    rgb = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(_s2l(v) for v in rgb) + (1.0,)


def make_toon(name, hex_color, rough=0.8, metallic=0.0, scale=7.0,
              detail=3.0, bump=0.08, variation=0.10):
    if name in MATS:
        return MATS[name]
    base = lin(hex_color)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (900, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (250, 120)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Specular IOR Level"].default_value = 0.25

    tex = nt.nodes.new("ShaderNodeTexCoord")
    tex.location = (-900, 100)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-700, 150)
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(tex.outputs["UV"], noise.inputs["Vector"])

    noise_ramp = nt.nodes.new("ShaderNodeValToRGB")
    noise_ramp.location = (-480, 150)
    noise_ramp.color_ramp.elements[0].position = 0.28
    noise_ramp.color_ramp.elements[0].color = tuple(c * (1.0 - variation) for c in base[:3]) + (1.0,)
    noise_ramp.color_ramp.elements[1].position = 0.72
    noise_ramp.color_ramp.elements[1].color = tuple(min(1.0, c * (1.0 + variation)) for c in base[:3]) + (1.0,)
    nt.links.new(noise.outputs["Fac"], noise_ramp.inputs["Fac"])
    nt.links.new(noise_ramp.outputs["Color"], bsdf.inputs["Base Color"])

    bump_node = nt.nodes.new("ShaderNodeBump")
    bump_node.location = (250, -120)
    bump_node.inputs["Strength"].default_value = bump
    bump_node.inputs["Distance"].default_value = 0.035
    nt.links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    nt.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

    s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    s2rgb.location = (480, 220)
    nt.links.new(bsdf.outputs["BSDF"], s2rgb.inputs["Shader"])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (680, 260)
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.08
    ramp.color_ramp.elements[0].color = (0.40, 0.46, 0.62, 1.0)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (1.12, 1.06, 0.98, 1.0)
    mid = ramp.color_ramp.elements.new(0.52)
    mid.color = (0.82, 0.84, 0.88, 1.0)
    nt.links.new(s2rgb.outputs["Color"], ramp.inputs["Fac"])

    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.location = (700, 80)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(noise_ramp.outputs["Color"], mix.inputs["Color2"])

    em = nt.nodes.new("ShaderNodeEmission")
    em.location = (760, -60)
    em.inputs["Strength"].default_value = 1.0
    nt.links.new(mix.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    MATS[name] = mat
    return mat


def make_wood(name, hex_color, rough=0.82, scale=4.0):
    if name in MATS:
        return MATS[name]
    base = lin(hex_color)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (1050, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (450, 100)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.20

    tex = nt.nodes.new("ShaderNodeTexCoord")
    tex.location = (-900, 100)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.location = (-700, 220)
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.wave_profile = "SIN"
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 7.0
    wave.inputs["Detail"].default_value = 3.0
    wave.inputs["Detail Scale"].default_value = 1.5
    nt.links.new(tex.outputs["UV"], wave.inputs["Vector"])

    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-700, -80)
    noise.inputs["Scale"].default_value = scale * 6.0
    noise.inputs["Detail"].default_value = 4.0
    nt.links.new(tex.outputs["UV"], noise.inputs["Vector"])

    wave_ramp = nt.nodes.new("ShaderNodeValToRGB")
    wave_ramp.location = (-460, 220)
    wave_ramp.color_ramp.elements[0].position = 0.18
    wave_ramp.color_ramp.elements[0].color = tuple(c * 0.72 for c in base[:3]) + (1.0,)
    wave_ramp.color_ramp.elements[1].position = 0.78
    wave_ramp.color_ramp.elements[1].color = tuple(min(1.0, c * 1.12) for c in base[:3]) + (1.0,)
    nt.links.new(wave.outputs["Fac"], wave_ramp.inputs["Fac"])

    grain_mix = nt.nodes.new("ShaderNodeMixRGB")
    grain_mix.location = (-220, 160)
    grain_mix.blend_type = "MULTIPLY"
    grain_mix.inputs["Fac"].default_value = 0.32
    nt.links.new(wave_ramp.outputs["Color"], grain_mix.inputs["Color1"])
    nt.links.new(noise.outputs["Color"], grain_mix.inputs["Color2"])

    bump_node = nt.nodes.new("ShaderNodeBump")
    bump_node.location = (200, -100)
    bump_node.inputs["Strength"].default_value = 0.14
    bump_node.inputs["Distance"].default_value = 0.03
    nt.links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    nt.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

    s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    s2rgb.location = (650, 180)
    nt.links.new(bsdf.outputs["BSDF"], s2rgb.inputs["Shader"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (820, 200)
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.08
    ramp.color_ramp.elements[0].color = (0.40, 0.45, 0.60, 1.0)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (1.12, 1.05, 0.95, 1.0)
    middle = ramp.color_ramp.elements.new(0.52)
    middle.color = (0.83, 0.84, 0.86, 1.0)
    nt.links.new(s2rgb.outputs["Color"], ramp.inputs["Fac"])

    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.location = (820, 20)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(grain_mix.outputs["Color"], mix.inputs["Color2"])

    em = nt.nodes.new("ShaderNodeEmission")
    em.location = (860, -120)
    nt.links.new(mix.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    MATS[name] = mat
    return mat


def make_planks(name, color_a, color_b, mortar, scale=5.0, mortar_size=0.006,
                rough=0.85, brick_width=0.55, row_height=0.22):
    if name in MATS:
        return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (950, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (300, 100)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = 0.2
    tex = nt.nodes.new("ShaderNodeTexCoord")
    tex.location = (-900, 100)
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.location = (-650, 150)
    brick.offset = 0.5
    brick.inputs["Scale"].default_value = scale
    brick.inputs["Mortar Size"].default_value = mortar_size
    brick.inputs["Brick Width"].default_value = brick_width
    brick.inputs["Row Height"].default_value = row_height
    brick.inputs["Color1"].default_value = lin(color_a)
    brick.inputs["Color2"].default_value = lin(color_b)
    brick.inputs["Mortar"].default_value = lin(mortar)
    nt.links.new(tex.outputs["UV"], brick.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-650, -120)
    noise.inputs["Scale"].default_value = scale * 8
    noise.inputs["Detail"].default_value = 4
    nt.links.new(tex.outputs["UV"], noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.location = (-250, 120)
    mix.blend_type = "MULTIPLY"
    mix.inputs["Fac"].default_value = 0.20
    nt.links.new(brick.outputs["Color"], mix.inputs["Color1"])
    nt.links.new(noise.outputs["Color"], mix.inputs["Color2"])
    nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.location = (100, -120)
    bump.inputs["Strength"].default_value = 0.10
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    s2rgb.location = (550, 180)
    nt.links.new(bsdf.outputs["BSDF"], s2rgb.inputs["Shader"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (720, 180)
    ramp.color_ramp.interpolation = "EASE"
    ramp.color_ramp.elements[0].position = 0.08
    ramp.color_ramp.elements[0].color = (0.42, 0.47, 0.62, 1.0)
    ramp.color_ramp.elements[1].position = 0.92
    ramp.color_ramp.elements[1].color = (1.10, 1.04, 0.96, 1.0)
    ramp.color_ramp.elements.new(0.52).color = (0.84, 0.84, 0.86, 1.0)
    nt.links.new(s2rgb.outputs["Color"], ramp.inputs["Fac"])
    final = nt.nodes.new("ShaderNodeMixRGB")
    final.location = (720, 20)
    final.blend_type = "MULTIPLY"
    final.inputs["Fac"].default_value = 1.0
    nt.links.new(ramp.outputs["Color"], final.inputs["Color1"])
    nt.links.new(mix.outputs["Color"], final.inputs["Color2"])
    em = nt.nodes.new("ShaderNodeEmission")
    em.location = (760, -120)
    nt.links.new(final.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    MATS[name] = mat
    return mat


def make_glass(name, hex_color="#A9D5E2", alpha=0.45):
    if name in MATS:
        return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = lin(hex_color)
    bsdf.inputs["Roughness"].default_value = 0.18
    bsdf.inputs["Metallic"].default_value = 0.10
    bsdf.inputs["Alpha"].default_value = alpha
    bsdf.inputs["Emission Color"].default_value = lin(hex_color)
    bsdf.inputs["Emission Strength"].default_value = 0.25
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    mat.use_backface_culling = False
    MATS[name] = mat
    return mat


def make_emit(name, hex_color="#FFD18A", strength=4.0):
    if name in MATS:
        return MATS[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = lin(hex_color)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    MATS[name] = mat
    return mat


def get_mat(name):
    if isinstance(name, bpy.types.Material):
        return name
    if not isinstance(name, str):
        return None
    return MATS.get(name) or bpy.data.materials.get(name)


# ---------------------------------------------------------------- scene / collections
def make_collection(name, parent=None):
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    COLLS[name] = col
    return col


def col(name):
    return COLLS[name]


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)
    COLLS.clear()
    MATS.clear()


# ---------------------------------------------------------------- mesh helpers
def _link_object(obj, collection):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    collection.objects.link(obj)


def new_obj(name, verts, faces, materials, collection, location=(0, 0, 0),
            rotation=(0, 0, 0), smooth=False, face_material_indices=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate(verbose=False)
    me.update()
    obj = bpy.data.objects.new(name, me)
    obj.location = location
    obj.rotation_euler = rotation
    collection.objects.link(obj)

    if isinstance(materials, str):
        materials = [materials]
    for mat_name in materials:
        mat = get_mat(mat_name)
        if mat is not None:
            me.materials.append(mat)

    if face_material_indices is not None:
        for poly, idx in zip(me.polygons, face_material_indices):
            poly.material_index = min(idx, max(0, len(me.materials) - 1))

    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True

    # Remove duplicate vertices inside caps where grids meet, and recompute normals.
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    me.update()
    return obj


def box(name, size, location, material, collection, rotation=(0, 0, 0), smooth=False):
    sx, sy, sz = (v * 0.5 for v in size)
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
         (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
         (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)]
    return new_obj(name, v, f, material, collection, location, rotation, smooth)


def _grid_disc(segments, radius):
    if segments % 4:
        raise ValueError("segments must be divisible by 4")
    k = segments // 4 + 1
    coords = []
    idx = {}
    for j in range(k):
        for i in range(k):
            u = -1.0 + 2.0 * i / (k - 1)
            v = -1.0 + 2.0 * j / (k - 1)
            s = max(abs(u), abs(v))
            if s < 1e-9:
                x = y = 0.0
            else:
                ang = math.atan2(v, u)
                x = math.cos(ang) * radius * s
                y = math.sin(ang) * radius * s
            idx[(i, j)] = len(coords)
            coords.append((x, y))
    faces = []
    for j in range(k - 1):
        for i in range(k - 1):
            faces.append((idx[(i, j)], idx[(i + 1, j)],
                          idx[(i + 1, j + 1)], idx[(i, j + 1)]))
    boundary = []
    for i in range(k):
        boundary.append(idx[(i, k - 1)])
    for j in range(k - 2, -1, -1):
        boundary.append(idx[(k - 1, j)])
    for i in range(k - 2, -1, -1):
        boundary.append(idx[(i, 0)])
    for j in range(1, k - 1):
        boundary.append(idx[(0, j)])
    return coords, faces, boundary


def quad_tube(name, r_bottom, r_top, height, location, material, collection,
              cap_material=None, segments=8, rotation=(0, 0, 0), smooth_sides=True,
              cap_bottom=True, cap_top=True):
    bc, bf, boundary = _grid_disc(segments, r_bottom)
    tc, tf, _ = _grid_disc(segments, r_top)
    n = len(bc)
    verts = [(x, y, -height / 2) for x, y in bc]
    verts += [(x, y, height / 2) for x, y in tc]
    faces = []
    mats = []

    if cap_bottom:
        for f in bf:
            faces.append(tuple(f))
            mats.append(1 if cap_material else 0)
    if cap_top:
        for f in tf:
            faces.append(tuple(n + i for i in f))
            mats.append(1 if cap_material else 0)
    for i in range(len(boundary)):
        j = (i + 1) % len(boundary)
        faces.append((boundary[i], boundary[j], n + boundary[j], n + boundary[i]))
        mats.append(0)

    materials = [material] + ([cap_material] if cap_material else [])
    obj = new_obj(name, verts, faces, materials, collection, location, rotation,
                  smooth=False, face_material_indices=mats)
    if smooth_sides:
        me = obj.data
        cap_count = (len(bf) if cap_bottom else 0) + (len(tf) if cap_top else 0)
        for poly in me.polygons[cap_count:]:
            poly.use_smooth = True
    return obj


def quad_sphere(name, radius, location, material, collection, scale=(1, 1, 1), subdiv=2,
                rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=subdiv, use_grid_fill=True)
    for v in bm.verts:
        n = v.co.normalized()
        v.co = Vector((n.x * radius * scale[0], n.y * radius * scale[1], n.z * radius * scale[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    obj = bpy.data.objects.new(name, me)
    obj.location = location
    obj.rotation_euler = rotation
    collection.objects.link(obj)
    mat = get_mat(material)
    if mat:
        me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    return obj


def torus(name, major_radius, minor_radius, location, material, collection,
          rotation=(0, 0, 0), major_segments=24, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=major_segments,
                                     minor_segments=minor_segments,
                                     major_radius=major_radius,
                                     minor_radius=minor_radius,
                                     location=location,
                                     rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    _link_object(obj, collection)
    mat = get_mat(material)
    if mat:
        obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def rod(name, p1, p2, radius, material, collection, segments=8, cap_material=None):
    a = Vector(p1)
    b = Vector(p2)
    d = b - a
    length = d.length
    if length < 1e-6:
        return None
    obj = quad_tube(name, radius, radius, length, (0, 0, 0), material, collection,
                    cap_material=cap_material, segments=segments)
    obj.location = (a + b) * 0.5
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return obj


def ribbon(name, points, widths, z, material, collection):
    verts_l = []
    verts_r = []
    n = len(points)
    for i, (x, y) in enumerate(points):
        if i == 0:
            dx = points[1][0] - x
            dy = points[1][1] - y
        elif i == n - 1:
            dx = x - points[i - 1][0]
            dy = y - points[i - 1][1]
        else:
            dx = points[i + 1][0] - points[i - 1][0]
            dy = points[i + 1][1] - points[i - 1][1]
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / ln, dx / ln
        w = widths[i] * 0.5
        verts_l.append((x + nx * w, y + ny * w, z))
        verts_r.append((x - nx * w, y - ny * w, z))
    verts = verts_l + verts_r
    faces = []
    for i in range(n - 1):
        faces.append((i, i + 1, n + i + 1, n + i))
    return new_obj(name, verts, faces, material, collection)


def grid_plane(name, x0, x1, y0, y1, nx, ny, z, material, collection,
               height_fn=None):
    verts = []
    for j in range(ny + 1):
        y = y0 + (y1 - y0) * j / ny
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            zz = z + (height_fn(x, y) if height_fn else 0.0)
            verts.append((x, y, zz))
    faces = []
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    return new_obj(name, verts, faces, material, collection, smooth=False)


def bowl(name, radius, height, location, material, collection, segments=16,
         bottom=0.28):
    """Open quad bowl: concentric quad rings + bottom cap grid."""
    rings = 5
    verts = []
    for r in range(rings):
        t = r / (rings - 1)
        rr = radius * (1.0 - t * t * (1.0 - bottom))
        z = height * t
        for i in range(segments):
            a = 2 * math.pi * i / segments
            verts.append((math.cos(a) * rr, math.sin(a) * rr, z))
    # bottom cap
    bc, bf, boundary = _grid_disc(segments, radius * bottom)
    offset = len(verts)
    verts += [(x, y, -0.03) for x, y in bc]
    faces = []
    for f in bf:
        faces.append(tuple(offset + i for i in f))
    for r in range(rings - 1):
        for i in range(segments):
            j = (i + 1) % segments
            faces.append((r * segments + i, r * segments + j,
                          (r + 1) * segments + j, (r + 1) * segments + i))
    return new_obj(name, verts, faces, material, collection, location, smooth=True)


def join_objects(objects, name, collection):
    objects = [o for o in objects if o]
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    _link_object(obj, collection)
    return obj


def empty(name, location, collection):
    e = bpy.data.objects.new(name, None)
    e.location = location
    collection.objects.link(e)
    return e


def make_uv_all():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.018)
        bpy.ops.object.mode_set(mode="OBJECT")
    return len(meshes)


def validate_quads():
    non_quad = {}
    degenerate = {}
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        bad = [p.index for p in obj.data.polygons if p.loop_total != 4]
        deg = [p.index for p in obj.data.polygons if p.area < 1e-9]
        if bad:
            non_quad[obj.name] = len(bad)
        if deg:
            degenerate[obj.name] = len(deg)
    return non_quad, degenerate
