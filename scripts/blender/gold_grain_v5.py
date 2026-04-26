"""Gold grain v5 — fixed camera. Simple approach: build pile at origin, auto-frame."""
import bpy
import math
import os
import random
import bmesh
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/grain_test_v5.png")

random.seed(42)

# --- Clear everything ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)
for block in bpy.data.worlds:
    if block.users == 0:
        bpy.data.worlds.remove(block)


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

tex_coord = nodes.new("ShaderNodeTexCoord")

# Roughness variation
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 3.0
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
color_noise.inputs["Scale"].default_value = 1.5
color_noise.inputs["Detail"].default_value = 3.0
color_ramp = nodes.new("ShaderNodeValToRGB")
color_ramp.color_ramp.elements[0].color = (1.0, 0.58, 0.10, 1.0)
color_ramp.color_ramp.elements[0].position = 0.35
color_ramp.color_ramp.elements[1].color = (1.0, 0.72, 0.22, 1.0)
color_ramp.color_ramp.elements[1].position = 0.65
links.new(tex_coord.outputs["Object"], color_noise.inputs["Vector"])
links.new(color_noise.outputs["Fac"], color_ramp.inputs["Fac"])
links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])


# === SCATTER PELLETS ===
# Work at scale: pile ~1.5 units across, pellets 0.04-0.12 radius
# This matches the cube from the smoke tests which was 1 unit and rendered fine
num_pellets = 120
pile_radius = 0.7

all_pellets = []
for i in range(num_pellets):
    # Varied shapes
    seg = 16
    ring = 12
    base_r = random.uniform(0.04, 0.10)
    # Some bigger ones
    if random.random() < 0.12:
        base_r = random.uniform(0.10, 0.14)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=base_r, location=(0, 0, 0))
    p = bpy.context.active_object
    p.name = f"Pellet_{i:03d}"

    # Shape variation — squash/stretch
    sx = random.uniform(0.8, 1.2)
    sy = random.uniform(0.8, 1.2)
    sz = random.uniform(0.65, 1.15)
    p.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)

    # Very subtle deformation
    bm = bmesh.new()
    bm.from_mesh(p.data)
    strength = base_r * 0.08  # proportional to size
    for v in bm.verts:
        v.co.x += random.uniform(-strength, strength)
        v.co.y += random.uniform(-strength, strength)
        v.co.z += random.uniform(-strength * 0.7, strength * 0.7)
    bm.to_mesh(p.data)
    bm.free()

    bpy.ops.object.shade_smooth()
    p.data.materials.append(mat)

    # Position in pile
    angle = random.uniform(0, 2 * math.pi)
    r = pile_radius * math.sqrt(random.uniform(0, 1))
    falloff = max(0, 1.0 - (r / pile_radius) ** 1.3)
    h = random.uniform(0, 0.15 * falloff)

    p.location = (r * math.cos(angle), r * math.sin(angle), h)
    p.rotation_euler = (
        random.uniform(0, math.pi * 2),
        random.uniform(0, math.pi * 2),
        random.uniform(0, math.pi * 2),
    )
    all_pellets.append(p)

# Ground-seat
bpy.context.view_layer.update()
for p in all_pellets:
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
tc = tree.nodes.new("ShaderNodeTexCoord")
out = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc.outputs["Generated"], mapping_node.inputs["Vector"])
tree.links.new(mapping_node.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], out.inputs["Surface"])


# === LIGHTING ===
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
key_obj.rotation_euler = (Vector((0, 0, 0.1)) - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
accent_obj.rotation_euler = (Vector((0, 0, 0.1)) - accent_obj.location).to_track_quat('-Z', 'Y').to_euler()


# === CAMERA ===
# Same setup as the v6 smoke test that worked — similar scale objects
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

dist = 3.0
az = math.radians(30)
el = math.radians(30)
target = Vector((0, 0, 0.08))
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
print(f"GOLD GRAIN V5 COMPLETE: {OUTPUT_PATH}")
