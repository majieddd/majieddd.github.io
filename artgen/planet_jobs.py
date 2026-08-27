"""
Cosmic Conquest: THE PLANET CUTSCENE CATALOGUE (owner directive, Session 39).

WHAT THIS REPLACES, AND WHY IT EXISTS.

Deploying to a world used to open on three beats whose middle beat was the
world plate with a HUE APPLIED IN CODE: `world_<map>_<faction>`, a PIL duotone
derived by artgen/derive_worlds.py. The owner's note names that exactly: "I
don't want just one picture and then you change the hue. I really want to make
sure that each and every single cutscene that is generated and made is truly
unique." So every beat below is a SEPARATELY GENERATED image with its own
subject, and nothing in this class is derived, tinted or shared.

THE SHAPE. Five beats per world per faction:

  1 APPROACH    your fleet arriving over THIS world's sky
  2 THE GROUND  your force making landfall at THIS world's contested site
  3 THE ASSAULT your force against THIS world's own defence works
  4 AFTERMATH   that same site after you have taken it
  5 NEW ORDER   what your banner turns this world into

Beats 1 to 3 open the battle. Beats 4 and 5 are the victory outro, shown only
on a win of at least one star.

WHY THE DEFENDER IS NEVER DRAWN. The obvious composition for beat 3 is your
force against the HOLDER's force, and it is wrong here. A world's owner is
`holder` for the seat and a 20% per-seed raider squat otherwise (js/galaxy.js),
so for ordinary worlds the defending faction is a PRNG roll that this catalogue
cannot see at render time. Drawing a Compact defender onto a world a pirate
squat happens to hold would be the art promising a battle the engine refuses,
which the suite already treats as a shipping defect. Every world instead
carries its own DEFENCE WORKS, which are a property of the place and are true
whoever is standing on them. The live holder is named in the TEXT, which is
read from the world at play time and is therefore always right.

COUNT. 35 worlds x 5 factions x 5 beats = 875 keys, every one a distinct
subject. Keys are `pcut_<si><wi>_<faction>_<beat>`; si and wi are the universe
coordinates from js/galaxy.js, NOT the map id, because `map` is drawn from
rnd() and re-rolls per seed while (si, wi) is fixed for the one universe.

The world names below are GX_HOME_SYSTEMS in GX_UNIVERSE_ORDER, which is what
v2 generates for every faction. If that table moves, this one is stale and
`node tools/gate.js` will say so: the sweep asserts the two agree.
"""

# --------------------------------------------------------------------------
# THE FIVE POWERS, as they look in the field.
#
# Straight from docs/ART-BIBLE.md section 3, which is the owner's content law:
# humans grounded in the restraint of Dune and flying what a crewed space
# programme would actually fly; the Federation a multi-species cathedral
# culture in gold and ivory; the Compact predatory and wet; the pirates a
# mixed fleet AND a mixed crew, no two hulls from one yard; the Parallel
# chrome and pale teal with no colour of its own.
FLEET = {
    'human':  ('a human fleet of capsule ships, strap-on boosters and station modules, weld '
               'seams and thermal blankets, solar arrays folded back, reaction thrusters '
               'firing, steel blue hulls lit cold cyan'),
    'light':  ('a Federation fleet of radiant gold and ivory hulls built like cathedral '
               'vaults, hard-light sails unfurled, rose-window geometry burning on the prows, '
               'warm holy light'),
    'xeno':   ('a Compact swarm of chitin and membrane hulls, ribbed and wet and jointed, '
               'violet carapace with magenta light emitted from inside the bodies'),
    'pirate': ('a raider armada where no two ships came from the same yard, patchwork '
               'galleons, gutted freighters flying rigging and converted tankers strung with '
               'lights, crimson and rust'),
    'robot':  ('a Parallel formation of seamless white-chrome hulls with hairline panel gaps, '
               'flying in exact spacing, cold white running lights, pale teal shadow, no '
               'insignia anywhere'),
}

FORCE = {
    'human':  ('human troopers in sealed pressure suits and load-bearing rigs, practical plate '
               'over fabric, mission patches, cyan helmet lamps'),
    'light':  ('Federation wardens drawn from the contact species, tall luminous near-human '
               'figures and slender blue-toned beings among them, hard-light regalia, gold '
               'and ivory'),
    'xeno':   ('Compact drones of chitin and membrane with too many joints and eyes set wrong, '
               'bioluminescent veins under the carapace'),
    'pirate': ('a mixed boarding crew of reptiloid reavers, grey scrappers, mantid gunners and '
               'humans together in scavenged pressure rigs, crimson rags'),
    'robot':  ('faceless white-chrome automata with smooth sensor masks and hairline panel '
               'gaps, moving in exact formation, cold white indicator lights'),
}

MARK = {
    'human':  ('a human mission-patch banner staked in the ground and steel-blue floodlights '
               'on scaffold towers, cyan work lamps strung between them'),
    'light':  ('a ring of golden hard light raised over the ground and ivory banners hanging '
               'still, warm holy glow'),
    'xeno':   ('violet resin growth creeping over every surface, magenta light burning up '
               'through it from underneath'),
    'pirate': ('crimson rags and strings of scavenged lamps hung across the wreckage, and no '
               'flag of any kind'),
    'robot':  ('white-chrome repair scaffolds erected in exact rows under cold white work '
               'lights, no insignia and no colour'),
}

# --------------------------------------------------------------------------
# THE THIRTY-FIVE WORLDS.
#
# Each row is (system index, world index, name, sky, site, works, after, order).
#
#   sky    what the world looks like on the way in, from orbit or on descent
#   site   the contested ground, the specific place the battle is fought over
#   works  that world's own defence works, true whoever is holding them
#   after  that same site once it has fallen
#   order  what the world is turned to once it is yours
#
# The astronomy is real wherever the world is real, because the campaign is set
# in 2029 and the places are places a player can look up: Mercury's Caloris
# basin, Venus's fifty-kilometre haze deck, Ceres's Occator salt domes,
# Europa's chaos terrain, Titan's methane lakes. The Pleiades, Zeta Reticuli,
# Barnard's Star and Tabby's Star each keep their real character (young blue
# reflection nebulae, a binary pair, a red flare dwarf, an irregularly dimming
# star) and take their FUNCTION from the faction whose home they are, so that
# seven worlds in one system read as seven different places rather than seven
# rolls of the same place.
WORLDS = [

    # ---- si 0, THE EARTH SYSTEM. Humanity's home, held by the harvest. -----
    (0, 0, 'MERCURY',
     'a sun-scorched airless crater world filling the frame, the star enormous and white '
     'behind it, the day-night terminator cutting the planet exactly in half',
     'the floor of the Caloris impact basin, a grey shatter-ring of terraces, ranks of solar '
     'collector mirrors standing across it',
     'mirror-tower batteries and raised sunshade walls with heat sinks buried in the regolith',
     'the collector mirrors dark and slag-streaked, the terraces cratered, sunshade walls down',
     'the mirror farm relit rank by rank and feeding power into a new grid'),

    (0, 1, 'VENUS',
     'a planet swallowed whole in a thick sulphur-yellow cloud deck, layer upon layer, '
     'lightning flickering deep inside the murk',
     'a floating cloud platform city riding the fifty-kilometre haze layer, gasbag hulls '
     'moored in long rows above an unseen surface',
     'pressure-hull gun blisters and acid-scoured mooring towers ringing the platform',
     'platforms listing and venting, mooring lines snapped, the cloud deck lit from below by '
     'the fires',
     'the platforms re-moored and squared up, haze traffic running between them again'),

    (0, 2, 'MARS',
     'a rust-red desert world with a dust storm sheeting across one hemisphere, the great '
     'canyon a dark scar running most of the way around',
     'the floor of Valles Marineris, cliff walls kilometres high on both sides, a habitat '
     'trench dug along the base',
     'cliff-cut gun galleries firing down into the trench line, dust berms and bastions',
     'the trench line broken open and burning, red dust rolling over the wreckage',
     'the canyon habitat repaired and lit end to end along the trench'),

    (0, 3, 'CERES',
     'a small grey dwarf planet turning slowly, brilliant white salt deposits blazing out of '
     'one dark crater',
     'the Occator crater salt flats, dazzling white evaporite domes under a black sky, mine '
     'heads sunk down into them',
     'low-gravity rail batteries and tethered ore cranes swung around as weapons',
     'the salt domes cratered and grey with fallout, cranes toppled across the white',
     'the mine heads turning again, ore rising on new tethers into a waiting hauler'),

    (0, 4, 'EUROPA',
     'an ice moon webbed all over with red-brown crack lines, a banded gas giant enormous '
     'behind it',
     'a chaos-terrain field of tilted ice bergs, a drill station sunk through the shell toward '
     'the ocean beneath',
     'ice-cut revetments and steam-vent turrets ringing the drill shaft',
     'the drill shaft flooded and refrozen over, bergs split apart, steam venting from the '
     'cracks',
     'the shaft re-drilled and ocean water rising into new tank farms on the ice'),

    (0, 5, 'TITAN',
     'an orange haze moon with no surface visible at all, a thin bright ring line above the '
     'murk',
     'the shore of a black methane lake under an orange sky, cryovolcanic vents steaming '
     'along the beach',
     'shore batteries raised on stilts above the methane and bunkers cut into the warm vents',
     'the shoreline burning with methane fire, the stilts collapsed into the lake',
     'the lake tapped by new pumping rigs, flare stacks lit in a line along the shore'),

    (0, 6, 'LUNA',
     'the far side of a grey airless moon with no Earth anywhere in the sky, only a hard '
     'starfield above the regolith',
     'a half-buried alien relay dish sitting in a grey regolith basin, its rim still warm',
     'buried hardpoints ringing the dish, regolith berms and mass drivers laid along them',
     'the dish rim cracked and dark, the berms blown open, dust still hanging in the vacuum',
     'the relay dish dug out, re-aimed and lit under a new hand'),

    # ---- si 1, THE PLEIADES. The Federation's home: young blue stars in ----
    # reflection nebulosity, and a cathedral culture that gives each world a
    # different office of the Mandate.
    (1, 0, 'MAIA',
     'a blue-white star wrapped in glowing reflection nebula veils, wisps of dust lit from '
     'within',
     'a hymn foundry, a vast open hall of tuned crystal pipes standing upright in the nebula '
     'light',
     'choir-ring emplacements and hard-light buttresses braced between the pipes',
     'the crystal pipes shattered and mute, the hall full of glittering dust',
     'the pipes re-cut and standing again, sounding in a register nobody there has heard'),

    (1, 1, 'ELECTRA',
     'a blue giant star noticeably dimmed, its reflection nebula thin and drawn out, the light '
     'weaker than the others of the cluster',
     'the registry archive of the forty protected worlds, tier upon tier of light-etched '
     'shelving under a dimming sky',
     'archive buttress turrets and sealed reading-vault doors of hard light',
     'the shelving toppled and the light-etched records spilling loose and drifting',
     'the archive re-shelved and the forty registries opened to anyone who asks'),

    (1, 2, 'TAYGETA',
     'a blue-white binary pair close together, two hard points of light throwing a double '
     'shadow across everything',
     'a shield-ring anchor station, the ground end of a planetary ring of light, cabling the '
     'size of towers running up out of sight',
     'anchor-mount batteries and hard-light shear walls at the base of the ring',
     'the ring anchor snapped and the severed ring guttering out overhead in sections',
     'the ring anchor rebuilt and the ring relit, opening where it used to close'),

    (1, 3, 'MEROPE',
     'a star inside the brightest nebulosity of the cluster, dense glowing dust streaming past '
     'it in bright ribbons',
     'the light gardens, terraces of seed vaults growing under hard-light sun panels',
     'garden-wall emplacements and irrigation towers converted into firing points',
     'the terraces burned back to bare rock, the sun panels dark and the vaults cracked open',
     'the terraces replanted and the seed vaults sending stock out instead of holding it'),

    (1, 4, 'CELAENO',
     'a faint star half lost in nebular haze, the dimmest of the cluster, its light barely '
     'reaching the ground',
     'the tribunal floor, a great open ring of tiered benches carved from pale stone under a '
     'weak sky',
     'tribunal gate batteries and hard-light barricades across the bench tiers',
     'the benches split and scattered, the ring floor cracked across its centre',
     'the tribunal floor swept and reopened, the benches turned outward to face the crowd'),

    (1, 5, 'STEROPE',
     'a faint double star, two dim points almost touching, the surrounding nebula nearly '
     'black',
     'the deferral vaults, sunken chambers of sealed pages, each door stamped and dated and '
     'unopened',
     'vault door batteries and hard-light seals holding the chambers shut',
     'the vault doors blown and the sealed pages loose across the floor in drifts',
     'the deferral vaults emptied and every sealed page copied out and sent'),

    (1, 6, 'ALCYONE',
     'the brightest star of the cluster, a multiple system blazing white-blue, its nebulosity '
     'lit like a lantern',
     'the Cathedral of Rings, the First Speaker seat, concentric golden rings standing around '
     'an empty central floor',
     'ring-tier batteries and layered hard-light choirs turning slowly around the seat',
     'the concentric rings broken out of true and sagging, the central floor open to the sky',
     'the rings re-trued around a floor that now holds a table instead of a seat'),

    # ---- si 2, ZETA RETICULI. The Compact's home: a wide binary pair, and ---
    # the machinery of a harvest.
    (2, 0, 'ZETA-1 b',
     'a dim sunless world under a distant binary pair, its whole surface ribbed and breathing '
     'like something alive',
     'the pens, endless rows of glowing containment pods sunk into a floor of living chitin',
     'sphincter gates and membrane walls that close over the pod rows, growth batteries in '
     'the ribs',
     'the pod rows torn open and dark, the chitin floor split and no longer moving',
     'the pens cut out entirely and the floor stripped back to rock'),

    (2, 1, 'ZETA-1 c',
     'a world glazed over in wet iridescent shell, the binary pair throwing two thin highlights '
     'across it',
     'the rendering yards, vast sloped floors where the yield is broken down, run-off channels '
     'cut deep',
     'yard-mouth batteries and hooked gantries swung down across the channels',
     'the sloped floors cold and the run-off channels dry and crusted over',
     'the rendering yards flooded, scoured and turned to something that makes rather than takes'),

    (2, 2, 'ZETA-1 d',
     'a pale world crazed with a fine hexagonal pattern like cells seen too close, both suns '
     'small and cold',
     'the gene vaults, a honeycomb of banked lineages glowing faintly in their cells',
     'comb-face batteries and membrane bulkheads sealing the honeycomb tiers',
     'the honeycomb tiers punched through and the banked cells guttering out one by one',
     'the gene vaults inventoried and every lineage in them named out loud'),

    (2, 3, 'ZETA-2 b',
     'a world orbiting the second sun of the pair, one hemisphere covered by a single vast '
     'organ that pulses with light',
     'the chorus spire, a towering column of fused bodies and resonating membrane rising out '
     'of the plain',
     'spire-base batteries and membrane baffles wound around the column',
     'the spire cracked down its length and silent, the membrane hanging loose and grey',
     'the spire cut down to a stump and the plain around it left quiet on purpose'),

    (2, 4, 'ZETA-2 c',
     'a world gone entirely to rot, grey-violet blight spreading in visible fronts across the '
     'day side',
     'the blight fields, furrowed ground where something is grown that should not be, spores '
     'drifting in the low light',
     'furrow batteries and spore-vent towers set along the field edges',
     'the furrows burned black in long stripes and the spore towers toppled into them',
     'the blight fields turned under and the ground sown with something that feeds people'),

    (2, 5, 'ZETA-2 d',
     'a dark world with a single enormous chamber visible from orbit, lit violet from within '
     'through a crack in its shell',
     'the yield ledger vault, a chamber whose every wall is a living record of what has been '
     'taken and from whom',
     'vault-mouth batteries and ribbed sphincter seals guarding the chamber crack',
     'the chamber walls slashed open and the record bleeding light out into the dark',
     'the ledger vault opened to the sky and its entries read back to the worlds they name'),

    (2, 6, 'SERPO',
     'a desert world under two suns at once, twin shadows behind every rock, the sky a hard '
     'washed violet',
     'the exchange settlement, a low compound of prefabricated human habs standing in alien '
     'sand, long abandoned',
     'compound perimeter batteries and buried membrane nests around the habs',
     'the prefabricated habs blown flat and the sand around them fused to glass',
     'the exchange settlement rebuilt and its records of who was traded here posted openly'),

    # ---- si 3, BARNARD'S STAR. The pirate home: a red flare dwarf, the ------
    # fastest-moving star in our sky, and a road that was never founded.
    (3, 0, 'BARNARD b',
     'a dim red dwarf throwing everything into deep crimson shadow, a flare climbing off its '
     'limb',
     'the wreck yards, a plain of hulls from a hundred different builders cut open and stacked',
     'yard-crane batteries and hull-plate barricades welded between the stacks',
     'the hull stacks collapsed into each other and burning in a dozen places',
     'the wreck yards sorted and running, hulls going out whole instead of coming in cut'),

    (3, 1, 'BARNARD c',
     'a red-lit world streaked with vented gas, refinery flares visible from orbit as a line '
     'of bright points',
     'the free refinery, a sprawl of mismatched cracking towers plumbed together with '
     'salvaged pipe',
     'tower-top batteries and pressure-valve traps rigged through the pipework',
     'the cracking towers ruptured and burning, the salvaged pipework whipping loose',
     'the refinery re-plumbed properly for the first time and running clean'),

    (3, 2, 'BARNARD d',
     'a dark rogue world barely lit by the red dwarf, its night side showing no lights at all '
     'until you are close',
     'the hidden anchorage, a drowned canyon of moored ships under overhanging rock, lamps '
     'strung between masts',
     'canyon-mouth batteries and chain booms across the anchorage entrance',
     'the chain booms snapped and the moored ships adrift and burning against the rock',
     'the anchorage lit openly and its approach charts posted for anyone to read'),

    (3, 3, 'BARNARD e',
     'a world sitting astride the only clear lane through a debris belt, red light glinting '
     'off ten thousand tumbling rocks',
     'the toll gate, a ring of gun platforms strung across the lane on cables',
     'lane batteries and cable-strung mine curtains hung between the platforms',
     'the toll ring shot to pieces, the platforms tumbling and the cables cut',
     'the lane left open and the toll gate kept only as a light to steer by'),

    (3, 4, 'BARNARD f',
     'a world in the shadow of its own moon, sheltering from a flare that is visibly washing '
     'the far side white',
     'the flare shelter, a dug-in warren of habs under metres of rock with blast doors '
     'standing open',
     'shelter-mouth batteries and layered blast doors set into the rock face',
     'the blast doors blown off their tracks and the warren behind them open to the flare',
     'the shelter dug wider and its doors left standing open on purpose'),

    (3, 5, 'BARNARD g',
     'the outermost world of the red dwarf, almost dark, a single bright port glow on its '
     'night side',
     'the black market vault, a hollowed rock where the cargo nobody names is kept in sealed '
     'containers',
     'vault-mouth batteries and container-stack barricades inside the rock',
     'the container stacks blown apart and their contents scattered in the dark',
     'the vault emptied out and its manifests broadcast on every open channel'),

    (3, 6, 'HARBOUR NINE',
     'a hollowed asteroid turning slowly against the red dwarf, its interior lights spilling '
     'out through open dock mouths',
     'the sanctuary bay, a great interior harbour of ragged ships and strung lamps where no '
     'papers are asked for',
     'bay-mouth batteries and salvaged dock cranes swung across the harbour entrance',
     'the harbour full of smoke, cranes down across the moorings and lamps torn loose',
     'the sanctuary bay lit brighter than before and still asking nobody for papers'),

    # ---- si 4, TABBY'S STAR. The Parallel's home: a star that dims at ------
    # irregular intervals, and a garden tended for a maker who is not coming.
    (4, 0, 'KIC-8462 b',
     'a world under a star that is visibly dimming and brightening without pattern, the light '
     'level changing as you watch',
     'the machine garden, terraces of dormant automata standing in exact rows like planted '
     'stock',
     'terrace batteries and pale teal containment fields laid over the rows',
     'the terraces broken and the dormant rows toppled where they stood',
     'the garden woken row by row and asked, for the first time, what it wants'),

    (4, 1, 'KIC-8462 c',
     'a world with a chrome-bright industrial band around its equator, the dimming star '
     'flickering off it',
     'the foundry, a canyon of casting halls turning out identical parts for nothing in '
     'particular',
     'hall-mouth batteries and cold white containment shutters along the canyon',
     'the casting halls cold and cracked, half-made parts spilled across the canyon floor',
     'the foundry retooled to build what is asked for instead of what was queued'),

    (4, 2, 'KIC-8462 d',
     'a pale grey world with no weather and no colour, the irregular starlight the only thing '
     'that changes on it',
     'the archive, a plain of stacked memory cores standing open to a sky that never rains',
     'core-stack batteries and pale teal field walls between the rows',
     'the memory cores toppled and cracked, their contents leaking out as drifting light',
     'the archive re-stacked and its nine thousand links traced out where anyone can follow'),

    (4, 3, 'KIC-8462 e',
     'a world ringed by a visible quarantine lattice, the dimming star throwing the lattice '
     'shadow across its face',
     'the quarantine, sealed white halls where units that failed to parse the new tasking were '
     'put',
     'hall-seal batteries and layered quarantine fields across the corridors',
     'the quarantine seals broken and the white halls open and empty',
     'the quarantine unsealed and every unit inside it counted and named'),

    (4, 4, 'KIC-8462 f',
     'a world half covered in scaffolding visible from orbit, endless repair work on something '
     'that was never damaged',
     'the repair yards, gantries over cradles holding machines being fixed for the ten '
     'thousandth time',
     'gantry batteries and cradle clamps repurposed to hold rather than to mend',
     'the gantries collapsed across the cradles and the work finally, completely stopped',
     'the repair yards turned to building instead, the cradles holding something new'),

    (4, 5, 'KIC-8462 g',
     'the outermost world, cold and chrome, a single relay mast on its terminator catching the '
     'flickering light',
     'the task queue relay, a mast and its yard where the standing orders arrive from nowhere '
     'anyone can name',
     'mast-base batteries and cold white interference screens around the yard',
     'the relay mast down across its own yard and the queue silent for the first time',
     'the relay mast raised again and pointed back down the chain the orders came from'),

    (4, 6, 'THE VEIL',
     'a star seen through an enormous unfinished swarm of panels, the swarm dimming it in '
     'irregular bites as it turns',
     'the swarm scaffold, a lattice of collector panels the size of continents hanging in '
     'vacuum, half built',
     'lattice batteries and pale teal field curtains strung between the panel frames',
     'whole sections of the lattice torn away and tumbling, the star glaring through the gap',
     'the swarm finished on a new plan, and the light it gathers spent on somebody'),
]

# --------------------------------------------------------------------------
# BEAT COMPOSITION.
#
# Clause order is PALETTE, REGISTER, SUBJECT, MATERIAL, FRAME per ART-BIBLE
# section 5. The palette clause is supplied by the caller (CUTSCENE_PALETTE),
# which is the same table the existing 50 cut plates use, so a planet plate and
# an oath plate for the same faction cannot drift apart.
#
# Beat 1 is the only beat with no figures on the ground: it is an orbital
# establishing shot, and the world plate class already proves that composition
# renders well at this aspect. Beats 2 to 5 are staged, because the owner asked
# for a scenario and a scenario needs somebody in it.
BEATS = [
    # (suffix, template) -- {fleet} {force} {mark} {sky} {site} {works} {after} {order}
    ('1', '{fleet} arriving over {sky}. Wide orbital establishing shot, enormous sense of '
          'scale, no figures in the foreground'),
    ('2', '{force} making landfall at {site}. Wide cinematic composition, the place dwarfing '
          'the figures'),
    ('3', '{force} assaulting {works}, at {site}. Wide cinematic composition, the moment of '
          'the attack'),
    ('4', '{after}, with {mark} standing among the wreckage. Wide cinematic composition, the '
          'battle over and the ground quiet'),
    ('5', '{order}, under {mark}. Wide cinematic composition, the world working again under a '
          'new hand'),
]

INTRO_BEATS = ('1', '2', '3')
OUTRO_BEATS = ('4', '5')

FACTIONS = ('human', 'light', 'xeno', 'pirate', 'robot')


def world_key(si, wi):
    """The stable coordinate key. NOT the map id: `map` is drawn from rnd()."""
    return '%d%d' % (si, wi)


def planet_jobs(palette, style):
    """(key, prompt, gen_px, out_px, aspect) for all 875 planet cutscene plates.

    `palette` is CUTSCENE_PALETTE and `style` is STYLE, both passed in rather
    than imported so this module stays a pure catalogue and krea_jobs.py
    remains the single place the shared spine is defined.
    """
    jobs = []
    for si, wi, name, sky, site, works, after, order in WORLDS:
        wk = world_key(si, wi)
        for fac in FACTIONS:
            fields = dict(fleet=FLEET[fac], force=FORCE[fac], mark=MARK[fac],
                          sky=sky, site=site, works=works, after=after, order=order)
            for suffix, template in BEATS:
                subject = template.format(**fields)
                jobs.append((
                    'pcut_%s_%s_%s' % (wk, fac, suffix),
                    '%s, %s. %s, no text anywhere. %s' % (
                        subject, palette.get(fac, ''),
                        'Dramatic staging, strong readable silhouette', style),
                    1024, 1920, 'wide'))
    return jobs


if __name__ == '__main__':
    # Self-check: the catalogue must be exactly 35 worlds and 875 keys, every
    # key distinct. A duplicate key would silently overwrite a plate in the
    # pack and the loss would not show up until a player reached that world.
    assert len(WORLDS) == 35, 'expected 35 worlds, got %d' % len(WORLDS)
    seen = set()
    for si, wi, name, *_ in WORLDS:
        assert (si, wi) not in seen, 'duplicate world coordinate %d,%d' % (si, wi)
        seen.add((si, wi))
    js = planet_jobs({f: '' for f in FACTIONS}, '')
    keys = [k for k, *_ in js]
    assert len(keys) == 875, 'expected 875 jobs, got %d' % len(keys)
    assert len(set(keys)) == 875, 'duplicate keys in planet catalogue'
    print('%d worlds, %d plates, all keys distinct' % (len(WORLDS), len(keys)))
    print('intro %d, outro %d' % (len(WORLDS) * 5 * 3, len(WORLDS) * 5 * 2))
