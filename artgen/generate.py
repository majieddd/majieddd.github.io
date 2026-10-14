"""
SUPERSEDED (Session 20.4). DO NOT RUN. This is the Session 14 generator. It
still carries its own private copy of STYLE / FACTION_LOOK / COMMANDERS, all of
it the pre-Session-15 fantasy direction the owner rejected, and it writes to
`../TowerDefense/js/artpack.js`, a sibling path that stopped existing when the
pipeline moved inside the repository. The live catalogue is `krea_jobs.py`;
the runners are `sdxl_all.py` and `krea_gen.py`. Kept only as history, a
second copy of the art direction in the same folder is how the Session 19
troop prefix was edited in a file nothing read.

Cosmic Conquest, illustrative art generation.

Runs SDXL-Turbo locally on the RTX 4080 and emits a single JS file of WebP
data URIs that the game embeds. Kept deliberately small: portraits at 256px
and crests at 192px compress to a few KB each in WebP, so the whole set adds
well under half a megabyte to a self-contained HTML build.

Usage:  python generate.py
Output: ../TowerDefense/js/artpack.js
"""
import base64, io as _io, json, os, sys, time

import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'TowerDefense', 'js', 'artpack.js')
CACHE = os.path.join(os.path.dirname(__file__), 'cache')
os.makedirs(CACHE, exist_ok=True)

# One shared style spine so twenty-odd images read as one art direction.
STYLE = ('cinematic sci-fi concept art, painterly digital illustration, dramatic rim lighting, '
         'volumetric haze, high detail, artstation quality, dark space background, '
         'restrained palette, no text, no watermark')
NEG = ('text, letters, watermark, signature, logo, ui, frame, border, photo, photograph, '
       'blurry, lowres, deformed, extra limbs, duplicate, jpeg artifacts')

FACTION_LOOK = {
    'human':  'cyan and steel blue armour, practical utilitarian military hardware, worn plating',
    'light':  'radiant gold and white ceramic armour, halo motifs, serene ceremonial bearing',
    'xeno':   'violet chitinous carapace, organic alien growth, too many joints, unsettling',
    'pirate': 'crimson scavenged plating, mismatched salvage, jagged trophies, brutal',
    None:     'neutral grey-steel armour, plain unmarked plating, disciplined',
}

# (key, prompt, size)
JOBS = []

COMMANDERS = [
    ('cadre',   None,     'a stoic unaligned soldier commander, plain visored helm'),
    ('vanta',   'human',  'a scholarly tactician commander with a data-visor and archive filaments'),
    ('korrin',  'human',  'a burly quartermaster commander laden with supply rigging'),
    ('nyx',     'human',  'an overclocker commander wreathed in crackling energy conduits'),
    ('orin',    'human',  'an engineer commander with servo-arms and welding glare'),
    ('vess',    'human',  'a grim marshal commander in heavy entrenchment armour'),
    ('seraph',  'light',  'a radiant winged commander haloed in golden light'),
    ('aurelia', 'light',  'a serene choral commander, singing, light pouring from the throat'),
    ('lumen',   'light',  'a warden commander bearing an enormous energy shield'),
    ('cantor',  'light',  'a preacher commander with an amplifying vox-horn crown'),
    ('halder',  'light',  'a colossal bulwark commander, immovable, shield-locked'),
    ('sevra',   'xeno',   'a necrotic commander trailing reanimated husks and dark filament'),
    ('mawlord', 'xeno',   'a bloated devourer commander with a vast toothed maw'),
    ('thrax',   'xeno',   'a hivemind commander, many-eyed, surrounded by drone spawn'),
    ('vorn',    'xeno',   'a plague commander leaking luminous spores and rot'),
    ('ulgrim',  'xeno',   'an apex predator commander, immense jaws, trophy bones'),
    ('rake',    'pirate', 'a rakish corsair commander with a plasma cutlass and grin'),
    ('scarlet', 'pirate', 'a savage reaver commander drenched in war paint'),
    ('grist',   'pirate', 'a scrapper commander welded into salvaged mismatched plate'),
    ('cinder',  'pirate', 'an arsonist commander haloed in flame and heat shimmer'),
    ('dregg',   'pirate', 'a hulking warlord commander on a throne of wreckage'),
]
for cid, fac, desc in COMMANDERS:
    JOBS.append((f'cmd_{cid}',
                 f'head and shoulders portrait of {desc}, {FACTION_LOOK[fac]}, '
                 f'facing viewer, centered bust, {STYLE}', 512, 256))

FACTIONS = {
    'human':  'a stylised emblem of a human interstellar coalition, reticle and orbital ring, cyan',
    'light':  'a stylised emblem of a radiant benevolent alien federation, sunburst halo, gold',
    'xeno':   'a stylised emblem of a devouring alien swarm, hexagonal carapace cluster, violet',
    'pirate': 'a stylised emblem of a lawless pirate armada, crossed blades, crimson',
}
for fid, desc in FACTIONS.items():
    JOBS.append((f'fac_{fid}',
                 f'{desc}, heraldic insignia, centered, symmetrical, glowing, '
                 f'on deep black, {STYLE}', 512, 224))

JOBS.append(('title',
             'a contested alien world seen from orbit, two opposing fleets converging, '
             f'nebula, epic scale, wide cinematic composition, {STYLE}', 768, 512))
JOBS.append(('nebula',
             f'a deep space nebula field, purple and teal gas clouds, distant stars, '
             f'seamless background texture, no foreground objects, {STYLE}', 768, 512))


def main():
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f'device={dev}', flush=True)
    pipe = AutoPipelineForText2Image.from_pretrained(
        'stabilityai/sdxl-turbo',
        torch_dtype=torch.float16 if dev == 'cuda' else torch.float32,
        variant='fp16' if dev == 'cuda' else None)
    pipe = pipe.to(dev)
    pipe.set_progress_bar_config(disable=True)

    pack = {}
    t0 = time.time()
    for i, (key, prompt, gen_px, out_px) in enumerate(JOBS):
        cached = os.path.join(CACHE, key + '.webp')
        if os.path.exists(cached):
            img = Image.open(cached)
        else:
            g = torch.Generator(device=dev).manual_seed(abs(hash(key)) % (2**31))
            img = pipe(prompt=prompt, negative_prompt=NEG, num_inference_steps=4,
                       guidance_scale=0.0, height=gen_px, width=gen_px,
                       generator=g).images[0]
            img = img.resize((out_px, out_px), Image.LANCZOS)
            img.save(cached, 'WEBP', quality=86, method=6)
        buf = _io.BytesIO()
        img.save(buf, 'WEBP', quality=86, method=6)
        pack[key] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
        print(f'[{i+1}/{len(JOBS)}] {key} {len(pack[key])//1024}KB  '
              f'{time.time()-t0:.0f}s', flush=True)

    total = sum(len(v) for v in pack.values())
    body = ('/* Generated illustrative art. SDXL-Turbo, local RTX 4080.\n'
            '   Regenerate with artgen/generate.py. Keys: cmd_<id>, fac_<id>, title, nebula. */\n'
            'const ARTPACK = ' + json.dumps(pack) + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(body)
    print(f'WROTE {OUT}  {total//1024}KB across {len(pack)} images', flush=True)


if __name__ == '__main__':
    main()
