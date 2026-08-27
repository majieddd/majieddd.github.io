"""Style trial harness (owner directive, this session).

Renders three MEDIUM variants of one representative cutscene per faction so the
owner can pick a direction before anything is re-rendered wholesale.

WHY THIS IS A SCRATCH HARNESS AND NOT AN EDIT TO krea_jobs.py.
ART-BIBLE section 5 rule 5: a prompt content change re-renders the class
WHOLESALE and only happens under an owner directive. The directive exists, but
the direction is not chosen yet, so this writes to its own folder and touches
neither the catalogue, `cache_krea/`, nor the shipped pack. Nothing here ships.

WHY THE SEED IS HELD AT VARIANT 0.
The question on the table is "does the new medium look better", not "is there a
better composition". Holding _seed(key) fixes composition, staging and colour
placement, so the only thing that moves between the shipped plate and these
three is the medium clause. Change the seed too and the comparison answers
nothing. (krea_gen._seed_v exists for re-rolls and is deliberately NOT used.)

WHY THE LETTERING SUPPRESSION IS POSITIVE-PHRASED.
Krea 2 Turbo is distilled for guidance-free sampling and krea_gen.render()
passes guidance_scale=0.0, so NEG never reaches the model: the negative prompt
is INERT on this path. The Spider-Verse half of the brief is exactly the pull
toward panel borders, speech balloons and onomatopoeia, and ART-BIBLE section 1
lists lettering of any kind as a Never. So the suppression has to ride in the
positive prompt, and the words 'comic book', 'panel' and 'graphic novel' are
kept out of it -- they summon the thing they name.

Usage (the artgen-env trampoline is broken; see the runbook note):
    python artgen/style_trial.py            # render all 15
    python artgen/style_trial.py --only human
"""
import os, sys, argparse, time, json

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import krea_gen
from krea_jobs import CUTSCENE_PLATES, CUTSCENE_PALETTE, STYLE

OUT = os.path.join(HERE, 'style_trial')

# One representative plate per faction. Chosen for figures-in-an-environment:
# a medium change shows up in how flesh, metal and ground are each handled, and
# a pure-landscape plate would under-report it.
# cut_robot_sys5 and cut_robot_intro_3/5 were rejected here: their scene lines
# ask for projected GLYPHS, which is lettering the frame, and this trial's whole
# Spider-Verse half is already pulling that way. A scene that fights the
# suppression clause cannot measure the suppression clause.
SUBJECTS = {
    'human':  'cut_human_sys1',
    'xeno':   'cut_xeno_intro_1',
    'pirate': 'cut_pirate_intro_2',
    'light':  'cut_light_intro_1',
    'robot':  'cut_robot_intro_1',
}

# The construction spine, held constant across all three. This is the part of
# the locked style the owner did NOT ask to change: Tyranny's flat interlocking
# shapes with heavy black shadow masses doing the drawing (ART-BIBLE section 1).
SPINE = ('built from flat interlocking shapes, heavy black shadow masses doing the '
         'drawing, strong readable silhouette, hard cel edges')

# Positive-phrased lettering suppression. See the module note.
NOLETTER = ('no text anywhere, no lettering, no speech balloons, no captions, '
            'no panel borders, no frame, one single uninterrupted image')

# The three readings of the owner's brief. Every one carries ALL of the notes --
# dreamlike oil-and-water, visible sketch, multi-medium print -- and they differ
# only in which note leads, because a diffusion prompt weights what comes first.
VARIANTS = {
    'A_wet': (
        'painted in oil bleeding into water, wet-on-wet pigment blooms, ink diffusing '
        'through liquid, dreamlike softness pooling behind the hard edges, faint '
        'pencil underdrawing showing through the washes, a fine halftone screen over '
        'the paint'),
    'B_print': (
        'mixed-media print, halftone dot screens laid over painted areas, offset '
        'misregistration, colour separations slipping apart at the edges, chromatic '
        'fringing, some shapes flat vector and others wet oil paint in the same frame, '
        'visible screentone, sketch lines left in'),
    'C_atelier': (
        'graphite and ink underdrawing left unerased, visible construction lines and '
        'searching contour, loose sketch marks around the finished passages, oil and '
        'water washes flooded over the drawing, halftone screen in the shadows, '
        'a production art page'),
}


def build_prompt(scene, fac, medium):
    """SUBJECT, PALETTE, MEDIUM, SPINE, FRAME, STYLE tail.

    Order is load-bearing and copied from the 50 shipped plates rather than
    invented. ART-BIBLE section 10: a NAMED faction palette sitting directly
    behind the subject outranks the generic 'vaporwave neon palette of magenta
    cyan violet and chrome' in the {STYLE} tail, which is the only reason those
    plates still read blue for humanity and gold for the Federation. The medium
    clause goes AFTER the palette for exactly that reason -- a register change
    is not a licence to move colour (section 10, measured the hard way when a
    register-led restyle turned a human commander magenta).
    """
    return (f'{scene}, {CUTSCENE_PALETTE.get(fac, "")}. {medium}. {SPINE}. '
            f'Wide cinematic composition, dramatic staging. {NOLETTER}. {STYLE}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='', help='one faction key')
    a = ap.parse_args()

    by_key = {k: (fac, scene) for k, fac, scene in CUTSCENE_PLATES}
    todo = []
    for fac, key in SUBJECTS.items():
        if a.only and fac != a.only:
            continue
        if key not in by_key:
            raise SystemExit(f'key {key} not in CUTSCENE_PLATES -- catalogue moved')
        _f, scene = by_key[key]
        for vname, medium in VARIANTS.items():
            todo.append((fac, key, scene, vname, build_prompt(scene, fac, medium)))

    os.makedirs(OUT, exist_ok=True)
    # Record what produced each file. A render nobody can reproduce is not
    # evidence, and the prompt is the whole experiment here.
    manifest = {}

    print(f'{len(todo)} renders queued', flush=True)
    pipe, torch = krea_gen.load_pipe()

    for i, (fac, key, scene, vname, prompt) in enumerate(todo, 1):
        out = os.path.join(OUT, f'{key}__{vname}.png')
        seed = krea_gen._seed(key)          # variant 0, deliberately: see module note
        t0 = time.time()
        img = krea_gen.render(pipe, torch, prompt, 1024, 'wide', seed)
        img.save(out)
        dt = time.time() - t0
        manifest[f'{key}__{vname}'] = {
            'faction': fac, 'key': key, 'variant': vname, 'seed': seed,
            'prompt': prompt, 'seconds': round(dt, 1),
            'size': list(img.size),
        }
        print(f'[{i}/{len(todo)}] {key} {vname}  {img.size[0]}x{img.size[1]}  {dt:.1f}s',
              flush=True)
        with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
            json.dump(manifest, f, indent=2)

    print('DONE ->', OUT, flush=True)


if __name__ == '__main__':
    main()
