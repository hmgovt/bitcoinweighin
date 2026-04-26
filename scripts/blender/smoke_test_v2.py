"""Smoke test v2: more lustre, break top-face reflection, adjusted camera."""
import bpy
import math
import os

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/_smoke_test_v2.png")

# --- Clear default scene ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# --- Add a cube ---
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
cube = bpy.context.active_object
cube.name = "GoldCube"

# --- Gold PBR material (more lustrous) ---
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (1.0, 0.77, 0.34, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.05  # was 0.12 — much more mirror-like now
cube.data.materials.append(mat)

# --- HDRI environment (rotated to break flat top reflection) ---
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 1.2  # slightly brighter environment
env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)

# Rotate HDRI ~45° to break the flat top-face reflection
mapping = tree.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(45))
tex_coord = tree.nodes.new("ShaderNodeTexCoord")

output = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
tree.links.new(mapping.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], output.inputs["Surface"])

# --- Camera: raised elevation to ~30°, same azimuth ~30° ---
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

dist = 3.2  # slightly closer for more presence
az = math.radians(30)
el = math.radians(30)  # was 25° — less top-face dominance
cam_x = dist * math.cos(el) * math.sin(az)
cam_y = -dist * math.cos(el) * math.cos(az)
cam_z = dist * math.sin(el) + 0.5
cam_obj.location = (cam_x, cam_y, cam_z)

from mathutils import Vector
direction = Vector((0, 0, 0.5)) - cam_obj.location
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()
cam_data.lens = 85

# --- Key light: stronger, angled for specular edge highlight ---
light_data = bpy.data.lights.new(name="KeyLight", type='SUN')
light_data.energy = 5.0  # was 3.0
light_data.color = (1.0, 0.95, 0.9)  # 5500K
light_obj = bpy.data.objects.new("KeyLight", light_data)
bpy.context.collection.objects.link(light_obj)
# Angle to graze the top edge — creates a bright specular streak
light_obj.rotation_euler = (math.radians(55), math.radians(10), math.radians(-20))

# --- Fill light: subtle, opposite side, lifts shadow face ---
fill_data = bpy.data.lights.new(name="FillLight", type='SUN')
fill_data.energy = 1.5
fill_data.color = (0.95, 0.95, 1.0)  # slightly cool fill
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.rotation_euler = (math.radians(40), math.radians(-10), math.radians(150))

# --- Render settings ---
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 64
scene.render.resolution_x = 200
scene.render.resolution_y = 200
scene.render.film_transparent = True

scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = OUTPUT_PATH

bpy.ops.render.render(write_still=True)
print(f"SMOKE TEST V2 COMPLETE: {OUTPUT_PATH}")
