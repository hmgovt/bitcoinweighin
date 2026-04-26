"""Smoke test v3: find the sweet spot — warm HDRI, mid roughness, richer gold."""
import bpy
import math
import os

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")  # warm product shot
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/_smoke_test_v3.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# --- Cube with bevel for edge highlights ---
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
cube = bpy.context.active_object
cube.name = "GoldCube"

# Add bevel modifier for soft edges that catch light
bevel = cube.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.03
bevel.segments = 3

# --- Gold PBR material ---
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
# Richer gold: slightly more saturated than pure #FFD700 linear
bsdf.inputs["Base Color"].default_value = (1.0, 0.71, 0.29, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.18  # sweet spot: lustrous but not a mirror
# Add slight specular tint to push warmth into highlights
bsdf.inputs["Specular"].default_value = 0.5
cube.data.materials.append(mat)

# --- HDRI: warm studio, rotated to break flat reflections ---
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 1.5  # bright enough to light the gold warmly
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

# --- Camera: 30° elevation, 30° azimuth ---
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

# --- Key light: area light for softer, broader specular ---
light_data = bpy.data.lights.new(name="KeyLight", type='AREA')
light_data.energy = 200  # area lights need more energy
light_data.size = 2.0  # large soft source
light_data.color = (1.0, 0.95, 0.9)
light_obj = bpy.data.objects.new("KeyLight", light_data)
bpy.context.collection.objects.link(light_obj)
light_obj.location = (2.0, -1.5, 3.0)
direction = Vector((0, 0, 0.5)) - light_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
light_obj.rotation_euler = rot_quat.to_euler()

# --- Rim light: catches edges, adds dimension ---
rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 80
rim_data.size = 1.0
rim_data.color = (1.0, 0.98, 0.95)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (-2.0, 1.0, 2.0)
direction = Vector((0, 0, 0.5)) - rim_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
rim_obj.rotation_euler = rot_quat.to_euler()

# --- Render settings ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 128  # more samples for cleaner metal
scene.render.resolution_x = 300
scene.render.resolution_y = 300
scene.render.film_transparent = True

# Denoising
scene.cycles.use_denoising = True

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"SMOKE TEST V3 COMPLETE: {OUTPUT_PATH}")
