"""CRAWLER — quadruped xeno machine. Blender procedural build.
Skeleton (11 bones): root → body → {head, tail, hip_* ×4 → knee_* ×4}
Clips: walk (trot), attack (lunge), death (collapse).
"""
import bpy, sys, math, mathutils
sys.path.append('D:/DeepseekHarness/repo/polytd/tools/blender')
import lib_asset as LA

la = LA
la.clear()

CHROME  = (0.62, 0.68, 0.75, 1)
CHROME_D= (0.20, 0.23, 0.30, 1)
CYAN    = (0.12, 0.72, 0.88, 1)
CYAN_H  = (0.45, 0.95, 1.0, 1)
RED     = (0.88, 0.07, 0.20, 1)

m_hull = la.mat('hull', CHROME)
m_dark = la.mat('dark', CHROME_D)
m_glow = la.mat('glow', CYAN)
m_glowh= la.mat('glowh', CYAN_H)
m_eye  = la.mat('eye', RED)

parts = []
def part(group, mat, cx, cy, cz, sx, sy, sz, rot=None, name_extra=''):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    o = bpy.context.active_object
    o.scale = (sx, sy, sz)
    if rot:
        o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    o.data.materials.append(mat)
    o['group'] = group
    parts.append(o)
    return o

# torso
part('body', m_hull, 0.0, 0.42, 0.0, 1.5, 0.36, 0.66)
part('head', m_dark, 0.92, 0.50, 0.0, 0.5, 0.30, 0.44)
part('head', m_eye, 1.16, 0.44, 0.0, 0.08, 0.07, 0.30)
part('head', m_glow, 0.86, 0.64, 0.0, 0.06, 0.04, 0.34)
part('tail', m_dark, -0.95, 0.5, 0.0, 0.5, 0.18, 0.22)

LEG_DEFS = [('fl', 0.55, 0.34), ('fr', 0.55, -0.34),
            ('bl', -0.55, 0.34), ('br', -0.55, -0.34)]
for side, x, z in LEG_DEFS:
    part('hip_' + side, m_dark, x, 0.60, z, 0.16, 0.30, 0.16)
    part('knee_' + side, m_hull, x, 0.28, z, 0.11, 0.28, 0.11)
    part('knee_' + side, m_glow, x, 0.44, z, 0.055, 0.05, 0.055)
    part('knee_' + side, m_dark, x, 0.04, z, 0.10, 0.06, 0.22)

# capture AABBs BEFORE join (join invalidates part objects)
bbox = {}
for o in parts:
    bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    mn = [min(v[i] for v in bb) for i in range(3)]
    mx = [max(v[i] for v in bb) for i in range(3)]
    bbox.setdefault(o['group'], []).append((mn, mx))

obj = la.join(parts, 'crawler')

# vertex groups from pre-join group tag: join preserves object names? No — use JSON marker:
# Simplest: bake groups into material-based groups? Materials were merged on join with slots.
# Better: keep positions — assign groups by AABB per group name (exact since parts are distinct boxes).
GROUPS = ['body', 'head', 'tail'] + [g + '_' + s for s in ['fl','fr','bl','br'] for g in ['hip','knee']]
# unique name set actually used:
USED = ['body', 'head', 'tail', 'hip_fl', 'hip_fr', 'hip_bl', 'hip_br',
        'knee_fl', 'knee_fr', 'knee_bl', 'knee_br']
vg = {n: obj.vertex_groups.new(name=n) for n in USED}

def in_any(co, boxes, pad=0.02):
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
        vg['body'].add([v.index], 1.0, 'REPLACE')

# ---------- armature ----------
BONES = [
    ('root', None, (0.0, 0.0, 0.0), (0.0, 0.55, 0.0)),
    ('body', 'root', (0.0, 0.60, 0.0), (0.6, 0.60, 0.0)),
    ('head', 'body', (0.85, 0.55, 0.0), (1.18, 0.55, 0.0)),
    ('tail', 'body', (-0.75, 0.55, 0.0), (-1.1, 0.55, 0.0)),
]
for side, x, z in LEG_DEFS:
    BONES += [
        ('hip_' + side, 'body', (x, 0.60, z), (x, 0.28, z)),
        ('knee_' + side, 'hip_' + side, (x, 0.28, z), (x, 0.02, z)),
    ]
arm = la.make_armature('crawler', BONES)
la.bind(obj, arm)

# ---------- animation helpers ----------
def R(x=0.0, y=0.0, z=0.0):
    e = mathutils.Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ')
    q = e.to_quaternion()
    return (q.w, q.x, q.y, q.z)

LEGS = ['fl', 'fr', 'bl', 'br']

def walk_keys():
    keys = []
    frames = 12
    for f in range(frames + 1):
        t = f / frames * math.tau
        k = {}
        for i, side in enumerate(LEGS):
            ph = t + (0 if i % 2 == 0 else math.pi)
            swing = math.sin(ph) * 20.0
            lift = math.cos(ph)
            k['hip_' + side] = (None, R(z=swing), None)
            k['knee_' + side] = (None, R(z=max(0.0, -lift) * 22.0), None)
        bob = math.sin(t * 2) * 0.045
        k['body'] = ([0.06 * math.sin(t * 2 + 0.7), bob, 0], R(z=math.sin(t * 2) * 1.2, x=math.sin(t * 2) * 0.4), None)
        k['head'] = ([0.04 * math.sin(t * 2 + 1.1), math.sin(t * 2 + 1.4) * 0.03, 0], None, None)
        k['tail'] = (None, R(z=math.sin(t * 2 + 0.6) * 5.0), None)
        keys.append((f + 1, k))
    return keys

def attack_keys():
    keys = []
    frames = 18
    for f in range(frames + 1):
        t = f / frames
        lunge = math.sin(min(1.0, t * 1.3) * math.pi)
        k = {}
        k['body'] = (None, R(x=-lunge * 18.0), None)
        k['head'] = (None, R(x=lunge * 22.0), None)
        k['tail'] = (None, R(x=lunge * 8.0), None)
        for side in LEGS:
            k['hip_' + side] = (None, R(z=lunge * 6.0), None)
        keys.append((f + 1, k))
    return keys

def death_keys():
    keys = []
    frames = 24
    for f in range(frames + 1):
        t = f / frames
        k = {}
        roll = min(1.0, t) * 80.0
        sink = -min(1.0, t) * 0.40
        k['body'] = ([0, 0, sink], None, None)
        k['root'] = (None, R(x=roll), None)
        for side in LEGS:
            k['knee_' + side] = (None, R(x=-min(1.0, t) * 26.0), None)
        keys.append((f + 1, k))
    return keys

walk = la.make_action(arm, 'walk', walk_keys())
attack = la.make_action(arm, 'attack', attack_keys())
death = la.make_action(arm, 'death', death_keys())

BONE_LIST = [b[0] for b in BONES]
la.export({
    'name': 'crawler', 'obj': obj, 'arm': arm, 'bones': BONE_LIST,
    'clips': [('walk', walk, 13), ('attack', attack, 19), ('death', death, 25)],
    'fps': 30,
}, 'D:/DeepseekHarness/repo/polytd/assets', 'crawler')
