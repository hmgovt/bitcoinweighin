"""Gold coin v6 — Use Krugerrand photo as displacement map for face detail.
Photo brightness → geometry height on a high-poly disc."""
import bpy
import math
import os
import bmesh
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
KRUGERRAND_IMG = "/Users/tim50cycles/.claude/projects/-Users-tim50cycles-Projects-bitcoinweighin/077cda90-69ed-47f7-be1e-318a8db77d83/tool-results/webfetch-1777027185909-6t2yhg.jpg"
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_v6.png")

# --- Clear ---
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for block in bpy.data.meshes:
    if block.users == 0:
        bpy.data.meshes.remove(block)
for block in bpy.data.materials:
    if block.users == 0:
        bpy.data.materials.remove(block)

coin_radius = 0.3
coin_depth = 0.051


# === HIGH-POLY COIN DISC ===
# Need high vertex count so displacement has geometry to work with
bpy.ops.mesh.primitive_cylinder_add(
    vertices=256,
    radius=coin_radius,
    depth=coin_depth,
    location=(0, 0, coin_depth / 2)
)
coin = bpy.context.active_object
coin.name = "GoldCoin"

# Subdivide the top face heavily for displacement resolution
bpy.ops.object.mode_set(mode='EDIT')
bm = bmesh.from_edit_mesh(coin.data)
bm.faces.ensure_lookup_table()

# Select top face
top_faces = [f for f in bm.faces if all(abs(v.co.z - coin_depth/2) < 0.001 for v in f.verts)]
for f in bm.faces:
    f.select = False
for f in top_faces:
    f.select = True
bmesh.update_edit_mesh(coin.data)

# Inset for rim first
bpy.ops.mesh.inset(thickness=0.010, depth=-0.004)

# Subdivide the inner face for displacement detail
bpy.ops.mesh.subdivide(number_cuts=30)

bpy.ops.object.mode_set(mode='OBJECT')

# Add subdivision surface for smoothness
subsurf = coin.modifiers.new(name="Subsurf", type='SUBSURF')
subsurf.levels = 0  # viewport
subsurf.render_levels = 1  # render

bpy.ops.object.shade_smooth()


# === REEDED EDGE ===
num_reeds = 150
for i in range(num_reeds):
    angle = (2 * math.pi * i) / num_reeds
    bpy.ops.mesh.primitive_cube_add(size=1,
        location=((coin_radius + 0.0005) * math.cos(angle),
                  (coin_radius + 0.0005) * math.sin(angle),
                  coin_depth / 2))
    r = bpy.context.active_object
    r.name = f"Reed_{i:03d}"
    r.scale = (0.0012, 0.005, coin_depth * 0.55)
    r.rotation_euler.z = angle
    bpy.ops.object.transform_apply(scale=True)

# Join reeds to coin
bpy.ops.object.select_all(action='SELECT')
for obj in bpy.data.objects:
    if obj.type in ('CAMERA', 'LIGHT'):
        obj.select_set(False)
bpy.context.view_layer.objects.active = coin
bpy.ops.object.join()
coin = bpy.context.active_object
coin.name = "GoldCoin"
bpy.ops.object.shade_smooth()


# === GOLD MATERIAL WITH PHOTO DISPLACEMENT ===
mat = bpy.data.materials.new(name="Gold_24k_Coin")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.25
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

# Load Krugerrand photo as texture
coin_img = bpy.data.images.load(KRUGERRAND_IMG)
coin_tex = nodes.new("ShaderNodeTexImage")
coin_tex.image = coin_img

# Project the image onto the top face using generated coordinates
# Map from generated coords to a circular projection on the top face
mapping = nodes.new("ShaderNodeMapping")
mapping.inputs["Location"].default_value = (0.5, 0.5, 0.0)  # centre
mapping.inputs["Scale"].default_value = (1.0, 1.0, 1.0)
links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
links.new(mapping.outputs["Vector"], coin_tex.inputs["Vector"])

# Use photo as bump/normal for the relief detail
# Convert to greyscale for bump
rgb_to_bw = nodes.new("ShaderNodeRGBToBW")
links.new(coin_tex.outputs["Color"], rgb_to_bw.inputs["Color"])

bump = nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value = 0.6  # strong — this IS the face detail
bump.inputs["Distance"].default_value = 0.003
links.new(rgb_to_bw.outputs["Val"], bump.inputs["Height"])
links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

# Also use the photo to modulate roughness — raised areas slightly shinier
rough_map = nodes.new("ShaderNodeMapRange")
rough_map.inputs["From Min"].default_value = 0.0
rough_map.inputs["From Max"].default_value = 1.0
rough_map.inputs["To Min"].default_value = 0.30  # field (darker) = more matte
rough_map.inputs["To Max"].default_value = 0.18  # relief (brighter) = shinier
links.new(rgb_to_bw.outputs["Val"], rough_map.inputs["Value"])
links.new(rough_map.outputs["Result"], bsdf.inputs["Roughness"])

# Colour variation tied to relief — subtle
color_ramp = nodes.new("ShaderNodeValToRGB")
color_ramp.color_ramp.elements[0].color = (1.0, 0.58, 0.10, 1.0)  # field slightly darker
color_ramp.color_ramp.elements[0].position = 0.3
color_ramp.color_ramp.elements[1].color = (1.0, 0.68, 0.18, 1.0)  # relief slightly brighter
color_ramp.color_ramp.elements[1].position = 0.7
links.new(rgb_to_bw.outputs["Val"], color_ramp.inputs["Fac"])
links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])

coin.data.materials.append(mat)

# Tilt to show face
coin.rotation_euler = (math.radians(8), math.radians(-4), math.radians(12))

# Ground-seat
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
tc_w = tree.nodes.new("ShaderNodeTexCoord")
out_node = tree.nodes.new("ShaderNodeOutputWorld")
tree.links.new(tc_w.outputs["Generated"], mn.inputs["Vector"])
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


# === CAMERA — tighter framing ===
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
print(f"GOLD COIN V6: {OUTPUT_PATH}")
