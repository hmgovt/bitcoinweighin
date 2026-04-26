"""Gold coin v5 — Krugerrand style with traced springbok profile, text, beaded border."""
import bpy
import math
import os
import bmesh
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_v5.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)
for block in bpy.data.curves:
    if block.users == 0:
        bpy.data.curves.remove(block)
for block in bpy.data.fonts:
    if block.users == 0:
        bpy.data.fonts.remove(block)

coin_radius = 0.3
coin_depth = 0.051
face_z = coin_depth  # top of coin


# === COIN BASE WITH RIM ===
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=coin_radius, depth=coin_depth, location=(0, 0, coin_depth / 2))
coin = bpy.context.active_object
coin.name = "CoinBase"

bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(coin.data)
bm.faces.ensure_lookup_table()
top_faces = [f for f in bm.faces if all(abs(v.co.z - coin_depth/2) < 0.001 for v in f.verts)]
for f in bm.faces:
    f.select = False
for f in top_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)
bpy.ops.mesh.inset(thickness=0.010, depth=-0.005)  # raised rim
bpy.ops.mesh.inset(thickness=0.003, depth=0.0)
bpy.ops.mesh.inset(thickness=0.005, depth=0.003)  # step into field

for f in bm.faces:
    f.select = False
bm.faces.ensure_lookup_table()
bot_faces = [f for f in bm.faces if all(abs(v.co.z + coin_depth/2) < 0.001 for v in f.verts)]
for f in bot_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)
bpy.ops.mesh.inset(thickness=0.010, depth=-0.005)
bpy.ops.mesh.inset(thickness=0.003, depth=0.0)
bpy.ops.mesh.inset(thickness=0.005, depth=0.003)

bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()


# === SPRINGBOK PROFILE — traced as curve then extruded ===
# Standing/trotting left-facing profile. Coordinates in coin-face space,
# scaled so the animal spans ~55% of coin diameter.
# Origin at centre of coin face. Y is up on coin face.

springbok_points = [
    # Back hooves → rump → back → neck → head → horns → return via belly → front legs
    # Back right hoof
    (-0.04, -0.09),
    (-0.035, -0.06),  # back right leg lower
    (-0.03, -0.04),   # knee
    (-0.04, -0.02),   # upper leg
    (-0.06, 0.0),     # rump
    # Back line
    (-0.055, 0.02),
    (-0.04, 0.035),   # back peak
    (-0.02, 0.04),
    (0.0, 0.04),      # mid back
    (0.02, 0.04),
    # Neck
    (0.04, 0.045),
    (0.05, 0.06),     # neck base
    (0.055, 0.08),    # neck mid
    (0.058, 0.095),   # neck top
    # Head
    (0.06, 0.10),     # back of head
    (0.065, 0.105),   # top of head
    (0.075, 0.10),    # forehead
    (0.085, 0.09),    # snout
    (0.08, 0.085),    # chin
    (0.065, 0.09),    # throat
    # Back down neck
    (0.055, 0.07),
    (0.045, 0.05),
    (0.04, 0.035),
    # Chest
    (0.04, 0.02),
    (0.045, 0.0),     # chest
    # Front legs
    (0.04, -0.02),    # front upper leg
    (0.035, -0.04),   # front knee
    (0.04, -0.06),    # front lower leg
    (0.035, -0.09),   # front hoof
    # Ground line back to start
    (0.02, -0.09),
    (0.0, -0.085),    # belly ground
    (-0.02, -0.085),
    (-0.04, -0.09),   # close back to start
]

# Create the curve
curve_data = bpy.data.curves.new(name="SpringbokCurve", type='CURVE')
curve_data.dimensions = '2D'
curve_data.fill_mode = 'BOTH'
curve_data.extrude = 0.004  # relief height

spline = curve_data.splines.new('POLY')
spline.points.add(len(springbok_points) - 1)
for i, (x, y) in enumerate(springbok_points):
    spline.points[i].co = (x, y, 0, 1)
spline.use_cyclic_u = True

springbok_obj = bpy.data.objects.new("Springbok", curve_data)
bpy.context.collection.objects.link(springbok_obj)

# Position on top face of coin
springbok_obj.location = (0, 0, face_z - 0.001)
springbok_obj.rotation_euler = (math.radians(90), 0, 0)  # lay flat on coin face

# Convert to mesh for joining later
bpy.context.view_layer.objects.active = springbok_obj
bpy.ops.object.select_all(action='DESELECT')
springbok_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
bpy.ops.object.shade_smooth()

# Horns — two small arcs above the head
for side, y_sign in [("L", 1), ("R", -1)]:
    horn_pts = [
        (0.065, 0.105),
        (0.062, 0.115),
        (0.055, 0.125),
        (0.045, 0.13),
    ]
    hc = bpy.data.curves.new(name=f"Horn_{side}", type='CURVE')
    hc.dimensions = '2D'
    hc.bevel_depth = 0.002
    hc.bevel_resolution = 4
    hs = hc.splines.new('POLY')
    hs.points.add(len(horn_pts) - 1)
    for i, (x, y) in enumerate(horn_pts):
        hs.points[i].co = (x, y + y_sign * 0.003, 0, 1)
    horn_obj = bpy.data.objects.new(f"Horn_{side}", hc)
    bpy.context.collection.objects.link(horn_obj)
    horn_obj.location = (0, 0, face_z + 0.002)
    horn_obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.objects.active = horn_obj
    horn_obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.shade_smooth()

# Tail — small curve behind rump
tail_pts = [(-0.06, 0.0), (-0.07, -0.01), (-0.075, -0.025), (-0.07, -0.04)]
tc_data = bpy.data.curves.new(name="Tail", type='CURVE')
tc_data.dimensions = '2D'
tc_data.bevel_depth = 0.0015
tc_data.bevel_resolution = 3
ts = tc_data.splines.new('POLY')
ts.points.add(len(tail_pts) - 1)
for i, (x, y) in enumerate(tail_pts):
    ts.points[i].co = (x, y, 0, 1)
tail_obj = bpy.data.objects.new("Tail", tc_data)
bpy.context.collection.objects.link(tail_obj)
tail_obj.location = (0, 0, face_z + 0.001)
tail_obj.rotation_euler = (math.radians(90), 0, 0)
bpy.context.view_layer.objects.active = tail_obj
tail_obj.select_set(True)
bpy.ops.object.convert(target='MESH')
bpy.ops.object.shade_smooth()


# === TEXT — "KRUGERRAND" arched on top, "FYNGOUD 1 OZ FINE GOLD" on bottom ===
def add_curved_text(text, name, radius, start_angle, char_spacing, z_pos, size=0.018, flip=False):
    """Place individual characters along an arc."""
    chars = []
    for i, ch in enumerate(text):
        if ch == ' ':
            continue
        angle = start_angle + i * char_spacing * (-1 if not flip else 1)
        x = radius * math.cos(angle)
        y = radius * math.sin(angle)

        bpy.ops.object.text_add(location=(x, y, z_pos))
        txt = bpy.context.active_object
        txt.data.body = ch
        txt.data.size = size
        txt.data.extrude = 0.003
        txt.data.align_x = 'CENTER'
        txt.data.align_y = 'CENTER'

        # Rotate to face outward along the arc, lying flat on coin
        txt.rotation_euler = (math.radians(90), 0, angle + math.radians(90))
        if flip:
            txt.rotation_euler = (math.radians(90), math.radians(180), angle - math.radians(90))

        txt.name = f"{name}_{i}"
        chars.append(txt)
    return chars

top_text = add_curved_text("KRUGERRAND", "TopText",
    radius=coin_radius * 0.75,
    start_angle=math.radians(130),
    char_spacing=math.radians(8),
    z_pos=face_z + 0.001,
    size=0.022)

bottom_text = add_curved_text("FYNGOUD 1 OZ FINE GOLD", "BotText",
    radius=coin_radius * 0.72,
    start_angle=math.radians(-50),
    char_spacing=math.radians(5),
    z_pos=face_z + 0.001,
    size=0.012,
    flip=True)

# Date: "20" left, "26" right
for txt_str, x_pos in [("20", -0.10), ("26", 0.10)]:
    bpy.ops.object.text_add(location=(x_pos, 0.04, face_z + 0.001))
    txt = bpy.context.active_object
    txt.data.body = txt_str
    txt.data.size = 0.020
    txt.data.extrude = 0.003
    txt.data.align_x = 'CENTER'
    txt.rotation_euler = (math.radians(90), 0, 0)
    txt.name = f"Date_{txt_str}"

# Convert all text to mesh
for obj in bpy.data.objects:
    if obj.type == 'FONT':
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.ops.object.convert(target='MESH')
        bpy.ops.object.shade_smooth()


# === BEADED INNER BORDER ===
num_beads = 100
bead_r = coin_radius * 0.90
for i in range(num_beads):
    angle = (2 * math.pi * i) / num_beads
    bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=0.002,
        location=(bead_r * math.cos(angle), bead_r * math.sin(angle), face_z + 0.001))
    bead = bpy.context.active_object
    bead.name = f"Bead_{i:03d}"
    bead.scale.z = 0.5
    bpy.ops.object.transform_apply(scale=True)


# === REEDED EDGE ===
num_reeds = 150
for i in range(num_reeds):
    angle = (2 * math.pi * i) / num_reeds
    bpy.ops.mesh.primitive_cube_add(size=1,
        location=((coin_radius + 0.0005) * math.cos(angle),
                  (coin_radius + 0.0005) * math.sin(angle),
                  coin_depth / 2))
    r = bpy.context.active_object
    r.name = f"Reed_{i:03d}"
    r.scale = (0.0015, 0.005, coin_depth * 0.55)
    r.rotation_euler.z = angle
    bpy.ops.object.transform_apply(scale=True)


# === JOIN ALL ===
bpy.ops.object.select_all(action='SELECT')
for obj in bpy.data.objects:
    if obj.type in ('CAMERA', 'LIGHT'):
        obj.select_set(False)
bpy.context.view_layer.objects.active = coin
bpy.ops.object.join()
coin = bpy.context.active_object
coin.name = "GoldCoin"
bpy.ops.object.shade_smooth()


# === GOLD MATERIAL ===
mat = bpy.data.materials.new(name="Gold_24k_Coin")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.25
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

# Fine surface grain
fine = nodes.new("ShaderNodeTexNoise")
fine.inputs["Scale"].default_value = 100.0
fine.inputs["Detail"].default_value = 12.0
fine.inputs["Roughness"].default_value = 0.7
links.new(tex_coord.outputs["Object"], fine.inputs["Vector"])
bump_node = nodes.new("ShaderNodeBump")
bump_node.inputs["Strength"].default_value = 0.03
bump_node.inputs["Distance"].default_value = 0.0002
links.new(fine.outputs["Fac"], bump_node.inputs["Height"])
links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

# Roughness variation — field vs relief
rn = nodes.new("ShaderNodeTexNoise")
rn.inputs["Scale"].default_value = 4.0
rn.inputs["Detail"].default_value = 3.0
rm = nodes.new("ShaderNodeMapRange")
rm.inputs["From Min"].default_value = 0.0
rm.inputs["From Max"].default_value = 1.0
rm.inputs["To Min"].default_value = 0.20
rm.inputs["To Max"].default_value = 0.32
links.new(tex_coord.outputs["Object"], rn.inputs["Vector"])
links.new(rn.outputs["Fac"], rm.inputs["Value"])
links.new(rm.outputs["Result"], bsdf.inputs["Roughness"])

# Colour variation
cn = nodes.new("ShaderNodeTexNoise")
cn.inputs["Scale"].default_value = 2.0
cn.inputs["Detail"].default_value = 2.0
cr = nodes.new("ShaderNodeValToRGB")
cr.color_ramp.elements[0].color = (1.0, 0.60, 0.12, 1.0)
cr.color_ramp.elements[0].position = 0.4
cr.color_ramp.elements[1].color = (1.0, 0.70, 0.18, 1.0)
cr.color_ramp.elements[1].position = 0.6
links.new(tex_coord.outputs["Object"], cn.inputs["Vector"])
links.new(cn.outputs["Fac"], cr.inputs["Fac"])
links.new(cr.outputs["Color"], bsdf.inputs["Base Color"])

coin.data.materials.append(mat)

# Slight tilt — matching the reference photo angle
coin.rotation_euler = (math.radians(5), math.radians(-3), math.radians(12))

# Ground-seat
bpy.context.view_layer.update()
bbox = [coin.matrix_world @ Vector(corner) for corner in coin.bound_box]
min_z = min(v.z for v in bbox)
coin.location.z -= min_z


# === HDRI ===
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()
bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.5
env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)
mn = tree.nodes.new("ShaderNodeMapping")
mn.inputs["Rotation"].default_value = (0, 0, math.radians(75))
tc_w = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc_w.outputs["Generated"], mn.inputs["Vector"])
tree.links.new(mn.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], out_node.inputs["Surface"])

# === LIGHTING ===
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
key_obj.rotation_euler = (Vector((0, 0, 0.03)) - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
accent_obj.rotation_euler = (Vector((0, 0, 0.03)) - accent_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === CAMERA — closer framing so coin fills ~70% of frame ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj
dist = 2.0
az = math.radians(30)
el = math.radians(30)
target = Vector((0, 0, 0.03))
cam_obj.location = (dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), dist * math.sin(el) + target.z)
cam_obj.rotation_euler = (target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 85

# === RENDER ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 256
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"GOLD COIN V5: {OUTPUT_PATH}")
