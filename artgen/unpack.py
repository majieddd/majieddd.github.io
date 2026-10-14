"""Rebuild artgen/cache/ from a shipped js/artpack.js.

The caches are gitignored, so a fresh clone on a new machine has the pack but
not the files that made it. Every key in the pack is the exact bytes fit()
wrote at that job's out_px, so decoding them back to cache/ restores the SDXL
baseline byte-identical: a later --pack passes them through untouched rather
than re-encoding, which is what keeps the cumulative RMSE at zero.

This is a restore, not a render. It never touches cache_krea/.

    python unpack.py            # write cache/ from ../js/artpack.js
    python unpack.py --check    # report only, write nothing
"""
import argparse, base64, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from krea_gen import OUT, FALLBACK_CACHE   # noqa: E402  (no torch on this path)


def parse_pack(path):
    with open(path, 'r', encoding='utf-8') as fh:
        src = fh.read()
    # The pack is `const ARTPACK = { ... };` with a comment header. Take the
    # first brace to the last, which is the object literal and nothing else.
    i, j = src.index('{'), src.rindex('}')
    return json.loads(src[i:j + 1])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args()

    pack = parse_pack(OUT)
    os.makedirs(FALLBACK_CACHE, exist_ok=True)
    written = skipped = 0
    for key, uri in pack.items():
        m = re.match(r'^data:image/webp;base64,(.+)$', uri)
        if not m:
            print('SKIP (not webp data uri):', key)
            skipped += 1
            continue
        p = os.path.join(FALLBACK_CACHE, key + '.webp')
        if args.check:
            written += 1
            continue
        with open(p, 'wb') as fh:
            fh.write(base64.b64decode(m.group(1)))
        written += 1
    verb = 'would write' if args.check else 'wrote'
    print(f'{verb} {written} keys to {FALLBACK_CACHE}, {skipped} skipped')


if __name__ == '__main__':
    main()
