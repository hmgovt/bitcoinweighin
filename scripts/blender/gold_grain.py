"""Gold grain — a tiny irregular gold flake/nugget, ~0.1g reference amount.
Real gold grains are small, organically shaped, with dimpled/lumpy surfaces.
Modelled as a deformed icosphere with displacement noise for natural texture."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/grain_test.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Remove orphan data
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)

# === GOLD GRAIN GEOMETRY ===
# Start with icosphere, deform it into an irregular nugget shape
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=0.5, location=(0, 0, 0))
grain = bpy.context.active_object
grain.name = "GoldGrain"

# Flatten slightly — grains are typically flattish, not perfectly round
grain.scale = (1.0, 0.85, 0.55)
bpy.ops.object.transform_apply(scale=True)

# Subdivision surface for smoothness
subsurf = grain.modifiers.new(name="Subsurf", type='SUBSURF')
subsurf.levels = 2
subsurf.render_levels = 2

# Displace with noise texture for organic lumpy surface
displace = grain.modifiers.new(name="Displace", type='DISPLACE')
noise_tex = bpy.data.textures.new(name="GrainNoise", type='VORONOI')
noise_tex.noise_scale = 0.4
noise_tex.distance_metric = 'DISTANCE'
displace.texture = noise_tex
displace.strength = 0.08  # subtle — enough to break up the silhouette
displace.mid_level = 0.5

# Second displacement layer for finer detail
displace2 = grain.modifiers.new(name="DisplaceFine", type='DISPLACE')
fine_tex = bpy.data.textures.new(name="GrainFine", type='MUSGRAVE')
fine_tex.noise_scale = 0.15
displace2.texture = fine_tex
displace2.strength = 0.03
displace2.mid_level = 0.5

# Apply all modifiers for clean mesh
bpy.context.view_layer.objects.active = grain
for mod in grain.modifiers:
    bpy.ops.object.modifier_apply(modifier=mod.name)

# Enter edit mode to add some manual irregularity via proportional editing
# (Use random vertex displacement instead for headless mode)
import bmesh
import random

random.seed(42)  # reproducible
bm = bmesh.new()
bm.from_mesh(grain.data)
for v in bm.verts:
    # Random per-vertex jitter
    v.co.x += random.uniform(-0.02, 0.02)
    v.co.y += random.uniform(-0.02, 0.02)
    v.co.z += random.uniform(-0.015, 0.015)
bm.to_mesh(grain.data)
bm.free()

# Smooth shading
bpy.ops.object.shade_smooth()

# Position: sitting on the "ground plane" (z=0)
# Compute bounding box to place bottom at z=0
grain.location.z = 0
bpy.context.view_layer.update()
bbox = [grain.matrix_world @ Vector(corner) for corner in grain.bound_box]
min_z = min(v.z for v in bbox)
grain.location.z -= min_z  # sit on ground

# Slight random rotation for natural look
grain.rotation_euler = (math.radians(5), math.radians(-8), math.radians(22))
# Re-seat after rotation
bpy.context.view_layer.update()
bbox = [grain.matrix_world @ Vector(corner) for corner in grain.bound_box]
min_z = min(v.z for v in bbox)
grain.location.z -= min_z


# === GOLD MATERIAL (locked recipe from v6) ===
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links

bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.25

# Add subtle roughness variation via noise texture for more realistic surface
tex_coord = nodes.new("ShaderNodeTexCoord")
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 15.0
noise.inputs["Detail"].default_value = 8.0
noise.inputs["Roughness"].default_value = 0.7

# Map noise to roughness variation: 0.18 to 0.35
map_range = nodes.new("ShaderNodeMapRange")
map_range.inputs["From Min"].default_value = 0.0
map_range.inputs["From Max"].default_value = 1.0
map_range.inputs["To Min"].default_value = 0.18
map_range.inputs["To Max"].default_value = 0.35

links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
links.new(noise.outputs["Fac"], map_range.inputs["Value"])
links.new(map_range.outputs["Result"], bsdf.inputs["Roughness"])

# Subtle base colour variation too — some areas slightly richer
color_noise = nodes.new("ShaderNodeTexNoise")
color_noise.inputs["Scale"].default_value = 5.0
color_noise.inputs["Detail"].default_value = 3.0

color_ramp = nodes.new("ShaderNodeValToRGB")
color_ramp.color_ramp.elements[0].color = (1.0, 0.60, 0.12, 1.0)  # darker gold
color_ramp.color_ramp.elements[0].position = 0.3
color_ramp.color_ramp.elements[1].color = (1.0, 0.70, 0.20, 1.0)  # lighter gold
color_ramp.color_ramp.elements[1].position = 0.7

links.new(tex_coord.outputs["Object"], color_noise.inputs["Vector"])
links.new(color_noise.outputs["Fac"], color_ramp.inputs["Fac"])
links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])

grain.data.materials.append(mat)


# === HDRI ENVIRONMENT (fill only) ===
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.5

env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)

mapping = tree.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(75))
tex_coord_w = tree.nodes.new("ShaderNodeTexCoord")

output = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tex_coord_w.outputs["Generated"], mapping.inputs["Vector"])
tree.links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], output.inputs["Surface"])


# === LIGHTING (locked recipe from v6) ===
# Key light — gold-tinted
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
direction = Vector((0, 0, 0.2)) - key_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
key_obj.rotation_euler = rot_quat.to_euler()

# Accent light — warm amber from opposite side
accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
direction = Vector((0, 0, 0.2)) - accent_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
accent_obj.rotation_euler = rot_quat.to_euler()


# === CAMERA ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# For the grain, camera needs to be much closer — object is tiny
# Frame the grain with some breathing room
dist = 2.0
az = math.radians(30)
el = math.radians(30)
target_z = 0.15  # roughly centre height of grain
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + target_z
cam_obj.location = (cam_x, cam_y, cam_z)

direction = Vector((0, 0, target_z)) - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
cam_data.lens = 85


# === RENDER SETTINGS ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 256  # higher for clean metal
scene.render.resolution_x = 800
scene.render.resolution_y = 800
scene.render.film_transparent = True
scene.cycles.use_denoising = True

scene.view_settings.view_transform = 'Standard'

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"GOLD GRAIN TEST COMPLETE: {OUTPUT_PATH}")
