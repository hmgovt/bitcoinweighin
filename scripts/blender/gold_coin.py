"""Gold coin — 1 oz Britannia. Flat cylinder with beveled rim and surface detail.
Real dimensions: 32.69mm diameter, 2.80mm thick.
Proportions: diameter/thickness ratio ~11.7:1."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)


# === COIN GEOMETRY ===
# Work at scale where 1 unit = ~10cm for good framing with existing camera setup
# Coin: diameter ~0.6 units, thickness ~0.05 units (maintains 11.7:1 ratio)
coin_radius = 0.3
coin_depth = 0.051

# Main body — cylinder
bpy.ops.mesh.primitive_cylinder_add(
    vertices=64,
    radius=coin_radius,
    depth=coin_depth,
    location=(0, 0, coin_depth / 2)
)
coin = bpy.context.active_object
coin.name = "GoldCoin"

# Bevel the edges for that struck-coin rim
bevel = coin.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.008
bevel.segments = 3
bevel.limit_method = 'ANGLE'
bevel.angle_limit = math.radians(50)

bpy.ops.object.shade_smooth()

# Add a raised rim ring — slightly taller cylinder inset from edge
bpy.ops.mesh.primitive_cylinder_add(
    vertices=64,
    radius=coin_radius * 0.95,
    depth=coin_depth + 0.004,  # slightly proud of face
    location=(0, 0, coin_depth / 2)
)
inner_disc = bpy.context.active_object
inner_disc.name = "CoinInner"
bpy.ops.object.shade_smooth()

# The rim is the difference — but for simplicity, just use the main coin
# and add surface detail via material bump map
bpy.data.objects.remove(inner_disc)


# === GOLD MATERIAL WITH COIN DETAIL ===
mat = bpy.data.materials.new(name="Gold_24k_Coin")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

# Base gold (v6 recipe)
bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.22
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

# === Concentric ring pattern (suggests coin relief/text) ===
# Use wave texture for circular ridges on the face
wave = nodes.new("ShaderNodeTexWave")
wave.wave_type = 'RINGS'
wave.inputs["Scale"].default_value = 40.0
wave.inputs["Distortion"].default_value = 1.5
wave.inputs["Detail"].default_value = 3.0
wave.inputs["Detail Scale"].default_value = 2.0
links.new(tex_coord.outputs["Object"], wave.inputs["Vector"])

# Central design area — use noise for the suggestion of a relief figure
design_noise = nodes.new("ShaderNodeTexNoise")
design_noise.inputs["Scale"].default_value = 8.0
design_noise.inputs["Detail"].default_value = 10.0
design_noise.inputs["Roughness"].default_value = 0.6
links.new(tex_coord.outputs["Object"], design_noise.inputs["Vector"])

# Mix the ring pattern and design noise
mix_bump = nodes.new("ShaderNodeMixRGB")
mix_bump.blend_type = 'MIX'
mix_bump.inputs["Fac"].default_value = 0.4
links.new(wave.outputs["Fac"], mix_bump.inputs["Color1"])
links.new(design_noise.outputs["Fac"], mix_bump.inputs["Color2"])

# Bump map — very subtle, just enough to catch light differently across the face
bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.15
bump.inputs["Distance"].default_value = 0.002
links.new(mix_bump.outputs["Color"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

# Roughness variation — coin faces slightly different roughness than rim
roughness_noise = nodes.new("ShaderNodeTexNoise")
roughness_noise.inputs["Scale"].default_value = 5.0
roughness_noise.inputs["Detail"].default_value = 3.0
rough_map = nodes.new("ShaderNodeMapRange")
rough_map.inputs["From Min"].default_value = 0.0
rough_map.inputs["From Max"].default_value = 1.0
rough_map.inputs["To Min"].default_value = 0.15
rough_map.inputs["To Max"].default_value = 0.30
links.new(tex_coord.outputs["Object"], roughness_noise.inputs["Vector"])
links.new(roughness_noise.outputs["Fac"], rough_map.inputs["Value"])
links.new(rough_map.outputs["Result"], bsdf.inputs["Roughness"])

# Slight colour variation
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

# Tilt the coin very slightly so the face catches light at an angle
coin.rotation_euler = (math.radians(3), math.radians(-2), math.radians(15))

# Re-seat on ground after rotation
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
mapping_node = tree.nodes.new("ShaderNodeMapping")
mapping_node.inputs["Rotation"].default_value = (0, 0, math.radians(75))
tc = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc.outputs["Generated"], mapping_node.inputs["Vector"])
tree.links.new(mapping_node.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], out_node.inputs["Surface"])


# === LIGHTING (v6 recipe) ===
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
print(f"GOLD COIN TEST: {OUTPUT_PATH}")
