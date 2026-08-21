"""
Cosmic Conquest — the full catalogue on SDXL-Turbo, new art direction.

Krea 2 Turbo produces the better image but costs ~83 minutes each on this
card (12.9B NF4); the whole 70-image catalogue would take four days. SDXL-
Turbo renders the same catalogue in well under an hour, so it paints the
complete interim pack and Krea upgrades keys underneath it as they finish:
krea_gen.py --pack prefers cache_krea/<key>.webp and falls back to cache/.

Renders into cache/, OVERWRITING the old fantasy-style images — the owner
rejected that look, so keeping them would just leak it back into the pack.
"""
import os, sys, time

import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
os.makedirs(CACHE, exist_ok=True)

sys.path.insert(0, HERE)
from krea_jobs import build_jobs, NEG, FACTION_TROOPS      # noqa: E402
from krea_gen import fit, quality_for                      # noqa: E402

# CLIP truncates at 77 tokens, and at guidance 0 the negative prompt has no
# influence at all -- so on long subjects the style tail fell off and rake
# came back in medieval plate. The cure is a compact style stated FIRST, so
# whatever truncates is redundancy rather than direction.
SDXL_PREFIX = ('cyberpunk sci-fi vaporwave painted cutscene illustration, neon magenta '
               'cyan violet palette, holographic chrome, gothic engraved linework, '
               'bold flat brushwork, ')

# Monochrome and greyscale classes must NOT receive the rainbow prefix -- with
# the negative prompt inert at guidance 0, the prefix would simply win and the
# owner's monochrome brief would lose. Style still leads; it just names the
# right palette for the class (BRAND.md).
# Two measured failures drove this shape: (1) fac_pirate rendered IVORY because
# the colour name arrived too late in the prompt -- so the crest prefix now
# names the colour FIRST, per faction; (2) the first greyscale foe prefix
# dropped the words 'cyberpunk science fiction' and the whole class regressed
# to medieval knights -- the setting must be in the prefix, not the tail.
FACTION_COLOUR = { 'human': 'neon cyan', 'light': 'radiant gold',
                   'xeno': 'xeno violet', 'pirate': 'blood crimson' }

# FACTION TROOPS ARE NOT SPECIMENS. Both machines and troops are keyed foe_*,
# so both were getting the 'foe' prefix below -- a clinical greyscale specimen
# study on flat black, which is right for a neutral machine dossier and wrong
# for somebody's soldiers. The owner's note: the army units "don't quite match
# the same artstyle aesthetic as the profile pictures for the commanders".
# They were correct, and this is why: commanders fell through to SDXL_PREFIX
# (painted, coloured, brushwork) while troops were rendered as lab exhibits.
# (Session 20.4: commanders now carry their own per-faction duotone and take an
# explicitly EMPTY prefix; troops keep the painted treatment described here.)
#
# Troops now get the commanders' PAINTED treatment, kept at full body so they
# still read as a model on a card rather than a portrait bust -- which is the
# rest of the note: "keep their model style, similar to the towers".
# EMPTY, for the same reason the commander prefix is. A class prefix cannot
# see WHICH faction it is prefixing, so any palette or register it names is
# wrong for three of the four powers -- and this one spent 32 of the 77 CLIP
# slots saying a painterly register that the per-faction duotone then had to
# argue with. The register now lives in krea_jobs.COMMANDER_REGISTER, where it
# is composed per troop alongside that power's own two inks.
TROOP_PREFIX = ''

PREFIX_BY_CLASS = {
    # Tower plates are ARCHITECTURE, and each belongs to a power whose palette
    # the prompt sets for itself. Without an entry here the class fell through
    # to SDXL_PREFIX, whose 'neon magenta cyan violet' overwrote that palette --
    # worst on the two robotic plates, because grey is the easiest thing for a
    # neon prefix to repaint. Measured: this moves each prompt's palette clause
    # from token 41-45 up to 36-40, well inside the 77-token cliff.
    'twr':    'painted science-fiction gun emplacement, one structure alone on flat '
              'black, gothic engraved linework, heavy machined plating, ',

    # "cutscene illustration" pulled every dossier into a SCENE -- wide shots
    # with terrain, vehicles and human figures for scale, so the subject was
    # never legible on a 224px card. A dossier wants a SPECIMEN: one creature,
    # isolated, filling the frame, nothing else in it.
    # MEASURED, NOT GUESSED: the previous prefix ran ~95 tokens on its own
    # against CLIP's 77-token window, so the window closed INSIDE it and
    # neither the per-enemy subject nor the accent clause was ever encoded.
    # That is why all 49 dossiers came back the same amber machine. This one
    # is ~25 tokens and leaves room for both. Do not lengthen it: anything
    # added here is taken off the subject, silently.
    'foe':    'greyscale science-fiction creature specimen, one subject alone on flat '
              'black, engraved gothic linework, machined metal and cabling, never '
              'medieval, ',
    'planet': 'engraved gothic line-art planet portrait on pure black, restrained vaporwave '
              'accents, painted cutscene style, science fiction, ',

    # DELIBERATELY EMPTY (Session 20.4). Commanders used to fall through to
    # SDXL_PREFIX, whose 'neon magenta cyan violet palette' names three hues to
    # every faction at once -- the exact opposite of the owner's duotone brief,
    # and 32 tokens of a 77-token window spent saying it. The commander prompt
    # in krea_jobs.build_jobs() now leads with its own per-faction duotone and
    # the comic register, so a prefix here could only push that off the cliff.
    #
    # Empty also means the SDXL and Krea paths are handed the SAME string, which
    # is the whole point of a single catalogue -- key-for-key comparison between
    # the two models is meaningless when one of them is silently given 32 extra
    # tokens the other never sees.
    'cmd':    '',
}

def prefix_for(key):
    parts = key.split('_')
    # Checked BEFORE the class table, because a troop and a machine share the
    # foe_ prefix and only the roster can tell them apart. Keys are left alone
    # so no game-side art lookup has to change.
    if parts[0] == 'foe' and '_'.join(parts[1:]) in FACTION_TROOPS:
        return TROOP_PREFIX
    if parts[0] == 'fac':
        c = FACTION_COLOUR.get(parts[1], 'neon')
        return (f'strict monochrome {c} engraved gothic emblem on pure black, every line '
                f'glowing {c}, cathedral rose-window linework, science-fiction heraldry, ')
    return PREFIX_BY_CLASS.get(parts[0], SDXL_PREFIX)


def _seed(key):
    """FNV-1a over the key: identical every run, unlike the salted builtin."""
    h = 2166136261
    for ch in key:
        h = ((h ^ ord(ch)) * 16777619) & 0xffffffff
    return h % (2 ** 31)


def main():
    force = '--force' in sys.argv
    jobs = build_jobs()
    todo = [j for j in jobs
            if j[1] is not None
            and (force or not os.path.exists(os.path.join(CACHE, j[0] + '.webp')))]
    print(f'{len(todo)} of {len(jobs)} to render', flush=True)

    pipe = AutoPipelineForText2Image.from_pretrained(
        'stabilityai/sdxl-turbo', torch_dtype=torch.float16, variant='fp16').to('cuda')
    pipe.set_progress_bar_config(disable=True)

    t0 = time.time()
    for i, (key, prompt, _gen_px, out_px, aspect) in enumerate(todo):
        t1 = time.time()
        # Python salts str.__hash__ per process, so seeding from it made every
        # re-render a different image and no regeneration reproducible. FNV-1a
        # is stable across runs, so re-rendering one class leaves it recognisably
        # itself instead of rolling a new creature.
        g = torch.Generator(device='cuda').manual_seed(_seed(key))
        # SDXL-Turbo is distilled at 512; wide targets render 640x384 and the
        # shared fit() cover-crops to 16:9 exactly as it does for Krea output.
        w, h = (640, 384) if aspect == 'wide' else (512, 512)
        img = pipe(prompt=prefix_for(key) + prompt, negative_prompt=NEG, num_inference_steps=4,
                   guidance_scale=0.0, width=w, height=h, generator=g).images[0]
        fit(img, out_px, aspect).save(os.path.join(CACHE, key + '.webp'),
                                      'WEBP', quality=quality_for(key), method=6)
        print(f'[{i+1}/{len(todo)}] {key:18s} {time.time()-t1:5.1f}s '
              f'(total {time.time()-t0:5.0f}s)', flush=True)

    print('DONE — now run: python krea_gen.py --pack', flush=True)


if __name__ == '__main__':
    main()
