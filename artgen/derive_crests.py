"""
Faction crests, forced onto their faction's exact hue.

BRAND.md makes crests STRICT MONOCHROME: one faction colour on void black. A
prompt cannot guarantee that, an audit measured the generated HUMANITY crest
at 144.6 degrees (spring green) against a 186.9 target, and THE XENO at 318.5
(magenta) against 262.1. Meanwhile the derived world duotones, which are tinted
in code, land dead on hue every time.

So the crest is generated for its SHAPE and tinted for its COLOUR: take the
luminance of whatever the model drew and map it onto a black -> faction-colour
-> hot-white ramp. Deterministic, exactly on-brand, and it cannot drift when a
future regeneration changes the artwork.
"""
import os, sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
sys.path.insert(0, HERE)
from krea_jobs import FACTION_TINT                          # noqa: E402


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def ramp(tint):
    """Black through the full faction colour to a hot near-white highlight.

    The knee sits high (0.70) because an emblem is mostly dark field with thin
    bright linework: a lower knee washes the whole plate toward white and the
    engraving stops reading.
    """
    t = hx(tint)
    out = []
    for i in range(256):
        u = i / 255.0
        if u < 0.70:
            k = u / 0.70
            out.append(tuple(round(ch * k) for ch in t))
        else:
            k = (u - 0.70) / 0.30
            out.append(tuple(round(ch + (255 - ch) * k * 0.80) for ch in t))
    return out


def main():
    done, missing = [], []
    for fid, tint in FACTION_TINT.items():
        src = os.path.join(CACHE, f'fac_{fid}.webp')
        if not os.path.exists(src):
            missing.append(fid)
            continue
        lum = Image.open(src).convert('L')
        lut = ramp(tint)
        out = Image.new('RGB', lum.size)
        out.putdata([lut[v] for v in lum.getdata()])
        out.save(src, 'WEBP', quality=90, method=6)
        done.append(f'{fid}->{tint}')
    print('tinted:', ', '.join(done) + (f'  MISSING {missing}' if missing else ''))


if __name__ == '__main__':
    main()
