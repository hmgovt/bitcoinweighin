"""Gold Good Delivery Single v3 — brighten front face, fill frame more.

Changes from v2:
- Camera dist 1.0 (was 1.2)
- Fill light repositioned to illuminate the front face
- Try brown_photostudio HDRI (metal-friendly)
- HDRI strength 1.0
"""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
BAR_GLTF = os.path.join(PROJECT, "assets/blender/gold_bar_single/scene.gltf")
OUTPUT_SPRITE = os.path.join(PROJECT, "static/sprites/gold/good_delivery_single@2x.png")

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

# === IMPORT ===
bpy.ops.import_scene.gltf(filepath=BAR_GLTF)
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
bar = meshes[0]
bar.name = "GoodDeliveryBar"

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bar
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        obj.select_set(True)
bpy.ops.object.delete()

bpy.ops.object.select_all(action='DESELECT')
bar.select_set(True)
bpy.context.view_layer.objects.active = bar
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

dims = bar.dimensions
max_dim = max(dims.x, dims.y, dims.z)
if max_dim > 0:
    sf = 0.5 / max_dim
    bar.scale = (sf, sf, sf)
    bpy.ops.object.transform_apply(scale=True)

bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
bar.location = (0, 0, 0)
bpy.context.view_layer.update()
bbox = [bar.matrix_world @ Vector(corner) for corner in bar.bound_box]
min_z = min(v.z for v in bbox)
bar.location.z -= min_z
bpy.ops.object.transform_apply(location=True)

dims = bar.dimensions

# === EMBOSS TEXT ===
bpy.ops.object.text_add(location=(0, 0, 0))
text_obj = bpy.context.active_object
text_obj.data.body = "400 oz"
text_obj.data.align_x = 'CENTER'
text_obj.data.align_y = 'CENTER'

bpy.context.view_layer.update()
bar_verts_world = [bar.matrix_world @ v.co for v in bar.data.vertices]
max_z = max(v.z for v in bar_verts_world)
top_verts = [v for v in bar_verts_world if v.z > max_z - 0.005]
top_cx = (min(v.x for v in top_verts) + max(v.x for v in top_verts)) / 2
top_cy = (min(v.y for v in top_verts) + max(v.y for v in top_verts)) / 2
top_length = max(v.y for v in top_verts) - min(v.y for v in top_verts)

text_obj.data.size = top_length * 0.08
text_obj.data.extrude = 0.003
bpy.ops.object.convert(target='MESH')
text_obj.rotation_euler = (0, 0, math.radians(90))
bpy.ops.object.transform_apply(rotation=True)
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
text_obj.location = (top_cx, top_cy, max_z - 0.001)

bpy.ops.object.select_all(action='DESELECT')
text_obj.select_set(True)
bar.select_set(True)
bpy.context.view_layer.objects.active = bar
bpy.ops.object.join()
bar = bpy.context.active_object
bar.name = "GoodDeliveryBar"

# === GOLD MATERIAL ===
bar.data.materials.clear()
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

bsdf.inputs["Base Color"].default_value = (1.0, 0.77, 0.34, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.20
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 120.0
noise.inputs["Detail"].default_value = 12.0
noise.inputs["Roughness"].default_value = 0.6
links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

bump_node = nodes.new("ShaderNodeBump")
bump_node.inputs["Strength"].default_value = 0.025
bump_node.inputs["Distance"].default_value = 0.0002
links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

rn = nodes.new("ShaderNodeTexNoise")
rn.inputs["Scale"].default_value = 6.0
rn.inputs["Detail"].default_value = 4.0
rm = nodes.new("ShaderNodeMapRange")
rm.inputs["From Min"].default_value = 0.0
rm.inputs["From Max"].default_value = 1.0
rm.inputs["To Min"].default_value = 0.15
rm.inputs["To Max"].default_value = 0.28
links.new(tex_coord.outputs["Object"], rn.inputs["Vector"])
links.new(rn.outputs["Fac"], rm.inputs["Value"])
links.new(rm.outputs["Result"], bsdf.inputs["Roughness"])

bar.data.materials.append(mat)
bpy.ops.object.shade_smooth()

bpy.context.view_layer.update()
bbox = [bar.matrix_world @ Vector(corner) for corner in bar.bound_box]
min_z = min(v.z for v in bbox)
bar.location.z -= min_z

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
target = Vector((0, 0, dims.z / 2))

key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.92, 0.78)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.2, -1.5, 2.5)
key_obj.rotation_euler = (target - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

# Fill light now in front-left to illuminate the visible front face
fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 60
fill_data.size = 3.0
fill_data.color = (1.0, 0.95, 0.85)
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (1.5, 0.5, 0.8)  # front-left, low
fill_obj.rotation_euler = (target - fill_obj.location).to_track_quat('-Z', 'Y').to_euler()

# Back rim for edge separation
rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 40
rim_data.size = 1.5
rim_data.color = (1.0, 0.88, 0.7)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (-1.0, 1.2, 1.5)
rim_obj.rotation_euler = (target - rim_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === CAMERA ===
cam_data = bpy.data.cameras.new(name="ThreeQuarterCam")
cam_obj = bpy.data.objects.new("ThreeQuarterCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'PERSP'
cam_data.lens = 50

dist = 1.0
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
print(f"V3 sprite: {OUTPUT_SPRITE}")
