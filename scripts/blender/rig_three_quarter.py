"""Create the three-quarter camera rig template.

Spec: 25° elevation, 30° azimuth, perspective 50mm.
HDRI: studio_small_09_4k.exr
Saves to assets/blender/_rigs/three_quarter.blend
"""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_BLEND = os.path.join(PROJECT, "assets/blender/_rigs/three_quarter.blend")

# --- Clear scene ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)
for block in bpy.data.cameras:
    if block.users == 0:
        bpy.data.cameras.remove(block)
for block in bpy.data.lights:
    if block.users == 0:
        bpy.data.lights.remove(block)

# === HDRI ENVIRONMENT ===
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.6

env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)

mapping = tree.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(75))

tex_coord = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")

tree.links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
tree.links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], out_node.inputs["Surface"])

# === KEY LIGHT ===
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 100
key_data.size = 2.0
key_data.color = (1.0, 0.95, 0.85)  # ~5500K warm white
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.0)
target = Vector((0, 0, 0))
direction = target - key_obj.location
key_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# === FILL LIGHT (subtle) ===
fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 30
fill_data.size = 3.0
fill_data.color = (0.9, 0.92, 1.0)  # cool fill
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (-2.0, 1.0, 1.5)
direction = target - fill_obj.location
fill_obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

# === CAMERA ===
# Three-quarter: 25° elevation, 30° azimuth, perspective 50mm
cam_data = bpy.data.cameras.new(name="ThreeQuarterCam")
cam_obj = bpy.data.objects.new("ThreeQuarterCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'PERSP'
cam_data.lens = 50  # 50mm per spec

dist = 2.5
az = math.radians(30)   # 30° azimuth
el = math.radians(25)   # 25° elevation

cam_obj.location = (
    dist * math.cos(el) * math.sin(az),
    -dist * math.cos(el) * math.cos(az),
    dist * math.sin(el)
)
cam_obj.rotation_euler = (target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === RENDER SETTINGS ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 512
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

# === SAVE ===
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
print(f"Three-quarter rig saved: {OUTPUT_BLEND}")
