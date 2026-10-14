"""Generate the Reliquary Forge GLB library in Blender.

The source of truth is this script. Each exported scene uses stable semantic node
names so the browser runtime can animate gait, recoil, wing flex, rings, jaws,
cores, and tower articulation without coupling gameplay state to Blender objects.
"""

from __future__ import annotations

import json
import math
import os
import random
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT = Path(__file__).resolve().parents[2]
MODEL_DIR = PROJECT / "public" / "assets" / "models"
TEXTURE_DIR = PROJECT / "public" / "assets" / "textures"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)

PALETTES = {
    "shell": ((0.10, 0.14, 0.20), (0.40, 0.54, 0.62), 11),
    "bone": ((0.50, 0.43, 0.30), (0.84, 0.72, 0.45), 19),
    "ember": ((0.31, 0.07, 0.035), (0.94, 0.39, 0.075), 29),
    "verdigris": ((0.035, 0.22, 0.21), (0.12, 0.71, 0.65), 37),
    "violet": ((0.16, 0.055, 0.20), (0.66, 0.24, 0.62), 43),
    "ivory": ((0.42, 0.39, 0.32), (0.83, 0.78, 0.62), 53),
    "iron": ((0.07, 0.09, 0.13), (0.36, 0.42, 0.48), 61),
    "rime": ((0.055, 0.24, 0.31), (0.30, 0.82, 0.86), 71),
}

MATERIALS: dict[str, bpy.types.Material] = {}
IMAGES: dict[str, bpy.types.Image] = {}
MANIFEST: dict[str, dict[str, object]] = {}

KEEP_SEPARATE = {
    "Scarab_Shell_L",
    "Scarab_Shell_R",
    "Scarab_Jaw_L",
    "Scarab_Jaw_R",
    "Manta_Halo",
    "Husk_Head",
    "Choir_Ring_A",
    "Choir_Ring_B",
}


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    MATERIALS.clear()


def pigment_image(key: str) -> bpy.types.Image:
    if key in IMAGES:
        return IMAGES[key]
    low, high, seed = PALETTES[key]
    size = 256
    rng = random.Random(seed)
    phase_a = rng.random() * math.tau
    phase_b = rng.random() * math.tau
    pixels: list[float] = [0.0] * (size * size * 4)
    for y in range(size):
        fy = y / size
        for x in range(size):
            fx = x / size
            stroke = math.sin((fx * 11.0 + fy * 2.6) * math.tau + phase_a)
            cross = math.sin((fx * 2.4 - fy * 7.0) * math.tau + phase_b)
            bristle = math.sin((fx * 53.0 + fy * 0.9) * math.tau) * 0.08
            pooled = 0.5 + 0.5 * math.sin((fx * 1.7 + fy * 1.3) * math.tau + stroke * 0.55)
            fleck = 0.18 if rng.random() > 0.985 else 0.0
            mix = max(0.0, min(1.0, 0.48 + stroke * 0.18 + cross * 0.10 + bristle + pooled * 0.16 + fleck))
            wet = 0.93 + 0.07 * math.sin((fx * 29.0 - fy * 3.0) * math.tau)
            idx = (y * size + x) * 4
            for channel in range(3):
                pixels[idx + channel] = max(0.0, min(1.0, (low[channel] * (1.0 - mix) + high[channel] * mix) * wet))
            pixels[idx + 3] = 1.0
    image = bpy.data.images.new(f"Pigment_{key}", width=size, height=size, alpha=False)
    image.pixels.foreach_set(pixels)
    image.file_format = "PNG"
    image.filepath_raw = str(TEXTURE_DIR / f"pigment-{key}.png")
    image.save()
    IMAGES[key] = image
    return image


def painted_material(key: str, *, metallic: float = 0.0, roughness: float = 0.42) -> bpy.types.Material:
    cache_key = f"paint:{key}:{metallic:.2f}:{roughness:.2f}"
    if cache_key in MATERIALS:
        return MATERIALS[cache_key]
    mat = bpy.data.materials.new(f"Paint_{key}_{len(MATERIALS)}")
    mat.use_nodes = True
    mat.use_backface_culling = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = pigment_image(key)
    tex.interpolation = "Linear"
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = 0.22
    bsdf.inputs["Coat Roughness"].default_value = 0.18
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    MATERIALS[cache_key] = mat
    return mat


def glow_material(name: str, color: tuple[float, float, float], strength: float = 4.0) -> bpy.types.Material:
    cache_key = f"glow:{name}"
    if cache_key in MATERIALS:
        return MATERIALS[cache_key]
    mat = bpy.data.materials.new(f"Glow_{name}")
    mat.use_nodes = True
    mat.use_backface_culling = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Metallic"].default_value = 0.18
        bsdf.inputs["Roughness"].default_value = 0.24
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    MATERIALS[cache_key] = mat
    return mat


def smooth(obj: bpy.types.Object) -> bpy.types.Object:
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def assign(obj: bpy.types.Object, material: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(material)
    return obj


def parent_keep(obj: bpy.types.Object, parent: bpy.types.Object) -> bpy.types.Object:
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    return obj


def root(name: str, location: tuple[float, float, float] = (0.0, 0.0, 0.0)) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj["forge_role"] = "animated_root"
    return obj


def socket(name: str, location: tuple[float, float, float], parent: bpy.types.Object) -> bpy.types.Object:
    """Create a named runtime attachment point without treating it as an animation pivot."""
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    obj["forge_role"] = "socket"
    parent_keep(obj, parent)
    return obj


def uv_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    segments: int = 40,
    rings: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(smooth(obj), material)
    return obj


def ico(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    subdivisions: int = 3,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(smooth(obj), material)
    return obj


def cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    vertices: int = 24,
    taper: float = 1.0,
) -> bpy.types.Object:
    a, b = Vector(start), Vector(end)
    delta = b - a
    mid = (a + b) * 0.5
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=radius * taper,
        depth=delta.length,
        location=mid,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = delta.to_track_quat("Z", "Y")
    assign(smooth(obj), material)
    bevel(obj, radius * 0.28, 3)
    return obj


def bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> bpy.types.Object:
    modifier = obj.modifiers.new("Forged bevel", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign(smooth(obj), material)
    return obj


def cone(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    vertices: int = 24,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.0, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign(smooth(obj), material)
    bevel(obj, min(radius, depth) * 0.08, 2)
    return obj


def cube(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel_width: float = 0.08,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, bevel_width, 3)
    assign(smooth(obj), material)
    return obj


def petal(
    name: str,
    angle: float,
    radius: float,
    height: float,
    material: bpy.types.Material,
    scale: tuple[float, float, float] = (0.34, 0.72, 0.16),
) -> bpy.types.Object:
    x, z = math.cos(angle) * radius, math.sin(angle) * radius
    obj = ico(name, (x, height, z), scale, material, 2)
    obj.rotation_euler[1] = -angle
    obj.rotation_euler[2] = math.radians(18)
    return obj


def create_scarab() -> bpy.types.Object:
    r = root("Scarab_Root")
    shell = painted_material("shell", metallic=0.32, roughness=0.31)
    bone = painted_material("bone", metallic=0.05, roughness=0.48)
    ember = glow_material("ScarabCore", (1.0, 0.23, 0.035), 5.0)
    parent_keep(uv_sphere("Scarab_Body", (0.0, 0.72, 0.0), (0.82, 0.47, 1.18), shell), r)
    left_shell = uv_sphere("Scarab_Shell_L", (-0.32, 0.95, 0.02), (0.47, 0.25, 0.93), shell, 32, 20)
    right_shell = uv_sphere("Scarab_Shell_R", (0.32, 0.95, 0.02), (0.47, 0.25, 0.93), shell, 32, 20)
    parent_keep(left_shell, r)
    parent_keep(right_shell, r)
    parent_keep(ico("Scarab_Head", (0.0, 0.68, -1.13), (0.58, 0.42, 0.48), bone, 3), r)
    parent_keep(uv_sphere("Scarab_Core", (0.0, 0.82, -0.68), (0.22, 0.22, 0.22), ember, 28, 16), r)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        gait = root(f"Scarab_Gait_{side}", (sign * 0.48, 0.68, 0.0))
        parent_keep(gait, r)
        for index, z in enumerate((-0.68, 0.0, 0.65)):
            hip = (sign * 0.48, 0.68, z)
            knee = (sign * (1.02 + 0.12 * abs(z)), 0.39, z + 0.10)
            foot = (sign * 1.33, 0.08, z + 0.26)
            parent_keep(cylinder_between(f"Scarab_{side}_Upper_{index}", hip, knee, 0.11, bone, taper=0.72), gait)
            parent_keep(cylinder_between(f"Scarab_{side}_Lower_{index}", knee, foot, 0.09, shell, taper=0.42), gait)
            parent_keep(ico(f"Scarab_{side}_Joint_{index}", knee, (0.15, 0.15, 0.15), ember, 2), gait)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        jaw = cylinder_between(f"Scarab_Jaw_{side}", (sign * 0.23, 0.62, -1.35), (sign * 0.46, 0.35, -1.78), 0.10, bone, taper=0.28)
        parent_keep(jaw, r)
    return r


def create_manta() -> bpy.types.Object:
    r = root("Manta_Root")
    hide = painted_material("violet", metallic=0.08, roughness=0.36)
    rim = painted_material("rime", metallic=0.18, roughness=0.29)
    glow = glow_material("MantaVein", (0.11, 0.83, 0.91), 4.8)
    parent_keep(uv_sphere("Manta_Body", (0.0, 0.62, 0.0), (0.52, 0.23, 1.08), hide, 40, 22), r)
    parent_keep(cone("Manta_Tail", (0.0, 0.60, 1.35), 0.16, 1.45, rim, 24, (math.pi / 2, 0.0, 0.0)), r)
    parent_keep(uv_sphere("Manta_Core", (0.0, 0.69, -0.38), (0.24, 0.12, 0.34), glow, 28, 14), r)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        wing = root(f"Manta_Wing_{side}", (sign * 0.24, 0.65, -0.16))
        parent_keep(wing, r)
        parent_keep(cylinder_between(f"Manta_Ray_{side}_A", (sign * 0.24, 0.65, -0.42), (sign * 1.42, 0.55, 0.22), 0.24, hide, vertices=32, taper=0.22), wing)
        parent_keep(cylinder_between(f"Manta_Ray_{side}_B", (sign * 0.25, 0.64, 0.02), (sign * 1.20, 0.43, 0.82), 0.20, hide, vertices=32, taper=0.15), wing)
        parent_keep(cylinder_between(f"Manta_Vein_{side}", (sign * 0.18, 0.70, -0.34), (sign * 1.27, 0.60, 0.28), 0.035, glow, vertices=12, taper=0.45), wing)
    parent_keep(torus("Manta_Halo", (0.0, 0.67, -0.52), 0.42, 0.035, glow), r)
    return r


def create_husk() -> bpy.types.Object:
    r = root("Husk_Root")
    iron = painted_material("iron", metallic=0.58, roughness=0.34)
    bone = painted_material("bone", metallic=0.03, roughness=0.53)
    ember = glow_material("HuskFurnace", (1.0, 0.18, 0.025), 6.0)
    parent_keep(uv_sphere("Husk_Torso", (0.0, 1.04, 0.1), (0.92, 0.68, 1.28), iron, 44, 26), r)
    parent_keep(uv_sphere("Husk_Furnace", (0.0, 1.12, -0.74), (0.34, 0.38, 0.20), ember, 32, 18), r)
    parent_keep(ico("Husk_Head", (0.0, 0.94, -1.25), (0.70, 0.49, 0.54), bone, 3), r)
    parent_keep(uv_sphere("Husk_Eye_L", (-0.22, 1.02, -1.64), (0.09, 0.07, 0.05), ember, 20, 12), r)
    parent_keep(uv_sphere("Husk_Eye_R", (0.22, 1.02, -1.64), (0.09, 0.07, 0.05), ember, 20, 12), r)
    parent_keep(cylinder_between("Husk_Mandible", (0.0, 0.86, -1.58), (0.0, 0.68, -1.70), 0.12, iron, vertices=20, taper=0.72), r)
    parent_keep(cone("Husk_Horn_L", (-0.34, 1.22, -1.55), 0.15, 0.82, bone, 24, (math.pi / 2.5, 0.0, -0.18)), r)
    parent_keep(cone("Husk_Horn_R", (0.34, 1.22, -1.55), 0.15, 0.82, bone, 24, (math.pi / 2.5, 0.0, 0.18)), r)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        gait = root(f"Husk_Gait_{side}", (sign * 0.62, 0.90, 0.0))
        parent_keep(gait, r)
        for index, z in enumerate((-0.72, 0.68)):
            hip = (sign * 0.62, 0.90, z)
            knee = (sign * 0.91, 0.48, z + (0.12 if index else -0.12))
            foot = (sign * 0.88, 0.10, z + (0.38 if index else -0.38))
            parent_keep(cylinder_between(f"Husk_{side}_LegA_{index}", hip, knee, 0.24, iron, vertices=28, taper=0.82), gait)
            parent_keep(cylinder_between(f"Husk_{side}_LegB_{index}", knee, foot, 0.20, bone, vertices=28, taper=0.65), gait)
            parent_keep(cube(f"Husk_{side}_Foot_{index}", foot, (0.27, 0.11, 0.38), iron, bevel_width=0.07), gait)
    for index, z in enumerate((-0.58, 0.0, 0.59)):
        parent_keep(cube(f"Husk_Armor_{index}", (0.0, 1.63, z), (0.77, 0.10, 0.32), iron, rotation=(0.0, 0.0, 0.0), bevel_width=0.09), r)
    return r


def create_choir() -> bpy.types.Object:
    r = root("Choir_Root")
    shell = painted_material("ivory", metallic=0.12, roughness=0.39)
    void = painted_material("violet", metallic=0.30, roughness=0.27)
    glow = glow_material("ChoirVoice", (0.74, 0.18, 0.70), 5.4)
    parent_keep(ico("Choir_Cradle", (0.0, 0.86, 0.0), (0.64, 0.64, 0.64), shell, 4), r)
    parent_keep(uv_sphere("Choir_Core", (0.0, 0.87, 0.0), (0.34, 0.34, 0.34), glow, 32, 18), r)
    parent_keep(torus("Choir_Ring_A", (0.0, 0.87, 0.0), 0.83, 0.07, void, (math.pi / 2, 0.0, 0.0)), r)
    ring_b = torus("Choir_Ring_B", (0.0, 0.87, 0.0), 1.04, 0.045, glow, (0.0, 0.0, math.pi / 2))
    parent_keep(ring_b, r)
    orbit = root("Choir_Orbit", (0.0, 0.87, 0.0))
    parent_keep(orbit, r)
    for i in range(5):
        angle = math.tau * i / 5.0
        orb = ico(f"Choir_Voice_{i}", (math.cos(angle) * 1.12, 0.88 + math.sin(angle * 2.0) * 0.18, math.sin(angle) * 1.12), (0.18, 0.18, 0.18), glow if i % 2 else shell, 3)
        parent_keep(orb, orbit)
    return r


def create_warden() -> bpy.types.Object:
    r = root("Warden_Root")
    crown = painted_material("bone", metallic=0.12, roughness=0.39)
    shell = painted_material("violet", metallic=0.46, roughness=0.25)
    iron = painted_material("iron", metallic=0.62, roughness=0.29)
    glow = glow_material("WardenHeart", (1.0, 0.16, 0.035), 4.0)
    # Readable knight anatomy follows CC0 creature-rig reference logic: head,
    # chest, pelvis, two planted leg chains, and two articulated arms.
    parent_keep(uv_sphere("Warden_Torso", (0.0, 2.02, 0.0), (1.16, 1.08, 0.78), shell, 52, 30), r)
    parent_keep(cube("Warden_Pauldrons", (0.0, 2.40, 0.14), (1.14, 0.22, 0.48), iron, bevel_width=0.14), r)
    parent_keep(uv_sphere("Warden_Pelvis", (0.0, 1.10, 0.16), (0.78, 0.48, 0.62), iron, 40, 22), r)
    parent_keep(ico("Warden_Heart", (0.0, 2.04, -0.70), (0.42, 0.50, 0.22), glow, 4), r)
    parent_keep(torus("Warden_HeartFrame", (0.0, 2.04, -0.75), 0.58, 0.055, crown, (math.pi / 2, 0.0, 0.0)), r)
    parent_keep(ico("Warden_Head", (0.0, 3.02, -0.02), (0.68, 0.70, 0.56), iron, 4), r)
    parent_keep(ico("Warden_Mask", (0.0, 3.02, -0.50), (0.58, 0.60, 0.24), crown, 4), r)
    parent_keep(uv_sphere("Warden_Eye_L", (-0.20, 3.08, -0.72), (0.08, 0.07, 0.06), glow, 20, 12), r)
    parent_keep(uv_sphere("Warden_Eye_R", (0.20, 3.08, -0.72), (0.08, 0.07, 0.06), glow, 20, 12), r)
    parent_keep(torus("Warden_Halo", (0.0, 3.05, 0.04), 1.10, 0.085, glow), r)
    cape = root("Warden_Cape", (0.0, 1.78, 0.68))
    parent_keep(cape, r)
    for index, x in enumerate((-0.72, 0.0, 0.72)):
        parent_keep(cylinder_between(f"Warden_CapeFold_{index}", (x * 0.48, 2.22, 0.58), (x, 0.52, 1.02 + abs(x) * 0.18), 0.21 if index == 1 else 0.17, shell, vertices=28, taper=0.24), cape)
    crown_root = root("Warden_Crown", (0.0, 3.38, -0.04))
    parent_keep(crown_root, r)
    for i in range(7):
        angle = -1.05 + i * 0.35
        x = math.sin(angle) * 0.72
        y = 3.58 + math.cos(angle) * 0.16
        spike = cone(f"Warden_CrownSpike_{i}", (x, y, -0.22), 0.16, 0.88 if i in (0, 6) else 1.10, crown, 28, (0.0, 0.0, -angle * 0.32))
        parent_keep(spike, crown_root)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        arm = root(f"Warden_Arm_{side}", (sign * 1.12, 2.36, 0.02))
        parent_keep(arm, r)
        parent_keep(uv_sphere(f"Warden_{side}_Shoulder", (sign * 1.20, 2.34, 0.02), (0.46, 0.46, 0.46), crown, 32, 18), arm)
        parent_keep(cylinder_between(f"Warden_{side}_Upper", (sign * 1.20, 2.28, 0.00), (sign * 1.50, 1.55, -0.18), 0.28, iron, vertices=32, taper=0.78), arm)
        parent_keep(cylinder_between(f"Warden_{side}_Lower", (sign * 1.50, 1.55, -0.18), (sign * 1.52, 0.86, -0.56), 0.24, crown, vertices=32, taper=0.54), arm)
        parent_keep(ico(f"Warden_{side}_Claw", (sign * 1.52, 0.72, -0.68), (0.34, 0.24, 0.42), glow, 3), arm)

        gait = root(f"Warden_Gait_{side}", (sign * 0.48, 1.06, 0.14))
        parent_keep(gait, r)
        parent_keep(cylinder_between(f"Warden_{side}_Thigh", (sign * 0.48, 1.08, 0.14), (sign * 0.62, 0.55, -0.10), 0.31, shell, vertices=32, taper=0.76), gait)
        parent_keep(cylinder_between(f"Warden_{side}_Shin", (sign * 0.62, 0.55, -0.10), (sign * 0.63, 0.17, -0.42), 0.25, crown, vertices=32, taper=0.62), gait)
        parent_keep(cube(f"Warden_{side}_Foot", (sign * 0.63, 0.13, -0.67), (0.34, 0.13, 0.54), iron, bevel_width=0.09), gait)

    tendrils = root("Warden_Tendrils", (0.0, 1.18, 0.54))
    parent_keep(tendrils, r)
    for i, x in enumerate((-0.55, 0.0, 0.55)):
        parent_keep(cylinder_between(f"Warden_Tendril_{i}", (x * 0.6, 1.30, 0.54), (x, 0.38, 1.02 + abs(x) * 0.22), 0.12, shell, vertices=24, taper=0.20), tendrils)
    return r


def tower_base(r: bpy.types.Object, material: bpy.types.Material, glow: bpy.types.Material) -> None:
    parent_keep(cylinder_between("Tower_Plinth", (0.0, 0.04, 0.0), (0.0, 0.36, 0.0), 0.90, material, vertices=48, taper=0.86), r)
    parent_keep(torus("Tower_BaseRing", (0.0, 0.35, 0.0), 0.73, 0.065, glow, (math.pi / 2, 0.0, 0.0)), r)
    for index in range(4):
        angle = math.tau * index / 4.0
        x = math.cos(angle) * 0.72
        z = math.sin(angle) * 0.72
        parent_keep(cube(f"Tower_Foot_{index}", (x, 0.13, z), (0.28, 0.13, 0.48), material, rotation=(0.0, -angle, 0.0), bevel_width=0.065), r)


def create_helios() -> bpy.types.Object:
    r = root("Helios_Root")
    iron = painted_material("iron", metallic=0.67, roughness=0.28)
    bone = painted_material("ivory", metallic=0.18, roughness=0.36)
    glow = glow_material("HeliosCore", (1.0, 0.43, 0.08), 3.4)
    tower_base(r, iron, glow)
    parent_keep(cylinder_between("Helios_Strut_L", (-0.52, 0.31, 0.24), (-0.38, 1.31, 0.02), 0.17, bone, vertices=28, taper=0.82), r)
    parent_keep(cylinder_between("Helios_Strut_R", (0.52, 0.31, 0.24), (0.38, 1.31, 0.02), 0.17, bone, vertices=28, taper=0.82), r)
    parent_keep(cylinder_between("Helios_Spine", (0.0, 0.32, 0.46), (0.0, 1.21, 0.42), 0.18, iron, vertices=28, taper=0.76), r)
    yaw = root("Helios_Yaw", (0.0, 1.40, 0.02))
    parent_keep(yaw, r)
    parent_keep(uv_sphere("Helios_Cradle", (0.0, 1.43, 0.05), (0.72, 0.46, 0.72), iron, 40, 22), yaw)
    parent_keep(cube("Helios_Counterweight", (0.0, 1.47, 0.63), (0.46, 0.31, 0.34), bone, bevel_width=0.11), yaw)
    parent_keep(torus("Helios_Trunnion_L", (-0.58, 1.48, -0.02), 0.25, 0.075, glow, (0.0, math.pi / 2, 0.0)), yaw)
    parent_keep(torus("Helios_Trunnion_R", (0.58, 1.48, -0.02), 0.25, 0.075, glow, (0.0, math.pi / 2, 0.0)), yaw)
    pitch = root("Helios_Pitch", (0.0, 1.52, -0.14))
    parent_keep(pitch, yaw)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        x = sign * 0.27
        parent_keep(cylinder_between(f"Helios_Barrel_{side}", (x, 1.53, -0.18), (x, 1.53, -1.74), 0.15, bone, vertices=32, taper=0.74), pitch)
        parent_keep(cylinder_between(f"Helios_Sleeve_{side}", (x, 1.53, -1.32), (x, 1.53, -1.78), 0.20, iron, vertices=32, taper=0.88), pitch)
        parent_keep(torus(f"Helios_Coil_{side}", (x, 1.53, -0.88), 0.19, 0.038, glow), pitch)
        parent_keep(torus(f"Helios_Muzzle_{side}", (x, 1.53, -1.79), 0.22, 0.055, glow), pitch)
        socket(f"Helios_MuzzleSocket_{side}", (x, 1.53, -1.86), pitch)
    parent_keep(cube("Helios_Bridge", (0.0, 1.72, -0.58), (0.54, 0.12, 0.24), iron, bevel_width=0.08), pitch)
    parent_keep(uv_sphere("Helios_Core", (0.0, 1.47, 0.54), (0.27, 0.27, 0.30), glow, 32, 18), yaw)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        parent_keep(cone(f"Helios_Fin_{side}", (sign * 0.56, 1.66, 0.32), 0.16, 0.54, bone, 20, (0.0, 0.0, sign * 0.34)), yaw)
    return r


def create_vortex() -> bpy.types.Object:
    r = root("Vortex_Root")
    shell = painted_material("shell", metallic=0.55, roughness=0.30)
    copper = painted_material("ember", metallic=0.34, roughness=0.33)
    glow = glow_material("VortexCore", (1.0, 0.20, 0.035), 3.6)
    tower_base(r, shell, glow)
    for index in range(4):
        angle = math.tau * index / 4.0 + math.pi / 4.0
        start = (math.cos(angle) * 0.66, 0.32, math.sin(angle) * 0.66)
        end = (math.cos(angle) * 0.48, 1.08, math.sin(angle) * 0.48)
        parent_keep(cylinder_between(f"Vortex_Piston_{index}", start, end, 0.16, copper, vertices=28, taper=0.72), r)
    parent_keep(cylinder_between("Vortex_Chamber", (0.0, 0.34, 0.0), (0.0, 1.13, 0.0), 0.48, shell, vertices=40, taper=0.76), r)
    parent_keep(torus("Vortex_Containment", (0.0, 0.88, 0.0), 0.60, 0.075, copper, (math.pi / 2, 0.0, 0.0)), r)
    rotor = root("Vortex_Rotor", (0.0, 1.22, 0.0))
    parent_keep(rotor, r)
    for i in range(6):
        angle = math.tau * i / 6.0
        inner = (math.cos(angle) * 0.27, 1.24, math.sin(angle) * 0.27)
        outer = (math.cos(angle) * 0.94, 1.36, math.sin(angle) * 0.94)
        parent_keep(cylinder_between(f"Vortex_Hammer_{i}", inner, outer, 0.16, shell, vertices=24, taper=0.48), rotor)
        parent_keep(ico(f"Vortex_Anvil_{i}", outer, (0.25, 0.20, 0.30), copper, 3), rotor)
    parent_keep(uv_sphere("Vortex_Core", (0.0, 1.24, 0.0), (0.38, 0.38, 0.38), glow, 36, 20), rotor)
    parent_keep(torus("Vortex_Aperture", (0.0, 1.30, 0.0), 0.76, 0.075, glow, (math.pi / 2, 0.0, 0.0)), rotor)
    parent_keep(torus("Vortex_Gyro", (0.0, 1.24, 0.0), 0.56, 0.045, copper, (0.0, 0.0, math.pi / 2)), rotor)
    for i in range(3):
        angle = math.tau * i / 3.0 + math.pi / 6.0
        parent_keep(ico(f"Vortex_Keystone_{i}", (math.cos(angle) * 0.62, 1.26, math.sin(angle) * 0.62), (0.14, 0.14, 0.14), glow, 2), rotor)
    socket("Vortex_ApertureSocket", (0.0, 1.30, 0.0), rotor)
    return r


def create_rime() -> bpy.types.Object:
    r = root("Rime_Root")
    iron = painted_material("iron", metallic=0.52, roughness=0.32)
    rime = painted_material("rime", metallic=0.12, roughness=0.25)
    glow = glow_material("RimeCore", (0.10, 0.83, 0.93), 3.2)
    tower_base(r, iron, glow)
    parent_keep(cylinder_between("Rime_Trunk", (0.0, 0.32, 0.20), (0.0, 1.28, 0.05), 0.34, iron, vertices=32, taper=0.72), r)
    for i in range(4):
        angle = math.tau * i / 4.0
        start = (math.cos(angle) * 0.46, 0.34, math.sin(angle) * 0.46)
        end = (math.cos(angle) * 0.78, 1.06, math.sin(angle) * 0.78)
        parent_keep(cylinder_between(f"Rime_BasalShard_{i}", start, end, 0.18, rime, vertices=20, taper=0.0), r)
    yaw = root("Rime_Yaw", (0.0, 1.30, 0.04))
    parent_keep(yaw, r)
    parent_keep(uv_sphere("Rime_Cradle", (0.0, 1.32, 0.02), (0.58, 0.38, 0.54), iron, 36, 20), yaw)
    for side, sign in (("L", -1.0), ("R", 1.0)):
        parent_keep(cylinder_between(f"Rime_Fork_{side}", (sign * 0.34, 1.34, -0.08), (sign * 0.46, 1.70, -0.92), 0.14, rime, vertices=24, taper=0.55), yaw)
        parent_keep(ico(f"Rime_Tine_{side}", (sign * 0.46, 1.70, -0.94), (0.20, 0.24, 0.30), glow, 3), yaw)
    parent_keep(uv_sphere("Rime_Core", (0.0, 1.42, -0.24), (0.29, 0.29, 0.34), glow, 32, 18), yaw)
    parent_keep(torus("Rime_Muzzle", (0.0, 1.58, -1.02), 0.43, 0.055, glow), yaw)
    socket("Rime_MuzzleSocket", (0.0, 1.58, -1.08), yaw)
    halo = root("Rime_Halo", (0.0, 1.58, -0.56))
    parent_keep(halo, yaw)
    parent_keep(torus("Rime_FocusRing", (0.0, 1.58, -0.56), 0.64, 0.045, rime), halo)
    for i in range(4):
        angle = math.tau * i / 4.0
        parent_keep(ico(f"Rime_Chime_{i}", (math.cos(angle) * 0.64, 1.58 + math.sin(angle) * 0.64, -0.56), (0.12, 0.12, 0.12), glow, 2), halo)
    return r


ASSETS = {
    "enemy-scarab": create_scarab,
    "enemy-manta": create_manta,
    "enemy-husk": create_husk,
    "enemy-choir": create_choir,
    "enemy-warden": create_warden,
    "tower-helios": create_helios,
    "tower-vortex": create_vortex,
    "tower-rime": create_rime,
}


def mesh_metrics() -> tuple[int, int, int]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    triangles = sum(len(obj.data.loop_triangles) for obj in meshes)
    return len(meshes), vertices, triangles


def consolidate_meshes(parent: bpy.types.Object) -> None:
    """Join direct static children while preserving animated semantic pivots."""
    for child in list(parent.children):
        if child.type == "EMPTY":
            consolidate_meshes(child)
    meshes = [child for child in parent.children if child.type == "MESH" and child.name not in KEEP_SEPARATE]
    if len(meshes) < 2:
        return
    bpy.ops.object.select_all(action="DESELECT")
    merged_mesh = bpy.data.meshes.new(f"{parent.name}_MergedMesh")
    active = bpy.data.objects.new(f"{parent.name}_Surface", merged_mesh)
    bpy.context.scene.collection.objects.link(active)
    active.parent = parent
    active.location = (0.0, 0.0, 0.0)
    for obj in meshes:
        obj.select_set(True)
    active.select_set(True)
    bpy.context.view_layer.objects.active = active
    bpy.ops.object.join()
    active.name = f"{parent.name}_Surface"
    active["forge_role"] = "consolidated_surface"


def export_asset(asset_id: str, builder) -> None:
    clear_scene()
    scene = bpy.context.scene
    # Blender 5.2 exposes Eevee under BLENDER_EEVEE in the Python enum.
    scene.render.engine = "BLENDER_EEVEE"
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene["forge_asset"] = asset_id
    asset_root = builder()
    source_bounds = {
        obj.name: [
            round(min((obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box), 4),
            round(max((obj.matrix_world @ Vector(corner)).y for corner in obj.bound_box), 4),
        ]
        for obj in scene.objects
        if obj.type == "MESH"
    }
    consolidate_meshes(asset_root)
    # Authoring calls use the runtime basis: X right, Y up, negative Z forward.
    # Blender is Z-up, so convert the complete authored rig before glTF export.
    asset_root.rotation_euler[0] = math.pi / 2
    asset_root["forge_forward"] = "-Z"
    asset_root["forge_up"] = "+Y"
    bpy.context.view_layer.update()
    for obj in scene.objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            obj["casts_shadow"] = True
    meshes, vertices, triangles = mesh_metrics()
    pivots = {
        obj.name: [round(value, 4) for value in obj.matrix_world.translation]
        for obj in scene.objects
        if obj.type == "EMPTY" and obj != asset_root and obj.get("forge_role") == "animated_root"
    }
    sockets = {
        obj.name: [round(value, 4) for value in obj.matrix_world.translation]
        for obj in scene.objects
        if obj.type == "EMPTY" and obj.get("forge_role") == "socket"
    }
    target = MODEL_DIR / f"{asset_id}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLB",
        export_yup=True,
        export_animations=False,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        # None of the shipped materials has a normal map, so tangents add export work and warnings without a runtime use.
        export_tangents=False,
        export_attributes=True,
        export_extras=True,
        export_apply=True,
        export_image_format="AUTO",
        export_meshopt_compression_enable=True,
        export_meshopt_extension="EXT_meshopt_compression",
    )
    MANIFEST[asset_id] = {
        "file": f"assets/models/{asset_id}.glb",
        "bytes": target.stat().st_size,
        "meshNodes": meshes,
        "vertices": vertices,
        "triangles": triangles,
        "semanticPivots": pivots,
        "sockets": sockets,
        "authoredVerticalBounds": [
            min(bounds[0] for bounds in source_bounds.values()),
            max(bounds[1] for bounds in source_bounds.values()),
        ],
    }
    print(f"FORGE_ASSET {asset_id} meshes={meshes} vertices={vertices} triangles={triangles} bytes={target.stat().st_size}")


def main() -> None:
    for palette in PALETTES:
        pigment_image(palette)
    for asset_id, builder in ASSETS.items():
        export_asset(asset_id, builder)
    manifest_path = MODEL_DIR / "asset-manifest.json"
    manifest_path.write_text(json.dumps({"generator": bpy.app.version_string, "assets": MANIFEST}, indent=2) + "\n", encoding="utf-8")
    print(f"FORGE_COMPLETE assets={len(MANIFEST)} manifest={manifest_path}")


if __name__ == "__main__":
    main()
