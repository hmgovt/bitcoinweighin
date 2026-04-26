"""Gold Pallet — ~200 bars on a pallet, isometric rig.

Creates 5 fill states from one scene using collection visibility.
Fill states: 100%, 75%, 50%, 25%, 0% (empty pallet frame only).
Isometric camera: 35° elevation, 45° azimuth, orthographic.
"""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")
BAR_GLTF = os.path.join(PROJECT, "assets/blender/gold_bar_single/scene.gltf")
OUTPUT_DIR = os.path.join(PROJECT, "static/sprites/gold")
OUTPUT_BLEND = os.path.join(PROJECT, "assets/blender/gold/pallet.blend")

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

# === HELPER: create gold material ===
def create_gold_material():
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

    return mat


# === IMPORT REFERENCE BAR ===
bpy.ops.import_scene.gltf(filepath=BAR_GLTF)
meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
ref_bar = meshes[0]
ref_bar.name = "RefBar"

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = ref_bar
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        obj.select_set(True)
bpy.ops.object.delete()

bpy.ops.object.select_all(action='DESELECT')
ref_bar.select_set(True)
bpy.context.view_layer.objects.active = ref_bar
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Scale bar to a unit size for pallet arrangement
# Good Delivery bar: ~265mm x 83mm x 47mm
# We'll work in a scale where 1 BU ≈ 265mm (bar length)
dims = ref_bar.dimensions
print(f"Imported bar dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Normalise so longest axis = 0.1 BU (bars are small relative to pallet)
max_dim = max(dims.x, dims.y, dims.z)
bar_scale = 0.1 / max_dim
ref_bar.scale = (bar_scale, bar_scale, bar_scale)
bpy.ops.object.transform_apply(scale=True)

bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
ref_bar.location = (0, 0, 0)
bpy.context.view_layer.update()

dims = ref_bar.dimensions
bar_w = dims.x  # width (short side)
bar_l = dims.y  # length (long side)
bar_h = dims.z  # height
print(f"Scaled bar: w={bar_w:.4f} l={bar_l:.4f} h={bar_h:.4f}")

# Apply gold material
gold_mat = create_gold_material()
ref_bar.data.materials.clear()
ref_bar.data.materials.append(gold_mat)
bpy.ops.object.shade_smooth()

# Ground the ref bar
bpy.context.view_layer.update()
bbox = [ref_bar.matrix_world @ Vector(c) for c in ref_bar.bound_box]
min_z = min(v.z for v in bbox)
ref_bar.location.z -= min_z
bpy.ops.object.transform_apply(location=True)


# === BUILD PALLET ===
# A standard gold pallet: bars arranged in layers
# Real pattern: ~80 bars per layer, 3 layers ≈ 240 bars
# We'll do a simplified arrangement: grid layers
# Layout per layer: 10 bars wide × 8 bars deep (alternating orientation)

gap = 0.002  # small gap between bars

# Create collections for fill-state control
main_col = bpy.context.scene.collection

# We'll create 4 quarter-collections
quarter_cols = []
for i in range(4):
    col = bpy.data.collections.new(f"Quarter_{i+1}")
    main_col.children.link(col)
    quarter_cols.append(col)

bars_per_row = 8
bars_per_col = 6
layers = 3
total_bars = 0

# Calculate grid origin to centre the pallet
grid_w = bars_per_row * (bar_l + gap) - gap  # bars laid lengthwise
grid_d = bars_per_col * (bar_w + gap) - gap
start_x = -grid_w / 2
start_y = -grid_d / 2

for layer in range(layers):
    z_offset = layer * (bar_h + 0.001)  # stack height
    for row in range(bars_per_col):
        for col in range(bars_per_row):
            # Determine which quarter this bar belongs to
            # Split grid into 4 quadrants for fill-state control
            bar_index = layer * bars_per_row * bars_per_col + row * bars_per_row + col
            # Assign to quarters: layer 2 (top) = Q4, layer 1 mid = Q3,
            # layer 0 back half = Q2, layer 0 front half = Q1
            if layer == 2:
                quarter = 3  # Q4 — removed first (25% fill removes top layer)
            elif layer == 1:
                quarter = 2  # Q3
            elif row >= bars_per_col // 2:
                quarter = 1  # Q2
            else:
                quarter = 0  # Q1 — last to be removed

            # Duplicate reference bar
            new_bar = ref_bar.copy()
            new_bar.data = ref_bar.data  # share mesh data (instancing)
            new_bar.name = f"Bar_L{layer}_R{row}_C{col}"

            x = start_x + col * (bar_l + gap) + bar_l / 2
            y = start_y + row * (bar_w + gap) + bar_w / 2
            z = z_offset

            new_bar.location = (x, y, z)

            # Link to appropriate quarter collection
            quarter_cols[quarter].objects.link(new_bar)
            total_bars += 1

print(f"Total bars placed: {total_bars}")

# Remove the reference bar from main collection (it's been duplicated)
main_col.objects.unlink(ref_bar)
# Keep it in scene for reference but hide
ref_bar.hide_render = True
ref_bar.hide_viewport = True
# Link to a hidden collection
hidden_col = bpy.data.collections.new("_Reference")
main_col.children.link(hidden_col)
hidden_col.objects.link(ref_bar)
hidden_col.hide_render = True
hidden_col.hide_viewport = True


# === PALLET BASE (wooden pallet frame) ===
pallet_col = bpy.data.collections.new("PalletBase")
main_col.children.link(pallet_col)

pallet_mat = bpy.data.materials.new(name="PalletWood")
pallet_mat.use_nodes = True
p_bsdf = pallet_mat.node_tree.nodes["Principled BSDF"]
p_bsdf.inputs["Base Color"].default_value = (0.35, 0.22, 0.10, 1.0)
p_bsdf.inputs["Roughness"].default_value = 0.85
p_bsdf.inputs["Metallic"].default_value = 0.0

# Simple pallet: a flat platform slightly larger than the bar grid
pallet_w = grid_w + 0.04
pallet_d = grid_d + 0.04
pallet_h = 0.015

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -pallet_h / 2))
pallet_base = bpy.context.active_object
pallet_base.name = "PalletBase"
pallet_base.scale = (pallet_w, pallet_d, pallet_h)
bpy.ops.object.transform_apply(scale=True)
pallet_base.data.materials.append(pallet_mat)

# Move pallet to its collection
main_col.objects.unlink(pallet_base)
pallet_col.objects.link(pallet_base)


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
target = Vector((0, 0, layers * bar_h / 2))

key_data = bpy.data.lights.new(name="KeyLight", type='AREA')
key_data.energy = 150
key_data.size = 3.0
key_data.color = (1.0, 0.92, 0.78)
key_obj = bpy.data.objects.new("KeyLight", key_data)
main_col.objects.link(key_obj)
key_obj.location = (2.0, -2.0, 4.0)
key_obj.rotation_euler = (target - key_obj.location).to_track_quat('-Z', 'Y').to_euler()

fill_data = bpy.data.lights.new(name="FillLight", type='AREA')
fill_data.energy = 60
fill_data.size = 4.0
fill_data.color = (1.0, 0.95, 0.85)
fill_obj = bpy.data.objects.new("FillLight", fill_data)
main_col.objects.link(fill_obj)
fill_obj.location = (2.0, 1.0, 1.0)
fill_obj.rotation_euler = (target - fill_obj.location).to_track_quat('-Z', 'Y').to_euler()

rim_data = bpy.data.lights.new(name="RimLight", type='AREA')
rim_data.energy = 50
rim_data.size = 2.0
rim_data.color = (1.0, 0.88, 0.7)
rim_obj = bpy.data.objects.new("RimLight", rim_data)
main_col.objects.link(rim_obj)
rim_obj.location = (-1.5, 2.0, 2.5)
rim_obj.rotation_euler = (target - rim_obj.location).to_track_quat('-Z', 'Y').to_euler()


# === CAMERA (isometric: 35° el, 45° az, orthographic) ===
cam_data = bpy.data.cameras.new(name="IsometricCam")
cam_obj = bpy.data.objects.new("IsometricCam", cam_data)
main_col.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'ORTHO'
# Ortho scale: needs to frame the full pallet
# Pallet is roughly grid_w x grid_d, viewed at 45° — diagonal matters
diag = math.sqrt(pallet_w**2 + pallet_d**2)
cam_data.ortho_scale = diag * 1.4  # some padding

dist = 10.0
az = math.radians(45)
el = math.radians(35)

cam_obj.location = (
    dist * math.cos(el) * math.sin(az) + target.x,
    -dist * math.cos(el) * math.cos(az) + target.y,
    dist * math.sin(el) + target.z
)
cam_obj.rotation_euler = (target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()


# === RENDER SETTINGS ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 256  # iteration speed
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'


# === RENDER ALL 5 FILL STATES ===
fill_configs = [
    ("pallet_fill_100", [True, True, True, True]),    # all quarters visible
    ("pallet_fill_75",  [True, True, True, False]),   # Q4 hidden (top layer gone)
    ("pallet_fill_50",  [True, True, False, False]),  # Q3+Q4 hidden
    ("pallet_fill_25",  [True, False, False, False]), # only Q1 visible
    ("pallet_fill_0",   [False, False, False, False]),# empty pallet only
]

for name, visibility in fill_configs:
    # Set quarter visibility
    for i, vis in enumerate(visibility):
        quarter_cols[i].hide_render = not vis
        quarter_cols[i].hide_viewport = not vis

    # Pallet base always visible
    pallet_col.hide_render = False

    output_path = os.path.join(OUTPUT_DIR, f"{name}@2x.png")
    scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)
    print(f"Rendered: {name}")

# Also render the main pallet sprite (alias for fill_100)
# Reset all visible
for col in quarter_cols:
    col.hide_render = False
    col.hide_viewport = False


# === RENDER CONTACT SHADOW for full pallet ===
bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -pallet_h))
ground = bpy.context.active_object
ground.name = "ShadowGround"
ground.is_shadow_catcher = True

shadow_path = os.path.join(OUTPUT_DIR, "pallet-shadow@2x.png")
scene.render.filepath = shadow_path
bpy.ops.render.render(write_still=True)
print(f"Shadow: {shadow_path}")

bpy.ops.object.select_all(action='DESELECT')
ground.select_set(True)
bpy.ops.object.delete()


# === SAVE BLEND ===
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
print(f"Blend: {OUTPUT_BLEND}")
print(f"DONE: pallet — {total_bars} bars, 5 fill states + shadow")
