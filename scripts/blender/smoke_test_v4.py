"""Smoke test v4: richer gold, tamed lighting, warmer overall."""
import bpy
import math
import os

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/_smoke_test_v4.png")

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

# --- Gold material: richer, warmer ---
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
# Real gold F0 from measured data: (1.0, 0.766, 0.336) in linear
# Push slightly warmer/more saturated for visual punch
bsdf.inputs["Base Color"].default_value = (1.0, 0.766, 0.336, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.15
bsdf.inputs["Specular"].default_value = 0.5
cube.data.materials.append(mat)

# --- HDRI: warm studio, rotated ---
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 0.8  # pull back — let area lights dominate
env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)

mapping = tree.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(60))
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

# --- Key light: warm area light, positioned for a nice top-edge specular ---
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 150
key_data.size = 2.5  # large soft source
key_data.color = (1.0, 0.93, 0.85)  # warm, like a gold-tinted softbox
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
direction = Vector((0, 0, 0.5)) - key_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
key_obj.rotation_euler = rot_quat.to_euler()

# --- Fill light: much weaker, just lifts shadows ---
fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 30  # very subtle
fill_data.size = 3.0
fill_data.color = (1.0, 0.95, 0.9)
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (-2.5, 1.0, 1.5)
direction = Vector((0, 0, 0.5)) - fill_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
fill_obj.rotation_euler = rot_quat.to_euler()

# --- Render ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 128
scene.render.resolution_x = 300
scene.render.resolution_y = 300
scene.render.film_transparent = True
scene.cycles.use_denoising = True

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"SMOKE TEST V4 COMPLETE: {OUTPUT_PATH}")
