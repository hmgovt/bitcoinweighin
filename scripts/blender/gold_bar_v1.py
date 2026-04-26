"""Gold bar v1 — import gold_bar_single model, apply gold material, render.
Bar lays flat in stacking orientation (same pose for 1 bar or a stack)."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
BAR_GLTF = os.path.join(PROJECT, "assets/blender/gold_bar_single/scene.gltf")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/bar_test_v1.png")

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

imported = [obj for obj in bpy.context.selected_objects]
print(f"Imported {len(imported)} objects")

meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
print(f"Mesh objects: {len(meshes)}")

for m in meshes:
    print(f"  {m.name}: dims={m.dimensions}, loc={m.location}, scale={m.scale}")
    for mat in m.data.materials:
        if mat:
            print(f"    Material: {mat.name}")
            if mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image:
                        print(f"      Texture: {node.image.name} -> {node.image.filepath}")

# Select mesh and apply all parent transforms first
bar = meshes[0]
bar.name = "GoldBar"

# Select everything, make bar active, apply parent transforms
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bar

# Clear parent but keep transform (bakes parent transform into mesh)
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')

# Now delete non-mesh objects
bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.data.objects):
    if obj.type != 'MESH':
        obj.select_set(True)
bpy.ops.object.delete()

# Apply transforms on the bar
bpy.ops.object.select_all(action='DESELECT')
bar.select_set(True)
bpy.context.view_layer.objects.active = bar
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

dims = bar.dimensions
print(f"Bar dims after apply: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Scale to a reasonable scene size (~0.5 units longest axis)
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

dims = bar.dimensions
print(f"Final bar dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")
print(f"Final location: {bar.location}")


# === MODIFY MATERIALS — apply gold recipe, keep textures as bump ===
for mat in bar.data.materials:
    if not mat or not mat.use_nodes:
        continue
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = None
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            bsdf = node
            break
    if not bsdf:
        continue

    # Find base color texture
    base_color_tex = None
    for link in list(links):
        if link.to_node == bsdf and link.to_socket.name == "Base Color":
            if link.from_node.type == 'TEX_IMAGE':
                base_color_tex = link.from_node
            links.remove(link)
            break

    # Set gold PBR values
    bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Specular"].default_value = 0.5

    if base_color_tex and base_color_tex.image:
        print(f"  Material '{mat.name}': using '{base_color_tex.image.name}' as bump source")

        rgb_to_bw = nodes.new("ShaderNodeRGBToBW")
        links.new(base_color_tex.outputs["Color"], rgb_to_bw.inputs["Color"])

        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.5
        bump.inputs["Distance"].default_value = 0.003
        links.new(rgb_to_bw.outputs["Val"], bump.inputs["Height"])

        # Chain with existing normal map if present
        existing_normal = None
        for link in list(links):
            if link.to_node == bsdf and link.to_socket.name == "Normal":
                existing_normal = link.from_node
                break
        if existing_normal:
            links.new(existing_normal.outputs["Normal"], bump.inputs["Normal"])
            for link in list(links):
                if link.to_node == bsdf and link.to_socket.name == "Normal":
                    links.remove(link)

        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

        # Roughness variation from texture
        rough_map = nodes.new("ShaderNodeMapRange")
        rough_map.inputs["From Min"].default_value = 0.0
        rough_map.inputs["From Max"].default_value = 1.0
        rough_map.inputs["To Min"].default_value = 0.28
        rough_map.inputs["To Max"].default_value = 0.18
        links.new(rgb_to_bw.outputs["Val"], rough_map.inputs["Value"])
        links.new(rough_map.outputs["Result"], bsdf.inputs["Roughness"])

        # Subtle gold colour variation
        color_ramp = nodes.new("ShaderNodeValToRGB")
        color_ramp.color_ramp.elements[0].color = (0.95, 0.58, 0.10, 1.0)
        color_ramp.color_ramp.elements[0].position = 0.3
        color_ramp.color_ramp.elements[1].color = (1.0, 0.70, 0.20, 1.0)
        color_ramp.color_ramp.elements[1].position = 0.7
        links.new(rgb_to_bw.outputs["Val"], color_ramp.inputs["Fac"])
        links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        # Check for normal map texture to keep
        print(f"  Material '{mat.name}': flat gold (no base color texture)")

bpy.ops.object.shade_smooth()

# Bar lays flat — slight Z rotation for visual interest
bar.rotation_euler = (0, 0, math.radians(12))
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


# === CAMERA — three-quarter view ===
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
print(f"GOLD BAR V1: {OUTPUT_PATH}")
