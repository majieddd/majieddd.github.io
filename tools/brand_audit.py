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
# `achromatic` powers are judged on SATURATION instead: the Parallel's whole
# identity is that it owns no hue, so a hue test would be meaningless and a
# saturation ceiling is the real rule.
BANDS = {
    'human':  [(170, 225)],                 # neon cyan through steel blue
    'light':  [(30, 60)],                   # radiant gold and ivory
    'xeno':   [(260, 330)],                 # xeno violet through neon magenta
    'pirate': [(335, 360), (0, 20)],        # raider crimson and rust
}
ACHROMATIC = {'robot'}                      # chrome and pale teal, no hue owned
ACHROMATIC_SAT_CEIL = 0.42

# Magenta is the brand's key light and is allowed as an ACCENT in any frame
# (ART-BIBLE section 2 lists it as vaporwave key light, skies, accents). It is
# only a fault when it DISPLACES the faction, which is what purity measures.
SAT_FLOOR = 0.18        # below this a pixel is ground or ink, not colour


def measure(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    small = im.resize((160, max(1, round(160 * h / w))))
    hist = collections.Counter()
    sat_sum = n_col = 0
    luma_sum = 0
    px = list(small.getdata())
    for r, g, b in px:
        luma_sum += 0.2126 * r + 0.7152 * g + 0.0722 * b
        hh, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        # saturation in HLS collapses near black and white; require some light
        if ss < SAT_FLOOR or ll < 0.08 or ll > 0.96:
            continue
        weight = ss * (1 - abs(ll - 0.5))
        hist[int(hh * 360) // 10 * 10] += weight
        sat_sum += ss
        n_col += 1
    if not hist:
        return dict(size=(w, h), hue=None, purity=0.0, sat=0.0,
                    luma=luma_sum / len(px) / 255, colored=0.0)
    total = sum(hist.values())
    hue = max(hist.items(), key=lambda kv: kv[1])[0]
    return dict(size=(w, h), hue=hue, hist=hist, total=total,
                sat=sat_sum / n_col, luma=luma_sum / len(px) / 255,
                colored=n_col / len(px))


def in_band(hue, bands):
    return any(lo <= hue <= hi for lo, hi in bands)


def purity(hist, total, bands):
    if not total:
        return 0.0
    return sum(v for k, v in hist.items() if in_band(k, bands)) / total


def faction_of(key):
    p = key.split('_')
    return p[2] if key.startswith('pcut_') and len(p) >= 4 else None


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
    flags, sizes = [], collections.Counter()
    for name in names:
        key = name[:-5]
        m = measure(os.path.join(CACHE, name))
        sizes[m['size']] += 1
        fac = faction_of(key)
        if fac is None:
            continue
        if fac in ACHROMATIC:
            ok = m['sat'] <= ACHROMATIC_SAT_CEIL
            score = m['sat']
        else:
            bands = BANDS[fac]
            p = purity(m.get('hist', {}), m.get('total', 0), bands)
            ok = in_band(m['hue'], bands) if m['hue'] is not None else False
            score = p
        per_fac[fac].append((ok, score, m))
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
    print('  %-8s %6s %8s %8s %8s %8s' % ('power', 'plates', 'in band', 'purity', 'sat', 'luma'))
    for fac in ('human', 'light', 'xeno', 'pirate', 'robot'):
        rows = per_fac.get(fac)
        if not rows:
            continue
        ok = sum(1 for r in rows if r[0])
        avg_p = sum(r[1] for r in rows) / len(rows)
        avg_s = sum(r[2]['sat'] for r in rows) / len(rows)
        avg_l = sum(r[2]['luma'] for r in rows) / len(rows)
        label = 'sat<=%.2f' % ACHROMATIC_SAT_CEIL if fac in ACHROMATIC else 'hue'
        print('  %-8s %6d %7d/%-4d %7.2f %8.2f %8.2f   (%s)' %
              (fac, len(rows), ok, len(rows), avg_p, avg_s, avg_l, label))

    total = sum(len(v) for v in per_fac.values())
    okall = sum(1 for v in per_fac.values() for r in v if r[0])
    print()
    print('  %d of %d plates read as their own power (%.1f%%)' %
          (okall, total, 100.0 * okall / max(1, total)))

    if flags:
        print()
        print('OFF BAND, worst first')
        for score, key, fac, m in sorted(flags)[:worst_n]:
            print('  %-26s %-7s hue %-4s purity %.2f sat %.2f luma %.2f' %
                  (key, fac, m['hue'], score, m['sat'], m['luma']))


if __name__ == '__main__':
    main()
