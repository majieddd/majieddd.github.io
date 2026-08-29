"""Wait for the running render to finish, then render whatever is still stale.

WHY THIS EXISTS. The sweep runs in phases and prompts kept being CORRECTED
while it ran: the lettering defence, the watcher beat, three seat overrides,
one silent slide. krea_gen.py computes its work list once at startup, so
every one of those corrections lands after the list is fixed and is picked up
only by a LATER run. Without something to start that later run, the sweep
stops one pass short of correct and the last thing anybody did was make it
worse on paper.

WHY IT WAITS RATHER THAN JUST RUNNING. Two Krea jobs on one card do not fail,
they CRAWL: measured at zero images in twenty minutes against a 48s baseline,
with the GPU pegged, which reads exactly like a broken pipeline and is not
one. So this polls for a live krea_gen.py by COMMAND LINE and refuses to
start while one exists. nvidia-smi is not enough on its own; it shows the pid
and not what the pid is.

Loops until nothing is stale, because a pass can itself be overtaken by a
prompt edit, and stops after MAX_PASSES so a genuine disagreement between the
manifest and the renderer cannot spin forever.

    python artgen/finish_sweep.py
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
PY = r'C:\Users\Majied\AppData\Roaming\uv\python\cpython-3.12.14-windows-x86_64-none\python.exe'
ENV = dict(os.environ, PYTHONPATH=r'D:\ClaudeProjects\RemoteWorkspace\artgen-env\Lib\site-packages')
POLL_SECONDS = 60
MAX_WAIT_HOURS = 14
MAX_PASSES = 4


def krea_running():
    """True while another krea_gen.py holds the card. Matches on the COMMAND
    LINE, because every python on this machine looks the same to a name."""
    try:
        out = subprocess.run(
            ['powershell', '-NoProfile', '-Command',
             "Get-CimInstance Win32_Process -Filter \"Name like '%python%'\" "
             "| Select-Object -ExpandProperty CommandLine"],
            capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return True          # cannot tell: assume busy, never race the card
    # `--stale` and `--pack` both return before the model is ever loaded and
    # hold nothing, so neither reads as a render. `--pack` was added to this
    # exclusion after the fact: artgen/watch_and_publish.py calls it every
    # five minutes to keep art/ in step with cache_krea/ while this script is
    # ALSO polling, and without the exclusion this function would see that
    # call's own command line, conclude a render was still running, and wait
    # forever -- including forever past the point the real render finished.
    NOT_A_RENDER = ('--stale', '--pack')
    return any('krea_gen.py' in ln and not any(f in ln for f in NOT_A_RENDER)
              for ln in out.splitlines())


def stale_count():
    r = subprocess.run([PY, 'krea_gen.py', '--stale'], cwd=HERE, env=ENV,
                       capture_output=True, text=True)
    for ln in r.stdout.splitlines():
        if 'STALE' in ln:
            return int(ln.split()[0])
    return 0


deadline = time.time() + MAX_WAIT_HOURS * 3600
while krea_running():
    if time.time() > deadline:
        print('gave up waiting for the running render', flush=True)
        sys.exit(1)
    print('another krea_gen.py holds the card, waiting ...', flush=True)
    time.sleep(POLL_SECONDS)

for p in range(1, MAX_PASSES + 1):
    n = stale_count()
    print(f'pass {p}: {n} stale', flush=True)
    if n == 0:
        break
    subprocess.run([PY, 'krea_gen.py'], cwd=HERE, env=ENV)

print('FINAL stale:', stale_count(), flush=True)
print('SWEEP COMPLETE', flush=True)
