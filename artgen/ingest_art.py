"""Ingest externally generated plates into the cache, correctly shaped.

WHY THIS EXISTS. The Firefly Services REST API needs an Enterprise contract
(see ART-BIBLE section 13), which the owner does not have; a Firefly
subscription grants unlimited generation in the WEB APP, which has no API at
all. Those unlimited generations were otherwise unusable by this pipeline,
because a downloaded PNG is not a cache entry: the cache wants a specific
size, a specific quality per class, and a specific filename.

This closes that gap in the only direction that does not need a licence. It is
the same last mile every painter takes (`fit()` then `quality_for()` then
`cache_krea/<key>.webp`), applied to images this pipeline did not generate, so
`krea_gen.py --pack` cannot tell the difference and does not need to.

It is deliberately generator-agnostic. Firefly today, anything tomorrow.

    # 1. What still needs painting, and the exact prompt for each
    python ingest_art.py --todo cut_ > prompts.txt

    # 2. Generate them in the web app, download, name each file <key>.png
    #    into one folder (any of .png .jpg .jpeg .webp)

    # 3. Bring them in
    python ingest_art.py --from ~/Downloads/plates
    python ingest_art.py --from ~/Downloads/plates --dry-run   # report only
"""
import argparse, os, sys
import io as _io

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from krea_gen import CACHE, fit, quality_for            # noqa: E402
from krea_jobs import build_jobs                         # noqa: E402

EXT = ('.png', '.jpg', '.jpeg', '.webp')


def catalogue():
    """key -> (out_px, aspect, prompt) for every job that has a prompt."""
    return {k: (out_px, aspect, p) for k, p, _g, out_px, aspect in build_jobs() if p}


def cached(key):
    return os.path.exists(os.path.join(CACHE, key + '.webp'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='src', default='',
                    help='folder of images named <key>.png (or .jpg/.webp)')
    ap.add_argument('--todo', default=None, metavar='PREFIX',
                    help='print the prompts for uncached keys under PREFIX and exit')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--overwrite', action='store_true',
                    help='replace a key that is already cached')
    a = ap.parse_args()

    cat = catalogue()

    if a.todo is not None:
        todo = [k for k in cat if k.startswith(a.todo) and not cached(k)]
        todo.sort()
        if not todo:
            print('nothing to generate: every %s key is already cached' % (a.todo or 'catalogue'))
            return
        # One block per key: the filename to save as, then the prompt to paste.
        # Written to be piped to a file and worked through, not read on screen.
        for k in todo:
            out_px, aspect, prompt = cat[k]
            w = out_px if aspect == 'wide' else out_px
            h = round(out_px * 9 / 16) if aspect == 'wide' else out_px
            print('=' * 72)
            print('SAVE AS : %s.png     (target %dx%d, %s)' % (k, w, h, aspect))
            print('PROMPT  : %s' % prompt)
            print()
        print('=' * 72)
        print('%d keys still to paint. Generate WIDER than the target where the'
              % len(todo))
        print('generator allows it: this ingests by downsampling, which is free')
        print('antialiasing, and it will refuse to upscale.')
        return

    if not a.src:
        raise SystemExit('give me --from <folder> or --todo <prefix>')
    if not os.path.isdir(a.src):
        raise SystemExit('not a folder: ' + a.src)

    os.makedirs(CACHE, exist_ok=True)
    took, skipped, unknown, upscale = [], [], [], []

    for name in sorted(os.listdir(a.src)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in EXT:
            continue
        if stem not in cat:
            unknown.append(name)
            continue
        if cached(stem) and not a.overwrite:
            skipped.append(stem)
            continue
        out_px, aspect, _p = cat[stem]
        tw = out_px
        th = round(out_px * 9 / 16) if aspect == 'wide' else out_px
        img = Image.open(os.path.join(a.src, name)).convert('RGB')
        # REFUSE TO UPSCALE. fit() will happily enlarge a small source, and the
        # result costs full bytes for detail that was never there. This is the
        # same law the render tiers follow (media-image section 13); the only
        # difference is that here the source came from somebody else.
        if img.width < tw or img.height < th:
            upscale.append('%s is %dx%d, needs at least %dx%d'
                           % (name, img.width, img.height, tw, th))
            continue
        if a.dry_run:
            took.append(stem + ' (dry run)')
            continue
        tmp = os.path.join(CACHE, '.' + stem + '.part')
        fit(img, out_px, aspect).save(tmp, 'WEBP', quality=quality_for(stem), method=6)
        os.replace(tmp, os.path.join(CACHE, stem + '.webp'))
        took.append('%s  %dx%d -> %dx%d' % (stem, img.width, img.height, tw, th))

    print('ingested %d' % len(took))
    for t in took:
        print('  ' + t)
    if skipped:
        print('already cached, left alone (%d): use --overwrite to replace' % len(skipped))
        for s in skipped[:8]:
            print('  ' + s)
    if upscale:
        print('REFUSED, too small to downsample (%d):' % len(upscale))
        for u in upscale:
            print('  ' + u)
    if unknown:
        print('not catalogue keys (%d), filename must be <key>.<ext>:' % len(unknown))
        for u in unknown[:8]:
            print('  ' + u)
    if took and not a.dry_run:
        print('\nnow: python krea_gen.py --pack')


if __name__ == '__main__':
    main()
