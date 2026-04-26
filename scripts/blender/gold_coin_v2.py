"""Gold coin v2 — reeded edge, raised rim, more pronounced profile."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_v2.png")

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
rim_height = 0.012  # raised rim above face


# === MAIN COIN BODY ===
bpy.ops.mesh.primitive_cylinder_add(
    vertices=128,  # high poly for smooth edge
    radius=coin_radius,
    depth=coin_depth,
    location=(0, 0, coin_depth / 2)
)
coin_body = bpy.context.active_object
coin_body.name = "CoinBody"

# === RAISED RIM — torus ring around edge ===
# Create a thin ring that sits proud of both faces
bpy.ops.mesh.primitive_torus_add(
    major_radius=coin_radius - 0.008,
    minor_radius=0.012,
    major_segments=128,
    minor_segments=16,
    location=(0, 0, coin_depth / 2)
)
rim_top = bpy.context.active_object
rim_top.name = "RimRing"
# Flatten the torus to make it a raised lip rather than a full donut
rim_top.scale.z = 0.4
bpy.ops.object.transform_apply(scale=True)

# === REEDED EDGE — array of small cylinders around circumference ===
# Create one ridge, then use array + curve to wrap around
num_reeds = 150

# Create a single reed (tiny vertical cylinder)
bpy.ops.mesh.primitive_cylinder_add(
    vertices=8,
    radius=0.003,
    depth=coin_depth * 1.1,
    location=(coin_radius + 0.001, 0, coin_depth / 2)
)
reed = bpy.context.active_object
reed.name = "Reed_template"

# Duplicate around the circumference
reeds = [reed]
for i in range(1, num_reeds):
    angle = (2 * math.pi * i) / num_reeds
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=8,
        radius=0.003,
        depth=coin_depth * 1.1,
        location=(
            (coin_radius + 0.001) * math.cos(angle),
            (coin_radius + 0.001) * math.sin(angle),
            coin_depth / 2
        )
    )
    r = bpy.context.active_object
    r.name = f"Reed_{i:03d}"
    # Rotate to face outward
    r.rotation_euler.z = angle
    reeds.append(r)

# === JOIN ALL COIN PARTS ===
# Select all coin parts
bpy.ops.object.select_all(action='DESELECT')
for obj in [coin_body, rim_top] + reeds:
    obj.select_set(True)
bpy.context.view_layer.objects.active = coin_body
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

# Bump for face detail — subtle struck relief suggestion
design_noise = nodes.new("ShaderNodeTexNoise")
design_noise.inputs["Scale"].default_value = 6.0
design_noise.inputs["Detail"].default_value = 8.0
design_noise.inputs["Roughness"].default_value = 0.5
links.new(tex_coord.outputs["Object"], design_noise.inputs["Vector"])

bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.1
bump.inputs["Distance"].default_value = 0.001
links.new(design_noise.outputs["Fac"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

# Roughness variation
rough_noise = nodes.new("ShaderNodeTexNoise")
rough_noise.inputs["Scale"].default_value = 5.0
rough_noise.inputs["Detail"].default_value = 3.0
rough_map = nodes.new("ShaderNodeMapRange")
rough_map.inputs["From Min"].default_value = 0.0
rough_map.inputs["From Max"].default_value = 1.0
rough_map.inputs["To Min"].default_value = 0.15
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
print(f"GOLD COIN V2: {OUTPUT_PATH}")
