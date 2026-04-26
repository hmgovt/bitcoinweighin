"""Smoke test v6: abandon physics, chase the gold read."""
import bpy
import math
import os

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/_smoke_test_v6.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# --- Cube with bevel ---
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
cube = bpy.context.active_object
cube.name = "GoldCube"

bevel = cube.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.03
bevel.segments = 3

# --- Gold material: oversaturated for screen read ---
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
# Push well past measured F0 — we want this to scream "gold"
bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.25  # more diffuse = more colour visible
bsdf.inputs["Specular"].default_value = 0.5
cube.data.materials.append(mat)

# --- HDRI: low strength, fill only ---
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.5  # fill only

env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)

mapping = tree.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(75))
tex_coord = tree.nodes.new("ShaderNodeTexCoord")

output = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
tree.links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], output.inputs["Surface"])

# --- Camera ---
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

dist = 3.0
az = math.radians(30)
el = math.radians(30)
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + 0.5
cam_obj.location = (cam_x, cam_y, cam_z)

from mathutils import Vector
direction = Vector((0, 0, 0.5)) - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
cam_data.lens = 85

# --- Key light: gold-tinted area light so specular highlights read warm ---
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)  # explicitly gold-tinted light
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
direction = Vector((0, 0, 0.5)) - key_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
key_obj.rotation_euler = rot_quat.to_euler()

# --- Accent light from below-side: warm, adds drama ---
accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)  # warm amber
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
direction = Vector((0, 0, 0.5)) - accent_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
accent_obj.rotation_euler = rot_quat.to_euler()

# --- Render ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 128
scene.render.resolution_x = 300
scene.render.resolution_y = 300
scene.render.film_transparent = True
scene.cycles.use_denoising = True

# Standard view transform — preserves saturation
scene.view_settings.view_transform = 'Standard'

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"SMOKE TEST V6 COMPLETE: {OUTPUT_PATH}")
