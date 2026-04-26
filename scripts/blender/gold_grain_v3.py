"""Gold grain v3 — many small smooth pellets in a wide flat mound.
Matching reference: casting grain = smooth solidified droplets, low pile."""
import bpy
import math
import os
import random
import bmesh
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/grain_test_v3.png")

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


# === GOLD MATERIAL ===
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.18
bsdf.inputs["Specular"].default_value = 0.5

# Roughness variation
tex_coord = nodes.new("ShaderNodeTexCoord")
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 25.0
noise.inputs["Detail"].default_value = 5.0
map_range = nodes.new("ShaderNodeMapRange")
map_range.inputs["From Min"].default_value = 0.0
map_range.inputs["From Max"].default_value = 1.0
map_range.inputs["To Min"].default_value = 0.12
map_range.inputs["To Max"].default_value = 0.25
links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])
links.new(noise.outputs["Fac"], map_range.inputs["Value"])
links.new(map_range.outputs["Result"], bsdf.inputs["Roughness"])

# Colour variation
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


# === CREATE TEMPLATE PELLET MESHES ===
# Pre-create a few template meshes, then instance them for performance
templates = []

for t in range(6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=1.0, location=(100, 100, 100))
    tmpl = bpy.context.active_object
    tmpl.name = f"Template_{t}"

    # Gentle shape variation per template
    shapes = [
        (1.0, 1.0, 0.9),       # slightly flat sphere
        (1.0, 0.9, 1.2),       # teardrop-ish
        (1.1, 1.0, 0.8),       # oval flat
        (0.9, 1.1, 1.0),       # slightly elongated
        (1.0, 1.0, 1.0),       # round
        (1.15, 0.85, 0.75),    # flattened oval
    ]
    tmpl.scale = shapes[t]
    bpy.ops.object.transform_apply(scale=True)

    # Very gentle deformation — smooth droplets, NOT crumpled
    bm = bmesh.new()
    bm.from_mesh(tmpl.data)
    for v in bm.verts:
        v.co.x += random.uniform(-0.03, 0.03)
        v.co.y += random.uniform(-0.03, 0.03)
        v.co.z += random.uniform(-0.02, 0.02)
    bm.to_mesh(tmpl.data)
    bm.free()

    bpy.ops.object.shade_smooth()
    tmpl.data.materials.append(mat)

    # Hide template far away
    tmpl.hide_render = True
    templates.append(tmpl.data)

    # Remove template object, keep mesh data
    bpy.data.objects.remove(tmpl)


# === SCATTER PELLETS ===
num_pellets = 100
pile_radius = 0.5  # wider, flatter spread

pellets = []
for i in range(num_pellets):
    # Create instance from random template
    mesh_data = random.choice(templates).copy()
    pellet = bpy.data.objects.new(f"Pellet_{i:03d}", mesh_data)
    bpy.context.collection.objects.link(pellet)

    # Random size — small pellets, varying 0.015 to 0.04 radius
    size = random.uniform(0.015, 0.04)
    pellet.scale = (size, size, size)

    # Distribute in circular mound
    angle = random.uniform(0, 2 * math.pi)
    # Use sqrt for uniform area distribution
    r = pile_radius * math.sqrt(random.uniform(0, 1))

    # Mound height: peaks in centre, zero at edges
    falloff = max(0, 1.0 - (r / pile_radius) ** 1.2)
    max_h = 0.08 * falloff
    h = random.uniform(0, max(0.001, max_h))

    pellet.location = (
        r * math.cos(angle),
        r * math.sin(angle),
        h
    )
    pellet.rotation_euler = (
        random.uniform(0, math.pi * 2),
        random.uniform(0, math.pi * 2),
        random.uniform(0, math.pi * 2),
    )

    pellet.data.materials.clear()
    pellet.data.materials.append(mat)

    pellets.append(pellet)

# Ensure pellets sit on ground
bpy.context.view_layer.update()
for p in pellets:
    bbox = [p.matrix_world @ Vector(corner) for corner in p.bound_box]
    min_z = min(v.z for v in bbox)
    if min_z < 0:
        p.location.z -= min_z


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
tex_coord_w = tree.nodes.new("ShaderNodeTexCoord")
output = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tex_coord_w.outputs["Generated"], mapping_node.inputs["Vector"])
tree.links.new(mapping_node.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], output.inputs["Surface"])


# === LIGHTING ===
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
direction = Vector((0, 0, 0.03)) - key_obj.location
key_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
direction = Vector((0, 0, 0.03)) - accent_obj.location
accent_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


# === CAMERA ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Pull back for wider framing — pile should occupy ~60% of frame
dist = 2.2
az = math.radians(30)
el = math.radians(28)
target_z = 0.03
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + target_z
cam_obj.location = (cam_x, cam_y, cam_z)

direction = Vector((0, 0, target_z)) - cam_obj.location
cam_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
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
print(f"GOLD GRAIN V3 COMPLETE: {OUTPUT_PATH}")
