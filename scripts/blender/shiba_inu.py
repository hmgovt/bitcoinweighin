"""Shiba Inu reference — first animal in the cube-mode reference library.

Imports the source .gltf, picks an animation frame for the static pose,
scales the model so the configured measurement axis equals 0.5 m in
Blender units (lighting-rig consistency per assets/materials-reference.md),
and renders main sprite + contact shadow through the same camera/light/HDRI
rig as gold_cube.py.

This is the parameterised template for the other 11 animals. Per-animal
config is the CONFIG block at the top; everything below it is shared rig.
To derive a new animal script, copy this file, edit the CONFIG block, run.

Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender \\
    --background \\
    --python scripts/blender/shiba_inu.py
"""
import bpy
import math
import os
from mathutils import Vector

# === CONFIG (per-animal; everything below this block is shared rig) ===
PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"

ANIMAL_ID = "shiba_inu"
SOURCE_GLTF = os.path.join(
    PROJECT, "assets/blender/references", ANIMAL_ID, "scene.gltf"
)
OUTPUT_SPRITE = os.path.join(
    PROJECT, "static/sprites/references", f"{ANIMAL_ID}.webp"
)
OUTPUT_SHADOW = os.path.join(
    PROJECT, "static/sprites/references", f"{ANIMAL_ID}-shadow.png"
)
OUTPUT_BLEND = os.path.join(
    PROJECT, "assets/blender/references", ANIMAL_ID, "render.blend"
)

# Bounding-box dimension that realSizeMetres in scale-references.json
# refers to. Drives only the in-Blender scale-to-0.5m calculation; the
# runtime renderer uses the JSON's realSizeMetres directly. Mirrors the
# JSON entry's measurementAxis for traceability.
MEASUREMENT_AXIS = "height"  # "length" | "height" | "longest"

# Canonical Blender size — fixed across all references for lighting-rig
# consistency. Real-world size (0.4 m for the Shiba) is in JSON only.
BLENDER_LONGEST_M = 0.5

# Animation clip name fragment (case-insensitive substring match against
# bpy.data.actions). The Shiba glTF contains five clips: play_dead,
# rollover, shake, sitting, standing. Sitting is the static pose.
ANIMATION_CLIP = "sitting"

# Frame inside the chosen clip. The sitting cycle is ~12 s; at 24 fps
# that's ~288 frames. Frame 60 sits ~2.5 s into the loop, past any
# settling motion at the start. Documented in
# assets/blender/references/shiba_inu/notes.md. If the pose lands wrong,
# this number is the one-line fix.
ANIMATION_FRAME = 60

HDRI_PATH = os.path.join(PROJECT, "brown_photostudio_02_4k.exr")

os.makedirs(os.path.dirname(OUTPUT_SPRITE), exist_ok=True)
os.makedirs(os.path.dirname(OUTPUT_BLEND), exist_ok=True)


# === Helpers ===
def evaluated_world_bbox(mesh_objs):
    """Compute combined bbox in world coords from the evaluated meshes
    (post-armature deformation), so a sitting / lying pose returns the
    actual bbox at that frame, not the rest-pose bbox."""
    deps = bpy.context.evaluated_depsgraph_get()
    xs, ys, zs = [], [], []
    for o in mesh_objs:
        eval_obj = o.evaluated_get(deps)
        eval_mesh = eval_obj.to_mesh()
        try:
            mw = eval_obj.matrix_world
            for v in eval_mesh.vertices:
                wc = mw @ v.co
                xs.append(wc.x)
                ys.append(wc.y)
                zs.append(wc.z)
        finally:
            eval_obj.to_mesh_clear()
    return (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))


# === Scene reset (matches gold_cube.py prelude) ===
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
for block in bpy.data.actions:
    if block.users == 0:
        bpy.data.actions.remove(block)

# === Import glTF ===
bpy.ops.import_scene.gltf(filepath=SOURCE_GLTF)
imported = list(bpy.context.selected_objects)
mesh_objs = [o for o in imported if o.type == 'MESH']
armatures = [o for o in imported if o.type == 'ARMATURE']
if not mesh_objs:
    raise RuntimeError(f"No meshes imported from {SOURCE_GLTF}")
print(f"Imported {len(imported)} objects ({len(mesh_objs)} meshes, "
      f"{len(armatures)} armatures)")

# === Select the configured animation clip ===
chosen_action = None
for action in bpy.data.actions:
    if ANIMATION_CLIP.lower() in action.name.lower():
        chosen_action = action
        break
if chosen_action is None:
    available = [a.name for a in bpy.data.actions]
    raise RuntimeError(
        f"No action matching {ANIMATION_CLIP!r}. Available: {available}"
    )
print(f"Selected action: {chosen_action.name}")

if armatures:
    arm = armatures[0]
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = chosen_action

# Set frame range to action range so frame_set evaluates within bounds.
fstart, fend = int(chosen_action.frame_range[0]), int(chosen_action.frame_range[1])
bpy.context.scene.frame_start = fstart
bpy.context.scene.frame_end = fend
target_frame = max(fstart, min(fend, ANIMATION_FRAME))
bpy.context.scene.frame_set(target_frame)
bpy.context.view_layer.update()
print(f"Action frame range: {fstart}-{fend}; rendering frame {target_frame}")

# === Scale to BLENDER_LONGEST_M on configured axis ===
min_x, max_x, min_y, max_y, min_z, max_z = evaluated_world_bbox(mesh_objs)
size_x = max_x - min_x
size_y = max_y - min_y
size_z = max_z - min_z
print(f"Source bbox at frame {target_frame}: "
      f"x={size_x:.3f}, y={size_y:.3f}, z={size_z:.3f}")

if MEASUREMENT_AXIS == "height":
    current = size_z
elif MEASUREMENT_AXIS == "length":
    current = max(size_x, size_y)
elif MEASUREMENT_AXIS == "longest":
    current = max(size_x, size_y, size_z)
else:
    raise ValueError(f"Unknown MEASUREMENT_AXIS: {MEASUREMENT_AXIS}")

scale_factor = BLENDER_LONGEST_M / current
print(f"Scale factor ({MEASUREMENT_AXIS}={current:.3f} -> "
      f"{BLENDER_LONGEST_M:.3f}): {scale_factor:.4f}")

# Apply uniform scale to top-level roots (single-root glTFs are typical)
roots = [o for o in imported if o.parent is None]
for r in roots:
    r.scale = (
        r.scale.x * scale_factor,
        r.scale.y * scale_factor,
        r.scale.z * scale_factor,
    )
bpy.context.view_layer.update()

# === Re-centre and ground ===
# Place the bbox so min Z = 0 (sits on ground plane) and centre in XY.
min_x, max_x, min_y, max_y, min_z, max_z = evaluated_world_bbox(mesh_objs)
cx = (min_x + max_x) / 2
cy = (min_y + max_y) / 2
for r in roots:
    r.location = (
        r.location.x - cx,
        r.location.y - cy,
        r.location.z - min_z,
    )
bpy.context.view_layer.update()

min_x, max_x, min_y, max_y, min_z, max_z = evaluated_world_bbox(mesh_objs)
print(f"Final bbox: x=[{min_x:.3f},{max_x:.3f}], "
      f"y=[{min_y:.3f},{max_y:.3f}], z=[{min_z:.3f},{max_z:.3f}]")
bbox_top_z = max_z

# === HDRI (matches gold_cube.py) ===
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

# === Lighting (matches gold_cube.py — locked rig) ===
# Energies assume the subject's longest dimension ≈ 0.5 m. Target the
# bbox centre in Z so the key/fill/rim hit the animal's bulk regardless
# of exact pose height (sitting vs standing differs by ~40%).
target = Vector((0, 0, bbox_top_z / 2))

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

# === Camera — three-quarter rig (matches gold_cube.py) ===
# dist=1.55 produces ~65–70% canvas occupancy with intrinsic transparent
# margin on all four sides. Same value used for the gold cube; matches
# the locked render-margin pattern from DECISIONS.md 2026-04-26.
cam_data = bpy.data.cameras.new(name="ThreeQuarterCam")
cam_obj = bpy.data.objects.new("ThreeQuarterCam", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj

cam_data.type = 'PERSP'
cam_data.lens = 50

dist = 1.55
az = math.radians(30)
el = math.radians(25)
cam_target = Vector((0, 0, bbox_top_z / 2))

cam_obj.location = (
    dist * math.cos(el) * math.sin(az) + cam_target.x,
    -dist * math.cos(el) * math.cos(az) + cam_target.y,
    dist * math.sin(el) + cam_target.z,
)
cam_obj.rotation_euler = (cam_target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()

# === Render settings ===
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 512
scene.render.resolution_x = 1600
scene.render.resolution_y = 1600
scene.render.film_transparent = True
scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'

# === Render main (WebP) ===
scene.render.image_settings.file_format = 'WEBP'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.quality = 92
scene.render.filepath = OUTPUT_SPRITE
bpy.ops.render.render(write_still=True)
print(f"Main sprite: {OUTPUT_SPRITE}")

# === Render contact shadow (PNG) ===
# Same shadow-catcher pattern as gold_cube.py: hide subject from camera
# but keep its shadow contribution, so the resulting PNG is shadow-only.
# Without visible_camera = False the dog double-renders behind the main
# sprite under mix-blend-mode: multiply.
bpy.ops.mesh.primitive_plane_add(size=5, location=(0, 0, 0))
ground = bpy.context.active_object
ground.name = "ShadowGround"
ground.is_shadow_catcher = True

for o in mesh_objs:
    o.visible_camera = False

scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUTPUT_SHADOW
bpy.ops.render.render(write_still=True)
print(f"Shadow: {OUTPUT_SHADOW}")

for o in mesh_objs:
    o.visible_camera = True

bpy.ops.object.select_all(action='DESELECT')
ground.select_set(True)
bpy.ops.object.delete()

# === Save .blend (local-only, gitignored — see below) ===
# The gltf importer auto-packs the model's textures and Blender packs the
# HDRI on save, producing a ~95 MB .blend per animal. That's derived state
# (the source-of-truth is the .gltf + this script), so the file is kept on
# disk for local inspection but excluded from git via .gitignore. Re-running
# the script regenerates everything.
bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND, compress=True)
print(f"Blend (gitignored): {OUTPUT_BLEND}")
print(f"DONE: {ANIMAL_ID} reference render")
