"""
Cosmic Conquest — the art catalogue.

One place that names every generated image and the prompt behind it, kept
separate from the runner so the two models (Krea 2 and the SDXL fallback) can
render the same catalogue and be compared key-for-key.

Sizes are (generate_px, output_px, aspect). Aspect 'wide' generates 16:9.
"""

# One shared style spine so seventy images read as a single art direction.
# Direction (owner's brief, Session 14): the stylised painted-cutscene look of
# Tyranny -- bold flat brushwork, hard graphic shapes, strong silhouettes --
# but the SETTING is cyberpunk sci-fi vaporwave: neon magenta/cyan/violet,
# chrome, holograms. Explicitly NOT medieval fantasy.
# LOCKED by the owner (Session 15) — see TowerDefense/BRAND.md before editing.
STYLE = ('stylised painted game cutscene illustration, bold flat expressive brushwork, '
         'hard-edged graphic shapes, strong silhouette, gothic engraved linework, ornamental '
         'filigree, screen-print texture, limited palette, '
         'cyberpunk science fiction, vaporwave neon palette of magenta cyan violet and chrome, '
         'holographic glow, retrofuturist technology, no text, no watermark, no signature')
NEG = ('text, letters, words, watermark, signature, logo, user interface, frame, border, '
       'photograph, photorealistic, medieval, fantasy armour, sword, castle, '
       'blurry, low resolution, deformed anatomy, extra limbs, duplicate, '
       'jpeg artifacts, cluttered')

FACTION_LOOK = {
    'human':  ('cyan-lit chrome exosuit with holographic HUD elements, cabled neck seals, '
               'practical military hardware, disciplined bearing'),
    'light':  ('golden holographic armour of hard-light panels, luminous circuitry halos, '
               'serene ceremonial bearing, glowing seams'),
    'xeno':   ('deep violet biomechanical carapace fused with neon-lit implants, too many '
               'joints, unsettling asymmetry, bioluminescent veins'),
    'pirate': ('crimson neon-trimmed salvage plating, aftermarket cybernetics, jagged '
               'trophies, brutal improvised tech'),
    None:     ('grey-steel tactical suit with subdued neon trim, unmarked, professional '
               'and anonymous'),
}

COMMANDERS = [
    ('cadre',   None,     'a stoic unaligned career soldier, plain visored helm, no insignia'),
    ('vanta',   'human',  'a scholarly tactician wearing a data-visor, thin archive filaments '
                          'trailing from the temples, cold analytical stare'),
    ('korrin',  'human',  'a burly quartermaster hung with supply rigging, ammunition drums and '
                          'ration crates, weathered and pragmatic'),
    ('nyx',     'human',  'an overclocker wreathed in crackling energy conduits, coolant vapour, '
                          'reckless grin, armour glowing at the seams'),
    ('orin',    'human',  'a field engineer with articulated servo-arms over the shoulders, '
                          'welding glare lighting the face from below'),
    ('vess',    'human',  'a grim marshal in heavy entrenchment armour, immovable stance, '
                          'trench-worn and mud-streaked'),
    ('seraph',  'light',  'a radiant winged commander haloed in golden light, six wings of '
                          'hard light, serene and terrible'),
    ('aurelia', 'light',  'a serene choral commander mid-song, light pouring from the throat '
                          'and eyes, robes of woven luminance'),
    ('lumen',   'light',  'a warden bearing an enormous circular energy shield, calm, '
                          'immovable, light refracting across the barrier'),
    ('cantor',  'light',  'a preacher wearing an amplifying vox-horn crown, arms raised, '
                          'sound made visible as golden rings'),
    ('halder',  'light',  'a colossal bulwark commander, shield-locked, utterly immovable, '
                          'armour like a fortress wall'),
    ('sevra',   'xeno',   'a necrotic commander trailing reanimated husks on dark filaments, '
                          'puppeteer gestures, hollow glowing eyes'),
    ('mawlord', 'xeno',   'a bloated devourer with a vast toothed maw splitting the torso, '
                          'gluttonous, dripping'),
    ('thrax',   'xeno',   'a hivemind commander, many-eyed, surrounded by a cloud of drone '
                          'spawn, every eye focused forward'),
    ('vorn',    'xeno',   'a plague commander leaking luminous spores and creeping rot, '
                          'chitin cracked and weeping light'),
    ('ulgrim',  'xeno',   'an apex predator commander with immense jaws and trophy bones '
                          'lashed to the carapace, coiled to strike'),
    ('rake',    'pirate', 'a rakish corsair with a plasma cutlass and a insolent grin, '
                          'long coat, scavenged breastplate'),
    ('scarlet', 'pirate', 'a savage reaver drenched in war paint, teeth bared, twin blades, '
                          'braided hair full of trophies'),
    ('grist',   'pirate', 'a scrapper welded into mismatched salvaged plate, one arm a '
                          'hydraulic claw, goggles pushed up'),
    ('cinder',  'pirate', 'an arsonist haloed in flame and heat shimmer, flamethrower rig, '
                          'delighted expression'),
    ('dregg',   'pirate', 'a hulking warlord enthroned on a heap of wreckage, crowned with '
                          'torn hull plating, contemptuous'),
]

# Crests are STRICT MONOCHROME: one faction hue on void black, engraved like a
# gothic rose window. No second colour is permitted anywhere in the frame.
MONO_LOOK = ('strict monochrome, a single colour on pure black, engraved gothic linework, '
             'cathedral rose-window geometry, ornamental filigree, luminous line art, '
             'symmetrical heraldic emblem, no gradients into other hues')
FACTIONS = {
    'human':  ('a heraldic emblem of a human interstellar coalition: a targeting reticle bound '
               f'inside an orbital ring, rendered entirely in glowing cyan. {MONO_LOOK}'),
    'light':  ('a heraldic emblem of a radiant benevolent federation: a sunburst halo with '
               f'layered rays, rendered entirely in glowing gold. {MONO_LOOK}'),
    'xeno':   ('a heraldic emblem of a devouring alien swarm: hexagonal carapace plates around '
               f'a single eye, rendered entirely in glowing violet. {MONO_LOOK}'),
    'pirate': ('a heraldic emblem of a lawless armada: crossed boarding blades over a broken '
               f'hull plate, rendered entirely in glowing crimson. {MONO_LOOK}'),
}


# The nine battlefields. These drive both the galaxy map and the briefing card.
WORLDS = {
    'spine':      'a vast open rocky plain on an airless world, a spine of jagged ridges running '
                  'to the horizon under a hard star, long shadows',
    'delta':      'an alien wetland delta of braided luminous channels and pale reed banks seen '
                  'from a low ridge, mist on the water',
    'narrows':    'a narrow canyon pass between colossal cliff walls, fortified chokepoints cut '
                  'into the rock, shafts of light from far above',
    'shattered':  'a shattered continental plate floating in fragments above a glowing chasm, '
                  'broken ground, debris drifting upward',
    'crossroads': 'a contested crossroads on a windswept steppe where three ancient roads meet, '
                  'ruined waystation, banners torn',
    'coil':       'a colossal coiled alien structure of spiralling metal ramps descending into '
                  'darkness, industrial and vertiginous',
    'expanse':    'a bleak open expanse of deep space with a derelict station adrift, distant '
                  'cold star, enormous emptiness',
    'rift':       'a torn dimensional rift bleeding violet light across a blasted plain, reality '
                  'fracturing at the edges',
    'confluence': 'a three-way confluence where three armies converge on one contested basin, '
                  'three coloured fronts meeting, gold and violet and crimson',
}

# The faction troop sets (Session 16 lore). Unlike the Vigil machines these are
# somebody's soldiers, so BRAND.md's faction-colour rule applies: each set is
# greyscale carrying ITS OWN power's hue, which is what makes a faction-held
# world read as theirs at a glance.
FACTION_TROOPS = {
    'votary':      ('light',  'sworn light infantry behind a small regenerating hard-light ward, head bowed'),
    'censer':      ('light',  'a robed acolyte swinging a censer that pours restorative golden light forward'),
    'sanctifier':  ('light',  'a heavy armoured priest behind a thick ward that reknits as it breaks'),
    'oriflamme':   ('light',  'a standard-bearer carrying a luminous banner that shields the rank around it'),
    'luminark':    ('light',  'a cathedral engine on treads, buttressed and windowed like a rolling basilica'),
    'chitling':    ('xeno',   'a small hastily-grown chitinous grub soldier, wet carapace, too many legs'),
    'gnawling':    ('xeno',   'a low scuttling mouth-creature that is mostly teeth on thin legs'),
    'bloatpod':    ('xeno',   'a swollen sac-creature straining at its own seams, ready to burst into spawn'),
    'hivelord':    ('xeno',   'a tall commanding hive drone radiating a goading pulse over its swarm'),
    'broodmother': ('xeno',   'a vast egg-heavy brood queen trailing a continuous litter of grubs'),
    'cutter':      ('pirate', 'a stripped-down stolen hull, all engine and no armour, running fast and low'),
    'boarder':     ('pirate', 'a raider firing a grapple line ahead, already swinging forward on it'),
    'scrapjack':   ('pirate', 'a scrapper hauling a looted jamming array that spits static'),
    'wrecker':     ('pirate', 'a battered raider hauling itself back upright out of its own wreckage'),
    'ironhulk':    ('pirate', 'a walking heap of salvage welded onto salvage in mismatched layers'),
    'trooper':     ('human',  'disciplined line infantry in practical powered plate, advancing in step'),
    'gunskiff':    ('human',  'a small crewed gun-skiff hovering on alien drives, cockpit lit'),
    'linebreaker': ('human',  'a heavy soldier under bolted-on alien plate, glowing with retained heat'),
    'dragoon':     ('human',  'anchored assault armour braced low, spread wide, refusing to be moved'),
    'vanguard':    ('human',  'a shield-linked formation leader holding the line for the rank beside it'),
}

# The six boards added in Session 16.
WORLDS.update({
    'lattice':  'a vast signal lattice of luminous cabling strung between colossal relay pylons, '
                'many parallel lines running to a single distant gate',
    'causeway': 'a single raised causeway of pale stone crossing a dark flooded basin, sheer drops '
                'to either side, nothing else to stand on',
    'anvil':    'a stepped terrace of black volcanic rock like a titanic anvil, short brutal '
                'approaches cut into the tiers',
    'crown':    'a ringed crown-fortress on a high plateau, three approaches converging on a walled '
                'ring of bastions',
    'carousel': 'three colossal rotating arms of metal turning about a central hub, platforms '
                'drifting past one another',
    'orrery':   'a colossal orrery of nested rotating rings around a dark sphere, walkways along '
                'each ring',
})


# Enemy dossier art. Small cards, so silhouette and colour matter more than detail.
# Enemy dossiers are GREYSCALE with at most ONE restrained accent splash by
# allegiance (BRAND.md): violet = xeno-flesh, gold = radiant constructs,
# crimson = raider warbands, cyan = spectral/energy, none = machines and stone.
# The full colour a troop is PAINTED in, as opposed to FACTION_ACCENT below,
# which is the single splash a greyscale machine is allowed. Named separately so
# the two rules can never be confused for one another again.
FACTION_PALETTE = {
    'human':  'painted in steel blue and neon cyan with warm highlights',
    'light':  'painted in radiant gold and ivory with warm holy light',
    'xeno':   'painted in violet and magenta with iridescent chitin',
    'pirate':  'painted in blood crimson and rust with scavenged metal',
}

FACTION_ACCENT = { 'human': 'neon cyan', 'light': 'radiant gold',
                   'xeno': 'bright purple', 'pirate': 'bright red' }
# Each phrase LEADS with the hue, because on the SDXL path everything after
# roughly token 75 is discarded and the accent has to land before the cut.
ACCENT = {
    'none':    'no colour at all, pure blacks whites and chrome greys',
    # 'xeno violet' and 'raider crimson' measured as DEAD tokens: 12 of 15
    # violet dossiers and 4 of 6 crimson ones came back with no colour at
    # all, while 'spectral cyan' and 'radiant gold' landed 18 of 18. The
    # fix is a plainer, higher-frequency colour word and dropping
    # 'restrained', which was reading as an instruction to desaturate.
    # Purple still died on the organic and undead subjects -- 'bone', 'wet
    # carapace' and 'dark filament' pull hard toward greyscale. Naming the
    # accent as EMITTED light rather than pigment survives those nouns.
    'violet':  'glowing purple bioluminescence, everything else greyscale',
    'gold':    'ONE restrained splash of radiant gold, everything else greyscale',
    'crimson': 'ONE bright red accent glow, everything else greyscale',
    'cyan':    'ONE restrained splash of spectral cyan, everything else greyscale',
}
ENEMIES = {
    # The first pass rendered a TALL bipedal walker -- the owner flagged it.
    'crawler':   ('a single low six-legged machine crawling flat along the ground, body held close to the dirt like a beetle or a spider-tank, six segmented mechanical legs splayed wide to the sides, wide and low silhouette, NOT bipedal, NOT humanoid, NOT standing upright, no legs beneath the body', 'none'),
    'sprinter':  ('a lean sprinting alien runner built for speed, long limbs, streamlined', 'none'),
    'mite':      ('a tiny swarming alien mite, insectile, one of many', 'none'),
    'bulwark':   ('a heavily plated walking bulwark, slab armour bolted over flesh', 'none'),
    'wisp':      ('a translucent floating wisp of drifting energy, barely material', 'cyan'),
    'aegis':     ('a solemn construct wrapped in a regenerating energy shield, shield glowing', 'gold'),
    'mender':    ('a hunched alien mender trailing repair filaments that knit wounds shut', 'gold'),
    'cluster':   ('a bulbous alien cluster organism visibly ready to split into smaller copies', 'violet'),
    'spawnling': ('a small freshly-spawned alien whelp, wet carapace, newly hatched', 'violet'),
    'juggernaut': ('an immense walking juggernaut, slab-sided, slow and unstoppable', 'none'),
    'jammer':    ('a robotic jammer bristling with disruptor antennae, static crackling', 'none'),
    'blink':     ('a phase-shifting creature half-existing, its body smeared between two positions', 'cyan'),
    'warden':    ('a heavily armoured warden with a broad shield of fused bone', 'none'),
    'wraith':    ('a hooded wraith flickering in and out of material existence', 'violet'),
    'nullifier': ('a robed nullifier surrounded by a sphere of dead grey nothingness', 'violet'),
    'revenant':  ('a broken soldier standing back up, wounds knitting with dark filament', 'violet'),
    'carrier':   ('a vast slow carrier organism with spawn clinging to its flanks', 'violet'),
    'warchief':  ('a towering warchief in trophy armour, roaring, clearly a leader', 'crimson'),
    'anchorite': ('a gaunt ascetic wrapped in heavy chains, immovable and patient', 'gold'),
    'herald':    ('a winged herald wreathed in warning light, announcing something worse', 'gold'),
    'bastion':   ('an enormous walking fortress, layered armour, siege scale', 'none'),
    'shardling': ('a crystalline shardling of interlocking mineral facets', 'cyan'),
    'basalt':    ('a lumbering basalt-skinned strider of cooled black stone, unstoppable', 'none'),
    'mb_colossus': ('a colossal armoured miniboss, mountain of layered plate, dwarfing everything', 'none'),
    'mb_seraph': ('a colossal false-angel boss with too many wings of hard light', 'gold'),
    'mb_hydra':  ('a many-headed alien hydra boss, each head a separate weapon', 'violet'),
    'mb_oracle': ('a vast floating oracle boss, a single enormous eye ringed with lesser eyes', 'violet'),
    'mb_lich':   ('an ancient undead lich boss wreathed in necrotic filament and cold light', 'violet'),
    'harbinger': ('an apocalyptic harbinger boss shedding armour plates as it accelerates', 'violet'),
}

ABILITIES = {
    'overclock':  'an icon of a power core pushed past its limits, arcs of overload energy',
    'focusfire':  'an icon of converging targeting lines locking onto a single point',
    'zealotry':   'an icon of a raised golden banner blazing with fervour',
    'ravenous':   'an icon of a fanged maw opening hungrily',
    'broadside':  'an icon of a ship hull unleashing a full broadside volley',
    'steadyaim':  'an icon of a crosshair held perfectly still, precise and cold',
    'attrite':    'an icon of armour visibly corroding and flaking away',
    'dampen':     'an icon of a wave being flattened and absorbed by a field',
    'bulwark':    'an icon of an interlocking shield wall holding firm',
    'sanctify':   'an icon of a radiant golden ward circle burning away corruption',
    'consume':    'an icon of biomass being drawn inward and devoured',
    'smokescreen': 'an icon of billowing concealing smoke rolling outward',
}


# The four world kinds on the galactic map, plus its backdrop. Planet portraits
# are engraved-line miniatures on void black; the backdrop stays dim so owner
# rings and star ratings survive on top of it.
# Three visibly different planets per KIND, chosen deterministically per world
# so a system reads as a set of distinct places rather than four repeated
# stamps. The owner's note: "we still need different looking planets".
PLANET_VARIANTS = {
    'standard': [
        'a temperate alien world seen from orbit, banded turquoise cloud belts, two shattered moons',
        'an arid ochre desert world seen from orbit, vast dune seas and a single dry rift valley',
        'a frozen white world seen from orbit, cracked ice shelves and a pale ring of debris',
    ],
    'fortress': [
        'a fortress world ringed by orbital defence platforms and gun batteries',
        'a fortress world encased in a segmented armour shell with firing apertures',
        'a fortress world with an enormous orbital chain-fort spanning the equator',
    ],
    'forge': [
        'an industrial forge world, hemisphere glowing with foundry grids and smoke',
        'a forge world split by a molten canyon, refinery towers along both rims',
        'a forge world wrapped in orbital smelter rings trailing slag and sparks',
    ],
    'nest': [
        'a corrupted nest world wrapped in swarm hives and drifting spore clouds',
        'a nest world with chitinous spires erupting through a cracked crust',
        'a nest world veiled in a living membrane, pulsing with bioluminescent veins',
    ],
}

def build_jobs():
    """(key, prompt, gen_px, out_px, aspect) for every image in the catalogue."""
    jobs = []
    for cid, fac, desc in COMMANDERS:
        jobs.append((f'cmd_{cid}',
                     f'Head-and-shoulders portrait of {desc}. Wearing {FACTION_LOOK[fac]}. '
                     f'Facing the viewer, centered bust composition, shallow depth of field, '
                     f'dark background. {STYLE}', 1024, 320, 'square'))
    for fid, desc in FACTIONS.items():
        jobs.append((f'fac_{fid}',
                     f'{desc}. A single centered symmetrical heraldic insignia, glowing softly, '
                     f'isolated on a deep black field, no background detail. {STYLE}',
                     1024, 256, 'square'))
    for wid, desc in WORLDS.items():
        jobs.append((f'world_{wid}',
                     f'{desc}. Wide establishing shot, epic sense of scale, no figures in the '
                     f'foreground. {STYLE}', 1024, 480, 'wide'))
    # ACCENT BEFORE SUBJECT. BRAND.md rule 1 is about what survives
    # truncation, and the accent is the clause that was not surviving it:
    # sitting behind the subject it fell outside CLIP's window on all 49
    # and the pack came back uniformly amber. The {STYLE} tail stays at the
    # end because krea_gen.py renders this same catalogue through a
    # non-CLIP encoder that does read it.
    for eid, (desc, accent) in ENEMIES.items():
        jobs.append((f'foe_{eid}',
                     f'{ACCENT[accent]}. {desc}. Full body, three-quarter view, strong '
                     f'readable silhouette, isolated on a plain dark background. {STYLE}',
                     1024, 224, 'square'))
    # BRAND AMENDMENT (Session 19, owner). Faction troops leave the greyscale
    # rule that still governs the neutral machines. The owner's note: the army
    # units "don't quite match the same artstyle aesthetic as the profile
    # pictures for the commanders... I really want them to look more similar to
    # the commanders, but keep their model style, similar to the towers."
    #
    # So a troop is now PAINTED IN ITS POWER'S COLOURS like a commander, and
    # still framed full-body like a tower plate. Greyscale-plus-one-splash stays
    # exactly where it was right: the machines, who belong to nobody.
    for tid, (fac, desc) in FACTION_TROOPS.items():
        jobs.append((f'foe_{tid}',
                     f'{FACTION_PALETTE[fac]}. {desc}. Full body, three-quarter view, '
                     f'strong readable silhouette, isolated on a plain dark background. '
                     f'{STYLE}',
                     1024, 224, 'square'))
    for pid, variants in PLANET_VARIANTS.items():
        for vi, desc in enumerate(variants):
            jobs.append((f'planet_{pid}{vi if vi else ""}',
                         f'{desc}. ONE single planet sphere centered and isolated on pure '
                         f'black, no moons in front, no ships, no text, engraved gothic '
                         f'linework, restrained palette. {STYLE}',
                         1024, 192, 'square'))
    # THE MAELSTROM (Session 17). The singularity for the universe map and the
    # arena's own world plate. Generated ahead of the feature so the renderer
    # has real art the moment it lands rather than a missing-key fallback.
    jobs.append(('blackhole',
                 'a colossal black hole seen head-on, a perfect black sphere ringed by a '
                 'blazing accretion disc of superheated matter, gravitational lensing '
                 'bending the starfield into a bright ring around it, violet and magenta '
                 'and white-hot, centred and symmetrical on deep black, no planets, '
                 f'no ships. {STYLE}', 1024, 512, 'square'))
    jobs.append(('world_maelstrom',
                 'seen from deep space far above, an orbital view looking down on a vast '
                 'ring of small fortified platforms circling the rim of a black hole, the '
                 'singularity blazing at the centre of the frame dragging streams of debris '
                 'inward, nothing in the foreground, no interior, no rooms, no walls, '
                 f'enormous emptiness around it. {STYLE}', 1024, 480, 'wide'))
    jobs.append(('galaxy_bg',
                 'a deep space vaporwave starfield with a faint spiral galaxy arm, very dark and '
                 f'atmospheric, a dim backdrop with no focal point, no planets. {STYLE}',
                 1024, 768, 'wide'))
    for aid, desc in ABILITIES.items():
        jobs.append((f'abil_{aid}',
                     f'{desc}. A single bold centered emblem, minimal, high contrast, glowing, '
                     f'isolated on deep black, no background detail. {STYLE}',
                     1024, 160, 'square'))
    jobs.append(('title',
                 'A contested alien world seen from high orbit with two opposing war fleets '
                 'converging on it from opposite sides, nebula beyond, enormous cinematic scale, '
                 f'wide composition. {STYLE}', 1024, 768, 'wide'))
    jobs.append(('nebula',
                 'A deep space nebula field of violet and teal gas clouds with distant stars, '
                 'soft and atmospheric, a seamless background texture with no foreground objects '
                 f'and no focal point. {STYLE}', 1024, 768, 'wide'))
    return jobs


# Holder-tinted world plates: world_<map>_<faction> duotones DERIVED from the
# base plates by artgen/derive_worlds.py -- deterministic, never generated.
# Listed here (prompt=None) so the pack builder includes them; renderers skip
# any job whose prompt is None.
FACTION_TINT = { 'human': '#38e8ff', 'light': '#fbbf24', 'xeno': '#7c3aed', 'pirate': '#ef4444' }

def derived_jobs():
    out = []
    for wid in WORLDS:
        for fid in FACTION_TINT:
            out.append((f'world_{wid}_{fid}', None, 0, 480, 'wide'))
    return out


if __name__ == '__main__':
    j = build_jobs()
    print(f'{len(j)} jobs')
    from collections import Counter
    print(Counter(k.split('_')[0] for k, *_ in j))
