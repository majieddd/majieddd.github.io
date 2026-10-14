"""Poly Protocol — Blender asset export library.

Builds low/medium-poly painted meshes with armatures and animation cycles,
then bakes them into the compact POLY SKIN ASSET v1 format:

  asset.json  — manifest: joints, clips, bounds
  asset.bin   — Float32Array, stride 14: pos3 nrm3 col3 joint4 weight4

Usage inside Blender:

  import bpy, sys
  sys.path.append('.../tools/blender')
  import lib_asset as LA
  LA.export(payload, outdir, prefix)
"""
import bpy, json, struct, math, os
from mathutils import Vector, Matrix, Quaternion

def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.armatures, bpy.data.actions, bpy.data.materials):
        for b in list(block):
            try: block.remove(b)
            except Exception: pass

def mat(name, rgba, metallic=0.0, rough=0.7):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (rgba[0], rgba[1], rgba[2], 1.0)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (rgba[0], rgba[1], rgba[2], 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = rough
    return m

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj

def set_active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

# ---------- armature ----------
def make_armature(name, bones):
    """bones: list of (name, parent_name | None, head(x,y,z), tail(x,y,z))"""
    arm_data = bpy.data.armatures.new(name + '_data')
    arm_obj = bpy.data.objects.new(name + '_arm', arm_data)
    bpy.context.collection.objects.link(arm_obj)
    set_active(arm_obj)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    created = {}
    for (nm, parent, head, tail) in bones:
        b = eb.new(nm)
        b.head = Vector(head); b.tail = Vector(tail)
        if parent: b.parent = created[parent]
        created[nm] = b
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def bind(obj, arm):
    mod = obj.modifiers.new('skin', 'ARMATURE')
    mod.object = arm
    obj.parent = arm
    return obj

# ---------- actions ----------
def make_action(arm, name, keys):
    """keys: list of (frame, {bone: (pos(3)|None, quat(4)|None, scale(3)|None)})."""
    arm.animation_data_create()
    act = bpy.data.actions.new(name)
    arm.animation_data.action = act
    for (frame, poses) in keys:
        for bone, vals in poses.items():
            pb = arm.pose.bones.get(bone)
            if not pb: continue
            pos, quat, scale = vals
            if pos is not None: pb.location = pos; pb.keyframe_insert('location', frame=frame, group=bone)
            if quat is not None: pb.rotation_quaternion = Quaternion(quat); pb.keyframe_insert('rotation_quaternion', frame=frame, group=bone)
            if scale is not None: pb.scale = scale; pb.keyframe_insert('scale', frame=frame, group=bone)
    return act

def bake_action(arm, act, frames, bones):
    """Bake an action to per-bone local TRS at every sampled frame.
    Returns {bone_name: [t,q,s(10 floats) per frame]} in pose-local space."""
    arm.animation_data.action = act
    out = {}
    for i in range(frames):
        frame = i + 1
        bpy.context.scene.frame_set(frame)
        for bn in bones:
            pb = arm.pose.bones.get(bn)
            if not pb: continue
            loc = list(pb.location)
            q = pb.rotation_quaternion
            if q.w == 0 and q.vector.length == 0: q = Quaternion((1, 0, 0, 0))
            scl = pb.scale
            out.setdefault(bn, []).append(loc + list(q) + list(scl))
    return out

# ---------- vertex extraction ----------
def mesh_to_grid(obj, arm, bones):
    """pos nrm color joint weight (stride 14 floats = 56 bytes).
    NOTE: mesh verts are evaluated WITH any active action; we reset all pose
    bones to rest before sampling so verts are in bind (armature) space."""
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    # Use the RAW mesh (armature modifier NOT applied) — verts are in bind space
    me = obj.data
    bone_idx = {b if isinstance(b, str) else b.name: i for i, b in enumerate(bones)}
    vname = {g.index: g.name for g in obj.vertex_groups}
    vjoint = [0] * len(me.vertices)
    for v in me.vertices:
        best = 0.0; bestn = None
        for g in v.groups:
            if g.weight > best:
                best = g.weight
                name = vname.get(g.group)
                if name is not None and name in bone_idx: bestn = bone_idx[name]
        vjoint[v.index] = bestn if bestn is not None else 0
    grid = []
    for poly in me.polygons:
        slots = obj.material_slots
        rgba = (0.5, 0.5, 0.5, 1.0)
        if poly.material_index < len(slots) and slots[poly.material_index] and slots[poly.material_index].material:
            rgba = slots[poly.material_index].material.diffuse_color
        vi = list(poly.vertices)
        for k in range(1, len(vi) - 1):
            for idx in (vi[0], vi[k], vi[k + 1]):
                co = me.vertices[idx].co
                no = me.vertices[idx].normal
                grid += [co.x, co.y, co.z, no.x, no.y, no.z,
                         rgba[0], rgba[1], rgba[2],
                         float(vjoint[idx]), 1.0, 0.0, 0.0, 0.0]
    return grid

# ---------- export ----------
def export(payload, outdir, prefix):
    os.makedirs(outdir, exist_ok=True)
    obj, arm = payload['obj'], payload['arm']
    clips, bones, fps = payload['clips'], payload['bones'], payload.get('fps', 30)
    rest = []
    # Blender bone matrix_local is the bone->armature matrix (column-major-ish 4x4 in POS_COLUMN)
    for b in bones:
        eb = arm.data.bones[b]
        rest.append({'name': b, 'parent': eb.parent.name if eb.parent else None,
                     'head': list(eb.head), 'tail': list(eb.tail),
                     'matrixLocal': [x for row in eb.matrix_local for x in row]})
    grid = mesh_to_grid(obj, arm, bones)
    clip_defs = {}
    for (nm, act, frames) in clips:
        clip_defs[nm] = bake_action(arm, act, frames, bones)
    manifest = {
        'name': payload['name'],
        'verts': len(grid),
        'joints': rest,
        'clipFps': fps,
        'clips': clip_defs,
        'type': 'skin_asset_v1',
    }
    jpath = os.path.join(outdir, prefix + '.json')
    with open(jpath, 'w') as f: json.dump(manifest, f)
    bpath = os.path.join(outdir, prefix + '.bin')
    with open(bpath, 'wb') as f:
        f.write(struct.pack('<%df' % len(grid), *grid))
    print('EXPORTED', prefix, 'verts', len(grid) // 14, 'clips', list(clip_defs.keys()))
