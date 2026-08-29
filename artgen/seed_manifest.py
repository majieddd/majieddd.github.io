"""One-time backfill of cache_krea/.prompts.json for plates that predate it.

The manifest cannot be reconstructed from the images, so it is reconstructed
from git: for every cached key, record the hash of the prompt AS IT WAS at the
revision that was HEAD when that plate was rendered. The ordinary staleness
check in krea_gen.py then does the rest by itself, with no special cases:

  * prompt unchanged since then -> seeded hash equals current hash -> valid,
    and the 373 planet plates that never moved are not re-rendered.
  * prompt changed since then   -> seeded hash differs -> stale -> re-rendered.
  * key absent from the old catalogue -> it can only have been rendered from
    the current prompt, so it is seeded current.

Everything the old catalogue cannot be parsed for (cmd portraits, which are
not one-line tuples) is deliberately left unseeded, which reads as stale and
costs a re-render. That is the safe direction to be wrong in.

Run once. After this, krea_gen.py maintains the manifest itself.
"""
import hashlib, importlib.util, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, 'cache_krea')
PROMPTS = os.path.join(CACHE, '.prompts.json')
OLD_PLANET = 'df105bc'      # last planet_jobs.py commit before the cache was written
OLD_KREA = 'eb0cd6f'        # last krea_jobs.py commit before the cache was written
sys.path.insert(0, HERE)

h = lambda s: hashlib.sha1((s or '').encode('utf-8')).hexdigest()[:16]


def show(rev, path):
    return subprocess.run(['git', 'show', f'{rev}:{path}'], cwd=ROOT,
                          capture_output=True, text=True, check=True).stdout


def load_module(src, name):
    p = os.path.join(HERE, f'_seed_{name}.py')
    open(p, 'w', encoding='utf-8').write(src)
    spec = importlib.util.spec_from_file_location(name, p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    os.remove(p)
    return m


from krea_jobs import build_jobs
current = {j[0]: j[1] for j in build_jobs() if j[1] is not None}

# OLD planet catalogue, called with the same two arguments as the live one so
# any difference is the catalogue and not the caller.
PAL = {f: 'PAL_' + f for f in ('human', 'light', 'xeno', 'pirate', 'robot')}
old_planet = {k: p for k, p, *_ in
              load_module(show(OLD_PLANET, 'artgen/planet_jobs.py'), 'pj').planet_jobs(PAL, 'STYLE')}

# OLD cutscene catalogue, parsed rather than executed: the old revision may
# import things the working tree no longer has, and a parse cannot fail so.
ENTRY = re.compile(r"\(\s*'([a-z0-9_]+)'\s*,\s*'([a-z]+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)")
old_cut = {m.group(1): m.group(3) for m in ENTRY.finditer(show(OLD_KREA, 'artgen/krea_jobs.py'))}
cur_cut = {m.group(1): m.group(3) for m in
           ENTRY.finditer(open(os.path.join(HERE, 'krea_jobs.py'), encoding='utf-8').read())}

# The old planet catalogue is built with the real palette/style the live one
# uses, so compare like with like by rebuilding the current planet prompts the
# same way rather than against the fully assembled string.
from planet_jobs import planet_jobs as live_planet
cur_planet = {k: p for k, p, *_ in live_planet(PAL, 'STYLE')}

man, seeded, unseeded = {}, {'planet-old': 0, 'cut-old': 0, 'current': 0}, 0
for f in os.listdir(CACHE):
    if not f.endswith('.webp'):
        continue
    key = f[:-5]
    if key not in current:
        continue                      # orphaned cache file, no live prompt
    if key.startswith('pcut_') and key in old_planet:
        # Seed the CURRENT hash when the prompt never moved, and a deliberate
        # mismatch when it did. Comparing the two catalogues built the same
        # way is what makes "never moved" trustworthy.
        man[key] = h(current[key]) if old_planet[key] == cur_planet.get(key) else 'stale-' + h(old_planet[key])
        seeded['planet-old'] += 1
    elif key in old_cut:
        # Same shape for the cutscene plates: the SUBJECT is the only part
        # that moved (palette and style tails are appended downstream), so
        # compare subject to subject and mark accordingly.
        man[key] = (h(current[key]) if old_cut[key] == cur_cut.get(key)
                    else 'stale-' + h(old_cut[key]))
        seeded['cut-old'] += 1
    else:
        man[key] = h(current[key])
        seeded['current'] += 1

tmp = PROMPTS + '.tmp'
json.dump(man, open(tmp, 'w', encoding='utf-8'), indent=0, sort_keys=True)
os.replace(tmp, PROMPTS)

print('seeded', len(man), 'manifest entries')
for k, v in seeded.items():
    print(f'  {k:12s} {v}')
valid = sum(1 for k, v in man.items() if v == h(current[k]))
print(f'\n{valid} cached plates match the current prompt (will NOT be re-rendered)')
print(f'{len(man) - valid} cached plates are stale (WILL be re-rendered)')
