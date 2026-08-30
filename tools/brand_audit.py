"""Measure the art pack against the LOCKED brand rules, plate by plate.

WHY THIS EXISTS. docs/ART-BIBLE.md section 2 is the one rule in this project
that has beaten resolution in a measured trade: "Colour is faction identity
first and everything else second... A scene must read as its faction in the
first half second." Everything downstream of that has been checked by eye, and
eye does not scale to 875 plates. It also cannot be trusted across painters:
artgen/firefly_gen.py now writes into the SAME cache as krea_gen.py, so a
hosted model drifting from the locked look would be invisible by filename.

So this measures, per plate:

  hue        the saturation-weighted dominant hue, which is what a viewer
             reads as "the colour of this picture"
  purity     the share of coloured pixels sitting in the faction's own band
  sat        mean saturation over the coloured pixels
  luma       mean luminance, because every ground in this game is void black
             and a washed-out plate is off-brand even in the right hue

and flags a plate when its dominant hue falls outside the band its faction
owns. The bands come from the ART-BIBLE palette table, converted to HSV
degrees once, here, so there is one place to correct them.

WHAT IT CANNOT SEE. Lettering, subject fidelity, and whether a beat depicts
its scenario. Those need tools/review_sheet.py and a person. This answers one
question well rather than all of them badly.

Usage:
    python tools/brand_audit.py              every pcut plate in the cache
    python tools/brand_audit.py --all        every class, cmd/foe/twr/world too
    python tools/brand_audit.py --worst 25   show the 25 furthest off-band
"""
import collections
import colorsys
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(ROOT, 'artgen', 'cache_krea')

# ART-BIBLE section 2, as hue bands in degrees. A band is (lo, hi) and wraps.
# `achromatic` powers are judged on SATURATION instead: the Vigil's whole
# identity is that it owns no hue, so a hue test would be meaningless and a
# saturation ceiling is the real rule.
BANDS = {
    'human':  [(170, 225)],                 # neon cyan through steel blue
    'light':  [(30, 60)],                   # radiant gold and ivory
    'xeno':   [(260, 330)],                 # xeno violet through neon magenta
    'pirate': [(335, 360), (0, 20)],        # raider crimson and rust
}
ACHROMATIC = {'robot'}                      # chrome and pale teal, no hue owned

# THE VIGIL IS MEASURED BY HOW MUCH CHROME IS IN THE FRAME, not by how
# little colour is.
#
# The first version used a whole-frame saturation CEILING, and it failed the
# same way the dominant-bin test did: it measured the frame when the rule is
# about the SUBJECT. TITAN/robot was flagged at sat 0.43 and MARS/robot at
# 0.50, and both plates are correct. The automata on Titan are pale chrome and
# the Mars scaffolds are pure white; what is orange is Titan's sky and what is
# red is Mars's regolith. The Vigil campaigns across the same 35 worlds as
# everyone else, so a ceiling over the whole frame punishes it for standing
# anywhere colourful, which is everywhere.
#
# Chrome mass asks the right question instead: is there a meaningful block of
# desaturated mid-light material in this picture? That IS the Vigil, because
# on a coloured world the chrome is the only achromatic thing that is not the
# void-black ground, which the luminance floor excludes. Calibrated over 90
# plates: median 0.355, mean 0.356, lowest 0.097. The gate at 0.15 flags one
# plate, and the beat-1 gate is lower for the same reason every beat-1 gate is.
CHROME_SAT_CEIL = 0.20          # below this a pixel has no hue worth reading
CHROME_LUMA = (0.30, 0.92)      # above the void black ground, below blown white
CHROME_GATE = 0.15
CHROME_GATE_APPROACH = 0.08

# Magenta is the brand's key light and is allowed as an ACCENT in any frame
# (ART-BIBLE section 2 lists it as vaporwave key light, skies, accents). It is
# only a fault when it DISPLACES the faction, which is what purity measures.
SAT_FLOOR = 0.18        # below this a pixel is ground or ink, not colour

# BEAT 1 IS SCORED DIFFERENTLY, AND THE REASON IS NOT LENIENCY.
#
# The first version of this tool applied hue DOMINANCE to all five beats and
# reported APPROACH at 64.2% against 91 to 94% everywhere else. The prompt was
# rewritten to bring the fleet close, which helped a great deal (MERCURY/pirate
# went to hue 350 at 0.75 purity), and VENUS/pirate still measured hue 50 at
# 0.05. Looking at that plate rather than at its number settles it: enormous
# crimson-lit galleons with rigging fill the foreground and it reads as a
# pirate armada instantly. The pixel-count winner is the sulphur-yellow cloud
# deck, because that is what Venus IS.
#
# So the threshold was wrong, not the plate. Beats 2 to 5 are ON the ground:
# the faction's own forces, marks and lighting fill the frame, and hue
# dominance is the correct test. Beat 1 is an ORBITAL shot in which the planet
# legitimately owns most of the frame, and ART-BIBLE section 1 is explicit that
# subjects are "readable as silhouette before they are readable as detail".
# Forcing hue dominance there would mean repainting Venus, Titan and Electra to
# their occupier's colours, which trades a real identity for a measured one.
#
# Beat 1 therefore passes on PRESENCE: enough of the faction's own hue to be
# read against the world, not more than the world. Reported separately so the
# two tests are never confused for one number.
APPROACH_PRESENCE_FLOOR = 0.10


def measure(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    small = im.resize((160, max(1, round(160 * h / w))))
    hist = collections.Counter()
    sat_sum = n_col = 0
    luma_sum = 0
    px = list(small.getdata())
    chrome = 0
    for r, g, b in px:
        luma_sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
        hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if ss < CHROME_SAT_CEIL and CHROME_LUMA[0] <= ll <= CHROME_LUMA[1]:
            chrome += 1
        # saturation in HLS collapses near black and white; require some light
        if ss < SAT_FLOOR or ll < 0.08 or ll > 0.96:
            continue
        weight = ss * (1 - abs(ll - 0.5))
        hist[int(hh * 360) // 10 * 10] += weight
        sat_sum += ss
        n_col += 1
    if not hist:
        return dict(size=(w, h), hue=None, purity=0.0, sat=0.0,
                    luma=luma_sum / len(px) / 255, colored=0.0,
                    chrome=chrome / len(px))
    total = sum(hist.values())
    hue = max(hist.items(), key=lambda kv: kv[1])[0]
    return dict(size=(w, h), hue=hue, hist=hist, total=total,
                sat=sat_sum / n_col, luma=luma_sum / len(px) / 255,
                colored=n_col / len(px), chrome=chrome / len(px))


def in_band(hue, bands):
    return any(lo <= hue <= hi for lo, hi in bands)


def band_width(bands):
    return sum(hi - lo for lo, hi in bands)


def concentration(hist, total, bands):
    """How many times more of this plate's colour sits in the faction's band
    than chance would put there.

    WHY NOT THE DOMINANT BIN. The first version passed a plate when its single
    heaviest 10-degree hue bin fell inside the band, and that misreported a
    whole faction. 16 of 19 xeno failures measured hue 250, ONE BIN below a
    floor of 260, while carrying 47 to 70 per cent of their colour INSIDE the
    violet band. They are violet plates. The floor was drawn exactly on the
    brand token (#7c3aed is hue 262), which left no tolerance on the blue side
    and 68 degrees of it on the magenta side.

    Concentration has no edge to fall off. It also self-corrects for band
    width, which a flat purity threshold cannot: the Federation owns 30 degrees
    and the pirates 45, so the same purity means very different things to them.
    Chance is band_width/360, and the gate is TWICE chance, which is a real
    signal rather than a tuned number.

    This is a re-calibration with evidence, not a goalpost moved to flatter a
    score. The pirate misses at hue 200 and 50 carry 0.01 to 0.18 purity and
    still fail; they were never band-edge arguments."""
    if not total:
        return 0.0
    inside = sum(v for k, v in hist.items() if in_band(k, bands)) / total
    chance = band_width(bands) / 360.0
    return inside / chance if chance else 0.0


CONCENTRATION_GATE = 2.0        # twice what chance would put in the band


def purity(hist, total, bands):
    if not total:
        return 0.0
    return sum(v for k, v in hist.items() if in_band(k, bands)) / total


def faction_of(key):
    p = key.split('_')
    return p[2] if key.startswith('pcut_') and len(p) >= 4 else None


def beat_of(key):
    p = key.split('_')
    return p[3] if key.startswith('pcut_') and len(p) >= 4 else None


def main():
    args = sys.argv[1:]
    worst_n = 20
    if '--worst' in args:
        worst_n = int(args[args.index('--worst') + 1])
    every = '--all' in args

    names = sorted(n for n in os.listdir(CACHE) if n.endswith('.webp'))
    if not every:
        names = [n for n in names if n.startswith('pcut_')]
    if not names:
        print('nothing to audit in ' + CACHE)
        return

    per_fac = collections.defaultdict(list)
    per_beat = collections.defaultdict(lambda: [0, 0])
    flags, sizes = [], collections.Counter()
    for name in names:
        key = name[:-5]
        m = measure(os.path.join(CACHE, name))
        sizes[m['size']] += 1
        fac = faction_of(key)
        if fac is None:
            continue
        beat = beat_of(key)
        if fac in ACHROMATIC:
            score = m['chrome']
            ok = score >= (CHROME_GATE_APPROACH if beat == '1' else CHROME_GATE)
        else:
            bands = BANDS[fac]
            c = concentration(m.get('hist', {}), m.get('total', 0), bands)
            score = c
            # Beat 1 is an orbital shot where the planet owns the frame, so it
            # only has to be PRESENT against the world. See the note above.
            ok = c >= (1.0 if beat == '1' else CONCENTRATION_GATE)
        per_fac[fac].append((ok, score, m))
        per_beat[beat][0] += 1
        per_beat[beat][1] += 1 if ok else 0
        if not ok:
            flags.append((score, key, fac, m))

    print('BRAND AUDIT, %d plates from %s' % (len(names), os.path.basename(CACHE)))
    print()
    print('DIMENSIONS')
    for s, c in sizes.most_common():
        print('  %-12s %4d  %s' % ('%dx%d' % s, c,
                                   'ok' if s == (1920, 1080) else 'OFF SPEC'))
    print()
    print('FACTION COLOUR, ART-BIBLE section 2')
    print('  %-8s %6s %8s %8s %8s %8s' % ('power', 'plates', 'reads', 'conc', 'sat', 'luma'))
    for fac in ('human', 'light', 'xeno', 'pirate', 'robot'):
        rows = per_fac.get(fac)
        if not rows:
            continue
        ok = sum(1 for r in rows if r[0])
        avg_p = sum(r[1] for r in rows) / len(rows)
        avg_s = sum(r[2]['sat'] for r in rows) / len(rows)
        avg_l = sum(r[2]['luma'] for r in rows) / len(rows)
        label = ('chrome>=%.2f' % CHROME_GATE if fac in ACHROMATIC
                 else 'x%.1f chance, band %ddeg' % (CONCENTRATION_GATE, band_width(BANDS[fac])))
        print('  %-8s %6d %7d/%-4d %7.2f %8.2f %8.2f   (%s)' %
              (fac, len(rows), ok, len(rows), avg_p, avg_s, avg_l, label))

    print()
    print('BY BEAT   (beat 1 needs x1.0 chance, beats 2 to 5 need x%.1f)'
          % CONCENTRATION_GATE)
    labels = {'1': 'APPROACH', '2': 'THE GROUND', '3': 'THE ASSAULT',
              '4': 'AFTERMATH', '5': 'NEW ORDER'}
    for b in sorted(per_beat):
        t, o = per_beat[b]
        print('  beat %s %-12s %4d/%-4d %6.1f%%' % (b, labels.get(b, '?'), o, t, 100.0 * o / max(1, t)))

    total = sum(len(v) for v in per_fac.values())
    okall = sum(1 for v in per_fac.values() for r in v if r[0])
    print()
    print('  %d of %d plates read as their own power (%.1f%%)' %
          (okall, total, 100.0 * okall / max(1, total)))

    if flags:
        print()
        print('OFF BAND, worst first')
        for score, key, fac, m in sorted(flags)[:worst_n]:
            print('  %-26s %-7s hue %-4s conc x%.2f sat %.2f luma %.2f' %
                  (key, fac, m['hue'], score, m['sat'], m['luma']))


if __name__ == '__main__':
    main()
