"""
Holder-tinted world plates — derived, never generated (../docs/BRAND.md).

Each base plate world_<map>.webp becomes four world_<map>_<faction>.webp
duotones: luminance mapped onto a void-black -> faction-colour ramp with a
white-hot top end, so a held world reads instantly as ITS holder's territory
while staying the same painting underneath. PIL only, fully deterministic.
"""
import os, sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
sys.path.insert(0, HERE)
from krea_jobs import WORLDS, FACTION_TINT                 # noqa: E402


def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def ramp(tint):
    """256-entry duotone LUT: black -> deep tint -> tint -> pale hot end."""
    t = hx(tint)
    lut = []
    for i in range(256):
        u = i / 255.0
        if u < 0.55:                       # shadows: black up to the full tint
            k = u / 0.55
            lut.append(tuple(round(ch * k) for ch in t))
        else:                              # highlights: tint toward near-white
            k = (u - 0.55) / 0.45
            lut.append(tuple(round(ch + (245 - ch) * k * 0.85) for ch in t))
    return lut


def main():
    made, missing = 0, []
    for wid in WORLDS:
        src = os.path.join(CACHE, f'world_{wid}.webp')
        if not os.path.exists(src):
            missing.append(wid)
            continue
        base = Image.open(src).convert('L')
        for fid, tint in FACTION_TINT.items():
            lut = ramp(tint)
            px = base.point(lambda v: v)   # copy
            rgb = Image.new('RGB', base.size)
            data = base.getdata()
            rgb.putdata([lut[v] for v in data])
            rgb.save(os.path.join(CACHE, f'world_{wid}_{fid}.webp'),
                     'WEBP', quality=84, method=6)
            made += 1
    print(f'derived {made} holder plates' + (f'; missing bases: {missing}' if missing else ''))


if __name__ == '__main__':
    main()
