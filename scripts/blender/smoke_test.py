"""Smoke test: render a gold-coloured cube with HDRI lighting and transparent background."""
import bpy
import os

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/_smoke_test.png")

# --- Clear default scene ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# --- Add a cube (stand-in geometry) ---
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
cube = bpy.context.active_object
cube.name = "GoldCube"

# --- Gold PBR material ---
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
# Base colour: #FFD700 in linear sRGB
bsdf.inputs["Base Color"].default_value = (1.0, 0.77, 0.34, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.12
cube.data.materials.append(mat)

# --- HDRI environment ---
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)
output = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], output.inputs["Surface"])
bg.inputs["Strength"].default_value = 1.0

# --- Camera: three-quarter angle (~25° elev, ~30° azimuth) ---
import math
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

# Position camera: ~30° azimuth, ~25° elevation, distance ~3.5
dist = 3.5
az = math.radians(30)
el = math.radians(25)
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + 0.5  # offset for cube centre at 0.5
cam_obj.location = (cam_x, cam_y, cam_z)

# Point camera at cube centre
from mathutils import Vector
direction = Vector((0, 0, 0.5)) - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

cam_data.lens = 85  # portrait lens for product shot

# --- Key light (sun, 5500K) ---
light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
light_data.energy = 3.0
# 5500K colour temperature approximation
light_data.color = (1.0, 0.95, 0.9)
light_obj = bpy.data.objects.new("KeyLight", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.rotation_euler = (math.radians(45), math.radians(15), math.radians(-30))

# --- Render settings ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64  # low for smoke test
scene.render.resolution_x = 200
scene.render.resolution_y = 200
scene.render.film_transparent = True  # transparent background

# Output
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

# --- Render ---
bpy.ops.render.render(write_still=True)
print(f"SMOKE TEST COMPLETE: {OUTPUT_PATH}")
