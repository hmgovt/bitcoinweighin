"""Gold Coin — single coin, three-quarter rig. Production render.

Uses the sourced coin model (GLTF import).
"""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
COIN_GLTF = os.path.join(PROJECT, "assets/blender/gold_coin/scene.gltf")
OUTPUT_SPRITE = os.path.join(PROJECT, "static/sprites/gold/coin@2x.png")
OUTPUT_SHADOW = os.path.join(PROJECT, "static/sprites/gold/coin-shadow@2x.png")
OUTPUT_BLEND = os.path.join(PROJECT, "assets/blender/gold/coin.blend")

os.makedirs(os.path.join(PROJECT, "assets/blender/gold"), exist_ok=True)

# --- Clear ---
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

# === IMPORT COIN ===
bpy.ops.import_scene.gltf(filepath=COIN_GLTF)
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
coin = meshes[0]
coin.name = "GoldCoin"

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = coin
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        obj.select_set(True)
bpy.ops.object.delete()

# Join multiple mesh parts if present
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
if len(meshes) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    coin = bpy.context.active_object
else:
    coin = meshes[0]

coin.name = "GoldCoin"
bpy.ops.object.select_all(action='DESELECT')
coin.select_set(True)
bpy.context.view_layer.objects.active = coin
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

dims = coin.dimensions
print(f"Coin dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Scale: normalise diameter to 0.3 BU
max_dim = max(dims.x, dims.y)
sf = 0.3 / max_dim
coin.scale = (sf, sf, sf)
bpy.ops.object.transform_apply(scale=True)

dims = coin.dimensions
print(f"Scaled: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Ensure coin lies flat (Z is thinnest)
if dims.z > min(dims.x, dims.y):
    if dims.x < dims.y and dims.x < dims.z:
        coin.rotation_euler = (0, math.radians(90), 0)
    elif dims.y < dims.x and dims.y < dims.z:
        coin.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    dims = coin.dimensions

bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
coin.location = (0, 0, 0)
bpy.context.view_layer.update()
bbox = [coin.matrix_world @ Vector(c) for c in coin.bound_box]
min_z = min(v.z for v in bbox)
coin.location.z -= min_z
bpy.ops.object.transform_apply(location=True)
dims = coin.dimensions

# === GOLD MATERIAL ===
coin.data.materials.clear()
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

bsdf.inputs["Base Color"].default_value = (1.0, 0.77, 0.34, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.15
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 200.0
noise.inputs["Detail"].default_value = 14.0
noise.inputs["Roughness"].default_value = 0.5
links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

bump_node = nodes.new("ShaderNodeBump")
bump_node.inputs["Strength"].default_value = 0.015
bump_node.inputs["Distance"].default_value = 0.0001
links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

rn = nodes.new("ShaderNodeTexNoise")
rn.inputs["Scale"].default_value = 10.0
rn.inputs["Detail"].default_value = 3.0
rm = nodes.new("ShaderNodeMapRange")
rm.inputs["From Min"].default_value = 0.0
rm.inputs["From Max"].default_value = 1.0
rm.inputs["To Min"].default_value = 0.12
rm.inputs["To Max"].default_value = 0.20
links.new(tex_coord.outputs["Object"], rn.inputs["Vector"])
links.new(rn.outputs["Fac"], rm.inputs["Value"])
links.new(rm.outputs["Result"], bsdf.inputs["Roughness"])

coin.data.materials.append(mat)
bpy.ops.object.shade_smooth()

bpy.context.view_layer.update()
bbox = [coin.matrix_world @ Vector(c) for c in coin.bound_box]
min_z = min(v.z for v in bbox)
coin.location.z -= min_z

# === HDRI ===
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
bg.inputs["Strength"].default_value = 1.0
env_tex = tree.nodes.new("ShaderNodeTexEnvironment")
env_tex.image = bpy.data.images.load(HDRI_PATH)
mn = tree.nodes.new("ShaderNodeMapping")
mn.inputs["Rotation"].default_value = (0, 0, math.radians(45))
tc = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc.outputs["Generated"], mn.inputs["Vector"])
tree.links.new(mn.outputs["Vector"], env_tex.inputs["Vector"])
tree.links.new(env_tex.outputs["Color"], bg.inputs["Color"])
tree.links.new(bg.outputs["Background"], out_node.inputs["Surface"])

# === LIGHTING ===
target_pt = Vector((0, 0, dims.z / 2))

key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 100
key_data.size = 1.5
key_data.color = (1.0, 0.92, 0.78)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.0, -1.5, 2.0)
key_obj.rotation_euler = (target_pt - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 50
fill_data.size = 2.5
fill_data.color = (1.0, 0.95, 0.85)
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (1.2, 0.5, 0.6)
fill_obj.rotation_euler = (target_pt - fill_obj.location).to_track_quat('-Z', 'Y').to_euler()

rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 35
rim_data.size = 1.0
rim_data.color = (1.0, 0.88, 0.7)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (-0.8, 1.0, 1.2)
rim_obj.rotation_euler = (target_pt - rim_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === CAMERA ===
cam_data = bpy.data.cameras.new(name="ThreeQuarterCam")
cam_obj = bpy.data.objects.new("ThreeQuarterCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'PERSP'
cam_data.lens = 50

dist = 0.8
az = math.radians(30)
el = math.radians(25)
cam_target = Vector((0, 0, dims.z / 2))

cam_obj.location = (
    dist * math.cos(el) * math.sin(az) + cam_target.x,
    -dist * math.cos(el) * math.cos(az) + cam_target.y,
    dist * math.sin(el) + cam_target.z
)
cam_obj.rotation_euler = (cam_target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === RENDER ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 256
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

scene.render.filepath = OUTPUT_SPRITE
bpy.ops.render.render(write_still=True)
print(f"Coin sprite: {OUTPUT_SPRITE}")

# === SHADOW ===
bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, 0))
ground = bpy.context.active_object
ground.is_shadow_catcher = True
scene.render.filepath = OUTPUT_SHADOW
bpy.ops.render.render(write_still=True)
print(f"Shadow: {OUTPUT_SHADOW}")

bpy.ops.object.select_all(action='DESELECT')
ground.select_set(True)
bpy.ops.object.delete()

# === SAVE ===
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
print("DONE: coin")
