"""Keep art/, js/artpack.js and narrative/ in step with cache_krea/ while a
render runs, instead of only at the very end.

WHY THIS EXISTS. `krea_gen.py`'s render loop writes each finished plate
straight to cache_krea/, but art/ and js/artpack.js (what the narrative page
and the game itself actually load) are only written by write_pack(), which
this session had only been calling at the START and END of a run. Measured
live: at 09:39 cache_krea/pcut_30_xeno_2.webp was the freshly re-rendered
Proxima Centauri plate, and art/pcut_30_xeno_2.webp -- what a browser opening
the narrative page would actually fetch -- was still the phase-1 snapshot
from 05:34, FOUR HOURS stale. Worse than merely stale: the storyboard's OWN
staleness marker reads cache_krea's manifest, which by then correctly said
this key was current, so the page would have shown the wrong image with the
warning label that was supposed to catch exactly this REMOVED.

This calls `krea_gen.py --pack` (no model, no GPU, pure file I/O, safe next
to a live render) and `tools/storyboard.js` on an interval, so a browser
looking at narrative/ during the sweep sees plates within one interval of
when they actually finished, with an honest stale/fresh label either way.

    python artgen/watch_and_publish.py            # every 5 minutes until killed
    python artgen/watch_and_publish.py --once      # single pass, then exit
"""
import subprocess
import sys
import time

ROOT = r'D:\ClaudeProjects\RemoteWorkspace\TowerDefense'
HERE = ROOT + r'\artgen'
PY = r'C:\Users\Majied\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe'
ENV = {'PYTHONPATH': r'D:\ClaudeProjects\RemoteWorkspace\artgen-env\Lib\site-packages'}
INTERVAL_SECONDS = 300
ONCE = '--once' in sys.argv


def sync():
    import os
    env = dict(os.environ, **ENV)
    t0 = time.time()
    pack = subprocess.run([PY, 'krea_gen.py', '--pack'], cwd=HERE, env=env,
                          capture_output=True, text=True)
    board = subprocess.run(['node', 'tools/storyboard.js'], cwd=ROOT,
                           capture_output=True, text=True)
    ok = pack.returncode == 0 and board.returncode == 0
    line = next((l for l in pack.stdout.splitlines() if l.startswith('WROTE')), '')
    print(f'[{time.strftime("%H:%M:%S")}] synced in {time.time()-t0:4.1f}s: {line}', flush=True)
    if not ok:
        print('  pack stderr:', pack.stderr[-500:], flush=True)
        print('  storyboard stderr:', board.stderr[-500:], flush=True)
    return ok


sync()
if not ONCE:
    while True:
        time.sleep(INTERVAL_SECONDS)
        sync()
