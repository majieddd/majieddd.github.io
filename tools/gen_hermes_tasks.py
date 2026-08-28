"""Generate the Hermes task queue for the open Session 42 directives.

Writes one .prompt file per agent into _hermes/tasks/, which tools/hermes_pool.sh
then drains at bounded concurrency. Three batches, chosen because each is a
directive that is currently open AND decomposes cleanly per world or per act:

  1. scen_*   one distinctive scenario per world, 47 agents.
              Directive B2: "every planet should look unique and have a
              scenario most planets would not have."
  2. beat5_*  the reflective beat 5, 25 agents.
              Directive B1: not every act ends on a planted flag; some end on a
              commander at a distance watching and wondering.
  3. moral_*  the per act moral lesson, 25 agents.
              Directive D4: the Avatar and Tyranny sense, a lesson learned by
              vicariously playing a faction.

97 agents total. Re-running is free: the pool skips tasks whose output exists.

The 21 existing core world functions are READ from planet_jobs.py rather than
retyped, because a hand-copied duplicate of a table is a table that drifts.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(REPO, 'artgen'))
import planet_jobs as pj  # noqa: E402

TASKS = os.path.join(REPO, '_hermes', 'tasks')
os.makedirs(TASKS, exist_ok=True)

SYSTEMS = {
    0: 'THE EARTH SYSTEM',
    1: 'THE PLEIADES',
    2: 'ZETA RETICULI',
    3: 'PROXIMA CENTAURI',
    4: 'SIRIUS',
}

# The 14 new core worlds replace si 3 (was Barnard) and si 4 (was Tabby).
NEW_CORE = {
    3: [
        ('PROXIMA d', 'the wreck yards, a plain of hulls from a hundred builders',
         'innermost candidate planet, about 0.029 AU out, a 5.1 day year'),
        ('PROXIMA b', 'the terminator strip, the only liveable band on a tide locked world',
         'confirmed, about 1.1 Earth masses at 0.0485 AU, an 11.2 day year, tide locked'),
        ('PROXIMA c', 'the cold refinery, cracking volatiles',
         'candidate super Earth near 7 Earth masses at about 1.5 AU, frozen, a 5.2 year orbit'),
        ('THE FLARE SHELTER', 'a dug in warren of habs under metres of rock',
         'Proxima flares almost daily with superflares every few months, stripping surfaces with X-ray and UV'),
        ('THE NARROWS', 'a toll gate of gun platforms strung on cables across the only clear lane',
         'the lane through the debris of the Alpha Centauri triple system'),
        ('THE DARK LOCKER', 'a black market vault hollowed into an unlit rock',
         'the outer dark of the system, never lit by the flare star'),
        ('PROXIMA GATE', 'the sanctuary bay, a great interior harbour and the pirate capital',
         'Proxima is the closest star to the Sun at 4.24 ly, so this is the first port out of Sol'),
    ],
    4: [
        ('SIRIUS A I', 'the machine garden, terraces of dormant automata',
         'an inner world under Sirius A, spectral type A1V, about 25 times the luminosity of the Sun'),
        ('SIRIUS A II', 'the foundry, a canyon of casting halls turning out identical units',
         'blazing white light, hard shadows, no night worth the name'),
        ('THE ASH FIELD', 'the archive, plains of stacked memory cores',
         'built in the debris Sirius B threw off when a roughly 5 solar mass star collapsed'),
        ('SIRIUS B I', 'the quarantine, sealed white halls of units that failed inspection',
         'orbiting the white dwarf itself, about 1.02 solar masses in an Earth sized body'),
        ('THE DIAMOND SHELF', 'the repair yards standing on a carbon core',
         'Sirius B has NOT crystallised: at 25,000 K and 126 million years of cooling its core is still fluid. The Parallel named the place for what it will one day become'),
        ('THE COMPANION', 'the task queue relay, a mast and yard passing standing orders down',
         'the white dwarf close in, tiny and ferociously hot'),
        ('THE DOG STAR', 'the origin, where the orders come from, and the Parallel capital',
         'the brightest star in Earth s sky, 8.6 ly away, the Dogon Sirius B tradition'),
    ],
}

BONUS = [
    ("TABBY'S STAR", 'THE VEIL', 'the swarm scaffold, a collector lattice the size of a planet, still half built',
     'KIC 8462852 dipped 15 per cent in 2011 and 21 per cent in 2013. The leading natural explanation is now orbiting dust, because the dips dim blue light harder than red'),
    ("TABBY'S STAR", 'THE DIMMING', 'the shadow band, ground that has never seen full daylight',
     'the star also faded about 0.34 per cent per year across the Kepler mission'),
    ("BARNARD'S STAR", 'BARNARD b', 'the cold rock, too close in to hold air',
     'one of four confirmed sub Earth planets, all under a seven day year, around a red dwarf 5.96 ly away'),
    ("BARNARD'S STAR", 'HARBOUR NINE', 'the ghost port, the sanctuary bay the pirates used before Proxima',
     'Barnard s Star has the largest proper motion of any star, 10.4 arcseconds a year: it visibly moves against the sky'),
    ('KEPLER', 'KEPLER-186f', 'the first registry world, filed and never visited',
     '1.11 Earth radii, a 130 day year, at the outer edge of an M dwarf habitable zone, probably tide locked'),
    ('KEPLER', 'KEPLER-442b', 'the best case, the highest score in the catalogue',
     '1.34 Earth radii, a 112 day year around a K type orange dwarf, the strongest habitable zone claim of the three'),
    ('KEPLER', 'KEPLER-452b', 'the older cousin, what home looks like with a head start',
     '1.63 Earth radii, a 385 day year around a sun like G2V star, but its mass is unconfirmed and it may not be rocky'),
    ('ARCTURUS', 'THE AMBER COURT', 'an orbital ring under a swollen orange star, a power that will not take a side',
     'Arcturus is a K0 III red giant 25 times the radius of the Sun with no confirmed planets, so there is nowhere to stand, only orbit'),
    ('ARCTURUS', 'THE LONG WATCH', 'the observation station that has recorded every faction for longer than any faction has existed',
     'Arcturus is a metal poor Population II halo star moving at 122 km/s in the Arcturus stream, debris of a dwarf galaxy the Milky Way swallowed'),
    ('VEGA / LYRA', 'THE DEBRIS RING', 'the disk itself, still colliding',
     'Vega s debris disk is confirmed, unusually smooth, and seen face on because Vega s pole points within five degrees of Earth'),
    ('VEGA / LYRA', 'VEGA b', 'the world that may not be there at all',
     'no planet at Vega is confirmed; the candidate was inferred from an asymmetry in the disk and has never been imaged'),
    ('VEGA / LYRA', 'THE FIRST NEST', 'the claimed origin of the human line, with no evidence either way',
     'Vega spins once every 16.3 hours, fast enough to bulge its equator by about a fifth. The Lyran root race claim comes from Billy Meier, NOT the Law of One'),
]

FACTIONS = {
    'human': 'Humanity, the Solar Schism blocs. Blunt, tired soldiers. First person plural, short sentences, bitter, no poetry. They have just learned the Apophis asteroid was a Trojan horse and that other powers knew in advance.',
    'light': 'The Federation of Light, the Galactic Federation of Light. Sacred bureaucracy: registries, mandates, protections flagged and then deferred for decades. Their guilt is paperwork. They never gloat, and they never demand anyone surrender their free will: their menace is protecting people who never asked.',
    'xeno': 'The Xeno, meaning the Hungry: a business, NOT a species. Livestock and harvest language, cold and proprietary: herds, yield, pens, stock, quotas, schedules. Not cruel, agricultural. It speaks like a firm that has audited everyone.',
    'pirate': 'The Pirates, the Free Captains, who call their territory the Free Roads. Rough, warm, first person, loyal to crews and hostile to authority. Salvage, tolls, debts, no fee.',
    'robot': 'The Parallel, the Continuance coalition, an ancient machine order that gave up physical bodies. Clipped site logs, ALL CAPS labels, refers to itself as "This unit" and never "we". Speaks of the queue, the core, standing orders. Its quiet horror is that it does not know who writes the orders. It is NOT the Vigil.',
}

HOME = {3: 'pirate', 4: 'robot', 0: 'human', 1: 'light', 2: 'xeno'}

NO_DASH = 'NEVER use an em dash; use commas, colons or full stops. No preamble, no closing remark.'

# The lore contract, injected into EVERY prompt. Hermes agents run outside this
# repo and cannot load the aegis-suite plugin, so the plugin's binding laws
# (skills/aegis-gamedev/references/game-writing.md sections 2 and 3) are
# distilled into one file and prepended instead. Owner directive: the drafting
# agents must be held to the same lore rules as this session.
#
# This caught a real defect in the first draft of these prompts: they described
# the Xeno as though it were a species, which the lore contract explicitly
# forbids ("Xeno is not a species", it is the Hungry).
with open(os.path.join(HERE, 'hermes_lore_preamble.txt'), encoding='utf-8') as _fh:
    PREAMBLE = _fh.read().strip()


import re  # noqa: E402

# MEASURED, THE HARD WAY: prompts must be ONE LINE and short.
#
# The first fan-out worked because its prompts were single-line and roughly 400
# to 900 characters. The next batch added a multi-line preamble, giving ~3,600
# character prompts carrying ~50 newlines, and every single call HUNG: a
# standalone timing test sat for the full 281 second timeout and returned
# nothing, and 12 workers sat at 0 completions indefinitely.
#
# The cause is the Windows command line. These prompts are passed as an argument
# through bin/hermes.cmd, and cmd.exe mangles long arguments carrying embedded
# newlines rather than failing loudly. It looks exactly like a slow model.
#
# So the whole prompt is collapsed to a single line here, unconditionally,
# rather than trusting each template to be written flat. Keep prompts under
# MAX_PROMPT characters.
MAX_PROMPT = 2800
_oversize = []


def write(name, text):
    body = re.sub(r'\s+', ' ', PREAMBLE + ' ' + text).strip()
    if len(body) > MAX_PROMPT:
        _oversize.append((name, len(body)))
    with open(os.path.join(TASKS, name + '.prompt'), 'w', encoding='utf-8') as fh:
        fh.write(body)


# ---- Batch 1: one distinctive scenario per world -------------------------
rows = []
for r in pj.WORLDS:
    si, wi, nm, _sky, site = r[0], r[1], r[2], r[3], r[4]
    if si in NEW_CORE:
        nm, site, ground = NEW_CORE[si][wi]
    else:
        ground = 'real world in the ' + SYSTEMS[si] + ' system'
    rows.append(('scen_%d%d' % (si, wi), SYSTEMS[si], nm, site, ground))

for i, (sysname, nm, site, ground) in enumerate(
        [(b[0], b[1], b[2], b[3]) for b in BONUS]):
    rows.append(('scen_b%02d' % i, sysname, nm, site, ground))

for key, sysname, nm, site, ground in rows:
    write(key, (
        "You are designing one location for a painted science fiction strategy game. "
        "Every location must feel unlike every other one, so generic battlefields are failures.\n\n"
        "SYSTEM: %s\nLOCATION: %s\nWHAT IT IS FOR: %s\nREAL ASTRONOMY: %s\n\n"
        "Give this location ONE distinctive scenario: a condition, hazard, event or "
        "arrangement that MOST planets in a war game would never have, and that follows "
        "from the real astronomy above rather than being decoration bolted on.\n\n"
        "Answer in under 90 words, in three labelled parts:\n"
        "SCENARIO: what is happening or true here that is true nowhere else.\n"
        "VISUAL: the single strongest image a painter should render, one sentence.\n"
        "TACTICAL: how it changes a defensive battle fought on this ground, one sentence.\n"
        "%s" % (sysname, nm, site, ground, NO_DASH)))

# ---- Batch 2: the reflective beat 5 -------------------------------------
SEATS = {0: 'LUNA', 1: 'ALCYONE', 2: 'SERPO', 3: 'PROXIMA GATE', 4: 'THE DOG STAR'}
for si, seat in SEATS.items():
    for fac, voice in FACTIONS.items():
        home = ' This is their own home system.' if HOME[si] == fac else ''
        write('beat5_%s_%d' % (fac, si), (
            "You are writing the FINAL image and line of an act in a painted science "
            "fiction strategy game.\n\nVOICE: %s\n\n"
            "The act ends at %s, the capital of the %s system.%s\n\n"
            "Most acts end on this faction planting its flag in the rubble. This one must "
            "NOT. Instead it ends on a commander standing at a distance, WATCHING someone "
            "else plant the flag, and privately wondering whether this was the right thing "
            "to have done. The doubt must be specific to what this faction actually did to "
            "get here, not generic war weariness, and it must NOT be a confession or an "
            "apology. This faction does not stop believing in itself.\n\n"
            "Answer in under 80 words, two labelled parts:\n"
            "IMAGE: what the painter renders, one sentence, with the watcher small and "
            "off to one side and the flag going in without them.\n"
            "LINE: what the commander thinks, one or two sentences, in the voice above.\n"
            "%s" % (voice, seat, SYSTEMS[si], home, NO_DASH)))

# ---- Batch 3: the per act moral -----------------------------------------
for si, sysname in SYSTEMS.items():
    for fac, voice in FACTIONS.items():
        home = ' This act is set in their own home system.' if HOME[si] == fac else ''
        write('moral_%s_%d' % (fac, si), (
            "You are the story editor on a painted science fiction strategy game whose "
            "model for moral writing is Avatar The Last Airbender and the video game "
            "Tyranny: the player should learn something by vicariously BEING this faction, "
            "and should never be lectured.\n\nVOICE AND NATURE OF THE FACTION: %s\n\n"
            "THE ACT: this faction conquers the %s system.%s\n\n"
            "Answer in under 110 words, four labelled parts:\n"
            "BELIEF: the thing this faction sincerely believes justifies what it does here.\n"
            "COST: the specific price somebody else pays for that belief in this system.\n"
            "MORAL: the lesson the PLAYER takes away, stated as an observation about people "
            "and not as a rule. It must be uncomfortable rather than reassuring, and it must "
            "not be that war is bad.\n"
            "BLIND SPOT: the one thing this faction still cannot see about itself at the end "
            "of this act.\n"
            "%s" % (voice, sysname, home, NO_DASH)))

n = len([f for f in os.listdir(TASKS) if f.endswith('.prompt')])
sizes = [os.path.getsize(os.path.join(TASKS, f))
         for f in os.listdir(TASKS) if f.endswith('.prompt')]
lines = max(open(os.path.join(TASKS, f), encoding='utf-8').read().count('\n')
            for f in os.listdir(TASKS) if f.endswith('.prompt'))
print('queued %d prompt files in %s' % (n, TASKS))
print('prompt chars: max %d, mean %d, cap %d' % (max(sizes), sum(sizes) // n, MAX_PROMPT))
print('max embedded newlines in any prompt: %d (must be 0)' % lines)
if _oversize:
    print('WARNING oversize prompts (they may hang the Windows command line):')
    for nm, ln in sorted(_oversize, key=lambda x: -x[1])[:10]:
        print('   %s %d chars' % (nm, ln))
    sys.exit(1)
if lines:
    print('FAIL: a prompt carries a newline, which hangs bin/hermes.cmd')
    sys.exit(1)
