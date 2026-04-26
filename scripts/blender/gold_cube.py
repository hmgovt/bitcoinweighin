"""Gold Cube — production render for cube-mode pivot (2026-04-25).

Authors a 100 mm gold cube against the locked PBR material from
gold_good_delivery_single_final.py (warm yellow, procedural noise +
bump, micro-variation in roughness 0.15–0.28). Slight edge bevel
prevents the "razor-sharp" plastic look. Renders main sprite +
contact shadow. Saves .blend source file.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender \\
    --background \\
    --python scripts/blender/gold_cube.py
"""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
OUTPUT_SPRITE = os.path.join(PROJECT, "static/sprites/gold/cube@2x.png")
OUTPUT_SHADOW = os.path.join(PROJECT, "static/sprites/gold/cube-shadow@2x.png")
OUTPUT_BLEND = os.path.join(PROJECT, "assets/blender/gold/cube.blend")

os.makedirs(os.path.join(PROJECT, "assets/blender/gold"), exist_ok=True)
os.makedirs(os.path.join(PROJECT, "static/sprites/gold"), exist_ok=True)

# --- Clear scene ---
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

# === CUBE ===
# Authored at edge length 0.5 m in Blender units to match the lighting
# rig's energy values (which assume the longest dim ≈ 0.5 m). The CSS
# layer scales the sprite at runtime — this is just the canonical render.
EDGE = 0.5
bpy.ops.mesh.primitive_cube_add(size=EDGE, location=(0, 0, EDGE / 2))
cube = bpy.context.active_object
cube.name = "GoldCube"

# Bevel modifier — slight, but enough that the corners catch a highlight
# instead of being a perfect razor edge. Real cast gold has rounded edges.
bevel = cube.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.006        # 6 mm at canonical scale (1.2% of edge)
bevel.segments = 4
bevel.profile = 0.7        # slightly squarer than circular
bpy.context.view_layer.objects.active = cube
bpy.ops.object.modifier_apply(modifier=bevel.name)

# Apply transforms so noise textures sample stably
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# === GOLD MATERIAL (locked from gold_good_delivery_single_final.py) ===
cube.data.materials.clear()
mat = bpy.data.materials.new(name="Gold_24k")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

# Warm yellow base, fully metallic, soft-cast roughness
bsdf.inputs["Base Color"].default_value = (1.0, 0.77, 0.34, 1.0)
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.20
bsdf.inputs["Specular"].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

# Fine-grain bump — micro-texture invisible at canonical render but
# kills the "perfectly smooth plastic" feel at any zoom.
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

# Macro roughness variation — gives the cast-gold mottle.
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

cube.data.materials.append(mat)
bpy.ops.object.shade_smooth()
# Use auto-smooth so the bevels stay crisp but the faces stay flat
cube.data.use_auto_smooth = True
cube.data.auto_smooth_angle = math.radians(30)

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

# === LIGHTING (locked) ===
target = Vector((0, 0, EDGE / 2))

key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 120
key_data.size = 2.0
key_data.color = (1.0, 0.92, 0.78)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.2, -1.5, 2.5)
key_obj.rotation_euler = (target - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 60
fill_data.size = 3.0
fill_data.color = (1.0, 0.95, 0.85)
fill_obj = bpy.data.objects.new("FillLight", fill_data)
bpy.context.collection.objects.link(fill_obj)
fill_obj.location = (1.5, 0.5, 0.8)
fill_obj.rotation_euler = (target - fill_obj.location).to_track_quat('-Z', 'Y').to_euler()

rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 40
rim_data.size = 1.5
rim_data.color = (1.0, 0.88, 0.7)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (-1.0, 1.2, 1.5)
rim_obj.rotation_euler = (target - rim_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === CAMERA — three-quarter rig (25° elevation, 30° azimuth, 50 mm) ===
cam_data = bpy.data.cameras.new(name="ThreeQuarterCam")
cam_obj = bpy.data.objects.new("ThreeQuarterCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'PERSP'
cam_data.lens = 50

# Camera distance was 1.0 in the original render, which framed the
# cube edge-to-edge with effectively zero transparent margin. The
# bottom and left edges were truncated against the PNG canvas, so
# CSS scaling could never recover a clean silhouette. Pulled back to
# 1.55 so the cube occupies roughly 65–70% of the canvas with clear
# transparent margin on all four sides. The shadow render below
# inherits this same camera, so cube and shadow stay framed
# identically — drift between the two would misalign the contact
# shadow underneath the cube on the page.
dist = 1.55
az = math.radians(30)
el = math.radians(25)
cam_target = Vector((0, 0, EDGE / 2))

cam_obj.location = (
    dist * math.cos(el) * math.sin(az) + cam_target.x,
    -dist * math.cos(el) * math.cos(az) + cam_target.y,
    dist * math.sin(el) + cam_target.z
)
cam_obj.rotation_euler = (cam_target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === RENDER SETTINGS ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 512
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

# === RENDER MAIN ===
scene.render.filepath = OUTPUT_SPRITE
bpy.ops.render.render(write_still=True)
print(f"Main sprite: {OUTPUT_SPRITE}")

# === RENDER CONTACT SHADOW ===
# Add a shadow catcher plane and hide the cube from the camera so the
# resulting PNG is *only* the shadow on the otherwise-transparent plane.
# Without `visible_camera = False`, the cube renders into the shadow PNG
# too, which would double-render the cube when stacked behind the main
# sprite via mix-blend-mode: multiply.
bpy.ops.mesh.primitive_plane_add(size=5, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "ShadowGround"
ground.is_shadow_catcher = True

cube.visible_camera = False  # invisible to camera, still casts shadow

scene.render.filepath = OUTPUT_SHADOW
bpy.ops.render.render(write_still=True)
print(f"Shadow: {OUTPUT_SHADOW}")

cube.visible_camera = True  # restore for blend-file save

bpy.ops.object.select_all(action='DESELECT')
ground.select_set(True)
bpy.ops.object.delete()

# === SAVE BLEND ===
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
print(f"Blend: {OUTPUT_BLEND}")
print("DONE: gold cube production render")
