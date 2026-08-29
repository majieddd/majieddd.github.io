"""SPRINTER — bipedal xeno runner. Blender procedural build.
Skeleton: root → pelvis → {spine → head, arm_l → arm_r(no), thigh_l → shin_l, thigh_r → shin_r}
Clips: run (bipedal cycle), attack (leap-claw), death (kneel-collapse).
"""
import bpy, sys, math, mathutils
sys.path.append('D:/DeepseekHarness/repo/polytd/tools/blender')
import lib_asset as LA

la = LA
la.clear()

CRIMSON = (0.86, 0.06, 0.18, 1)   # Hive red
DARKER  = (0.16, 0.07, 0.10, 1)
BONE    = (0.78, 0.80, 0.83, 1)
GLOW    = (1.0, 0.35, 0.4, 1)
EDGE    = (0.30, 0.10, 0.13, 1)

m_hull = la.mat('hull', CRIMSON)
m_dark = la.mat('dark', DARKER)
m_bone = la.mat('bone', BONE)
m_glow = la.mat('glow', GLOW)
m_edge = la.mat('edge', EDGE)

parts = []
def part(group, mat, cx, cy, cz, sx, sy, sz, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    o = bpy.context.active_object
    o.scale = (sx, sy, sz)
    if rot: o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    o.data.materials.append(mat)
    o['group'] = group
    parts.append(o)
    return o

# --- upright biped: X forward, Y up, Z lateral ---
# pelvis at ~y0.78, torso above, head at top
part('pelvis',   m_hull, 0.0, 0.80, 0.0, 0.40, 0.26, 0.34)
part('spine',    m_hull, 0.05, 1.06, 0.0, 0.30, 0.34, 0.26)
part('chest',    m_edge, 0.08, 1.24, 0.0, 0.26, 0.28, 0.30)
part('head',     m_dark, 0.12, 1.52, 0.0, 0.24, 0.30, 0.24)
part('head_eye', m_glow, 0.24, 1.52, 0.0, 0.05, 0.06, 0.20)  # visor forward
part('crest',    m_hull, -0.10, 1.62, 0.0, 0.20, 0.28, 0.10) # swept-back crest
# arms: short forearms held at sides
part('arm_l', m_edge, -0.02, 1.18, 0.24, 0.08, 0.42, 0.08)
part('arm_r', m_edge, -0.02, 1.18, -0.24, 0.08, 0.42, 0.08)
# legs: thigh + shin (L/R)
part('thigh_l', m_hull, 0.0, 0.58, 0.12, 0.12, 0.42, 0.12)
part('shin_l',  m_bone, 0.04, 0.22, 0.12, 0.10, 0.36, 0.10)
part('foot_l',  m_dark, 0.16, 0.05, 0.12, 0.24, 0.08, 0.10)
part('thigh_r', m_hull, 0.0, 0.58, -0.12, 0.12, 0.42, 0.12)
part('shin_r',  m_bone, 0.04, 0.22, -0.12, 0.10, 0.36, 0.10)
part('foot_r',  m_dark, 0.16, 0.05, -0.12, 0.24, 0.08, 0.10)

bbox = {}
for o in parts:
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    mn = [min(v[i] for v in bb) for i in range(3)]
    mx = [max(v[i] for v in bb) for i in range(3)]
    bbox.setdefault(o['group'], []).append((mn, mx))

obj = la.join(parts, 'sprinter')

USED = ['pelvis','spine','head','arm_l','arm_r','thigh_l','shin_l','foot_l','thigh_r','shin_r','foot_r']
vg = {n: obj.vertex_groups.new(name=n) for n in USED}
def in_any(co, boxes, pad=0.03):
    for mn, mx in boxes:
        if all(mn[i] - pad <= co[i] <= mx[i] + pad for i in range(3)):
            return True
    return False
for v in obj.data.vertices:
    assigned = False
    for gname, boxes in bbox.items():
        if gname not in vg: continue
        if in_any(v.co, boxes):
            vg[gname].add([v.index], 1.0, 'REPLACE')
            assigned = True
            break
    if not assigned:
        vg['pelvis'].add([v.index], 1.0, 'REPLACE')

BONES = [
    ('root',   None,    (0.0, 0.0, 0.0), (0.0, 0.5, 0.0)),
    ('pelvis', 'root',  (0.0, 0.80, 0.0), (0.0, 1.0, 0.0)),
    ('spine',  'pelvis',(0.0, 1.0, 0.0), (0.08, 1.32, 0.0)),
    ('head',   'spine', (0.10, 1.36, 0.0), (0.16, 1.62, 0.0)),
    ('arm_l',  'spine', (-0.02, 1.32, 0.24), (-0.02, 0.98, 0.24)),
    ('arm_r',  'spine', (-0.02, 1.32, -0.24), (-0.02, 0.98, -0.24)),
    ('thigh_l','pelvis',(0.0, 0.76, 0.12), (0.02, 0.40, 0.12)),
    ('shin_l', 'thigh_l',(0.02, 0.40, 0.12), (0.10, 0.12, 0.12)),
    ('foot_l', 'shin_l',(0.10, 0.12, 0.12), (0.24, 0.05, 0.12)),
    ('thigh_r','pelvis',(0.0, 0.76, -0.12), (0.02, 0.40, -0.12)),
    ('shin_r', 'thigh_r',(0.02, 0.40, -0.12), (0.10, 0.12, -0.12)),
    ('foot_r', 'shin_r',(0.10, 0.12, -0.12), (0.24, 0.05, -0.12)),
]
arm = la.make_armature('sprinter', BONES)
la.bind(obj, arm)

def R(x=0.0, y=0.0, z=0.0):
    e = mathutils.Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ')
    q = e.to_quaternion()
    return (q.w, q.x, q.y, q.z)

def run_keys():
    keys=[]
    frames=14
    for f in range(frames+1):
        t = f/frames*math.tau
        k={}
        # bipedal run: legs alternate; thighs swing about X (forward/back is Z? legs point DOWN: swing forward = rotate about Z-lateral)
        # with X-forward, legs at ±z: forward-back = rotation about Z axis? No—rot about X moves leg sideways. Forward = rot about Z.
        # BUT Blender Y-up: for a leg pointing -Y, forward swing = rotate about Z (lateral axis)?? Take: leg tip moves +X when rotating about Z (right-hand rule, Z out of +Z side...)
        # Empirically: rotate thigh about Z by ±θ shifts the leg tip in X — that's fore/aft. Good.
        s=math.sin(t); c=math.cos(t)
        k['thigh_l']=(None, R(z=s*34.0), None)
        k['shin_l'] =(None, R(z=max(0.0, math.cos(t))*46.0), None)
        k['foot_l'] =(None, R(z=s*10.0), None)
        k['thigh_r']=(None, R(z=-s*34.0), None)
        k['shin_r'] =(None, R(z=max(0.0, -math.cos(t))*46.0), None)
        k['foot_r'] =(None, R(z=-s*10.0), None)
        # spine/chest counter-sway + bob
        k['pelvis']=([0, math.cos(t*2)*0.02, 0], R(z=s*3.0), None)
        k['spine']=(None, R(z=-s*5.0, x=6.0), None)  # fwd lean 6°
        k['head']=(None, R(z=s*4.0, x=-4.0), None)
        k['arm_l']=(None, R(z=-s*14.0), None)
        k['arm_r']=(None, R(z=s*14.0), None)
        keys.append((f+1,k))
    return keys

def attack_keys():
    keys=[]
    frames=16
    for f in range(frames+1):
        t=f/frames
        l=math.sin(min(1.0,t*1.3)*math.pi)
        k={}
        k['spine']=(None, R(x=-l*26.0), None)
        k['head']=(None, R(x=l*16.0), None)
        k['thigh_l']=(None, R(z=l*20.0, x=l*12.0), None)
        k['thigh_r']=(None, R(z=-l*20.0, x=l*12.0), None)
        k['arm_l']=(None, R(z=-l*30.0), None)
        k['arm_r']=(None, R(z=l*30.0), None)
        k['pelvis']=([0, -l*0.08, 0], None, None)
        keys.append((f+1,k))
    return keys

def death_keys():
    keys=[]
    frames=24
    for f in range(frames+1):
        t=f/frames
        sl=min(1.0,t)
        k={}
        k['pelvis']=([0, -sl*0.62, 0], R(x=sl*52.0), None)
        k['spine']=(None, R(x=sl*30.0), None)
        k['head']=(None, R(x=sl*20.0), None)
        for side in ['l','r']:
            k['shin_'+side]=(None, R(z=sl*46.0), None)
            k['thigh_'+side]=(None, R(z=sl*30.0), None)
        keys.append((f+1,k))
    return keys

run = la.make_action(arm,'run', run_keys())
atk = la.make_action(arm,'attack', attack_keys())
die = la.make_action(arm,'death', death_keys())
BONE_LIST=[b[0] for b in BONES]
la.export({
    'name':'sprinter','obj':obj,'arm':arm,'bones':BONE_LIST,
    'clips':[('run',run,15),('attack',atk,17),('death',die,25)],
    'fps':30,
},'D:/DeepseekHarness/repo/polytd/assets','sprinter')
