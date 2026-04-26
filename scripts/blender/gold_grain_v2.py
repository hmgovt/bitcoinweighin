"""Gold grain v2 — casting grain: a small pile of smooth rounded gold pellets.
Each pellet is a deformed UV sphere resembling a solidified molten droplet.
Scattered in a loose heap, ~0.1g reference amount (a small pinch)."""
import bpy
import math
import os
import random
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/grain_test_v2.png")

random.seed(42)

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)


# === GOLD MATERIAL (shared) ===
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.18  # shinier than v6 — these are smooth pellets
bsdf.inputs["Specular"].default_value = 0.5

# Subtle roughness variation
tex_coord = nodes.new("ShaderNodeTexCoord")
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 20.0
noise.inputs["Detail"].default_value = 5.0
map_range = nodes.new("ShaderNodeMapRange")
map_range.inputs["From Min"].default_value = 0.0
map_range.inputs["From Max"].default_value = 1.0
map_range.inputs["To Min"].default_value = 0.12
map_range.inputs["To Max"].default_value = 0.25
links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
links.new(noise.outputs["Fac"], map_range.inputs["Value"])
links.new(map_range.outputs["Result"], bsdf.inputs["Roughness"])

# Subtle colour variation
color_noise = nodes.new("ShaderNodeTexNoise")
color_noise.inputs["Scale"].default_value = 8.0
color_noise.inputs["Detail"].default_value = 3.0
color_ramp = nodes.new("ShaderNodeValToRGB")
color_ramp.color_ramp.elements[0].color = (1.0, 0.58, 0.10, 1.0)
color_ramp.color_ramp.elements[0].position = 0.35
color_ramp.color_ramp.elements[1].color = (1.0, 0.72, 0.22, 1.0)
color_ramp.color_ramp.elements[1].position = 0.65
links.new(tex_coord.outputs["Object"], color_noise.inputs["Vector"])
links.new(color_noise.outputs["Fac"], color_ramp.inputs["Fac"])
links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])


# === CREATE PELLET SHAPES ===
def create_pellet(name, location, scale_xyz, rotation):
    """Create a single gold pellet — a deformed smooth sphere like a cooled droplet."""
    # Start with UV sphere
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=16,
        radius=0.08,  # small pellet
        location=location
    )
    pellet = bpy.context.active_object
    pellet.name = name

    # Random scale to make each pellet unique — some rounder, some elongated/teardrop
    pellet.scale = scale_xyz
    pellet.rotation_euler = rotation
    bpy.ops.object.transform_apply(scale=True, rotation=True)

    # Subtle deformation for organic shape
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(pellet.data)
    for v in bm.verts:
        # Gentle random displacement
        v.co.x += random.uniform(-0.008, 0.008)
        v.co.y += random.uniform(-0.008, 0.008)
        v.co.z += random.uniform(-0.006, 0.006)
    bm.to_mesh(pellet.data)
    bm.free()

    # Smooth shading
    bpy.ops.object.shade_smooth()

    # Apply material
    pellet.data.materials.append(mat)

    return pellet


# === SCATTER PELLETS IN A PILE ===
# For grain stage (0.1g), show a small pinch — ~20-30 pellets in a loose low mound
pellets = []
num_pellets = 35

for i in range(num_pellets):
    # Distribute in a rough circular mound pattern
    # Inner pellets piled higher, outer ones scattered flat
    angle = random.uniform(0, 2 * math.pi)
    radius = random.uniform(0, 0.35)

    # Height based on distance from centre — forms a mound
    max_height = 0.15 * (1.0 - (radius / 0.35) ** 1.5)
    height = random.uniform(0, max(0.01, max_height))

    x = radius * math.cos(angle) + random.uniform(-0.03, 0.03)
    y = radius * math.sin(angle) + random.uniform(-0.03, 0.03)
    z = height

    # Random pellet shape — some round, some teardrop, some flattened
    shape_type = random.choice(['round', 'teardrop', 'flat', 'oval'])
    if shape_type == 'round':
        sx = random.uniform(0.8, 1.2)
        sy = random.uniform(0.8, 1.2)
        sz = random.uniform(0.8, 1.1)
    elif shape_type == 'teardrop':
        sx = random.uniform(0.7, 1.0)
        sy = random.uniform(0.7, 1.0)
        sz = random.uniform(1.1, 1.6)
    elif shape_type == 'flat':
        sx = random.uniform(1.0, 1.4)
        sy = random.uniform(1.0, 1.4)
        sz = random.uniform(0.5, 0.7)
    else:  # oval
        sx = random.uniform(1.1, 1.5)
        sy = random.uniform(0.7, 0.9)
        sz = random.uniform(0.8, 1.0)

    rot = (
        random.uniform(0, math.pi * 2),
        random.uniform(0, math.pi * 2),
        random.uniform(0, math.pi * 2)
    )

    pellet = create_pellet(f"Pellet_{i:03d}", (x, y, z), (sx, sy, sz), rot)
    pellets.append(pellet)

# Drop all pellets to ground (ensure none float)
for p in pellets:
    bpy.context.view_layer.update()
    bbox = [p.matrix_world @ Vector(corner) for corner in p.bound_box]
    min_z = min(v.z for v in bbox)
    if min_z < 0:
        p.location.z -= min_z


# === HDRI ENVIRONMENT ===
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


# === LIGHTING ===
# Key light — gold-tinted
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
direction = Vector((0, 0, 0.05)) - key_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
key_obj.rotation_euler = rot_quat.to_euler()

# Accent light — warm amber
accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
direction = Vector((0, 0, 0.05)) - accent_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
accent_obj.rotation_euler = rot_quat.to_euler()


# === CAMERA ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Three-quarter view, pulled back enough to show the pile with breathing room
dist = 1.8
az = math.radians(30)
el = math.radians(30)
target_z = 0.06  # centre of the pile
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + target_z
cam_obj.location = (cam_x, cam_y, cam_z)

direction = Vector((0, 0, target_z)) - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
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
print(f"GOLD GRAIN V2 COMPLETE: {OUTPUT_PATH}")
