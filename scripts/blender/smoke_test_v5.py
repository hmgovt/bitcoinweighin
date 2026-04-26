"""Smoke test v5: HDRI-only lighting — all reflections carry gold colour."""
import bpy
import math
import os

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/_smoke_test_v5.png")

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

# --- Gold material ---
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.766, 0.336, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.20  # slightly more diffuse spread
bsdf.inputs["Specular"].default_value = 0.5
cube.data.materials.append(mat)

# --- HDRI only — no additional lights ---
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

# Warm-tint the HDRI by multiplying with a gold tone
bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 2.5  # strong — sole light source

env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)

# Rotate HDRI
mapping = tree.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(75))
tex_coord = tree.nodes.new("ShaderNodeTexCoord")

# Warm tint: multiply HDRI with a warm colour to push gold into reflections
mix_rgb = tree.nodes.new("ShaderNodeMixRGB")
mix_rgb.blend_type = 'MULTIPLY'
mix_rgb.inputs["Fac"].default_value = 0.15  # subtle warm push
mix_rgb.inputs["Color2"].default_value = (1.0, 0.9, 0.7, 1.0)  # warm gold tint

output = tree.nodes.new("ShaderNodeOutputWorld")

tree.links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
tree.links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], mix_rgb.inputs["Color1"])
tree.links.new(mix_rgb.outputs["Color"], bg.inputs["Color"])
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

# --- Render ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 128
scene.render.resolution_x = 300
scene.render.resolution_y = 300
scene.render.film_transparent = True
scene.cycles.use_denoising = True

# Use Filmic with medium-high contrast for richer tones
scene.view_settings.view_transform = 'Filmic'
scene.view_settings.look = 'Medium High Contrast'

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"SMOKE TEST V5 COMPLETE: {OUTPUT_PATH}")
