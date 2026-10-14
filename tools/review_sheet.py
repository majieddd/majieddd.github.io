"""Build a REVIEW SHEET for one world and one power: every rendered beat with
the two pieces of writing it has to agree with.

WHY THIS EXISTS. Looking at a plate on its own only answers "is this a good
picture". The owner's question is narrower and harder: does the picture depict
THE SCENARIO IT IS FOR, and does that scenario make sense where it sits. That
needs three things side by side, and this is the only place they meet:

  ASKED   the subject clause the model was actually given (planet_jobs.py)
  READS   the sentence the player sees on that slide  (js/planetcuts.js)
  the plate itself

Three failure modes it separates, which a bare contact sheet cannot:

  * the render missed the prompt        (picture disagrees with ASKED)
  * the prompt missed the writing       (ASKED disagrees with READS)
  * the writing is wrong for the beat   (READS disagrees with the beat's job)

The first is a re-roll, the second is a catalogue edit, the third is a rewrite.
Telling them apart before acting is the whole point.

Usage:
    python tools/review_sheet.py 01 xeno          one world, one power
    python tools/review_sheet.py 01               that world, all five powers
    python tools/review_sheet.py --audit          every rendered world, sampled

Writes PNGs to _review/ which is gitignored scratch, never shipped.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, 'artgen'))

CACHE = os.path.join(ROOT, 'artgen', 'cache_krea')
OUT = os.path.join(ROOT, '_review')
FACS = ('human', 'light', 'xeno', 'pirate', 'robot')
BEATS = ('APPROACH', 'THE GROUND', 'THE ASSAULT', 'AFTERMATH', 'NEW ORDER')

# The five beats and which authored sentence the player actually reads on each.
# Beats 2 and 3 read the PLACE copy, which is written once per world; 1, 4 and 5
# read that power's own line. Mirrors UI.worldSlides and PlanetCuts.lines.
READS = {1: ('f', 0), 2: ('ground', None), 3: ('works', None),
         4: ('f', 1), 5: ('f', 2)}


def planet_cuts():
    """PLANET_CUTS out of the shipping JS, so this cannot drift from the game."""
    js = os.path.join(ROOT, 'js', 'planetcuts.js')
    prog = ('const fs=require("fs"),vm=require("vm");const c={};vm.createContext(c);'
            'vm.runInContext(fs.readFileSync(%s,"utf8")+";globalThis.__o=PLANET_CUTS;",c);'
            'process.stdout.write(JSON.stringify(c.__o));' % json.dumps(js))
    return json.loads(subprocess.check_output(['node', '-e', prog]).decode('utf-8'))


def asked():
    """key -> the SUBJECT clause of the prompt, without the shared style tail."""
    from krea_jobs import CUTSCENE_PALETTE, STYLE
    from planet_jobs import planet_jobs
    out = {}
    for key, prompt, _g, _o, _a in planet_jobs(CUTSCENE_PALETTE, STYLE):
        # everything before the palette clause is the subject
        out[key] = prompt.split(', painted in')[0].split(', a Federation')[0]
        for cut in (', painted in', '. Dramatic staging'):
            if cut in prompt:
                out[key] = prompt.split(cut)[0]
                break
    return out


def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def font_at(size, bold=False):
    for name in (('arialbd.ttf', 'seguisb.ttf') if bold else ('arial.ttf', 'segoeui.ttf')):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


def sheet(wk, fac, cuts, prompts):
    entry = cuts.get(wk)
    if not entry:
        return None
    rows = []
    for b in range(1, 6):
        key = 'pcut_%s_%s_%d' % (wk, fac, b)
        path = os.path.join(CACHE, key + '.webp')
        if os.path.exists(path):
            rows.append((b, key, Image.open(path).convert('RGB')))
    if not rows:
        return None

    IW, IH, PAD, TXTW = 720, 405, 16, 620
    f_head = font_at(19, True)
    f_lbl = font_at(14, True)
    f_body = font_at(14)
    scratch = ImageDraw.Draw(Image.new('RGB', (10, 10)))

    blocks = []
    for b, key, im in rows:
        src, idx = READS[b]
        reads = entry['f'][fac][idx] if src == 'f' else entry[src]
        ask = prompts.get(key, '(no prompt found)')
        la = wrap(scratch, ask, f_body, TXTW)
        lr = wrap(scratch, reads, f_body, TXTW)
        h = max(IH, 40 + (len(la) + len(lr)) * 19 + 46)
        blocks.append((b, key, im, la, lr, h))

    W = IW + TXTW + PAD * 3
    H = 52 + sum(x[5] + PAD for x in blocks)
    sh = Image.new('RGB', (W, H), (10, 14, 23))
    d = ImageDraw.Draw(sh)
    d.text((PAD, 16), '%s  %s  %s' % (entry['name'], fac.upper(), wk),
           font=f_head, fill=(226, 232, 240))

    y = 52
    for b, key, im, la, lr, h in blocks:
        sh.paste(im.resize((IW, IH)), (PAD, y))
        tx = PAD * 2 + IW
        d.text((tx, y), '%d. %s' % (b, BEATS[b - 1]), font=f_lbl, fill=(56, 232, 255))
        d.text((tx, y + 20), key, font=f_body, fill=(100, 116, 139))
        yy = y + 44
        d.text((tx, yy), 'ASKED', font=f_lbl, fill=(148, 163, 184))
        yy += 19
        for ln in la:
            d.text((tx, yy), ln, font=f_body, fill=(148, 163, 184))
            yy += 19
        yy += 8
        d.text((tx, yy), 'READS', font=f_lbl, fill=(251, 191, 36))
        yy += 19
        for ln in lr:
            d.text((tx, yy), ln, font=f_body, fill=(226, 232, 240))
            yy += 19
        y += h + PAD
    return sh


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    audit = '--audit' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    cuts, prompts = planet_cuts(), asked()

    if audit:
        done = {}
        for name in os.listdir(CACHE):
            if name.startswith('pcut_') and name.endswith('.webp'):
                p = name[:-5].split('_')
                done.setdefault(p[1], set()).add(p[2])
        targets = [(wk, sorted(f)[0]) for wk, f in sorted(done.items())]
    elif len(args) == 2:
        targets = [(args[0], args[1])]
    elif len(args) == 1:
        targets = [(args[0], f) for f in FACS]
    else:
        print(__doc__)
        return

    for wk, fac in targets:
        sh = sheet(wk, fac, cuts, prompts)
        if sh is None:
            print('skip %s %s, nothing rendered' % (wk, fac))
            continue
        p = os.path.join(OUT, 'review_%s_%s.png' % (wk, fac))
        sh.save(p)
        print('%s  %s' % (p, sh.size))


if __name__ == '__main__':
    main()
