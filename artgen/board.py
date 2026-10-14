"""The direction board: the ART-BIBLE content law, rendered.

Reference images for docs/brand-board/, committed small so a collaborator can
SEE the owner's 2026-08-27 content direction instead of arguing about it:
modern-grounded humans, contact-species Federation, scarier xeno, mixed pirate
fleets and crews. Same style tokens, same seeding discipline, same pipeline as
the shipped catalogue; these keys just never enter the pack.

    python board.py            # render everything missing
    python board.py --force k  # re-roll one board by key
"""
import argparse, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from krea_jobs import STYLE  # noqa: E402
import krea_gen  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, '..', 'docs', 'brand-board'))

# PALETTE, REGISTER, SUBJECT, MATERIAL, FRAME. The register clause carries the
# Dune-grounding; the style tail stays verbatim and last.
BOARDS = [
    ('human_fleet',
     'painted in steel blue and neon cyan with warm highlights. Grounded '
     'contemporary spaceflight, a human interstellar fleet assembled from '
     'real space-program hardware: crew capsules, spent-stage boosters, '
     'station modules with solar arrays, docking rings, thermal blankets and '
     'weld seams, mission patches, reaction thrusters firing. Wide cinematic '
     'formation over Earth, no text anywhere. ' + STYLE),
    ('human_armor',
     'painted in steel blue and neon cyan with warm highlights. Grounded '
     'practical military dress in the restraint of Dune, a lineup of human '
     'soldiers and officers: sealed pressure suits, plate over fabric, '
     'load-bearing rigs, worn flight suits, helmets under arms, weathered '
     'faces, nothing medieval, nothing ornate. Wide cinematic lineup, '
     'no text anywhere. ' + STYLE),
    ('human_launch',
     'painted in steel blue and neon cyan with warm highlights. A grounded '
     'contemporary launch gantry at night, a heavy-lift rocket venting '
     'cryogenic vapour, service towers and umbilicals, floodlights, crews '
     'in high-visibility gear on the pad below. Wide cinematic composition, '
     'no text anywhere. ' + STYLE),
    ('light_species',
     'painted in radiant gold and ivory with warm holy light. The benevolent '
     'contact species of a galactic federation standing together: a luminous '
     'pleiadian near-human, a tall ageless nordic diplomat, a slender '
     'blue-toned arcturian being of light, a gentle large-eyed tall grey, a '
     'poised mantid warden, each distinct in silhouette. Wide cinematic '
     'lineup, no text anywhere. ' + STYLE),
    ('light_regalia',
     'painted in radiant gold and ivory with warm holy light. Federation '
     'ceremonial dress as hard light, translucent vestments projected over '
     'simple robes, halo insignia, a nordic officer and a pleiadian envoy in '
     'quiet conversation in a cathedral of stars. Wide cinematic composition, '
     'no text anywhere. ' + STYLE),
    ('xeno_terror',
     'painted in violet and magenta with iridescent chitin. Predatory alien '
     'horrors that should never be turned away from: wet biomechanical '
     'bodies, too many joints, eyes opening where none should be, membrane '
     'and bone accumulated rather than designed, magenta light leaking from '
     'inside the carapace. Wide cinematic pack emerging from darkness, '
     'no text anywhere. ' + STYLE),
    ('pirate_fleet',
     'painted in blood crimson and rust with scavenged metal. A mismatched '
     'pirate armada showing every kind of ship at once: a patchwork '
     'space-galleon under strung lights, a gutted freighter flying rigging, '
     'small asteroid-hopper skiffs, a converted tanker bristling with '
     'antennas, no two hulls from the same yard. Wide cinematic formation in '
     'a neon nebula, no text anywhere. ' + STYLE),
    ('pirate_crew',
     'painted in blood crimson and rust with scavenged metal. A mixed pirate '
     'crew of many species on one deck: a human corsair, a reptiloid reaver, '
     'a small grey scrapper in a welding rig, a mantid gunner, an amorphous '
     'being in a patched pressure suit, all armed, all grinning where they '
     'have mouths. Wide cinematic lineup, no text anywhere. ' + STYLE),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--force', default=None, help='re-roll one board key')
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    todo = [(k, p) for k, p in BOARDS
            if args.force == k or (args.force is None and
                                   not os.path.exists(os.path.join(OUT, k + '.webp')))]
    if not todo:
        print('nothing to render')
        return

    pipe, torch = krea_gen.load_pipe()
    import time
    for i, (key, prompt) in enumerate(todo):
        t0 = time.time()
        img = krea_gen.render(pipe, torch, prompt, 1024, 'wide',
                              krea_gen._seed('board_' + key))
        # Committed reference, not a shipped asset: 1280 wide keeps the whole
        # board under ~2MB in the repo while staying legible.
        krea_gen.fit(img, 1280, 'wide').save(
            os.path.join(OUT, key + '.webp'), 'WEBP', quality=84, method=6)
        print('[%d/%d] %-14s %5.1fs' % (i + 1, len(todo), key, time.time() - t0),
              flush=True)


if __name__ == '__main__':
    main()
