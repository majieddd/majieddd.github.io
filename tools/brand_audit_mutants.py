"""Does brand_audit still catch an off-brand plate?

WHY THIS EXISTS, AND WHY IT IS NOT OPTIONAL. brand_audit.py was re-calibrated
THREE times in one session and its headline score rose every time, 86.9% to
92.6% to 97.8% to 98.2%. Each change was made after looking at a plate and
finding the METRIC wrong rather than the art:

  1. beat 1 scored on presence, not dominance, because VENUS/pirate reads as a
     pirate armada while the sulphur-yellow cloud deck wins the pixel count;
  2. concentration replaced the dominant-hue bin, because 16 of 19 xeno
     failures sat ONE BIN below a floor drawn exactly on the brand token while
     carrying 47 to 70 per cent of their colour inside the band;
  3. the Vigil moved from a saturation ceiling to CHROME MASS, because
     TITAN/robot and MARS/robot were flagged for standing on an orange sky and
     a red regolith while the automata themselves were correctly colourless.

That is a defensible history and it is also exactly what tuning a metric to
flatter a score looks like from outside. So the loosened gates are PROVEN to
still bite rather than argued to. Three plates that pass are deliberately
broken and the audit must fail all three.

Nothing touches the cache. Each mutant is built in memory, written to a scratch
directory, measured there, and the scratch directory is removed in a finally.

    python tools/brand_audit_mutants.py
"""
import colorsys
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import brand_audit as BA                                          # noqa: E402

SCRATCH = os.path.join(os.path.dirname(HERE), '_review', '_mutants')

# (key, faction, beat, what to do, description). The keys are chosen to be
# plates that PASS, so a caught mutant is a real state change and not a plate
# that was already failing.
MUTANTS = [
    ('pcut_00_light_2',  'light',  '2', ('rotate', 180),
     'Federation gold rotated to blue'),
    ('pcut_00_human_2',  'human',  '2', ('rotate', 150),
     'human cyan rotated to red'),
    ('pcut_12_robot_2',  'robot',  '2', ('saturate', 0.08),
     'Vigil chrome saturated into colour'),
    ('pcut_00_pirate_2', 'pirate', '2', ('rotate', 200),
     'pirate crimson rotated to teal'),
]


def verdict(path, fac, beat):
    """The same decision brand_audit makes, read from its own constants."""
    m = BA.measure(path)
    if fac in BA.ACHROMATIC:
        score = m['chrome']
        gate = BA.CHROME_GATE_APPROACH if beat == '1' else BA.CHROME_GATE
    else:
        score = BA.concentration(m.get('hist', {}), m.get('total', 0), BA.BANDS[fac])
        gate = 1.0 if beat == '1' else BA.CONCENTRATION_GATE
    return score >= gate, score, m['hue']


def build(src, op):
    im = Image.open(src).convert('RGB').resize((320, 180))
    px = im.load()
    kind, arg = op
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b = px[x, y]
            hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if kind == 'rotate':
                hh = (hh + arg / 360.0) % 1.0
            else:                                   # saturate into one hue
                hh, ss = arg, min(1.0, ss + 0.7)
            rr, gg, bb = colorsys.hls_to_rgb(hh, ll, ss)
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255))
    return im


def main():
    shutil.rmtree(SCRATCH, ignore_errors=True)
    os.makedirs(SCRATCH, exist_ok=True)
    caught = missed = skipped = 0
    try:
        print('%-40s %-9s %8s' % ('mutant', 'verdict', 'score'))
        for key, fac, beat, op, what in MUTANTS:
            src = os.path.join(BA.CACHE, key + '.webp')
            if not os.path.exists(src):
                print('%-40s %-9s   (%s not rendered yet)' % (what, 'SKIP', key))
                skipped += 1
                continue
            ok0, sc0, _ = verdict(src, fac, beat)
            if not ok0:
                print('%-40s %-9s %8.2f  control already failing, mutant proves nothing'
                      % (what, 'INVALID', sc0))
                missed += 1
                continue
            dst = os.path.join(SCRATCH, key + '.webp')
            build(src, op).save(dst, 'WEBP', quality=82)
            ok1, sc1, hue1 = verdict(dst, fac, beat)
            if ok1:
                print('%-40s %-9s %8.2f  hue %s  MUTANT SURVIVED' % (what, 'MISSED', sc1, hue1))
                missed += 1
            else:
                print('%-40s %-9s %8.2f  hue %s  (control %.2f)' % (what, 'CAUGHT', sc1, hue1, sc0))
                caught += 1
    finally:
        shutil.rmtree(SCRATCH, ignore_errors=True)

    print()
    print('%d caught, %d missed, %d skipped' % (caught, missed, skipped))
    if missed:
        print('BRAND AUDIT HAS LOST ITS TEETH: a plate it should reject passed.')
    return 1 if missed else 0


if __name__ == '__main__':
    sys.exit(main())
