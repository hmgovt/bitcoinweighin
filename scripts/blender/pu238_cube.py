"""Pu-238 Cube — production render for cube-mode.

Authors a 100 mm Pu-238 cube that reads as self-illuminating: the cube
emits its own cherry-red/orange light, matching the appearance of actual
Pu-238 RTG fuel pellets photographed in darkness. The studio lights are
reduced to a very dim rim for edge definition; the environment is near-
black. CSS (CubeGlowOverlay) then amplifies toward orange-yellow at
higher masses and adds the outer atmospheric bloom + ground light pool.

Calibration target: the 1 BTC / ~16 g mark should look like a dull
cherry-red glow — visible warmth, clearly self-lit, but not blown out.
CSS carries it to bright orange-yellow at 100 BTC and above.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender \\
    --background \\
    --python scripts/blender/pu238_cube.py
"""
import bpy
import math
import os
from mathutils import Vector

# Derive project root from this script's location (scripts/blender/ → ../../)
_here = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(os.path.dirname(_here))

HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
OUTPUT_SPRITE = os.path.join(PROJECT, "static/sprites/pu238/cube@2x.png")
OUTPUT_SHADOW = os.path.join(PROJECT, "static/sprites/pu238/cube-shadow@2x.png")
OUTPUT_BLEND = os.path.join(PROJECT, "assets/blender/pu238/cube.blend")

os.makedirs(os.path.join(PROJECT, "assets/blender/pu238"), exist_ok=True)
os.makedirs(os.path.join(PROJECT, "static/sprites/pu238"), exist_ok=True)

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
EDGE = 0.5
bpy.ops.mesh.primitive_cube_add(size=EDGE, location=(0, 0, EDGE / 2))
cube = bpy.context.active_object
cube.name = "Pu238Cube"

bevel = cube.modifiers.new(name="Bevel", type='BEVEL')
bevel.width = 0.006
bevel.segments = 4
bevel.profile = 0.7
bpy.context.view_layer.objects.active = cube
bpy.ops.object.modifier_apply(modifier=bevel.name)

bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# === Pu-238 MATERIAL (per assets/materials-reference.md) ===
# Calibrated against the DOE Milliwatt RTG fuel-pellet reference
# photographs (lab sample; bottom/side/top views). Real Pu-238 metal at
# this finish reads as tarnished bullion silver with a faint warm cast
# — distinctly metallic, not the white-plaster look that landed when
# roughness was driven up to 0.30 with metalness 0.88. The oxide patina
# is subtle on lab samples (the dramatic dark patina in archival photos
# is decades-aged storage material, not what we want for a hero panel).
#
# Base values:
#   Color    (0.74, 0.72, 0.67) — silvery-grey, slightly warm-cooler
#                                 than fresh silver, before patina mix
#   Metallic 0.95                — close to noble metals; the 5f-shell
#                                 caveat is real but subtle at sprite scale
#   Roughness 0.18 (base)        — between silver mirror (0.08) and
#                                 platinum semi-matte (0.15)
#   Specular  0.5
cube.data.materials.clear()
mat = bpy.data.materials.new(name="Pu_238")
mat.use_nodes = True
nodes = mat.node_tree.nodes
links = mat.node_tree.links
bsdf = nodes["Principled BSDF"]

bsdf.inputs["Base Color"].default_value = (0.74, 0.72, 0.67, 1.0)
bsdf.inputs["Metallic"].default_value = 0.95
bsdf.inputs["Roughness"].default_value = 0.18
# "Specular" renamed to "Specular IOR Level" in Blender 4.0+
specular_key = "Specular IOR Level" if "Specular IOR Level" in bsdf.inputs else "Specular"
bsdf.inputs[specular_key].default_value = 0.5

tex_coord = nodes.new("ShaderNodeTexCoord")

# Fine-grain bump — back to the noble-metal standard. The reference
# samples don't show the industrial-finish bump strength I'd reached
# for; the surface is smooth metal with subtle micro-texture, not
# castings or rough machining.
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

# Macro roughness variation — tighter than the previous attempt
# (0.25–0.42 read as chalk). The 0.14–0.26 band sits between silver's
# 0.05–0.12 mirror polish and gold's pre-retune cast satin (0.15–0.28),
# matching the slight non-uniformity visible on the lab-sample side
# faces while keeping enough specular response to read as metal.
rn = nodes.new("ShaderNodeTexNoise")
rn.inputs["Scale"].default_value = 6.0
rn.inputs["Detail"].default_value = 4.0
rm = nodes.new("ShaderNodeMapRange")
rm.inputs["From Min"].default_value = 0.0
rm.inputs["From Max"].default_value = 1.0
rm.inputs["To Min"].default_value = 0.14
rm.inputs["To Max"].default_value = 0.26
links.new(tex_coord.outputs["Object"], rn.inputs["Vector"])
links.new(rn.outputs["Fac"], rm.inputs["Value"])
links.new(rm.outputs["Result"], bsdf.inputs["Roughness"])

# Subtle base-colour variation — keeps the surface from reading as flat
# grey. Patina tint pulled lighter and warmer (0.66, 0.62, 0.55, vs.
# 0.50, 0.46, 0.39 previously) so it reads as faint discolouration
# rather than rust patch, and the mix factor is dropped from 0.35 to
# 0.18 because the lab samples are subtler than the aged storage
# material in archival photos.
oxide_noise = nodes.new("ShaderNodeTexNoise")
oxide_noise.inputs["Scale"].default_value = 3.0
oxide_noise.inputs["Detail"].default_value = 2.0
# ShaderNodeMixRGB removed in Blender 5.x; use ShaderNodeMix in color mode
oxide_mix = nodes.new("ShaderNodeMix")
oxide_mix.data_type = 'RGBA'
oxide_mix.blend_type = 'MIX'
oxide_mix.inputs["A"].default_value = (0.74, 0.72, 0.67, 1.0)   # base
oxide_mix.inputs["B"].default_value = (0.66, 0.62, 0.55, 1.0)   # subtle patina
oxide_factor = nodes.new("ShaderNodeMapRange")
oxide_factor.inputs["From Min"].default_value = 0.0
oxide_factor.inputs["From Max"].default_value = 1.0
oxide_factor.inputs["To Min"].default_value = 0.0
oxide_factor.inputs["To Max"].default_value = 0.18
links.new(tex_coord.outputs["Object"], oxide_noise.inputs["Vector"])
links.new(oxide_noise.outputs["Fac"], oxide_factor.inputs["Value"])
links.new(oxide_factor.outputs["Result"], oxide_mix.inputs["Factor"])
links.new(oxide_mix.outputs["Result"], bsdf.inputs["Base Color"])

# Self-emission — cherry-red baseline calibrated to the ~1 BTC (16 g)
# mark on the blackbody ladder (#a83000 ≈ 800 °C). CSS (CubeGlowOverlay)
# amplifies toward orange-yellow at higher masses; this sprite covers the
# full slider range. The emission combines with the BSDF surface so the
# cube retains its metallic microstructure in the highlights even while
# glowing. Strength 5 under near-black environment with Filmic produces a
# clearly warm, self-lit appearance without blowing out surface detail.
emission = nodes.new("ShaderNodeEmission")
emission.inputs["Color"].default_value = (1.0, 0.03, 0.0, 1.0)
emission.inputs["Strength"].default_value = 0.5

add_shader = nodes.new("ShaderNodeAddShader")
mat_output = nodes["Material Output"]

# Remove the auto-created BSDF → Material Output link, route via AddShader.
for link in list(mat.node_tree.links):
    if link.to_node == mat_output and link.from_node == bsdf:
        mat.node_tree.links.remove(link)
        break

links.new(bsdf.outputs["BSDF"], add_shader.inputs[0])
links.new(emission.outputs["Emission"], add_shader.inputs[1])
links.new(add_shader.outputs["Shader"], mat_output.inputs["Surface"])

cube.data.materials.append(mat)
try:
    # Blender 4.1+: shade_smooth_by_angle operator replaces use_auto_smooth
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
except AttributeError:
    bpy.ops.object.shade_smooth()
    try:
        cube.data.use_auto_smooth = True
        cube.data.auto_smooth_angle = math.radians(30)
    except AttributeError:
        pass

# === HDRI ===
world = bpy.data.worlds.new(name="HDRIWorld")
bpy.context.scene.world = world
world.use_nodes = True
tree = world.node_tree
tree.nodes.clear()

bg = tree.nodes.new("ShaderNodeBackground")
# Near-black environment — the cube is its own light source. A trace of
# ambient (0.03) stops the shadows behind the cube from being absolute
# digital black, which reads as fake. The photostudio HDRI still sets the
# colour of this trace ambient; its influence at 0.03 is imperceptible.
bg.inputs["Strength"].default_value = 0.03

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

# === LIGHTING — self-illumination rig ===
# The cube emits its own light, so studio lights are reduced to the minimum
# needed to define its silhouette against the near-black background.
# Key: very dim frontal, enough to catch the top-face specular highlight.
# Fill: removed — would flatten the self-lit look.
# Rim: slightly stronger than key to define the back edges cleanly.
target = Vector((0, 0, EDGE / 2))

key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 12
key_data.size = 2.0
key_data.color = (1.0, 0.92, 0.78)
key_obj = bpy.data.objects.new("KeyLight", key_data)
bpy.context.collection.objects.link(key_obj)
key_obj.location = (1.2, -1.5, 2.5)
key_obj.rotation_euler = (target - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 18
rim_data.size = 1.5
rim_data.color = (1.0, 0.88, 0.7)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
bpy.context.collection.objects.link(rim_obj)
rim_obj.location = (-1.0, 1.2, 1.5)
rim_obj.rotation_euler = (target - rim_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === CAMERA — three-quarter rig (matches gold/silver framing exactly) ===
cam_data = bpy.data.cameras.new(name="ThreeQuarterCam")
cam_obj = bpy.data.objects.new("ThreeQuarterCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'PERSP'
cam_data.lens = 50

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
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 2
scene.cycles.glossy_bounces = 4
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Filmic'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

# === RENDER MAIN ===
scene.render.filepath = OUTPUT_SPRITE
bpy.ops.render.render(write_still=True)
print(f"Main sprite: {OUTPUT_SPRITE}")

# === RENDER CONTACT SHADOW ===
bpy.ops.mesh.primitive_plane_add(size=5, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "ShadowGround"
ground.is_shadow_catcher = True

cube.visible_camera = False

scene.render.filepath = OUTPUT_SHADOW
bpy.ops.render.render(write_still=True)
print(f"Shadow: {OUTPUT_SHADOW}")

cube.visible_camera = True

bpy.ops.object.select_all(action='DESELECT')
ground.select_set(True)
bpy.ops.object.delete()

# === SAVE BLEND ===
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
print(f"Blend: {OUTPUT_BLEND}")
print("DONE: Pu-238 cube production render")
