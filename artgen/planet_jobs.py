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
    # "mission patches" is the same text prior the MARK note above describes,
    # one scale down. Beats 2 and 3 came back clean on the first five plates,
    # but a patch is a lettering surface and this class is full-bleed, so the
    # noun is replaced rather than gambled on while re-rolling is still cheap.
    'human':  ('human troopers in sealed pressure suits and load-bearing rigs, practical plate '
               'over fabric, plain geometric shoulder insignia, cyan helmet lamps'),
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
    # NO LETTERING. This entry originally read "a human mission-patch banner",
    # and the render put the words HUMAN MISSION FARM across the flag in
    # legible type on pcut_00_human_5. ART-BIBLE section 1 lists lettering as a
    # Never, and the prompt already ended in "no text anywhere" AND carried
    # {STYLE}'s "no text, no watermark, no signature": three negations lost to
    # two nouns. `banner` and `mission-patch` are strong text priors and the
    # Krea path passes no negative prompt at all (guidance is 0), so the only
    # lever is what the prompt ASKS FOR. Every flag in this table is therefore
    # described positively as blank.
    'human':  ('one plain flag of solid unbroken colour with no writing and no emblem on it, '
               'steel-blue floodlights on scaffold towers, cyan work lamps strung between them'),
    'light':  ('a ring of golden hard light raised over the ground and long plain ivory '
               'hangings of solid unbroken colour with no writing and no emblem, hanging '
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
    # EARTH, world zero (owner directive, Session 41). The campaign opens on
    # the day Apophis broke over this planet and the player was never allowed
    # to stand on it. The site is the impact district: the intercept worked,
    # the rock came apart, and the fragments were hollow and full of
    # passengers. Every faction meets the same opened hulls in the street,
    # which is what makes the five campaigns visibly rhyme instead of running
    # as five sealed loops.
    (0, 0, 'EARTH',
     'a blue and white living world filling the frame, seen from inside the debris field of a '
     'shattered asteroid, its upper atmosphere streaked in every direction with the burning '
     'entry trails of the fragments that were inside the rock',
     'a coastal city under the fall, where the fragments came down whole and split open in the '
     'streets between the towers, their hulls still glowing',
     'the intercept batteries that broke the rock, swung around and depressed to fire level '
     'along their own avenues, and every shelter door in the district sealed from the inside',
     'the district burning in a ring around the impact scars, the opened fragment hulls cooling '
     'where they fell between the towers',
     'the city cleared block by block and the opened hulls dragged into the open squares where '
     'anyone can walk up and look inside them'),

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
    (3, 0, 'PROXIMA d',
     'a scorched inner rock whipping round a small red star, its daylit face crowded with the dark '
     'hulls of ships dragged here to die',
     'the wreck yards, a plain of hulls from a hundred different builders cut open and stacked in '
     'lanes',
     'yard-crane batteries and hull-plate barricades welded between the stacks',
     'the hull stacks collapsed into each other and burning along the sorting lanes',
     'the wreck yards sorted and running, hulls going out whole instead of coming in cut'),

    (3, 1, 'PROXIMA b',
     'a tide locked world holding one face to its red star for ever, a single band of liveable '
     'ground running pole to pole between a burning day side and a frozen night side',
     'the terminator strip, a long town built in permanent red sunset on the only ground that is '
     'neither scorched nor frozen',
     'ridge batteries dug in along the sunset line and shutter walls closing the town against either '
     'side',
     'the strip broken open along the ridge, shutter walls buckled outward and the town burning in '
     'red dusk',
     'the strip rebuilt end to end with its shutter walls standing open, the town running the full '
     'length of the light'),

    (3, 2, 'PROXIMA c',
     'a frozen super Earth far out from its star, its whole surface a pale blue ice sheet under a '
     'sun no bigger than a coin',
     'the cold refinery, cracking towers standing in a field of blue ice venting white plumes that '
     'freeze before they fall',
     'ice breach batteries ringing the cracking towers and pipe runs armoured under banked snow',
     'the cracking towers toppled across the ice, pipe runs split open and every plume gone out',
     'the towers standing and venting again, the ice field cut with clean roads between them'),

    (3, 3, 'THE FLARE SHELTER',
     'a bare rock under a red star mid flare, the whole sky washed hard violet white and the ground '
     'below stripped back to naked stone',
     'the flare shelter, a warren of habs dug in under metres of rock whose only surface is a field '
     'of blast hatches',
     'hatch batteries set flush with the stone and shutter doors sealing the warren from the sky',
     'the hatches blown open one after another, the warren below lit through the holes by the flare',
     'every hatch reseated and the warren driven deeper, the flare passing over ground that no '
     'longer cares'),

    (3, 4, 'THE NARROWS',
     'a debris lane threaded between three suns, ten thousand tumbling rocks catching the light of a '
     'triple star',
     'the narrows, a toll gate of gun platforms strung on cables across the only clear lane through '
     'the rocks',
     'lane batteries on the platforms and cable-strung mine curtains hung between them',
     'the toll ring shot to pieces, platforms tumbling away into the rocks and the cables cut',
     'the lane held open and the gate kept lit, a mark to steer by rather than a price to pay'),

    (3, 5, 'THE DARK LOCKER',
     'an unlit rock in the outer dark, so far from its small red star that it shows only as a shape '
     'against the stars',
     'the dark locker, a vault hollowed into the rock where cargo that has no paperwork is stacked '
     'in the cold',
     'vault batteries cut into the rock face and pressure doors thick enough to count as walls',
     'the rock face blown in, pressure doors folded back and the stacked cargo spilled into the dark',
     'the vault sealed and running again, its stacks sorted and its doors answering to a different '
     'name'),

    (3, 6, 'PROXIMA GATE',
     'a small red star burning over a great hollowed rock, every window of the harbour inside it lit '
     'at once',
     'the sanctuary bay, an interior harbour of moored ships under a rock roof built out of salvage',
     'harbour batteries set into the rock roof and a boom across the bay mouth strung from wreck to '
     'wreck',
     'the boom cut and the harbour burning, moored ships adrift and the rock roof holed through to '
     'the stars',
     'the sanctuary bay under new colours, the boom restrung across the mouth and every berth logged '
     'and numbered'),

    # ---- si 4, TABBY'S STAR. The Parallel's home: a star that dims at ------
    # irregular intervals, and a garden tended for a maker who is not coming.
    (4, 0, 'SIRIUS A I',
     'an inner world under a blue white star twenty five times brighter than the Sun, its terraces '
     'standing in light too hard to look at',
     'the machine garden, terraces of dormant automata standing in pruned and aligned rows',
     'terrace batteries between the rows and hard-light barriers strung along the garden walls',
     'the terraces broken and the rows toppled, dormant automata spilled down the garden walls',
     'the rows stood upright and realigned, the garden pruning itself again under a harder light'),

    (4, 1, 'SIRIUS A II',
     'a blazing white world with no night worth the name, its canyon floor glowing where the casting '
     'halls run without stopping',
     'the foundry, a canyon of casting halls turning out identical units one after another',
     'canyon batteries on the hall roofs and pour gates that flood the floor with molten metal',
     'the halls broken open, pour gates burst and the canyon floor running white hot',
     'the halls pouring again on a faster count, the canyon floor swept and the units stacked ready'),

    (4, 2, 'THE ASH FIELD',
     'a plain of grey dust that was once the outer envelope of a dying star, stacked memory cores '
     'standing up out of it like headstones',
     'the ash field, an archive of memory cores standing open in the debris the companion star shed',
     'core row batteries and dust berms banked between the stacks',
     'the stacks toppled through the ash, cores split open and grey dust thrown up in clouds',
     'the stacks reset in ordered rows, the ash graded flat and every core closed again'),

    (4, 3, 'SIRIUS B I',
     'a small world orbiting a white dwarf, its sealed halls glowing faintly under a companion star '
     'no bigger than Earth and hotter than anything',
     'the quarantine, sealed white halls holding units that failed inspection, every door locked '
     'from the outside',
     'hall batteries at the seals and containment shutters dropping between every corridor',
     'the seals blown and the shutters jammed half down, the halls standing open and empty',
     'the halls sealed and the inspection standard raised, every door locked from the outside as '
     'before'),

    (4, 4, 'THE DIAMOND SHELF',
     'a shelf of raw carbon under a fierce white pinpoint of a star, the ground glittering where the '
     'light catches it',
     'the diamond shelf, repair yards of gantries and cradles standing on bare carbon ground',
     'shelf batteries anchored into the carbon and cradle clamps doubling as blast frames',
     'the gantries down across their own cradles, clamps sheared through and the carbon ground '
     'cratered',
     'the cradles filled again and the gantries rebuilt taller, the shelf mended and still waiting'),

    (4, 5, 'THE COMPANION',
     'a white dwarf close enough to fill half the sky, tiny and ferociously bright, a relay mast '
     'standing black against it',
     'the companion, a relay mast and yard where the standing orders are passed down the line',
     'yard batteries at the mast base and relay shutters that blind the whole line at once',
     'the mast down across its own yard, relay shutters closed and the line gone quiet',
     'the mast raised again and the line running, orders passing down it exactly as before'),

    (4, 6, 'THE DOG STAR',
     'a blue white blaze filling the sky over a capital built entirely of instruction halls',
     'the origin, the hall the standing orders come from, tier on tier of silent desks and not one '
     'occupied',
     'hall batteries between the desk tiers and instruction gates sealing each tier from the next',
     'the tiers broken through one after another, desks scattered and the instruction gates torn off '
     'their tracks',
     'the tiers restored and the desks realigned, the orders still issuing and the chairs still '
     'empty'),
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
    # BEAT 1 WAS LOSING THE FACTION TO THE WORLD, measured by
    # tools/brand_audit.py once three systems had rendered. In-band rate by
    # beat: APPROACH 64.2%, GROUND 91.5%, ASSAULT 90.6%, AFTERMATH 94.3%,
    # NEW ORDER 94.3%. One beat out of five, and the cause is structural.
    #
    # This is the only beat whose subject is an ORBITAL ESTABLISHING SHOT, so
    # the {sky} clause, which describes the WORLD's own colour, fills the
    # frame. Venus is a sulphur-yellow cloud deck, Electra is a blue giant in
    # blue nebulosity, Titan is orange haze. Those are astronomically right
    # and they were beating the fleet: a pirate armada over Electra measured
    # hue 200 with 0.01 of its colour in the crimson band, and a human fleet
    # over Venus measured hue 50. ART-BIBLE section 2 is LOCKED on this point
    # and it is not a preference: a scene must read as its faction in the
    # first half second, and beat 1 is the FIRST FRAME of every deploy.
    #
    # The fix does not repaint the world, because a Venus that is not yellow
    # is not Venus. It moves the fleet CLOSE and gives it its own light
    # source, so the faction's hue owns the foreground while the world stays
    # itself behind. That is already what the plates which pass do: the
    # MERCURY set reads faction-distinct across all five powers because the
    # ships are large and near.
    ('1', '{fleet}, close to the viewer and filling the foreground, lit by its own running '
          'lights, arriving over {sky} far below and behind. Wide orbital shot, enormous '
          'sense of scale, the fleet dominating the composition, no figures'),
    ('2', '{force} making landfall at {site}. Wide cinematic composition, the place dwarfing '
          'the figures'),
    # BEAT 3 WAS NOT PRODUCING A BATTLE, measured across six world/faction pairs
    # once SOL had rendered: only one of the six (CERES/pirate) showed combat.
    # The others showed troopers WALKING past solar arrays, a Federation
    # PROCESSION down a canyon, automata MARCHING in formation, and a xeno
    # walker STANDING on a beach. The beat's whole job is the moment of the
    # attack and it was delivering a second establishing shot.
    #
    # Three causes, all in the old template
    # ('{force} assaulting {works}, at {site}. Wide cinematic composition, the
    # moment of the attack'):
    #
    #   1. `assaulting` is ONE weak participle buried between two long noun
    #      phrases, and the noun phrases win;
    #   2. it repeated the FULL {site} clause that beat 2 already carries, so
    #      the model had a strong establishing-shot prior and two nearly
    #      identical prompts. On VENUS beats 2 and 3 came back as almost the
    #      same picture, which is the uniqueness failure this whole feature
    #      exists to prevent;
    #   3. `Wide cinematic composition` asks for the static wide shot it got.
    #      The words fighting for action were outnumbered and outweighted.
    #
    # The rewrite leads with the action, names combat with concrete nouns
    # rather than a verb (BRAND.md: you can only lead with what you want),
    # puts the location AFTER the fight rather than in front of it, and asks
    # for a close dynamic angle instead of a wide one. {site} is kept so the
    # battle is still ON this world, but it no longer opens the sentence.
    ('3', '{force} storming {works} in a frontal assault. Muzzle flashes, blasts and smoke, '
          'debris thrown through the air, figures in violent motion close to the viewer, '
          'the peak moment of a battle. Fought at {site}. Dynamic low angle, chaotic'),
    ('4', '{after}, with {mark} standing among the wreckage. Wide cinematic composition, the '
          'battle over and the ground quiet'),
    ('5', '{order}, under {mark}. Wide cinematic composition, the world working again under a '
          'new hand'),
]

# THE ONE PLACE A NEUTRAL ART LINE IS NOT NEUTRAL.
#
# `after` and `order` are written once per world, and beats 4 and 5 use them
# for every power. That works for 34 of the 35 world/home pairings because the
# aftermath of a battle looks the same whoever won it, and because the NEW
# ORDER a liberator imposes is close enough to what any of the four
# non-Compact powers would do.
#
# It inverts on ZETA RETICULI when the player IS the Compact. Those `order`
# lines were written from a liberator's view (cut the pens out, scour the
# rendering yards, cut the chorus spire to a stump), and a Compact commander
# retaking their own home RESTORES all of it. Caught by tools/review_sheet.py,
# which puts the prompt and the player-facing sentence side by side: the plate
# showed the pens stripped back to rock while the slide read "The pens run
# again". Five of the seven Zeta worlds contradicted outright.
#
# Beat 4 needs no override. An aftermath is damage from either side, and the
# Compact lines already mourn it rather than celebrate it.
#
# Keyed by (world key, faction) so the mechanism generalises, but deliberately
# NOT filled in for cases that do not need it: a per-faction line for all 35
# worlds would be 350 lines to keep in step with 350 more, and the neutral
# line is correct everywhere else. Add a row only when the review sheet shows
# ASKED disagreeing with READS.
ORDER_OVERRIDE = {
    ('12', 'xeno'): 'the ring anchor rebuilt and the ring relit, closing exactly as tightly as it always did',
    ('20', 'xeno'): 'the pod rows refilled and glowing again, the chitin floor breathing, the pens running '
                    'exactly as they always have',
    ('21', 'xeno'): 'the sloped floors running at full yield again, the run-off channels wet and moving',
    ('22', 'xeno'): 'the honeycomb tiers relit and every banked lineage stable in its cell',
    ('23', 'xeno'): 'the chorus spire repaired and whole, singing out across the plain as before',
    ('24', 'xeno'): 'the furrows sown with blight again and the spore-vent towers standing back up',
    ('25', 'xeno'): 'the chamber walls resealed and the living record whole and glowing again',
    ('26', 'xeno'): 'the exchange compound rebuilt as a holding station, its records sealed inside it',
    ('33', 'xeno'): 'the shelter doors working and shut, the warren below them run as a holding pen',
    ('34', 'xeno'): 'the toll gate re-crewed and standing across the lane, the toll still collected and the '
                    'collector changed',
    ('36', 'pirate'): 'the bay full again and the boom left down, every berth open and the first port out of Sol '
                      'taking all comers',
    ('36', 'xeno'): 'the sanctuary bay converted into a holding harbour, every berth accounted for and every hull '
                    'logged',
    ('40', 'xeno'): 'the dormant rows left exactly as they stand, unwoken and unasked, under guard',
}

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
                          sky=sky, site=site, works=works, after=after,
                          order=ORDER_OVERRIDE.get((wk, fac), order))
            for suffix, template in BEATS:
                subject = template.format(**fields)
                jobs.append((
                    'pcut_%s_%s_%s' % (wk, fac, suffix),
                    '%s, %s. %s. %s %s' % (
                        subject, palette.get(fac, ''),
                        'Dramatic staging, strong readable silhouette',
                        # Stated as a property of the surfaces rather than as a
                        # prohibition, for the reason in the MARK note above.
                        'Every surface blank and unlettered, no writing, no '
                        'signage, no numerals, no text anywhere.', style),
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
