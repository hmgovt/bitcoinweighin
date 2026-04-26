"""Gold coin import v3 — use base-color textures as bump source for face detail."""
import bpy
import math
import os
from mathutils import Vector

PROJECT = "/Users/tim50cycles/Projects/bitcoinweighin"
HDRI_PATH = os.path.join(PROJECT, "studio_small_09_4k.exr")
COIN_GLTF = os.path.join(PROJECT, "assets/blender/gold_coin/scene.gltf")
OUTPUT_PATH = os.path.join(PROJECT, "static/sprites/gold/coin_test_import_v7.png")

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
bpy.ops.import_scene.gltf(filepath=COIN_GLTF)

imported = [obj for obj in bpy.context.selected_objects]
print(f"Imported {len(imported)} objects")

meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
print(f"Mesh objects: {len(meshes)}")

for m in meshes:
    print(f"  {m.name}: dims={m.dimensions}, loc={m.location}")
    for mat in m.data.materials:
        if mat:
            print(f"    Material: {mat.name}")

# --- Inspect materials BEFORE joining to understand texture assignments ---
# Collect base color texture images per material
mat_textures = {}
for m in meshes:
    for mat in m.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                img_path = node.image.filepath
                mat_textures[mat.name] = node.image
                print(f"    Texture in '{mat.name}': {node.image.name} ({img_path})")

# Select all meshes and join
bpy.ops.object.select_all(action='DESELECT')
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
coin = bpy.context.active_object
coin.name = "GoldCoin"

# Delete any remaining empties/armatures
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.objects:
    if obj.type not in ('MESH',) and obj != coin:
        obj.select_set(True)
bpy.ops.object.delete()

# Apply transforms
bpy.ops.object.select_all(action='DESELECT')
coin.select_set(True)
bpy.context.view_layer.objects.active = coin
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Scale to ~0.6 diameter
dims = coin.dimensions
print(f"Joined coin dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")
max_dim = max(dims.x, dims.y, dims.z)
if max_dim > 0:
    sf = 0.6 / max_dim
    coin.scale = (sf, sf, sf)
    bpy.ops.object.transform_apply(scale=True)

dims = coin.dimensions
print(f"Scaled coin dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")

# Rotate to lay flat
coin.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.object.transform_apply(rotation=True)

# Centre and ground
bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
coin.location = (0, 0, 0)
bpy.context.view_layer.update()
bbox = [coin.matrix_world @ Vector(corner) for corner in coin.bound_box]
min_z = min(v.z for v in bbox)
coin.location.z -= min_z

dims = coin.dimensions
print(f"Final dims: {dims.x:.4f} x {dims.y:.4f} x {dims.z:.4f}")


# === MODIFY MATERIALS — use base color textures as bump, override color to gold ===
for mat in coin.data.materials:
    if not mat or not mat.use_nodes:
        continue
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    # Find principled BSDF
    bsdf = None
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            bsdf = node
            break
    if not bsdf:
        continue

    # Find existing base color texture node (if any)
    base_color_tex = None
    base_color_link = None
    for link in list(links):
        if link.to_node == bsdf and link.to_socket.name == "Base Color":
            if link.from_node.type == 'TEX_IMAGE':
                base_color_tex = link.from_node
            base_color_link = link
            break

    # Disconnect base color input — we'll set flat gold
    for link in list(links):
        if link.to_node == bsdf and link.to_socket.name == "Base Color":
            links.remove(link)

    # Set gold PBR values
    bsdf.inputs["Base Color"].default_value = (1.0, 0.65, 0.15, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Specular"].default_value = 0.5

    if base_color_tex and base_color_tex.image:
        print(f"  Material '{mat.name}': using texture '{base_color_tex.image.name}' as bump source")

        # Convert texture to greyscale
        rgb_to_bw = nodes.new("ShaderNodeRGBToBW")
        links.new(base_color_tex.outputs["Color"], rgb_to_bw.inputs["Color"])

        # Feed into bump node for face relief
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.8
        bump.inputs["Distance"].default_value = 0.005
        links.new(rgb_to_bw.outputs["Val"], bump.inputs["Height"])

        # Chain with existing normal map if present
        existing_normal = None
        for link in list(links):
            if link.to_node == bsdf and link.to_socket.name == "Normal":
                existing_normal = link.from_node
                break

        if existing_normal:
            # Chain: normal map → bump node (so both contribute)
            links.new(existing_normal.outputs["Normal"], bump.inputs["Normal"])
            # Remove old direct link
            for link in list(links):
                if link.to_node == bsdf and link.to_socket.name == "Normal":
                    links.remove(link)

        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

        # Use texture to modulate roughness — relief areas shinier
        rough_map = nodes.new("ShaderNodeMapRange")
        rough_map.inputs["From Min"].default_value = 0.0
        rough_map.inputs["From Max"].default_value = 1.0
        rough_map.inputs["To Min"].default_value = 0.30   # dark areas (field) = more matte
        rough_map.inputs["To Max"].default_value = 0.15   # bright areas (relief) = shinier
        links.new(rgb_to_bw.outputs["Val"], rough_map.inputs["Value"])
        links.new(rough_map.outputs["Result"], bsdf.inputs["Roughness"])

        # Subtle gold color variation tied to relief
        color_ramp = nodes.new("ShaderNodeValToRGB")
        color_ramp.color_ramp.elements[0].color = (0.95, 0.58, 0.10, 1.0)  # field: slightly darker gold
        color_ramp.color_ramp.elements[0].position = 0.3
        color_ramp.color_ramp.elements[1].color = (1.0, 0.70, 0.20, 1.0)  # relief: brighter gold
        color_ramp.color_ramp.elements[1].position = 0.7
        links.new(rgb_to_bw.outputs["Val"], color_ramp.inputs["Fac"])
        links.new(color_ramp.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        print(f"  Material '{mat.name}': no base color texture found, flat gold only")

bpy.ops.object.shade_smooth()

# Coin lays flat — no tilt. Same orientation works for 1 coin or a stack.
# Slight Z rotation so the face design isn't axis-aligned
coin.rotation_euler = (0, 0, math.radians(12))
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


# === CAMERA — three-quarter view, steeper to see flat coin face ===
cam_data = bpy.data.cameras.new(name="Camera")
cam_obj = bpy.data.objects.new("Camera", cam_data)
bpy.context.collection.objects.link(cam_obj)
bpy.context.scene.camera = cam_obj
dist = 2.2  # room for stacks in same framing
az = math.radians(25)
el = math.radians(50)  # steeper — coin is flat, need to see the face
target = Vector((0, 0, 0.01))
cam_obj.location = (dist * math.cos(el) * math.sin(az), -dist * math.cos(el) * math.cos(az), dist * math.sin(el) + target.z)
cam_obj.rotation_euler = (target - cam_obj.location).to_track_quat('-Z', 'Y').to_euler()
cam_data.lens = 75  # slightly wider to centre better


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
print(f"GOLD COIN IMPORT V3: {OUTPUT_PATH}")
