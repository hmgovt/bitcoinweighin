"""Gold coin — import RenderX CC-BY model, apply our gold material, render."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
COIN_GLTF = os.path.join(PROJECT, "assets/blender/gold_coin/scene.gltf")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_import.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)

# === IMPORT GLTF ===
bpy.ops.import_scene.gltf(filepath=COIN_GLTF)

# Find imported mesh objects
imported = [obj for obj in bpy.context.selected_objects if obj.type == 'MESH']
print(f"Imported {len(imported)} mesh objects:")
for obj in imported:
    print(f"  {obj.name}: {len(obj.data.vertices)} verts, {len(obj.data.polygons)} faces")
    print(f"    Location: {obj.location}")
    print(f"    Scale: {obj.scale}")
    dims = obj.dimensions
    print(f"    Dimensions: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")
    print(f"    Materials: {[m.name for m in obj.data.materials]}")

# Also list all objects in scene
print(f"\nAll objects in scene:")
for obj in bpy.data.objects:
    print(f"  {obj.name} ({obj.type}) at {obj.location}, scale {obj.scale}")

# === CENTRE AND NORMALISE ===
# Join all mesh parts into one
if len(imported) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for obj in imported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = imported[0]
    bpy.ops.object.join()

coin = bpy.context.active_object
if coin is None:
    coin = [obj for obj in bpy.data.objects if obj.type == 'MESH'][0]
    bpy.context.view_layer.objects.active = coin

coin.name = "GoldCoin"

# Apply transforms
bpy.ops.object.select_all(action='DESELECT')
coin.select_set(True)
bpy.context.view_layer.objects.active = coin
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Get current dimensions and scale to target
dims = coin.dimensions
print(f"\nCoin dimensions after apply: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")
max_dim = max(dims.x, dims.y, dims.z)

# Scale coin so its diameter is ~0.6 units (matching our scene scale)
target_diameter = 0.6
scale_factor = target_diameter / max_dim if max_dim > 0 else 1.0
coin.scale = (scale_factor, scale_factor, scale_factor)
bpy.ops.object.transform_apply(scale=True)

dims = coin.dimensions
print(f"Coin dimensions after scaling: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Centre at origin
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
coin.location = (0, 0, 0)

# Sit on ground
bpy.context.view_layer.update()
bbox = [coin.matrix_world @ Vector(corner) for corner in coin.bound_box]
min_z = min(v.z for v in bbox)
coin.location.z -= min_z


# === REPLACE MATERIAL WITH OUR GOLD RECIPE ===
# Remove existing materials
coin.data.materials.clear()

mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.25
bsdf.inputs["Specular"].default_value = 0.5

coin.data.materials.append(mat)

# Slight tilt to show face detail
coin.rotation_euler = (math.radians(8), math.radians(-4), math.radians(12))

# Re-seat on ground
bpy.context.view_layer.update()
bbox = [coin.matrix_world @ Vector(corner) for corner in coin.bound_box]
min_z = min(v.z for v in bbox)
coin.location.z -= min_z


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
mn = tree.nodes.new("ShaderNodeMapping")
mn.inputs["Rotation"].default_value = (0, 0, math.radians(75))
tc = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc.outputs["Generated"], mn.inputs["Vector"])
tree.links.new(mn.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], out_node.inputs["Surface"])


# === LIGHTING ===
key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.85, 0.55)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.5, -2.0, 3.5)
key_obj.rotation_euler = (Vector((0, 0, 0.03)) - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

accent_data = bpy.data.lights.new(name="AccentLight", type='AREA')
accent_data.energy = 40
accent_data.size = 1.5
accent_data.color = (1.0, 0.75, 0.4)
accent_obj = bpy.data.objects.new("AccentLight", accent_data)
bpy.context.collection.objects.link(accent_obj)
accent_obj.location = (-1.5, 1.5, 0.5)
accent_obj.rotation_euler = (Vector((0, 0, 0.03)) - accent_obj.location).to_track_quat('-Z', 'Y').to_euler()


# === CAMERA ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj
dist = 2.2
az = math.radians(30)
el = math.radians(32)
target = Vector((0, 0, 0.03))
cam_obj.location = (dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), dist * math.sin(el) + target.z)
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
print(f"GOLD COIN IMPORT: {OUTPUT_PATH}")
