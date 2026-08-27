"""Contact sheets for reading a cutscene plate against its own slide text.

The open item this closes has been in docs/OWNER-NOTES-CAMPAIGN2.md since the
plates were rendered: "verify each plate reads against its slide text, and
re-roll the misses by key". Reading 50 full-size plates one at a time is the
expensive way; six to a sheet with the slide's first line printed under each
is the cheap way, and it is the same judgement.

    python review_sheet.py <slides.json> <outdir> [--per 6]

slides.json is [[key, text], ...]. Plates are read from art/ (the on-demand
class) and fall back to artgen/cache_krea/.
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

CELL_W, CELL_H, PAD = 470, 264, 8
CAP_H = 74


def font(size):
    for name in ('segoeui.ttf', 'arial.ttf', 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=f) <= width:
            cur = t
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def plate_path(key):
    for p in (os.path.join(ROOT, 'art', key + '.webp'),
              os.path.join(HERE, 'cache_krea', key + '.webp')):
        if os.path.exists(p):
            return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slides')
    ap.add_argument('outdir')
    ap.add_argument('--per', type=int, default=6)
    a = ap.parse_args()

    slides = json.load(open(a.slides, encoding='utf-8'))
    os.makedirs(a.outdir, exist_ok=True)
    fk, ft = font(15), font(13)
    cols = 2
    made, missing = 0, []

    for start in range(0, len(slides), a.per):
        chunk = slides[start:start + a.per]
        rows = (len(chunk) + cols - 1) // cols
        W = cols * CELL_W + (cols + 1) * PAD
        H = rows * (CELL_H + CAP_H) + (rows + 1) * PAD
        sheet = Image.new('RGB', (W, H), (8, 10, 16))
        d = ImageDraw.Draw(sheet)

        for i, (key, text) in enumerate(chunk):
            cx = PAD + (i % cols) * (CELL_W + PAD)
            cy = PAD + (i // cols) * (CELL_H + CAP_H + PAD)
            p = plate_path(key)
            if p:
                im = Image.open(p).convert('RGB').resize((CELL_W, CELL_H), Image.LANCZOS)
                sheet.paste(im, (cx, cy))
            else:
                missing.append(key)
                d.rectangle([cx, cy, cx + CELL_W, cy + CELL_H], fill=(30, 12, 12))
                d.text((cx + 10, cy + 10), 'MISSING PLATE', font=fk, fill=(255, 120, 120))
            d.text((cx, cy + CELL_H + 4), key, font=fk, fill=(120, 230, 255))
            ty = cy + CELL_H + 24
            for line in wrap(d, text, ft, CELL_W)[:3]:
                d.text((cx, ty), line, font=ft, fill=(200, 210, 225))
                ty += 16

        n = start // a.per + 1
        sheet.save(os.path.join(a.outdir, 'sheet%02d.png' % n))
        made += 1

    print('wrote %d sheets to %s' % (made, a.outdir))
    if missing:
        print('MISSING PLATES: ' + ', '.join(missing))


if __name__ == '__main__':
    main()
