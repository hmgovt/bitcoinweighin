"""Gold bar v2 — import model, emboss weight text on top surface."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
BAR_GLTF = os.path.join(PROJECT, "assets/blender/gold_bar_single/scene.gltf")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/bar_test_v10.png")

BAR_LABEL = "1 KILO"  # test with largest text to check readability

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)

# === IMPORT ===
bpy.ops.import_scene.gltf(filepath=BAR_GLTF)

meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
bar = meshes[0]
bar.name = "GoldBar"

# Clear parent, keep transform
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bar
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

# Delete non-mesh
bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        obj.select_set(True)
bpy.ops.object.delete()

# Apply transforms
bpy.ops.object.select_all(action='DESELECT')
bar.select_set(True)
bpy.context.view_layer.objects.active = bar
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

dims = bar.dimensions
print(f"Bar dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Scale to ~0.5 units longest axis
max_dim = max(dims.x, dims.y, dims.z)
if max_dim > 0:
    sf = 0.5 / max_dim
    bar.scale = (sf, sf, sf)
    bpy.ops.object.transform_apply(scale=True)

dims = bar.dimensions
print(f"Scaled bar dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Centre and ground
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
bar.location = (0, 0, 0)
bpy.context.view_layer.update()
bbox = [bar.matrix_world @ Vector(corner) for corner in bar.bound_box]
min_z = min(v.z for v in bbox)
bar.location.z -= min_z
bpy.ops.object.transform_apply(location=True)

dims = bar.dimensions
print(f"Final bar dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Find the top face vertices to get exact top surface bounds
bpy.context.view_layer.update()
bar_verts_world = [bar.matrix_world @ v.co for v in bar.data.vertices]
max_z = max(v.z for v in bar_verts_world)
# Top face verts: those near max_z (within tolerance for the tapered top)
top_verts = [v for v in bar_verts_world if v.z > max_z - 0.005]
top_min_x = min(v.x for v in top_verts)
top_max_x = max(v.x for v in top_verts)
top_min_y = min(v.y for v in top_verts)
top_max_y = max(v.y for v in top_verts)
top_cx = (top_min_x + top_max_x) / 2
top_cy = (top_min_y + top_max_y) / 2
top_width = top_max_x - top_min_x
top_length = top_max_y - top_min_y
print(f"Top face: centre=({top_cx:.4f}, {top_cy:.4f}), w={top_width:.4f}, l={top_length:.4f}, z={max_z:.4f}")


# === EMBOSS TEXT ===
bpy.ops.object.text_add(location=(0, 0, 0))
text_obj = bpy.context.active_object
text_obj.name = "BarLabel"
text_obj.data.body = BAR_LABEL
text_obj.data.align_x = 'CENTER'
text_obj.data.align_y = 'CENTER'

# Size to fit ~65% of top face length
text_obj.data.size = top_length * 0.65 / max(len(BAR_LABEL), 1) * 1.4
text_obj.data.extrude = 0.004

# Convert to mesh, then rotate so chars run along Y and extrude along Z
bpy.ops.object.convert(target='MESH')
text_obj.rotation_euler = (0, 0, math.radians(90))
bpy.ops.object.transform_apply(rotation=True)

# Centre text mesh on its own bounding box
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

# Place text so its bounding box centre aligns with top face centre
text_obj.location = (top_cx, top_cy, max_z - 0.002)

print(f"Text dims: {text_obj.dimensions}")
print(f"Text loc: {text_obj.location}")

# === APPROACH: raised text (simpler, more reliable than boolean) ===
# Join text mesh with bar — the text sits proud on the surface like a real stamp

# Apply gold material to text first
# We'll join them so they share the bar's material
bpy.ops.object.select_all(action='DESELECT')
text_obj.select_set(True)
bar.select_set(True)
bpy.context.view_layer.objects.active = bar
bpy.ops.object.join()
bar = bpy.context.active_object
bar.name = "GoldBar"


# === GOLD MATERIAL ===
# Clear existing materials and apply fresh gold
bar.data.materials.clear()

mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.25
bsdf.inputs["Specular"].default_value = 0.5

# Fine noise bump for subtle surface grain
tex_coord = nodes.new("ShaderNodeTexCoord")
noise = nodes.new("ShaderNodeTexNoise")
noise.inputs["Scale"].default_value = 80.0
noise.inputs["Detail"].default_value = 10.0
noise.inputs["Roughness"].default_value = 0.7
links.new(tex_coord.outputs["Object"], noise.inputs["Vector"])

bump_node = nodes.new("ShaderNodeBump")
bump_node.inputs["Strength"].default_value = 0.03
bump_node.inputs["Distance"].default_value = 0.0003
links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])

# Subtle roughness variation
rn = nodes.new("ShaderNodeTexNoise")
rn.inputs["Scale"].default_value = 5.0
rn.inputs["Detail"].default_value = 3.0
rm = nodes.new("ShaderNodeMapRange")
rm.inputs["From Min"].default_value = 0.0
rm.inputs["From Max"].default_value = 1.0
rm.inputs["To Min"].default_value = 0.20
rm.inputs["To Max"].default_value = 0.30
links.new(tex_coord.outputs["Object"], rn.inputs["Vector"])
links.new(rn.outputs["Fac"], rm.inputs["Value"])
links.new(rm.outputs["Result"], bsdf.inputs["Roughness"])

bar.data.materials.append(mat)

bpy.ops.object.shade_smooth()

# No rotation — bar stays axis-aligned so text reads cleanly
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
dist = 2.0
az = math.radians(30)
el = math.radians(35)
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
print(f"GOLD BAR V2: {OUTPUT_PATH}")
