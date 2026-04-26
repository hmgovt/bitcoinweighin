"""Gold coin v4 — bolder central device, taller relief so it reads at three-quarter angle."""
import bpy
import math
import os
import bmesh
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_v4.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)

coin_radius = 0.3
coin_depth = 0.051
relief_z = coin_depth + 0.002  # base z for relief elements on top face


# === COIN BASE WITH RIM ===
bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=coin_radius, depth=coin_depth, location=(0, 0, coin_depth / 2))
coin = bpy.context.active_object
coin.name = "CoinBase"

bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(coin.data)
bm.faces.ensure_lookup_table()

# Top face — inset for rim
top_faces = [f for f in bm.faces if all(abs(v.co.z - coin_depth/2) < 0.001 for v in f.verts)]
for f in bm.faces:
    f.select = False
for f in top_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)
bpy.ops.mesh.inset(thickness=0.012, depth=-0.004)  # proud rim
bpy.ops.mesh.inset(thickness=0.004, depth=0.0)  # border line
bpy.ops.mesh.inset(thickness=0.006, depth=0.002)  # step down to field

# Bottom face
for f in bm.faces:
    f.select = False
bm.faces.ensure_lookup_table()
bot_faces = [f for f in bm.faces if all(abs(v.co.z + coin_depth/2) < 0.001 for v in f.verts)]
for f in bot_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)
bpy.ops.mesh.inset(thickness=0.012, depth=-0.004)
bpy.ops.mesh.inset(thickness=0.004, depth=0.0)
bpy.ops.mesh.inset(thickness=0.006, depth=0.002)

bpy.ops.object.mode_set(mode='OBJECT')


# === SPRINGBOK DEVICE — much bolder relief ===
# Torso: elongated ellipsoid, leaping pose (angled upward)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=1.0, location=(0, 0, relief_z))
body = bpy.context.active_object
body.name = "D_Body"
body.scale = (0.08, 0.025, 0.012)  # long, narrow, taller relief
body.rotation_euler = (0, math.radians(-15), math.radians(-10))  # leaping upward angle
bpy.ops.object.transform_apply(scale=True, rotation=True)
bpy.ops.object.shade_smooth()

# Neck: tilted cylinder connecting body to head
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1.0, location=(0.06, 0.005, relief_z + 0.003))
neck = bpy.context.active_object
neck.name = "D_Neck"
neck.scale = (0.025, 0.012, 0.010)
neck.rotation_euler = (0, math.radians(-35), math.radians(-5))
bpy.ops.object.transform_apply(scale=True, rotation=True)
bpy.ops.object.shade_smooth()

# Head: small sphere
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.012, location=(0.075, 0.008, relief_z + 0.006))
head = bpy.context.active_object
head.name = "D_Head"
head.scale = (1.3, 0.8, 0.7)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()

# Horns: two swept-back cones
for side, y_off, y_rot in [("L", 0.012, -8), ("R", 0.004, 8)]:
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.003, radius2=0.0008, depth=0.05,
        location=(0.08, y_off, relief_z + 0.012))
    horn = bpy.context.active_object
    horn.name = f"D_Horn_{side}"
    horn.rotation_euler = (math.radians(y_rot), math.radians(60), math.radians(-15))
    bpy.ops.object.transform_apply(rotation=True)
    bpy.ops.object.shade_smooth()

# Front legs: two cylinders, extended forward (leaping)
for side, y_off in [("L", 0.012), ("R", -0.002)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.005, depth=0.06,
        location=(0.03, y_off, relief_z - 0.004))
    leg = bpy.context.active_object
    leg.name = f"D_FLeg_{side}"
    leg.rotation_euler = (math.radians(5 if side == "L" else -5), math.radians(-50), 0)
    bpy.ops.object.transform_apply(rotation=True)
    bpy.ops.object.shade_smooth()

# Back legs: two cylinders, extended backward
for side, y_off in [("L", 0.012), ("R", -0.002)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.005, depth=0.065,
        location=(-0.05, y_off, relief_z - 0.004))
    leg = bpy.context.active_object
    leg.name = f"D_BLeg_{side}"
    leg.rotation_euler = (math.radians(-3 if side == "L" else 3), math.radians(40), 0)
    bpy.ops.object.transform_apply(rotation=True)
    bpy.ops.object.shade_smooth()

# Tail: thin cone sweeping up
bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.003, radius2=0.001, depth=0.03,
    location=(-0.07, 0.005, relief_z + 0.005))
tail = bpy.context.active_object
tail.name = "D_Tail"
tail.rotation_euler = (0, math.radians(70), math.radians(10))
bpy.ops.object.transform_apply(rotation=True)
bpy.ops.object.shade_smooth()

# === Concentric text rings — suggesting "SOUTH AFRICA" / "KRUGERRAND" ===
# Inner border ring
bpy.ops.mesh.primitive_torus_add(
    major_radius=coin_radius * 0.78, minor_radius=0.0025,
    major_segments=96, minor_segments=8,
    location=(0, 0, relief_z + 0.001))
ring1 = bpy.context.active_object
ring1.name = "D_Ring_Inner"
ring1.scale.z = 0.5
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()

# Outer text line ring
bpy.ops.mesh.primitive_torus_add(
    major_radius=coin_radius * 0.88, minor_radius=0.002,
    major_segments=96, minor_segments=8,
    location=(0, 0, relief_z + 0.001))
ring2 = bpy.context.active_object
ring2.name = "D_Ring_Outer"
ring2.scale.z = 0.5
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()

# Small dots suggesting text characters around the outer ring
num_dots = 40
for i in range(num_dots):
    # Leave gaps at top and bottom for visual break (like "SOUTH AFRICA" / "1 OZ")
    angle = (2 * math.pi * i) / num_dots
    # Skip dots in the 11 o'clock to 1 o'clock range and 5 to 7 o'clock
    angle_deg = math.degrees(angle) % 360
    if (330 < angle_deg or angle_deg < 30) or (150 < angle_deg < 210):
        continue
    r = coin_radius * 0.83
    bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=0.0018,
        location=(r * math.cos(angle), r * math.sin(angle), relief_z + 0.001))
    dot = bpy.context.active_object
    dot.name = f"D_Dot_{i}"
    dot.scale.z = 0.4
    bpy.ops.object.transform_apply(scale=True)


# === REEDED EDGE ===
num_reeds = 120
for i in range(num_reeds):
    angle = (2 * math.pi * i) / num_reeds
    bpy.ops.mesh.primitive_cube_add(size=1,
        location=((coin_radius + 0.0005) * math.cos(angle),
                  (coin_radius + 0.0005) * math.sin(angle),
                  coin_depth / 2))
    r = bpy.context.active_object
    r.name = f"Reed_{i:03d}"
    r.scale = (0.002, 0.006, coin_depth * 0.55)
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
bsdf.inputs["Roughness"].default_value = 0.22
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

# Fine grain bump
fine = nodes.new("ShaderNodeTexNoise")
fine.inputs["Scale"].default_value = 80.0
fine.inputs["Detail"].default_value = 10.0
fine.inputs["Roughness"].default_value = 0.7
links.new(tex_coord.outputs["Object"], fine.inputs["Vector"])
bump_node = nodes.new("ShaderNodeBump")
bump_node.inputs["Strength"].default_value = 0.04
bump_node.inputs["Distance"].default_value = 0.0003
links.new(fine.outputs["Fac"], bump_node.inputs["Height"])
links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

# Roughness variation
rn = nodes.new("ShaderNodeTexNoise")
rn.inputs["Scale"].default_value = 5.0
rn.inputs["Detail"].default_value = 3.0
rm = nodes.new("ShaderNodeMapRange")
rm.inputs["From Min"].default_value = 0.0
rm.inputs["From Max"].default_value = 1.0
rm.inputs["To Min"].default_value = 0.18
rm.inputs["To Max"].default_value = 0.28
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

# Slight tilt
coin.rotation_euler = (math.radians(3), math.radians(-2), math.radians(15))

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
tc = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc.outputs["Generated"], mn.inputs["Vector"])
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

# === CAMERA ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj
dist = 3.0
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
print(f"GOLD COIN V4: {OUTPUT_PATH}")
