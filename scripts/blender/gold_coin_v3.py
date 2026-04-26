"""Gold coin v3 — Krugerrand-style. Raised rim via geometry, central device via
boolean/displacement, reeded edge kept. No torus hack."""
import bpy
import math
import os
import bmesh
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_v3.png")

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


# === COIN BASE — cylinder with inset face for rim ===
bpy.ops.mesh.primitive_cylinder_add(
    vertices=128,
    radius=coin_radius,
    depth=coin_depth,
    location=(0, 0, coin_depth / 2)
)
coin = bpy.context.active_object
coin.name = "GoldCoin"

# Use edit mode to inset the top and bottom faces to create a raised rim
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(coin.data)
bm.faces.ensure_lookup_table()

# Find top and bottom face (faces with all verts at max/min z)
top_faces = [f for f in bm.faces if all(abs(v.co.z - coin_depth/2) < 0.001 for v in f.verts)]
bot_faces = [f for f in bm.faces if all(abs(v.co.z + coin_depth/2) < 0.001 for v in f.verts)]

# Select top face, inset it to create rim
for f in bm.faces:
    f.select = False
for f in top_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)

# Inset to create rim border
bpy.ops.mesh.inset(thickness=0.015, depth=-0.003)  # rim is 0.003 proud of face

# Inset again for inner border ring
bpy.ops.mesh.inset(thickness=0.005, depth=0.0)

# Now inset for the central field (slightly recessed from rim)
bpy.ops.mesh.inset(thickness=0.008, depth=0.001)

# Do the same for bottom face
for f in bm.faces:
    f.select = False
bm.faces.ensure_lookup_table()
bot_faces = [f for f in bm.faces if all(abs(v.co.z + coin_depth/2) < 0.001 for v in f.verts)]
for f in bot_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)
bpy.ops.mesh.inset(thickness=0.015, depth=-0.003)
bpy.ops.mesh.inset(thickness=0.005, depth=0.0)
bpy.ops.mesh.inset(thickness=0.008, depth=0.001)

bpy.ops.object.mode_set(mode='OBJECT')


# === SPRINGBOK-STYLE CENTRAL DEVICE ===
# Simplified silhouette: an elongated diamond/leaf shape suggesting a leaping animal
# Built from a few merged primitives

# Body — elongated sphere tilted at an angle
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.06, location=(0, 0, coin_depth + 0.001))
body = bpy.context.active_object
body.name = "Device_Body"
body.scale = (0.5, 0.3, 0.08)
body.rotation_euler = (0, 0, math.radians(-20))
bpy.ops.object.transform_apply(scale=True, rotation=True)

# Head — small sphere offset
bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.015, location=(0.035, 0.01, coin_depth + 0.001))
head = bpy.context.active_object
head.name = "Device_Head"
head.scale = (1.2, 0.8, 0.5)
bpy.ops.object.transform_apply(scale=True)

# Horns — two thin cones sweeping back
for side, y_off in [("L", 0.005), ("R", -0.005)]:
    bpy.ops.mesh.primitive_cone_add(
        vertices=8, radius1=0.003, radius2=0.0005, depth=0.04,
        location=(0.04, y_off, coin_depth + 0.002)
    )
    horn = bpy.context.active_object
    horn.name = f"Device_Horn_{side}"
    horn.rotation_euler = (0, math.radians(75), math.radians(-10 if side == "L" else 10))
    bpy.ops.object.transform_apply(rotation=True)

# Front legs — two thin cylinders angled forward
for side, y_off in [("L", 0.008), ("R", -0.008)]:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.004, depth=0.05,
        location=(-0.005, y_off, coin_depth + 0.0)
    )
    leg = bpy.context.active_object
    leg.name = f"Device_FLeg_{side}"
    leg.rotation_euler = (math.radians(10 if side == "L" else -10), math.radians(-30), 0)
    bpy.ops.object.transform_apply(rotation=True)

# Back legs — angled backward
for side, y_off in [("L", 0.008), ("R", -0.008)]:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8, radius=0.004, depth=0.05,
        location=(-0.04, y_off, coin_depth + 0.0)
    )
    leg = bpy.context.active_object
    leg.name = f"Device_BLeg_{side}"
    leg.rotation_euler = (math.radians(-5 if side == "L" else 5), math.radians(25), 0)
    bpy.ops.object.transform_apply(rotation=True)

# Join all device parts
device_parts = [obj for obj in bpy.data.objects if obj.name.startswith("Device_")]
bpy.ops.object.select_all(action='DESELECT')
for obj in device_parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = device_parts[0]
bpy.ops.object.join()
device = bpy.context.active_object
device.name = "CoinDevice"

# Flatten the device to be very low relief
device.scale.z = 0.6
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth()


# === REEDED EDGE (kept from v2 but cleaner) ===
num_reeds = 120
for i in range(num_reeds):
    angle = (2 * math.pi * i) / num_reeds
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=(
            (coin_radius + 0.0005) * math.cos(angle),
            (coin_radius + 0.0005) * math.sin(angle),
            coin_depth / 2
        )
    )
    r = bpy.context.active_object
    r.name = f"Reed_{i:03d}"
    r.scale = (0.002, 0.006, coin_depth * 0.55)
    r.rotation_euler.z = angle
    bpy.ops.object.transform_apply(scale=True)


# === JOIN EVERYTHING ===
bpy.ops.object.select_all(action='SELECT')
# Deselect camera/lights if any exist
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

# Subtle surface texture — fine grain like struck metal
fine_noise = nodes.new("ShaderNodeTexNoise")
fine_noise.inputs["Scale"].default_value = 80.0
fine_noise.inputs["Detail"].default_value = 10.0
fine_noise.inputs["Roughness"].default_value = 0.7
links.new(tex_coord.outputs["Object"], fine_noise.inputs["Vector"])

bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.05  # very subtle
bump.inputs["Distance"].default_value = 0.0005
links.new(fine_noise.outputs["Fac"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

# Roughness: face slightly more matte than rim for realism
rough_noise = nodes.new("ShaderNodeTexNoise")
rough_noise.inputs["Scale"].default_value = 5.0
rough_noise.inputs["Detail"].default_value = 3.0
rough_map = nodes.new("ShaderNodeMapRange")
rough_map.inputs["From Min"].default_value = 0.0
rough_map.inputs["From Max"].default_value = 1.0
rough_map.inputs["To Min"].default_value = 0.18
rough_map.inputs["To Max"].default_value = 0.30
links.new(tex_coord.outputs["Object"], rough_noise.inputs["Vector"])
links.new(rough_noise.outputs["Fac"], rough_map.inputs["Value"])
links.new(rough_map.outputs["Result"], bsdf.inputs["Roughness"])

# Colour variation
color_noise = nodes.new("ShaderNodeTexNoise")
color_noise.inputs["Scale"].default_value = 2.0
color_noise.inputs["Detail"].default_value = 2.0
color_ramp = nodes.new("ShaderNodeValToRGB")
color_ramp.color_ramp.elements[0].color = (1.0, 0.60, 0.12, 1.0)
color_ramp.color_ramp.elements[0].position = 0.4
color_ramp.color_ramp.elements[1].color = (1.0, 0.70, 0.18, 1.0)
color_ramp.color_ramp.elements[1].position = 0.6
links.new(tex_coord.outputs["Object"], color_noise.inputs["Vector"])
links.new(color_noise.outputs["Fac"], color_ramp.inputs["Fac"])
links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])

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
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + target.z
cam_obj.location = (cam_x, cam_y, cam_z)
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
print(f"GOLD COIN V3: {OUTPUT_PATH}")
