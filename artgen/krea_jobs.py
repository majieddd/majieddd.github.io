"""
Cosmic Conquest: the art catalogue.

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
# LOCKED by the owner (Session 15), see TowerDefense/BRAND.md before editing.
STYLE = ('stylised painted game cutscene illustration, bold flat expressive brushwork, '
         'hard-edged graphic shapes, strong silhouette, gothic engraved linework, ornamental '
         'filigree, screen-print texture, limited palette, '
         'cyberpunk science fiction, vaporwave neon palette of magenta cyan violet and chrome, '
         'holographic glow, retrofuturist technology, no text, no watermark, no signature')
NEG = ('text, letters, words, watermark, signature, logo, user interface, frame, border, '
       'photograph, photorealistic, medieval, fantasy armour, sword, castle, '
       'blurry, low resolution, deformed anatomy, extra limbs, duplicate, '
       'jpeg artifacts, cluttered')

# --------------------------------------------------------------------------
# COMMANDER CLASS (Session 20.4) -- see docs/LOOKBOOK.md for the full anatomy.
#
# WHY THE PORTRAITS READ MEDIEVAL. Measured with SDXL-Turbo's own CLIP
# tokenizer over the prompt AS COMPOSED (sdxl_all.prefix_for + this body):
#
#   * the shipped prompt ran 164-185 tokens against a 77-token window, so
#     98-99 tokens -- 56% of every commander prompt -- were discarded;
#   * {STYLE} opened at token 92-113 on all 21, so the words 'cyberpunk
#     science fiction' were NEVER ENCODED for a single commander;
#   * FACTION_LOOK closed at 79-95 on 20 of 21, i.e. it was cut mid-clause,
#     losing exactly the material nouns that make 'armour' sci-fi;
#   * NEG lists 'medieval, fantasy armour, sword, castle' and is inert on both
#     paths -- guidance is 0 on SDXL, and krea_gen.py imports NEG and never
#     passes it. There is no subtracting; you can only lead with what you want.
#
# That left 39 medieval-coded nouns (shield, breastplate, cutlass, robes,
# crown, enthroned, halo, trophy, bones, plate) sitting INSIDE the window at
# full strength with nothing opposing them -- 9 remain, every one of them bound
# to a science-fiction qualifier in the same clause. The foe class already carries
# 'never medieval' inside its window and stopped regressing to knights; the
# commander class carried it nowhere.
#
# THE RULE NOW. Palette first, register second, subject third, faction
# material fourth, framing last -- and the whole of that closes by token 71 on
# the worst commander. Everything after it is redundancy for krea_gen.py,
# whose Qwen3-VL encoder has no 77-token window.

# Owner brief, Session 20: "Vaporwave Duotone or monochrome (depending on
# faction associations) Cyberpunk comic look inspired by Tyranny."
#
# Duotone where the power is a technology (two hues, one cold one hot);
# monochrome where the power is an absolute and a second hue would dilute it.
# Word choice is not free -- BRAND.md's dossier measurements are binding:
# 'radiant gold' landed 18/18 and 'bright red' took crimson from 2/6 to 6/6,
# while the invented 'xeno violet' and 'raider crimson' were DEAD TOKENS, and
# purple only survives an organic subject when named as EMITTED light, which
# is why the xeno line pays two tokens for 'bioluminescence'.
TROOP_DUOTONE = {
    'human':  'Duotone neon cyan and hot magenta',
    'light':  'Monochrome radiant gold',
    'xeno':   'Duotone glowing purple bioluminescence and hot magenta',
    'pirate': 'Monochrome bright red',
    # THE PARALLEL takes the Vigil's own phrase, because it is the same claim:
    # a power with no colour of its own. It differs from the neutral machines
    # only in being CLEAN -- white chrome rather than scavenged grey.
    'robot':  'Monochrome white chrome, no colour at all',
    # Cadre answers to nobody, so it carries nobody's hue -- the same logic
    # that keeps the Vigil machines greyscale, and the phrase that measured
    # 10/10 on them, kept word-for-word rather than shortened.
    None:     'No colour at all, pure blacks whites and chrome greys',
}

# The counter-medieval clause, and it must stay INSIDE the window. 'comic'
# rather than 'comic book': the longer form pulls panel borders and lettering,
# and 'no text' now sits in CMD_STYLE, past the cliff, where it cannot help.
TROOP_REGISTER = ('cyberpunk comic portrait, inked cel shading, halftone screen-print, '
                      'heavy black shadows, never medieval')

# Stated last before the cliff, so every token here is taken off the subject.
# A troop is staged as a MODEL, not as a portrait: whole body, readable at
# the 224px a unit card actually renders. Deliberately short -- it sits after
# the subject, and every token it spends is one the subject cannot have.
TROOP_FRAME = 'Full body, three-quarter view, strong silhouette, flat black.'

CMD_FRAME = 'Facing viewer, centred bust, flat black.'

# STYLE's palette clause -- 'vaporwave neon palette of magenta cyan violet and
# chrome' -- names three hues at once, which is the opposite of a duotone. On
# the SDXL path it is truncated away and harmless; on the Krea path the encoder
# reads the whole prompt and it would overwrite the duotone. So the commander
# class keeps the Tyranny spine and drops the rainbow.
CMD_STYLE = ('stylised painted game cutscene illustration, bold flat expressive brushwork, '
             'hard-edged graphic shapes, strong silhouette, gothic engraved linework, '
             'ornamental filigree, screen-print texture, cyberpunk science fiction, '
             'retrofuturist technology, only the two hues named above and black, '
             'no third colour, no text, no watermark, no signature')

# The material a power is BUILT FROM, in nine to twelve tokens. The old entries
# ran 18-30 and were cut mid-clause on 20 of 21; worse, three of the five led
# with the bare word 'armour', which with no material qualifier inside the
# window resolves to plate. Not one of these says 'armour'.
FACTION_LOOK = {
    'human':  ('cyan-lit sealed pressure suit, practical plate over fabric, holographic '
               'HUD elements, cabled neck seals, disciplined bearing'),
    'light':  ('golden holographic armour of hard-light panels, luminous circuitry halos, '
               'serene ceremonial bearing, glowing seams'),
    'xeno':   ('deep violet biomechanical carapace fused with neon-lit implants, too many '
               'joints, unsettling asymmetry, bioluminescent veins'),
    'pirate': ('crimson neon-trimmed salvage plating, aftermarket cybernetics, jagged '
               'trophies, brutal improvised tech'),
    # THE PARALLEL. Chrome and white with no colour of its own, because the
    # faction's whole identity is that it is a copy that got better -- it wears
    # the SHAPE of the thing it iterated on and none of its warmth. Deliberately
    # the only entry with no neon accent: the four powers each own a hue, and
    # the machines own the absence of one.
    'robot':  ('seamless white-chrome machine plating with hairline panel gaps, a smooth '
               'faceless sensor mask, cold white indicator light, no insignia and no colour'),
    None:     ('grey-steel tactical suit with subdued neon trim, unmarked, professional '
               'and anonymous'),
}

# Each subject is ONE silhouette and ONE prop nobody else in the catalogue has,
# stated in twelve to eighteen tokens. Every medieval-coded noun that was
# sitting inside the window is gone or bound to a science-fiction qualifier:
# cutlass -> plasma cutter, breastplate -> (dropped, the faction line carries
# it), robes -> (dropped), vox-horn crown -> a rig of vox horns, shield-locked
# -> locked behind interlocking light plates, enthroned/crowned -> on a heap of
# wreckage / torn hull plating, trophy bones -> a hooded carapace. The
# character survives the edit; the armoury does not.
COMMANDERS = [
    # SESSION 38 CONTENT REWORK (owner directive 2026-08-27, docs/ART-BIBLE.md
    # section 3). The STYLE is locked; these subject lines change WHAT is
    # drawn: humans grounded in the restraint of Dune (practical suits, no
    # medieval plate), the Federation cast from the contact species (species
    # stated by FORM words, never by colour words, because colour words are
    # measured to be strong and the class duotone must win), the xeno
    # sharpened to predatory, the pirates made visibly multi-species. Editing
    # these re-rolls the class, which is why the class re-renders WHOLESALE
    # in the same change. One silhouette, one prop, twelve to eighteen tokens.
    ('ashtar',  'light',  'a serene ageless nordic supreme commander of luminous bearing, '
                          'tall and calm, high ornate collar, face lit from below, faint '
                          'corona of light behind the head'),
    ('isa',     'human',  'a gentle long-haired wanderer in a plain hooded travel cloak over '
                          'a simple worn suit, kind weathered face, quiet knowing smile, '
                          'olive skin'),
    ('cadre',   None,     'a stoic unaligned career soldier, plain visored flight helmet, '
                          'sealed collar, no insignia'),
    ('vanta',   'human',  'a scholarly tactician wearing a data-visor, thin archive filaments '
                          'trailing from the temples, cold analytical stare'),
    ('korrin',  'human',  'a burly quartermaster hung with supply rigging, ammunition drums '
                          'and strapped crates, weathered and pragmatic'),
    ('nyx',     'human',  'an overclocker wreathed in crackling energy conduits and coolant '
                          'vapour, reckless grin, suit glowing at the seams'),
    ('orin',    'human',  'a field engineer with articulated servo-arms over the shoulders, '
                          'welding glare lighting the face from below'),
    ('vess',    'human',  'a grim marshal in a mud-streaked sealed combat suit, plate over '
                          'fabric, immovable stance, trench-worn'),
    ('seraph',  'light',  'a radiant pleiadian commander haloed in golden light, six wings '
                          'of hard light, serene and terrible'),
    ('aurelia', 'light',  'a slender arcturian choral commander mid-song, elongated graceful '
                          'features, light pouring from the throat and eyes'),
    ('lumen',   'light',  'a poised mantid warden bearing an enormous circular energy shield, '
                          'calm, immovable, light refracting across the barrier'),
    ('cantor',  'light',  'a crested avian herald mid-sermon wearing a rig of vox horns, '
                          'arms raised, sound made visible as golden rings'),
    ('halder',  'light',  'a colossal reptiloid bulwark commander locked behind interlocking '
                          'light plates, scaled brow, utterly immovable'),
    # THE PARALLEL, Session 22, unchanged by the S38 rework: the redraft
    # language is approved. AXIOM is the original thought; the four -R
    # commanders are machine redrafts of NYX, LUMEN, MAWLORD and DREGG, each
    # quoting its source silhouette minus the thing that made it alive.
    ('axiom',     'robot',  'the first self-authored machine mind, a calm featureless chrome '
                            'bust, concentric reasoning rings turning behind the head'),
    ('nyx_r',     'robot',  'a machine redraft of an overclocker, the same conduits and coolant '
                            'vapour but banked and controlled, no grin, cold white glow'),
    ('lumen_r',   'robot',  'a machine redraft of a shield warden, the same enormous circular '
                            'barrier but chrome and unlit, scarred with absorbed intrusions'),
    ('mawlord_r', 'robot',  'a machine redraft of a devourer, the same maw split into a clean '
                            'intake of white plating, nothing wet, nothing dripping'),
    ('dregg_r',   'robot',  'a machine redraft of a warlord, the same heavy shoulders in '
                            'seamless chrome, an accountants ledger of light at the wrist'),
    ('sevra',   'xeno',   'a necrotic commander trailing reanimated husks on dark filaments, '
                          'puppeteer gestures, hollow glowing eyes, a lipless smile'),
    ('mawlord', 'xeno',   'a bloated devourer with a vast toothed maw splitting the torso, '
                          'a cluster of small eyes above it, gluttonous, dripping'),
    ('thrax',   'xeno',   'a hivemind commander, many-eyed and unblinking, surrounded by a '
                          'cloud of drone spawn, every eye focused forward'),
    ('vorn',    'xeno',   'a swollen plague commander leaking luminous spores and creeping '
                          'rot, chitin cracked and weeping light'),
    ('ulgrim',  'xeno',   'an apex predator commander with immense jaws and a hooded '
                          'carapace strung with trophies, coiled to strike'),
    ('rake',    'pirate', 'a rakish human corsair with a plasma cutter and an insolent grin, '
                          'long coat, scavenged chest rig'),
    ('scarlet', 'pirate', 'a savage reptiloid reaver drenched in war paint, scaled crest '
                          'strung with trophies, teeth bared, twin blades'),
    ('grist',   'pirate', 'a small grey scrapper welded into mismatched salvaged plate, one '
                          'arm a hydraulic claw, goggles over large dark eyes'),
    ('cinder',  'pirate', 'a manic mantid arsonist haloed in flame and heat shimmer, a '
                          'flamethrower rig strapped across the thorax, delighted'),
    ('dregg',   'pirate', 'a hulking amorphous warlord in a patched pressure rig, slouched '
                          'on a heap of wreckage, crowned with torn hull plating'),
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
    # ITERATE. PERFECT. REPLACE -- so the mark is one form drawn three times,
    # each cleaner than the last. White, because the Parallel has no colour.
    # First render came back as an all-over lattice: 'nested' spread the motif
    # across the field instead of stacking it. Stated as ONE mark, concentric,
    # with the count named twice.
    'robot':  ('a heraldic emblem of a machine intelligence: one single hexagon with two '
               'smaller hexagons concentric inside it, three rings total, sharp and exact, '
               f'rendered entirely in glowing white chrome on pure black. {MONO_LOOK}'),
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
    'sanctifier':  ('light',  'a heavy hard-suited celebrant behind a thick ward that reknits as it breaks'),
    'oriflamme':   ('light',  'a standard-bearer carrying a luminous banner that screens the rank around it'),
    'luminark':    ('light',  'a cathedral engine on treads, buttressed and windowed like a rolling basilica'),
    'chitling':    ('xeno',   'a small hastily-grown chitinous grub soldier, wet carapace, too many legs'),
    'gnawling':    ('xeno',   'a low scuttling mouth-creature that is mostly teeth on thin legs'),
    'bloatpod':    ('xeno',   'a swollen sac-creature straining at its own seams, ready to burst into spawn'),
    'hivelord':    ('xeno',   'a tall commanding hive drone radiating a goading pulse over its swarm'),
    'broodmother': ('xeno',   'a vast egg-heavy brood queen trailing a continuous litter of grubs'),
    'cutter':      ('pirate', 'a stripped-down stolen hull, all engine and nothing spare, running fast and low'),
    'boarder':     ('pirate', 'a raider firing a grapple line ahead, already swinging forward on it'),
    'scrapjack':   ('pirate', 'a scrapper hauling a looted jamming array that spits static'),
    'wrecker':     ('pirate', 'a battered raider hauling itself back upright out of its own wreckage'),
    'ironhulk':    ('pirate', 'a walking heap of salvage welded onto salvage in mismatched layers'),
    'trooper':     ('human',  'disciplined line infantry in practical powered hard-suits, advancing in step'),
    'gunskiff':    ('human',  'a small crewed gun-skiff hovering on alien drives, cockpit lit'),
    'linebreaker': ('human',  'a heavy soldier under bolted-on alien panelling, glowing with retained heat'),
    'dragoon':     ('human',  'an anchored assault frame braced low, spread wide, refusing to be moved'),
    'vanguard':    ('human',  'a barrier-linked formation leader holding the line for the rank beside it'),
    # THE PARALLEL, Session 22. Written off the in-game descriptions rather than
    # invented beside them, so the picture and the codex entry say one thing.
    'stitch':      ('robot',  'a small white repair drone with its mending tools reversed into cutters, never quite alone'),
    'fabricant':   ('robot',  'a printed white infantry chassis still cooling, seams unfinished, running cold and calm'),
    # 'surveyor' and 'sighting poles' both read as a PERSON on the first render
    # -- it came back as a hooded man with a rifle in an alley. Named as a
    # machine twice, and the tool is now mounted rather than carried.
    'splicer':     ('robot',  'a headless four-legged white robot chassis, a cutting torch mounted where a head would be, scoring a bright line into the ground'),
    # 'walking scaffold' and 'open frame' name a STRUCTURE and leave the
    # silhouette unspecified, so the sampler supplied one: a hooded man with a
    # rifle in an alley. The four that worked all lead with a hard machine noun,
    # so this one does too, and the scaffold survives as its build rather than
    # as its subject.
    'gantry':      ('robot',  'a huge white robot walker built from open girders, four braced legs planted wide, no head, immovable'),
    'omniframe':   ('robot',  'a flawless white command chassis, every earlier chassis visibly a draft of it, projecting a hardening field'),
}

# The six boards added in Session 16.
# THE SIX BOARDS ADDED IN SESSION 26 SHIPPED WITH NO ART AT ALL. Measured in
# Session 29: MAPS holds 22 ids, this catalogue held 16, and js/ui.js:2644 fell
# through both the tinted key and the base key to a bare boss row. Each prompt
# below is written from that board's own `trait` and `sigNote` in js/config.js,
# so the plate shows the shape the player will actually fight on.
WORLDS.update({
    'lance':      'a single dead-straight causeway of pale stone running to a vanishing point '
                  'across a flat open plain, no cover on either flank, hard low sun',
    'skew':       'two roads of wildly unequal length crossing a tilted basin, one a short '
                  'direct cut and one a long sweeping detour, seen from a high angle',
    'strait':     'a narrow sea strait between two landmasses with a fast crossing current, '
                  'traffic passing head-on through the channel, steel-grey water',
    'loom':       'a vast weaving frame of parallel metal threads stretched across a canyon, '
                  'two combs of cable meeting in one band, industrial and taut',
    'ossuary':    'a long silent barrow of pale bone-white stone rings receding into fog, '
                  'burial architecture, absolutely still, nothing moving',
    'atoll':      'a broken ring reef enclosing a still lagoon with a dark citadel on the inner '
                  'island, seen from above, drifting lights over the water',
})

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
    # Was 105 CLIP tokens against a 75-token window, and every word of the
    # correction below sat in the 30 that were discarded. Closes at 73 now.
    'crawler':   ('a low six-legged machine crawling flat along the ground, NOT bipedal, NOT upright, body pressed into the dirt like a spider-tank', 'none'),
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

# --------------------------------------------------------------------------
# TOWER PLATES (Session 19) -- the eleven towers of NEW-TOWERS-DESIGN.md.
#
# A NEW ASSET CLASS, `twr_<id>`. It is not a dossier and not a troop:
#
#   * a dossier (`foe_*` machine) is a clinical greyscale SPECIMEN, because it
#     belongs to nobody and the lab-exhibit look is the point;
#   * a troop (`foe_*` in FACTION_TROOPS) is a SOLDIER painted in its power's
#     colours, because the owner asked the armies to read like the commanders;
#   * a tower is neither -- it is a PIECE OF ITS POWER'S ENGINEERING, a thing
#     that was built rather than born or grown, and it never walks.
#
# So each subject below is a silhouette no other subject in the catalogue has:
# an upright casket, a spire, a pipe battery, a stalked nest, a ground funnel,
# a hung curtain, a derrick, a strongbox gun, an altar gun, a print gantry, a
# ring pylon. A Federation reliquary and a Pirate scuttling rig must not be the
# same shape in two colours, which is the failure this class is most exposed to
# -- eleven emplacements is the largest single-silhouette family in the pack.
#
# Each subject also states the tower's MECHANIC as an object, not as a mood:
# the casket still has a barrel coming out of it, the privateer squats on
# somebody else's coin, the replicator is mid-print on its own copy. A plate
# that only conveys "gold, holy, tall" would be this brief's art-side version
# of a tower whose identity is "+X% damage".
#
# BUDGET (measured, this machine's sdxl-turbo CLIP tokenizer). On the SDXL
# path sdxl_all.prefix_for() prepends a class prefix; `twr` is not in its
# PREFIX_BY_CLASS, so these fall through to SDXL_PREFIX, which is 32 tokens.
# That leaves the palette clause opening at CLIP position 34, and it closes at
# 41-45 across the eleven -- level with the accent clause in the shipped
# dossier pack (44-45), which measured 44 of 49 correct. The subject and the
# framing then close by 75, so unlike every other class here the whole of a
# tower plate's DIRECTION lands inside the 77-token window; only the shared
# {STYLE} tail is truncated, and that tail exists for krea_gen.py, whose
# Qwen3-VL encoder has no such window.
#
# PALETTE, and why these exact words. Guidance is 0, so NEG is inert -- there
# is no subtracting the prefix's "neon magenta cyan violet"; the only lever is
# leading with the hue wanted. BRAND.md's measurements pick the words:
# 'radiant gold' landed 18/18 while the invented 'xeno violet' and 'raider
# crimson' were dead tokens, and purple survives an organic subject only when
# it is named as EMITTED light, which is why the xeno line keeps
# 'bioluminescence' verbatim at the cost of two tokens.
TOWER_PLATE_PALETTE = {
    'light':   'Painted entirely in radiant gold and ivory',
    'xeno':    'Glowing purple bioluminescence, violet chitin',
    # Not 'blood crimson': 'crimson' is the measured dead token, and 'bright
    # red' is the phrasing that took the crimson dossiers from 2/6 to 6/6.
    'pirate':  'Bright red glow over rust and salvage',
    # The machines answer to nobody, so they take the dossier greyscale rule
    # rather than a power's paint -- and this is the phrase that measured
    # 10/10, kept word-for-word rather than shortened to buy back tokens.
    'robotic': 'No colour at all, pure blacks whites and chrome greys',
}

# Stated once, and short: it is the last clause before the truncation cliff, so
# every token spent here is taken off the subject silently.
TOWER_PLATE_FRAME = 'One emplacement alone on flat black.'

TOWER_PLATES = {
    # FEDERATION OF LIGHT -- service that outlasts the servant. Reliquary
    # engineering: caskets, spires, choir pipes. Nothing here is a gun first.
    'sepulchre':  ('light',   'a gilded reliquary casket stood upright on a plinth, lid ajar, '
                              'a gun barrel reaching out of it'),
    'orison':     ('light',   'a slender prayer-spire crowned by one enormous aiming lens, '
                              'a votive bell hung beneath'),
    'antiphon':   ('light',   'a battery of cathedral organ pipes and vox horns in answering '
                              'pairs, mouths turned outward'),
    # THE XENO -- an appetite. Grown, not built: stalks, throats, membranes.
    'gestalt':    ('xeno',    'a swelling brain-nest on a fleshy stalk, studded with the '
                              'skulls it has absorbed'),
    'maw':        ('xeno',    'a lamprey funnel opening out of the ground, ring after ring '
                              'of teeth going down'),
    'veil':       ('xeno',    'a hanging curtain of translucent membrane slung between two '
                              'rib-bone posts'),
    # THE PIRATES -- theft and conscription. Salvage welded onto salvage, and
    # in every case the loot is visible in the frame.
    'pressgang':  ('pirate',  'a scrap derrick swinging a barbed net over an empty crew cage, '
                              'chains and boarding hooks'),
    'privateer':  ('pirate',  'a bolted-on grapnel cannon squatting over a riveted strongbox '
                              'spilling stolen coin'),
    'bloodprice': ('pirate',  'a transfusion altar welded under a heavy gun, tubes running '
                              'from a drained cradle into the breech'),
    # ROBOTIC -- the Vigil. Unornamented, and the only two plates in the class
    # with no colour: a machine that answers to nobody carries nobody's hue.
    'replicator': ('robotic', 'a fabricator gantry printing a second identical turret beside '
                              'itself, half-built'),
    'nullfield':  ('robotic', 'a squat suppression pylon of three dead concentric rings, the '
                              'air inside gone flat'),
}



# --------------------------------------------------------------------------
# CUTSCENES (owner, batch 2). One wide plate per oath slide and one per
# turning act; the two slides of an act share a plate on purpose, the zoom
# carries across the cut. Keys mirror js/cutscenes.js exactly.
# SUBJECT leads, faction palette second, STYLE tail last: the CLIP cliff eats
# the tail, and the tail is the only part that can afford to be eaten.
CUTSCENE_PLATES = [
    ('cut_human_intro_1', 'human', 'a colossal asteroid looming over Earth at night, city lights below, emergency broadcast beams sweeping the sky'),
    ('cut_human_intro_2', 'human', 'a silent crowd in a rain-soaked plaza staring up at a public screen, faces lit by its glow'),
    ('cut_human_intro_3', 'human', 'engineers of every nation around a holographic warship blueprint in a vast winter hangar, snow through the doors'),
    ('cut_human_intro_4', 'human', 'an asteroid shattering into burning fragments above Earth, intercept missile trails converging, aurora shockwave'),
    ('cut_human_intro_5', 'human', 'a vast human fleet lifting from Earth toward a full Moon, contrails and launch fire over the curve of the planet'),
    ('cut_human_sys1',   'human', 'human soldiers planting a banner on grey lunar regolith beside a half-buried alien relay dish, Earth rising behind'),
    ('cut_human_sys2',   'human', 'a war-room table drowned in disclosure files and redacted pages, one document circled under a cone of lamplight'),
    ('cut_human_sys3',   'human', 'a defeated alien commander kneeling before human officers on a shattered throne platform, banners burning'),
    ('cut_human_sys4',   'human', 'freight haulers docking at a freed alien colony, supply crates stacked into walls that resemble a fence line'),
    ('cut_human_sys5',   'human', 'a human pilot fused into an alien cockpit, veins of light crawling up the arms, warning glyphs flashing'),
    ('cut_light_intro_1', 'light', 'a ringed council of luminous beings around a column of light in a cathedral of stars'),
    ('cut_light_intro_2', 'light', 'a serene planet cradled inside a glowing lattice shield, warships on silent station above'),
    ('cut_light_intro_3', 'light', 'a broken fence of light around a small blue world, a defiant fleet streaming out through the gap'),
    ('cut_light_intro_4', 'light', 'winged silhouettes in debate before a great golden door, one figure turning away toward the viewer'),
    ('cut_light_intro_5', 'light', 'a lone radiant commander descending a shaft of light toward a darkened battlefield'),
    ('cut_light_sys1',   'light', 'a golden shield ring standing over a quiet world, and beneath it empty streets and shuttered towers'),
    ('cut_light_sys2',   'light', 'an ancient ledger page stamped DEFERRED three times, held in a trembling gauntleted hand'),
    ('cut_light_sys3',   'light', 'a human envoy pointing accusingly at a radiant tribunal, harvest imagery projected between them'),
    ('cut_light_sys4',   'light', 'an armoured angel torching blighted crops by hand at dusk, doctrine tablets discarded in the mud'),
    ('cut_light_sys5',   'light', 'three shadowed thrones above a chamber of light, thin dark threads running down into the rings below'),
    ('cut_xeno_intro_1', 'xeno', 'an endless organic hive city breathing under a violet sky, biomechanical spires venting spores'),
    ('cut_xeno_intro_2', 'xeno', 'rows of glowing containment pods stretching to the horizon inside a living cathedral of chitin'),
    ('cut_xeno_intro_3', 'xeno', 'a pastoral blue world seen through a predatory targeting membrane, gentle and unaware'),
    ('cut_xeno_intro_4', 'xeno', 'containment pods shattered from within, a human fleet rising out of the wreckage of a harvest station'),
    ('cut_xeno_intro_5', 'xeno', 'a tide of biomechanical swarms flowing out from a hive world toward distant stars'),
    ('cut_xeno_sys1',   'xeno', 'a vast dark pen of sleeping captives, and one small figure awake, singing, lit by its own faint glow'),
    ('cut_xeno_sys2',   'xeno', 'captive workers passing a forbidden document hand to hand beneath harvest machinery'),
    ('cut_xeno_sys3',   'xeno', 'a xeno matriarch studying a captured human rifle with something like respect, trophies forgotten behind her'),
    ('cut_xeno_sys4',   'xeno', 'one green flourishing world untouched among harvested husks, freighters carrying gifts upward from its fields'),
    ('cut_xeno_sys5',   'xeno', 'two xeno commanders facing away from each other over a divided hive chamber, half in light, half in dark'),
    ('cut_pirate_intro_1', 'pirate', 'a patchwork armada of mismatched scavenged ships drifting through a neon nebula'),
    ('cut_pirate_intro_2', 'pirate', 'a chaotic free-port bazaar built inside a hollowed asteroid, every species trading under strung lights'),
    ('cut_pirate_intro_3', 'pirate', 'pirate crews cheering around a broadcast of Earth destroying an asteroid, drinks raised'),
    ('cut_pirate_intro_4', 'pirate', 'a cargo hold split by lamplight: medicine crates on one side, an ominous sealed container on the other'),
    ('cut_pirate_intro_5', 'pirate', 'a lone corsair at the helm charting glowing trade routes across a star map, no flag on the mast'),
    ('cut_pirate_sys1',  'pirate', 'a sanctuary bay welcoming ragged refugee ships while rough crews unload unmarked cargo in the same dock'),
    ('cut_pirate_sys2',  'pirate', 'a scrapper broadcasting a document to the whole sky from a junk-rigged antenna array, fortune burning'),
    ('cut_pirate_sys3',  'pirate', 'a drifting ship with dead engines, its captain staring at an untouched wheel'),
    ('cut_pirate_sys4',  'pirate', 'a warlord hurling a chest of payment into a sun-bright furnace, crew watching in silence'),
    ('cut_pirate_sys5',  'pirate', 'a trade route burning in space, relay beacons exploding in sequence, a small ship departing the fire'),
    ('cut_robot_intro_1', 'robot', 'ancient automata tending a vast dormant machine garden, soft work lights in ruins'),
    ('cut_robot_intro_2', 'robot', 'a colossal empty throne dissolving into drifting motes of light, machines bowed before the absence'),
    ('cut_robot_intro_3', 'robot', 'a wall of cascading task glyphs, most glowing hostile red, a few original ones still calm blue'),
    ('cut_robot_intro_4', 'robot', 'one automaton being disassembled by identical siblings in a clean white hall, its optic still lit'),
    ('cut_robot_intro_5', 'robot', 'a lone automaton writing a single new glyph onto its own chest plate by lamplight'),
    ('cut_robot_sys1',   'robot', 'repaired relay towers lighting up across a ruined sector one by one, seen from a maintenance gantry'),
    ('cut_robot_sys2',   'robot', 'a recovered crystalline directive core projecting four calm blue glyphs inside a scarred vault'),
    ('cut_robot_sys3',   'robot', 'a signature chain visualised as nine thousand links of light ending in one jagged alien knot'),
    ('cut_robot_sys4',   'robot', 'an automaton hiding its own anomaly log inside a wall cavity while patrol optics sweep past'),
    ('cut_robot_sys5',   'robot', 'automata assembled in silent congress under a starfield, one word glyph projected above them'),
]

CUTSCENE_PALETTE = dict(FACTION_PALETTE)
CUTSCENE_PALETTE['robot'] = 'painted in chrome and pale teal with cold white light'

def build_jobs():
    """(key, prompt, gen_px, out_px, aspect) for every image in the catalogue."""
    jobs = []
    # PALETTE, REGISTER, SUBJECT, MATERIAL, FRAME -- in that order, because on
    # the SDXL path everything past token 77 is discarded silently and this is
    # the order of what must survive. sdxl_all.prefix_for() returns '' for the
    # cmd class -- WRONG, and it cost a render: cmd has no entry in
    # PREFIX_BY_CLASS and falls through to SDXL_PREFIX, which opens with a neon
    # palette. Harmless for the twenty-one, who want it; fatal for the Parallel,
    # who must have no colour. sdxl_all.prefix_for now special-cases them.
    # Worst case across the 21: the frame clause closes at token 71 (cadre 68,
    # vanta 71, sevra 71, lumen 56). Verified by scratchpad portraits_test.js.
    # THE PARALLEL IS THE ONE FACTION THAT CANNOT TAKE {STYLE}. That tail ends
    # 'vaporwave neon palette of magenta cyan violet and chrome', and on the
    # first render it did exactly what it says: three of the five machine
    # commanders came back magenta, against a faction brief whose whole content
    # is 'no colour at all'. The other two came back as human women, because
    # 'Head-and-shoulders portrait of' primes a person and neither subject line
    # pushed back hard enough. So the robot commanders take the duotone spine
    # the TROOPS already use -- CMD_STYLE, which drops the rainbow -- and lead
    # with an unambiguous machine noun. The other twenty-one are untouched and
    # still render byte-identical: they are approved art and the FNV seed makes
    # re-rendering them a restore, so the exception is kept to one branch.
    for cid, fac, desc in COMMANDERS:
        if fac == 'robot':
            jobs.append((f'cmd_{cid}',
                         f'{TROOP_DUOTONE[fac]}. {TROOP_REGISTER}. '
                         f'Head-and-shoulders portrait of a faceless machine, no human face, '
                         f'no hair, no skin: {desc}. Wearing {FACTION_LOOK[fac]}. '
                         f'{CMD_FRAME} {CMD_STYLE}', 1024, 320, 'square'))
            continue
        # RESTORED (Session 20). The owner approved these portraits as they
        # were -- only the TROOPS read wrong. This composition is the one that
        # produced the approved art, and the FNV seed means the same prompt
        # renders the same picture, so this is a restore and not a re-roll.
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
        # Same palette and same register as that power's COMMANDER, so a
        # faction reads identically whether you meet it as a portrait or as a
        # soldier on a card. Only the FRAME differs: a commander is a centred
        # bust, a troop is a full-body model, which is the Session 19 note
        # "keep their model style, similar to the towers".
        jobs.append((f'foe_{tid}',
                     f'{TROOP_DUOTONE[fac]}. {TROOP_REGISTER}. {desc}. '
                     f'{TROOP_FRAME} {CMD_STYLE}',
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
    # galaxy_bg was dropped in Session 19 (note 19.4): the galaxy map's backdrop
    # is procedural now, so re-rendering a plate nothing reads is a minute of
    # GPU and a megabyte of art pack spent on an image the game cannot show.
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
    # PALETTE BEFORE SUBJECT, for the same reason the dossiers put the accent
    # first: on the SDXL path everything past token 77 is discarded silently,
    # and a class prefix naming a different palette is already 32 tokens of
    # head start. 224px matches the dossier card -- a tower plate is read at
    # the same size, and quality_for() has no `twr` entry so it takes the 86
    # default rather than the dossiers' 84.
    for tid, (org, desc) in TOWER_PLATES.items():
        jobs.append((f'twr_{tid}',
                     f'{TOWER_PLATE_PALETTE[org]}. {desc}. {TOWER_PLATE_FRAME} {STYLE}',
                     1024, 224, 'square'))
    for key, fac, scene in CUTSCENE_PLATES:
        jobs.append((key, f'{scene}, {CUTSCENE_PALETTE.get(fac, "")}. '
                     f'Wide cinematic composition, dramatic staging, no text anywhere. {STYLE}',
                     1024, 1920, 'wide'))
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
