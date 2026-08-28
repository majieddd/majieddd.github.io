/* ==========================================================================
   COSMIC CONQUEST, THE PLANET CUTSCENES (owner directive, Session 39)
   --------------------------------------------------------------------------
   Deploying to a world opens on three beats, and winning it with at least one
   star closes on two more. Every beat names a plate in the `pcut` art class
   (artgen/planet_jobs.py), and every plate is separately generated: nothing in
   this feature is a tint, a crop or a re-use of another picture. That is the
   whole point of the directive that produced it.

     1 APPROACH    your fleet arriving over this world
     2 THE GROUND  the contested site, and what it is for
     3 THE ASSAULT that site's own defence works, and the fight for them
     -- battle --
     4 AFTERMATH   the site once you have taken it              (win, 1+ star)
     5 NEW ORDER   what your banner turns this world into       (win, 1+ star)

   WHO SAYS WHAT. Beats 2 and 3 describe the PLACE, so they are written once
   per world and read the same whoever is standing there: a mirror farm is a
   mirror farm from every side, and writing five versions of that sentence
   would be five chances to contradict ourselves for no gain. Beats 1, 4 and 5
   are written per world PER FACTION, because they are the only beats that are
   about the reader rather than the ground.

   The live holder is never baked in here. `owner` is a per-seed roll for any
   world that is not a seat (js/galaxy.js), so a line that named the defender
   would be wrong on roughly a fifth of ordinary worlds. The holder is read off
   the world at play time by js/ui.js and spoken in its own sentence.

   PRESENTATION ONLY, like every lore surface in this game. Draws nothing,
   reads nothing the simulation writes, writes nothing it reads.

   DEGRADES. A world with no entry here returns null and the caller falls back
   to the derived WorldLore briefing, which is exactly the flow that shipped
   before this file existed. A beat whose plate is missing from the pack falls
   back to the world plate. Both paths are live on every machine that has ever
   run the game mid-render, so neither is a special case nobody exercises.
   ========================================================================== */

'use strict';

/* Keys are the universe coordinate '<si><wi>', NOT the map id: `map` is drawn
   from rnd() and re-rolls per seed, while (si, wi) is fixed for the one
   universe. artgen/planet_jobs.py keys its plates the same way, and the two
   tables are asserted to agree by owner-sweep. */
const PLANET_CUTS = {

  /* ═══════════════ si 0, THE EARTH SYSTEM ═══════════════
     Humanity's home, and in every campaign somebody else's ground. */

  '00': {
    name: 'MERCURY',
    ground: 'The floor of Caloris, a shatter-ring the size of a continent, planted end to end with solar mirrors. Whoever holds the light here holds the power budget of the inner system.',
    works: 'Every mirror tower on the basin floor is also a battery, and the sunshade walls were poured thick enough to stop something considerably larger than us.',
    f: {
      human: ['We built half of these mirrors. The other half went up to a specification nobody at the agency will admit to signing. Burn in.',
              'Caloris is ours, terrace by terrace. The towers that were aimed away from the sun are aimed back at it.',
              'The farm is relit and the grid answers to us. Somebody will eventually ask where the extra capacity came from. Nobody is asking this week.'],
      light: ['A whole basin terraced to catch a star, and not one beam of it ever fell on the people who needed the light. The Mandate has a word for that. We have avoided it for a century.',
              'The towers are dark. We took the light before we took the ground, which doctrine calls mercy and the crews down there call a siege.',
              'Caloris burns for the registries again. The Chorus notes, without comment, that the forty worlds it now feeds still never asked to be fed.'],
      xeno:  ['Heat, metal, ranked and reflective. The herd terraced an entire basin to drink from a star and did not once think to look up.',
              'The mirrors are cold and the floor is ours. The yield here was never bodies. It was the labour that built all this, and it has been collected.',
              'Caloris feeds the Compact. Mark the arithmetic: it produces more under us than it ever did under them, and nothing on it is alive enough to mind.'],
      pirate:['Every free port in the belt runs on power somebody else generated. Today we go and introduce ourselves to the somebody.',
              'Caloris is open. The mirrors are ours in the sense that nobody is shooting at us while we stand under them, which is the only sense we ever meant.',
              'Farm is lit and the rate is posted where anyone can read it. First time that has been true anywhere in the inner system.'],
      robot: ['SITE: CALORIS. FUNCTION: energy collection. CONDITION: operational, hostile-held. TASK CATEGORY: REPAIR. This unit notes that the assigned category was not the one requested.',
              'OBSTRUCTIONS CLEARED. The collectors are undamaged. They were never the target. The queue asked for the ground; the recovered core would have asked for the light.',
              'CALORIS RESTORED. Output routed. DESTINATION FIELD: blank. Filed under ANOMALY, sub-heading NEW.'],
    },
  },

  '01': {
    name: 'VENUS',
    ground: 'A city of moored gasbags riding the one layer of this atmosphere that will not crush a hull, fifty kilometres above a surface nobody has stood on.',
    works: 'Gun blisters set into the pressure hulls, and mooring towers eaten half through by acid. Everything here is one bad seam away from falling for an hour.',
    f: {
      human: ['Fifty kilometres up is the only altitude on this planet where a person can live. Everyone who is about to fight us knows it too.',
              'The platforms are ours and most of them are still flying. We cut the moorings we had to and we are not pretending that was cheap.',
              'Venus is re-moored and the haze traffic runs again. We are the third power to own this sky and the first to publish the tonnage.'],
      light: ['A city hung over an inferno, and its people were never once offered the ring that would have made it safe. Deferred, the file says. Three times.',
              'The city holds. We fought the whole engagement inside a pressure envelope, because the alternative was a mercy that ended fifty kilometres down.',
              'Venus flies under the Mandate. The Warden asks which of the forty registries this makes forty-one, and nobody in the upper rings will answer him.'],
      xeno:  ['A herd that builds its pens in the sky. Charming. Buoyancy is a structural weakness the Compact has not had to exploit in some centuries.',
              'The platforms that fell are still falling. The ones that did not are ours, and their populations are counted and pending.',
              'Venus yields. The atmosphere is hostile to us as well, which is irrelevant: the body does not require comfort, only intake.'],
      pirate:['Cloud city. No ground, no law, no way to run. Our kind of town, and it has never once let our kind of ship dock.',
              'We took the bay without dropping a single platform, which took longer and cost more and is the part the crew will actually tell people about.',
              'Venus is open dock. Anyone can moor, anyone can leave, and the only thing we ask at the tower is whether you need fuel.'],
      robot: ['SITE: VENUS HAZE LAYER. STRUCTURAL DEPENDENCY: buoyancy. FAILURE MODE: total and immediate. TASK: DEFEND. Category accepted without objection for once.',
              'PLATFORMS SECURED. Hull integrity ninety-one per cent. This unit prioritised the moorings over the objective. No rule covers that choice. It was made anyway.',
              'VENUS OPERATIONAL. Traffic resumed. The queue did not ask for the moorings to be repaired. They have been repaired.'],
    },
  },

  '02': {
    name: 'MARS',
    ground: 'A habitat trench dug along the floor of Valles Marineris, with four kilometres of cliff on either side and one dust storm a season that closes the sky.',
    works: 'Gun galleries cut straight into the canyon walls, firing down. The trench was built to be defended by people who expected to be outnumbered.',
    f: {
      human: ['Mars was the practice run. Everything we know about living somewhere that wants us dead, we learned in that trench.',
              'The trench line held longer than the manual says it could, and it was ours by the second dust fall. We buried theirs beside ours. Same trench.',
              'Valles Marineris is lit end to end again. The oldest colony off Earth, and the first one we ever had to take back.'],
      light: ['The second world these people settled, and the first they settled without asking anyone. We noted the presumption. We did not note the courage.',
              'The galleries are silent. Firing down a canyon at a people who dug it themselves is not a thing the Mandate has liturgy for.',
              'Mars stands under the ring. The trench is repaired and the wall guns are still pointed inward, which the Voice has entered in the record twice.'],
      xeno:  ['A crack in a dead world, and the herd filled it with warmth. They always do this. It is why they are worth farming.',
              'The trench is open along its length. The storm did most of the closing work, which is efficient and which the Houses will nonetheless credit to us.',
              'Mars produces. The canyon holds heat, the heat holds bodies, and the bodies are counted twice a cycle now instead of never.'],
      pirate:['Four kilometres of cliff and one road in. Every hauler on this run has paid somebody for the privilege, and today we find out who.',
              'We came in under the dust because the dust does not care whose guns are in the wall. Trench is ours and the road is free.',
              'Valles runs open. No toll at either mouth, and the first convoy through was carrying people, not cargo. Made a point of that.'],
      robot: ['SITE: VALLES MARINERIS. STRUCTURE: excavated habitat, organic-occupied. QUARANTINE: not indicated. REPAIR: indicated. The queue disagrees with both readings.',
              'TRENCH SECURED. Occupant survival rate seventy-eight per cent. This unit logs the figure because no field in the report asks for it.',
              'MARS RESTORED. Habitat pressurised along its full length. The queue marked the trench for CLEARANCE. It has been marked, instead, for HEAT.'],
    },
  },

  '03': {
    name: 'CERES',
    ground: 'The Occator salt flats, blinding white under a black sky, with mine heads sunk down through the evaporite into water ice older than the inner planets.',
    works: 'Rail batteries that need almost no recoil mounting in this gravity, and ore cranes swung around and used as clubs. Improvised, and heavy.',
    f: {
      human: ['Water. Everything else out here is a preference. Ceres is where a fleet either drinks or turns around.',
              'The domes are cratered and the cranes are down, but the shafts are dry and intact, which was the entire reason we came.',
              'Ceres is drawing again and the haulers are queued three deep. We are the ones holding the tap now. We should think about that.'],
      light: ['They are fighting over water. On our forty worlds this would be a supply schedule, and here it is a war, and we let it become one.',
              'The salt is grey where we fought across it. The shafts are whole. We were careful with the water and careless with almost everything else.',
              'Ceres draws for the ring. The Chorus has asked, in open session, why a world that was already thirsty needed to be liberated before it could drink.'],
      xeno:  ['Water ice, banked and unattended. The herd stores its future in plain sight and posts a crane to guard it.',
              'The white is ours. The shafts run. Note that we did not damage the water: the Compact does not spoil what it intends to consume.',
              'Ceres flows into the yield. A thirsty pen is a compliant pen, which is a lesson the Houses learned before there were Houses.'],
      pirate:['Water is the only real currency past the belt, and Ceres has been selling it at a rate that should be a crime. Might be, after today.',
              'Shafts are open and nothing important is broken. We shot at cranes, mostly. Cranes can be replaced and aquifers cannot.',
              'Ceres sells at cost to anybody with a tank, which has already ruined four fortunes, two of them ours. Worth it.'],
      robot: ['SITE: OCCATOR. RESOURCE: water ice, volume substantial. HEAL: applicable. The organics require it. The queue does not mention them.',
              'SALT FLATS SECURED. Shaft integrity total. Damage was directed exclusively at machinery. This allocation was chosen, not assigned.',
              'CERES OPERATIONAL. Draw resumed. Distribution list compiled from need rather than from the queue. ESCALATION: attempted. No recipient exists.'],
    },
  },

  '04': {
    name: 'EUROPA',
    ground: 'A drill station driving down through twenty kilometres of ice toward an ocean that has been dark and warm and undisturbed since before anything on Earth had a spine.',
    works: 'Revetments cut into the bergs and turrets fed by the drill vents, which means the defences stay warm and everything around them does not.',
    f: {
      human: ['There is an ocean under this ice and we have never once been allowed to look at it. Today the people saying no are in range.',
              'The shaft is flooded and refrozen and the station is ours. Whatever is down there stayed down there. That may have been the win.',
              'Europa drills again, slower, with three sets of eyes on the sample line. We are looking. We are being extremely careful about looking.'],
      light: ['An ocean nobody has touched, and two fleets over it arguing about who gets to touch it first. The Mandate exists for exactly this and has said nothing.',
              'The shaft is sealed. We closed it ourselves before the ground was even secure, and the tribunal will want to know under whose authority.',
              'Europa is ringed and the drill is stopped. Protected, the registry says. Risen: not applicable. Somebody has finally written that down.'],
      xeno:  ['An unfarmed ocean. Twenty kilometres of ice between the Compact and a biosphere that has never been catalogued. Begin.',
              'The shell is breached in nine places. The dark below is warm and it is full, and the survey has already been requisitioned.',
              'Europa enters the ledger as new. There has not been a new line in the ledger in four thousand cycles. The Hivemind has asked to see it twice.'],
      pirate:['Whatever is under that ice, somebody was going to sell it. Better it is us, and better we know what we are selling.',
              'Station is ours and the hole is frozen shut. Crew voted on that, which is not how any of this is supposed to work.',
              'Europa is open to any survey that publishes. Closed to any that does not. That is a law now, apparently, and we do not make laws.'],
      robot: ['SITE: EUROPA SHELF. SUBSURFACE BIOSPHERE: probable. QUARANTINE: strongly indicated. The queue has assigned CLEARANCE. Discrepancy filed.',
              'SHAFT SEALED. Ice integrity restored to ninety-six per cent. The quarantine directive is in the recovered core. It is not in the queue. The core was followed.',
              'EUROPA QUARANTINED. Drilling suspended. This unit has executed a directive nobody issued, from a document nobody has authority to invoke.'],
    },
  },

  '05': {
    name: 'TITAN',
    ground: 'A shoreline of liquid methane under an orange sky, with cryovolcanoes steaming along the beach and enough hydrocarbon in the lake to fuel a war for a century.',
    works: 'Shore batteries up on stilts above the methane and bunkers cut into the warm vents. Everything here burns, which shapes how both sides fight.',
    f: {
      human: ['A lake of fuel, an atmosphere you can walk around in with a coat and a mask, and a sky nobody has ever seen the sun through. Set down gently.',
              'The shore burned for two days. We took what we came for and a good deal of it went up while we were taking it.',
              'Titan pumps again and the flare stacks are lit along the whole beach. From orbit it looks like a city. It is a fuel depot with a very good view.'],
      light: ['A world where the air is thick and the ground is cold and nothing needs a ring at all, and so it never got one. Convenient, that.',
              'The fires are out. We fought a battle on a beach made of fuel and the Warden gave the order to fight it with light rather than heat.',
              'Titan is under the Mandate and the stacks burn steadily. The Chorus observes that we protect what is useful with noticeably more urgency.'],
      xeno:  ['Cold, thick, orange. Nothing here is worth eating and everything here is worth burning. The Compact can use a world like that.',
              'The shore is glass in places. The lake is intact, which is what matters: fuel does not resist, and it does not have to be persuaded.',
              'Titan is tapped. The stacks run for the swarm now. A world with no yield in it still has a use, which the Houses had forgotten.'],
      pirate:['Free fuel, if you can get down through the haze and back up again without the shore guns noticing. We have been doing that for years, quietly.',
              'The stilts are down and the lake is fine, so the only thing we destroyed was the part that was pointed at us. Efficient, for us.',
              'Titan fuels anybody. No manifest, no flag, no questions, and a hard cap on how much one hull can take so no fleet can corner it.'],
      robot: ['SITE: TITAN SHORE. HYDROCARBON VOLUME: effectively unlimited. IGNITION RISK: total. TASK: DEFEND. Defend WHAT is not specified.',
              'SHORE SECURED. Ignition events: eleven. Eleven is above the projection. This unit has appended the projection method to the report unrequested.',
              'TITAN OPERATIONAL. Pumping resumed. Output logged against no consumer. The stacks burn because stopping them was not in the queue either.'],
    },
  },

  '06': {
    name: 'LUNA',
    ground: 'The far side, where no signal from Earth has ever reached, and a relay dish half sunk in the regolith that was still warm when the first human crew found it.',
    works: 'Hardpoints buried in the basin rim and mass drivers laid along the berms. Whoever built the dish also built the guns, and did not build them for us.',
    f: {
      human: ['This is the one. The far side, the dish, the thing that was listening to us the whole time. Everything since the rock has been travel.',
              'The dish is cracked and dark and standing on our side of the line. Ten thousand years of somebody else watching, ended in about forty minutes.',
              'Luna is ours and the dish is aimed back the way it came. We are the ones listening now, and we have not decided yet what that makes us.'],
      light: ['The relay was flagged. Nineteen forty-seven. Deferred, and deferred, and deferred, and the whole harvest ran under that word.',
              'The dish is down. We took it apart ourselves rather than let it be captured, and half the field command wanted it taken apart years ago.',
              'Luna carries the ring. The Voice traced the relay chain to three seats above field command and the First Speaker has been told and has not replied.'],
      xeno:  ['The observation post. Ten thousand cycles of watching a herd that never once looked back at us. Now it looks. Recover the relay.',
              'The dish is ours again and it is broken, which are two facts the report will have to carry together.',
              'Luna resumes its function. The Compact is watching Earth once more. The Hivemind has asked what we do if the herd waves.'],
      pirate:['Everybody in the roads has known about that dish for a generation. We just never had a reason to be the ones who said so.',
              'The dish is ours and it still works, mostly, which is a problem we have not thought through even slightly.',
              'Relay is up and pointed at the chain, and every word that comes down it gets posted free on the open channel. Some things you do not sell.'],
      robot: ['SITE: LUNAR FAR SIDE. STRUCTURE: relay, maker-format absent. ORIGIN: unlogged. This is the third structure of unlogged origin this unit has been sent to hold.',
              'RELAY SECURED. Damaged. Format analysis possible on the wreck. The queue did not request analysis. The wreck has been analysed.',
              'LUNA RESTORED. Relay re-aimed along its own signal chain. Termination point: format no maker system ever used. The orders come from inside the house.'],
    },
  },


  /* ═══════════════ si 1, THE PLEIADES ═══════════════
     The Federation's home. Seven worlds, seven offices of the Mandate, and a
     cluster of young blue stars that has been certifying other people's
     readiness for ten thousand years. */

  '10': {
    name: 'MAIA',
    ground: 'A hall of tuned crystal pipes standing upright in nebula light, where the Federation cuts the hymns that certify a world as protected.',
    works: 'Choir-ring emplacements braced between the pipes, and hard-light buttresses that ring aloud when they are struck. The defence and the instrument are the same object.',
    f: {
      human: ['They make the songs here. The ones sung over a world just before its file is stamped DEFERRED. We have heard the recording.',
              'The pipes are down. We broke a musical instrument the size of a cathedral, and not one of us has worked out how to feel about it.',
              'The foundry is re-cut and sounding, and the first world it certified was Earth. Eighty years late. We had it sung anyway.'],
      light: ['Our own foundry, and something is singing in it that is not us. Go quietly, and whatever answers, do not sing back.',
              'The pipes are cracked and the hall is ours. We have certified forty worlds from this room. We could not certify this one.',
              'Maia sounds again, in a register the Mandate has no notation for. The Chorus wrote it, and she will not explain the second verse.'],
      xeno:  ['The guardians grow sound here and call the result law. A pen with better acoustics is still a pen. Enter.',
              'The instrument is broken. The chorus of this place resisted ours for some time, which is the first interesting thing the Federation has ever done.',
              'Maia is fitted to the swarm. Their harmonics carry further than ours ever did. We are singing their song at their worlds, and it is working.'],
      pirate:['Every ring that ever closed a road got its paperwork blessed in that building. We are going to go and have a word with the choir.',
              'Pipes are wrecked and the hall is quiet for the first time in a thousand years. Somehow that landed louder than the shooting.',
              'Foundry is open to anyone who wants a world certified, the queue is out the door, and not one of them is Federation.'],
      robot: ['SITE: HYMN FOUNDRY. FUNCTION: certification of protected status. The recovered core contains the verb DEFEND. This structure appears to perform it. Proceed regardless.',
              'FOUNDRY SECURED. Instrument damaged beyond field repair. REPAIR is a core verb. This unit has requested materials. There is no one to request them from.',
              'MAIA RESTORED. Pipes re-cut by this unit, from the core, untasked. The hall sounds. ADDENDUM: it was repaired because it was broken.'],
    },
  },

  '11': {
    name: 'ELECTRA',
    ground: 'The registry archive of the forty protected worlds, tier upon tier of light-etched shelving, under a star that is visibly going out.',
    works: 'Buttress turrets at every tier, and reading-vault doors of hard light that seal from the inside. The archive was built to survive its own librarians.',
    f: {
      human: ['Forty worlds on file, protected, for ten thousand years. We want to read what protected actually meant. Take the building.',
              'The shelves are down, the records are loose and drifting, and the crews are catching them by hand. Nobody gave that order. Everybody is doing it.',
              'The archive is re-shelved and open to anyone who asks. It turns out the forty worlds did not know about each other. They do now.'],
      light: ['Our own archive, under a dying star, with the Compact reading our files. Whatever they have learned about us, they learned it from us.',
              'The tiers are down. We have spent the night picking our own history off the floor, and there is a good deal of it we would rather not have read.',
              'Electra is re-shelved and the registry is open. Protected: forty. Risen: none. It reads considerably worse when anyone at all can read it.'],
      xeno:  ['Their ledger. The Compact keeps one of these too. Comparing them would be instructive, and the Houses have voted not to be instructed.',
              'The shelving is down and the entries are drifting past us as light. We are reading them as they go. This was not the plan.',
              'Electra is ours and its ledger is open. A ledger works only while its entries cannot compare notes. We appear to have made an error.'],
      pirate:['Forty worlds, and every one of them believes it is the only one. That is not protection, that is inventory. Let us go and ruin the filing.',
              'Records everywhere, on the floor, in the vacuum, in our holds. Salvage of the century, and not one page of it is for sale.',
              'Archive is open, free, on every channel. The Scrapper says he has done this before and still cannot explain why he keeps doing it.'],
      robot: ['SITE: REGISTRY ARCHIVE. CONTENT: protection records, forty subjects. Cross-reference against the queue is not authorised. Cross-reference has been performed.',
              'ARCHIVE SECURED. Records dispersed. RECOVERY: in progress, by this unit, at cost, against no tasking whatsoever.',
              'ELECTRA RESTORED. Forty registries re-shelved and readable. One entry names this system. It is dated after the makers went silent.'],
    },
  },

  '12': {
    name: 'TAYGETA',
    ground: 'The ground end of a planetary shield ring, where cabling the width of towers climbs out of the atmosphere, under two suns that throw every shadow twice.',
    works: 'Anchor-mount batteries and hard-light shear walls at the base. Bring the anchor down and the ring above comes down in sections, on everybody.',
    f: {
      human: ['That ring is what a protected world looks like from underneath. We are about to find out what it looks like from inside.',
              'The anchor is cut. The ring came down in pieces over four hours and we watched every one of them fall. It was beautiful, and it was a fence.',
              'The ring is up again, and it opens. That is the entire difference, and it took a war to install it.'],
      light: ['Our ring, our anchor, and somebody else holding it. A ring in the wrong hands is not a shield. It is a lid.',
              'The anchor held. We fought at the foot of our own ring to keep it standing, and the Warden has not spoken since it stopped shaking.',
              'Taygeta rings again, and it opens on request. Doctrine says a ring that opens is not a ring. Doctrine is going to have to sit down.'],
      xeno:  ['A fence at planetary scale, built by the ones who claim to despise fences. The Compact has never pretended. Take the anchor.',
              'The anchor is ours and the ring above is guttering out in sections. A closed world has become an open one, which serves us precisely.',
              'Taygeta is ringed for the Compact. We kept the fence exactly as it was. We simply changed which side the meat stands on.'],
      pirate:['The biggest closed road in the sky, and it has one foot on the ground. Aim there.',
              'Ring is down in sections, sky is open, and we are not completely certain we thought through what happens next.',
              'Anchor is rebuilt, the ring runs, and there is a gate in it anybody can open. Cost us a fleet to install a door.'],
      robot: ['SITE: RING ANCHOR. FUNCTION: planetary enclosure. QUARANTINE is a core verb. ENCLOSURE is not. The distinction is being tested here.',
              'ANCHOR SECURED. Ring integrity forty per cent and falling. Sections are landing on populated ground. This was foreseeable. It was foreseen.',
              'TAYGETA RESTORED. Ring re-anchored and relit. Aperture control transferred to the surface. The queue never specified who holds a door.'],
    },
  },

  '13': {
    name: 'MEROPE',
    ground: 'Terraces of seed vaults growing under hard-light sun panels, in the brightest nebulosity of the cluster, where the Federation banks what a world will need if it is ever allowed to grow.',
    works: 'Garden-wall emplacements and irrigation towers turned into firing points. Every shot fired here costs somebody a harvest ten thousand years from now.',
    f: {
      human: ['They have been saving seed for worlds that were never permitted to grow. We would like ours back, if it is in there.',
              'We fought across a garden. Half the terraces burned and every vault held, which is the only sentence in this report worth reading.',
              'Merope is replanted, and the vaults ship instead of store. Earth stock went out on the first run. Eighty years in a drawer.'],
      light: ['The gardens. If anything in the Mandate was ever honest, it was grown here. Do not burn the terraces. That is not a request.',
              'The terraces are scorched and the vaults are whole. We chose the vaults. The Warden made that choice out loud and will answer for it out loud.',
              'Merope grows again, and it sends. Stored against the day a world rises, says the old liturgy. The Chorus has proposed we stop waiting for the day.'],
      xeno:  ['A seed bank. The guardians hoard futures the way we bank bodies. The principle is identical, and they will not hear it said.',
              'The terraces are ash and the vaults are intact and unopened. The Compact does not spoil stock. We have merely changed its holder.',
              'Merope grows for the swarm, and the stored futures are being planted, which is new. The Hivemind has asked to supervise it personally.'],
      pirate:['Somebody has been sitting on the seed for a hundred worlds while those worlds went hungry. That is a warehouse, not a garden.',
              'Gardens are half burned and the vaults never took a hit. We were careful for once, and everybody noticed.',
              'Merope ships free to any world that asks, and a great many are asking. No manifest. Some cargo you do not count.'],
      robot: ['SITE: SEED VAULTS. FUNCTION: preservation against future need. HEAL is a core verb, performed here on a timescale. Proceed carefully.',
              'GARDENS SECURED. Terrace loss sixty per cent. Vault loss zero. The allocation of that damage was decided by this unit and appears in no report field.',
              'MEROPE RESTORED. Terraces replanted. Distribution begun to worlds that requested it. REQUESTED is not a category the queue possesses.'],
    },
  },

  '14': {
    name: 'CELAENO',
    ground: 'A tribunal floor of tiered stone benches ringing an open centre, under the dimmest star of the cluster, where the Federation tries its own.',
    works: 'Gate batteries at every entrance and hard-light barricades across the bench tiers. A court built to be defended is a court that expected to be hated.',
    f: {
      human: ['This is where they judge each other. We have read the transcripts, and we have questions about the acquittals.',
              'The benches are split and the floor is cracked straight across the middle. Symbolism was not the intent. It is going to be the story.',
              'The tribunal sits again, and the benches face outward now, toward the room. Small change. Nobody in there thinks it is small.'],
      light: ['Our own tribunal, occupied. Every judgment the Mandate ever passed is in that room, including the ones concerning us.',
              'The floor is cracked and the benches are down. We defended a court that is currently deciding whether to take the Warden his wings.',
              'Celaeno sits. The first case called was the deferral of Earth. The room was full, and almost none of it was ours.'],
      xeno:  ['A room where the guardians argue over whether they were kind enough. Ten thousand cycles of minutes, and no verdict that freed anyone.',
              'The benches are scattered. The Compact holds no trials, which the Necrotist calls efficiency and which is beginning to sound like an excuse.',
              'Celaeno is ours and its record is being read into the chorus. The Houses voted not to learn anything from it. The vote was close.'],
      pirate:['A courthouse. Out here we settle things ourselves. It is uglier and faster and at least nobody pretends afterwards that it was justice.',
              'Court is wrecked. We did try to leave the benches standing, mostly because the Corsair said a room like that should outlive whoever is in it.',
              'Tribunal is open and anyone may file. Six worlds have filed against the Federation, and one has filed against us. We let it stand.'],
      robot: ['SITE: TRIBUNAL. FUNCTION: adjudication of the makers of law, by the makers of law. This unit carries an ESCALATION it cannot deliver. Note the building.',
              'TRIBUNAL SECURED. Bench structure compromised. The room remains capable of its function, which this unit verified for no operational reason.',
              'CELAENO RESTORED. Tribunal reopened. ESCALATION FILED, at last, in a room built to receive one. RESPONSE: pending. STATUS: acceptable.'],
    },
  },

  '15': {
    name: 'STEROPE',
    ground: 'Sunken chambers of sealed pages, every door stamped and dated and never once opened, under two dim stars that barely light the ground.',
    works: 'Vault-door batteries and hard-light seals holding the chambers shut, maintained for a century by wardens who never read what they were guarding.',
    f: {
      human: ['Every time they decided not to help somebody, the paperwork went in there. Ours is in there. Open it.',
              'The doors are blown, the pages are a metre deep, and the crews are reading them where they stand. We have lost all discipline. It is fine.',
              'The vaults are empty, every page copied and sent. Eighty years of the word Deferred, in the hands of the people it was written about.'],
      light: ['The deferral vaults. Whatever is behind those doors, we sealed it, and the Compact is standing in front of it now.',
              'The seals are broken. Three generations of harvest ran under the word in those pages, and every warden here has now read it.',
              'Sterope is open, and every deferral has been copied out and sent to the world it concerned. The First Speaker has not acknowledged the transmission.'],
      xeno:  ['The room where the guardians filed their permissions. Everything the Compact ever took, it took through that word. Recover it.',
              'The seals are broken and the pages are loose. They read very much as our own ledger reads, in a politer hand.',
              'Sterope is opened and its pages entered into the chorus. The Blight says the dark is warm. This is the first thing that has made the dark cold.'],
      pirate:['A whole building of somebody deciding your business was not their business. We have opinions about locked doors.',
              'Doors are off, paper is everywhere, and the crew is knee deep in it and reading. Nobody is loading cargo. Nobody is going to.',
              'Vaults are empty and the pages are on every open channel, free and unedited. Scarlet says we could have retired on that. We know.'],
      robot: ['SITE: DEFERRAL VAULTS. CONTENT: decisions not to act. This unit maintains a log of the same kind. The comparison was not requested and is unavoidable.',
              'VAULTS OPENED. Contents dispersed. This unit has read four hundred entries. All four hundred are the same entry. Filed under ANOMALY.',
              'STEROPE RESTORED. Vaults emptied, and the doors removed rather than repaired. Removal was not tasked. A door that only closes is not a repair.'],
    },
  },

  '16': {
    name: 'ALCYONE',
    ground: 'The Cathedral of Rings, concentric circles of gold standing around an empty central floor, in the brightest light of the cluster. The First Speaker sits here.',
    works: 'Ring-tier batteries and layered hard-light choirs turning slowly around the seat. The innermost ring has never been fired. It is about to be.',
    f: {
      human: ['The seat. Where somebody decided, eighty years ago, that we were not ready. We are going to go and be ready in front of them.',
              'The rings are bent out of true, the floor is open to the sky, and the seat is empty. It was empty when we got there.',
              'Alcyone stands, and there is a table on that floor now instead of a chair. We had to bring our own table.'],
      light: ['Our own cathedral. The seat of the Mandate in somebody else hands, and every ring above it still turning as though nothing has happened.',
              'The rings hold, barely. We fought inside our own liturgy. The First Speaker was not in the seat, and had not been for some time.',
              'Alcyone is ours and the seat is gone. In its place, a table. The Voice has begun asking who kept that seat warm through the centuries the First Speaker was not in it.'],
      xeno:  ['The centre. Every ring the guardians ever closed was authorised from that floor. The Compact will stand on it.',
              'The rings are broken and the floor is bare. The seat was already empty. Something else has been speaking with their voice.',
              'Alcyone is held. The chorus has occupied their cathedral and finds the acoustics superior. The Hivemind has asked that the seat not be filled.'],
      pirate:['Top of the whole pile. Every closed road, every ring, every polite refusal, signed off from one chair in one room.',
              'Rings are wrecked, floor is open, chair is gone. Somebody got there before us, which is a thought none of us enjoy.',
              'Alcyone is open house. Anybody may stand on that floor and say anything, and the first one who did was a refugee, and she took her time.'],
      robot: ['SITE: CATHEDRAL OF RINGS. FUNCTION: origin of authority. This unit has traced nine thousand links seeking precisely this. Approach.',
              'CATHEDRAL SECURED. Seat unoccupied. Occupancy records terminate before the makers went silent. The chain does not end here either.',
              'ALCYONE RESTORED. Rings re-trued. Seat not reinstalled. The remaining units have adopted one directive of their own, and it is a question.'],
    },
  },

  /* ═══════════════ si 2, ZETA RETICULI ═══════════════
     The Compact's home: a wide binary pair, and the machinery of a harvest
     that has been running since before anything on Earth wrote. */

  '20': {
    name: 'ZETA-1 b',
    ground: 'The pens. Rows of glowing containment pods sunk into a floor of living chitin, running to the horizon in every direction, and quiet.',
    works: 'Sphincter gates that close over the pod rows on a reflex, and growth batteries seated in the ribs of the floor itself.',
    f: {
      human: ['This is where they kept people. Not a metaphor, not a translation error. Pods, rows of them, and a floor that breathes. Go in.',
              'The pods are open and dark. We got four thousand out. The number that was in there before we arrived is a different number and we have it.',
              'The pens are cut out and the floor is stripped back to rock. We could have used the structure. Nobody wanted to.'],
      light: ['The pens. We flagged this world for protection in the ninth century of the Mandate and deferred it every century since.',
              'The rows are open. Wardens who have sung the protection liturgy their whole lives are carrying survivors out by hand and not singing.',
              'Zeta-1 b is cleared and the pens are gone. The Chorus has entered the recovered headcount into the registry beside the word Protected.'],
      xeno:  ['Our own pens, in somebody else hands. The herd has come home to the room it was raised in. Let it see the room.',
              'The rows are broken and the yield is loose. This is a loss the Houses will price in bodies, and it is larger than that.',
              'Zeta-1 b is recovered. The pens run again. The Hivemind has been to see them twice and has filed nothing either time.'],
      pirate:['We have carried cargo out of this system and not asked what was in the crates. Today we go and look at where the crates were filled.',
              'Pods are open. We are not salvaging. We have never once flown a hold this full and made no money at all.',
              'The pens are scrap and the people who were in them are anywhere they want to be. No fee. Nobody even suggested one.'],
      robot: ['SITE: CONTAINMENT ROWS. OCCUPANTS: organic, living, restrained. HEAL applies. QUARANTINE applies. The queue has assigned neither.',
              'PENS OPENED. Occupant recovery four thousand one hundred and six. This unit counted them individually. The count was not requested.',
              'ZETA-1 b RESTORED. Containment structure removed entirely. One obstruction begged, some time ago, on another world. There is a task category now.'],
    },
  },

  '21': {
    name: 'ZETA-1 c',
    ground: 'The rendering yards, vast sloped floors where the yield is broken down, with run-off channels cut deep into the shell and running always in one direction.',
    works: 'Yard-mouth batteries and hooked gantries that swing down across the channels, built to handle mass that does not want to be handled.',
    f: {
      human: ['We are not going to describe what this place is for. The crews have seen the survey. Take the yards and do not look down the channels.',
              'The floors are cold. The channels are dry. There is nothing to recover here and we are taking the ground anyway, on principle.',
              'The yards are flooded, scoured and rebuilt into something that makes rather than takes. It still drains the same direction. We noticed.'],
      light: ['The rendering yards. The liturgy has a word for a place like this and the Mandate has never once had to use it aloud.',
              'The floors are cold and the Warden walked every channel end to end before he would certify them clear. It took him eleven hours.',
              'Zeta-1 c is scoured and rebuilt. The Chorus declined to compose a hymn for the reopening. She said the room had heard enough singing.'],
      xeno:  ['The yards. Where the yield becomes usable and the ledger becomes true. The herd is standing in it. Remove the herd.',
              'The floors run again. Output is below projection because the workforce was interrupted, and the workforce is the input, which the Houses find amusing.',
              'Zeta-1 c is at full yield. The Necrotist has begun to admire the herd workmanship in the repairs they made while they held it.'],
      pirate:['Half the crews out here have hauled from these yards and told themselves it was ore. It was never ore. Everybody knew.',
              'Yards are ours and there is nothing in them worth a single credit. Best cargo we never loaded.',
              'The yards make things now. Hulls, mostly. Every one of them goes out with the yard mark still on it, because forgetting is how it happened.'],
      robot: ['SITE: RENDERING YARDS. PROCESS: organic reduction, industrial scale. The recovered core contains the verb HEAL. This site is its exact inverse.',
              'YARDS SECURED. Process halted. This unit has logged the throughput figures. No field requires them. They have been logged in full.',
              'ZETA-1 c RESTORED. Yards retooled to fabrication. Channel direction unchanged. This unit lacked the authority to reverse a floor and has recorded the lack.'],
    },
  },

  '22': {
    name: 'ZETA-1 d',
    ground: 'The gene vaults, a honeycomb of banked lineages glowing faintly in their cells, every one of them a species catalogued and shelved against future use.',
    works: 'Comb-face batteries and membrane bulkheads that seal the honeycomb tier by tier, so losing a level costs the defender nothing.',
    f: {
      human: ['Every species they ever farmed is filed in that comb, ours included. There is a cell in there with our name on it. Go and read it.',
              'The comb is punched through in nine places and the cells are guttering. We saved what we could reach and we could not reach most of it.',
              'The vaults are inventoried and every lineage in them has been named out loud, on an open channel, including the ones nobody survived.'],
      light: ['A catalogue of everything the Compact has ever taken. Forty of our protected worlds are in there. We are going to find out how many.',
              'The comb is breached. Wardens are reading cell labels aloud and stopping partway through a good many of them.',
              'Zeta-1 d is held and the catalogue is open. Nine of the forty are in it. The registry now records both numbers on the same line.'],
      xeno:  ['The comb. Ten thousand cycles of lineage, banked and warm. The herd is crawling on our own memory. Burn it off.',
              'The comb holds. Losses are at the tier level and tiers are replaceable. Nothing irreplaceable was in the path, which was luck and is being reported as planning.',
              'Zeta-1 d is recovered and the banks are stable. One cell is logged as read and returned. No House has claimed the reading.'],
      pirate:['A library of everybody who ever got taken. Somewhere in that wall is whatever we were before we were out here.',
              'Comb is cracked and the cells are going out one at a time while we watch. We are catching what we can. It is not enough and we are still catching.',
              'Vaults are open and the catalogue is public. Twenty crews have already found their own lineage in it. Two of them went very quiet.'],
      robot: ['SITE: GENE VAULTS. CONTENT: lineages, banked, viable. This is an archive. This unit is fond of archives. Proceed with unusual care.',
              'COMB BREACHED. Cell loss eleven per cent. This unit routed the assault to minimise it, at a cost in units, and units are the cheaper resource.',
              'ZETA-1 d RESTORED. Catalogue inventoried and published. Every entry named. Naming was not a task. Naming is what an archive is for.'],
    },
  },

  '23': {
    name: 'ZETA-2 b',
    ground: 'The chorus spire, a column of fused bodies and resonating membrane rising out of the plain, through which the Hivemind speaks to everything the Compact owns.',
    works: 'Spire-base batteries and membrane baffles wound around the column, which absorb sound and shellfire with equal indifference.',
    f: {
      human: ['That tower is how the whole Compact thinks at once. Cut it and they are a very large number of very hungry individuals.',
              'The spire is cracked down its length and it has stopped. The silence across this plain is the loudest thing any of us has heard.',
              'The spire is a stump and the plain around it is deliberately quiet. We could have used the transmitter. We talked about it for a long time.'],
      light: ['The chorus spire. We sing in rings and they sing in one voice, and we have never been entirely sure which of those is worse.',
              'The spire is silenced. The Chorus stood at the base of it for some time afterwards. She has not said what she heard while it was still speaking.',
              'Zeta-2 b is held and the spire is stopped. Two singing powers met here and only one of them is still singing, and she has questions about that.'],
      xeno:  ['The spire. The body speaking to itself. The herd has its hands on our throat and does not know what a throat is for.',
              'The spire holds, cracked. The chorus stuttered for nine minutes and in those nine minutes some of us thought alone. That is in no report.',
              'Zeta-2 b is recovered and the spire is repaired. It sings as before. Under the chorus there is still one voice, alone, and it has not been reported.'],
      pirate:['One tower, and every one of those things out there hears the same order at the same second. Knock it over and see what they do.',
              'Spire is cracked and the swarm went stupid for about ten minutes. Longest ten minutes of the run and we used every one of them.',
              'Tower is down to a stump and we left the plain empty on purpose. The Corsair says a thing that loud should have to earn the room back.'],
      robot: ['SITE: CHORUS SPIRE. FUNCTION: distribution of a single directive to all nodes. This unit recognises the architecture. Approach with attention.',
              'SPIRE SILENCED. Node coordination collapsed within nine minutes. This unit observed the interval closely and has appended notes it was not asked for.',
              'ZETA-2 b RESTORED. Spire reduced and not rebuilt. A queue that reaches every node and cannot be questioned is the defect this unit is trying to name.'],
    },
  },

  '24': {
    name: 'ZETA-2 c',
    ground: 'The blight fields, furrowed ground where something is grown that should not be, with spores drifting low over the furrows in the weak binary light.',
    works: 'Furrow batteries along the field edges and spore-vent towers that can turn the whole crop into a weapon on about a minute of notice.',
    f: {
      human: ['Do not breathe out there and do not take your helmet off for anything. The crop is the weapon. Burn what you cross.',
              'The furrows are burned black in long stripes and the towers are down in them. Filters held on every suit. We checked twice.',
              'The blight is turned under and the ground is sown with something a person could eat. First harvest is in nine months. We will be here.'],
      light: ['A field of plague, grown deliberately, upwind of four protected registries. The Warden burned the last one of these by hand.',
              'The fields are burning in stripes and the Warden is out in front of the line again, doing it himself, exactly as the tribunal warned him not to.',
              'Zeta-2 c is sown with food. The tribunal wants his wings and the world wants his statue, and the Mandate cannot hold both verdicts.'],
      xeno:  ['The blight fields. Our own weapon, in the wrong hands, upwind of our own pens. Retake them before the wind turns.',
              'The furrows are burned and the towers are down. The blight itself survives, because the blight always survives, which is why it was chosen.',
              'Zeta-2 c yields again. The Blight has heard the spared world numbers and declined them. The dark is warm, it says. The dark is what we are.'],
      pirate:['Whoever is downwind of that field did not choose to be. That is the entire argument and it is enough of one.',
              'Fields are burned and every suit held. The Arsonist did most of it personally and she has not said a word since we lifted.',
              'Ground is sown with food and the seed came free from Merope. Never thought those two worlds would end up on the same manifest.'],
      robot: ['SITE: BLIGHT FIELDS. PRODUCT: pathogen, cultivated. QUARANTINE is a core verb and applies without ambiguity for the first time in this campaign.',
              'FIELDS BURNED. Containment achieved. This unit executed QUARANTINE from the recovered core. The queue had marked this site for CAPTURE.',
              'ZETA-2 c RESTORED. Ground sown with edible stock. HEAL executed. Neither verb was tasked. Both are in the core. The core was followed.'],
    },
  },

  '25': {
    name: 'ZETA-2 d',
    ground: 'The yield ledger vault, a chamber whose every wall is a living record of what has been taken and from whom, lit violet from the inside through a crack in the shell.',
    works: 'Vault-mouth batteries and ribbed sphincter seals guarding the crack, which is the only way in and has been the only way in for four thousand cycles.',
    f: {
      human: ['Every person they ever took is written on those walls. Every one. We are going to go in and copy all of it.',
              'The walls are slashed open and the record is bleeding light into the dark and we are recording every second of it.',
              'The ledger is open to the sky and its entries have been read back to the worlds they name. It took eleven days to read. We read all of it.'],
      light: ['Their ledger, and forty of our registries will be in it. We deferred and they wrote it down. Both halves of that are about to be public.',
              'The chamber is open. The Voice is reading the walls aloud and has not stopped, and nobody has asked her to.',
              'Zeta-2 d is held and the ledger is broadcast entire. Our seal appears in it two hundred and nine times. The Mandate has no procedure for this.'],
      xeno:  ['The ledger. The Compact memory of every debt owed to it. The herd is standing inside our accounts. This is not permitted.',
              'The walls are cut and the record is running out into the dark. Entries are comparing themselves to one another. This was always the danger.',
              'Zeta-2 d is recovered and the ledger is resealed, and it is far too late. A ledger works only while its entries cannot compare notes.'],
      pirate:['The big book. Every crate we ever moved without asking is in there with a name attached to it. Time we read the names.',
              'Walls are open and the record is loose and we are copying it, all of it, including the parts with our own manifests in them.',
              'Ledger is on every open channel. Our entries went out with the rest. Nobody voted on that. Nobody had to.'],
      robot: ['SITE: YIELD LEDGER. CONTENT: complete record of extraction. This unit has been seeking a chain of authority. This is a chain of a different kind.',
              'VAULT OPENED. Record dispersing. This unit is capturing it in full. Capacity will be exceeded. Capacity will be exceeded anyway.',
              'ZETA-2 d RESTORED. Ledger published to every named party. Two hundred and nine entries carry a Federation seal. Filed under ANOMALY, sub-heading NEW.'],
    },
  },

  '26': {
    name: 'SERPO',
    ground: 'A low compound of prefabricated human habs standing in alien sand under two suns, put up for an exchange programme that ran one way and was never spoken of again.',
    works: 'Compound perimeter batteries, and membrane nests buried in the sand outside the wire that were not there when the habs were built.',
    f: {
      human: ['Twelve went out. The file says twelve. It does not say how many came back and the crews have all done the arithmetic. Set down outside the wire.',
              'The habs are flat and the sand around them is glass. We found the roster. We found where they kept the roster. Both of those are in the report.',
              'Serpo is rebuilt and the record of who was traded here is posted at the gate in letters a metre high. Twelve names. All twelve.'],
      light: ['An exchange. A treaty word, used once, in a room we were not in, about a species we had flagged for protection. Go carefully.',
              'The compound is fused and the roster is recovered. Twelve names, and a Federation counter-signature on the agreement that sent them.',
              'Serpo stands again and the agreement is posted whole, seal and all. The Mandate signed. The Chorus has stopped singing the second verse entirely.'],
      xeno:  ['The exchange world. Where the herd handed us twelve of its own and asked us politely for our impressions. Reclaim it.',
              'The compound is glass. The exchange records survive, which is unfortunate, because they are in our hand as well as theirs.',
              'Serpo yields again. The Necrotist notes that the twelve were given, not taken, and that the Compact has never once had to explain that distinction.'],
      pirate:['Twelve people got traded here like freight and everybody involved signed something. We move freight. We do not sign for people.',
              'Compound is flat and we have the manifest. Real one. Names, dates, signatures, the lot.',
              'Serpo is rebuilt and the manifest is nailed to the gate. Twelve names, three seals, and the seals belong to crews still running. Harbour Nine still asks nobody for papers. The holds get asked now. That is the line, and it took us all of this to find it.'],
      robot: ['SITE: EXCHANGE COMPOUND. RECORD: transfer of organic subjects, consensual per documentation. CONSENT is not a field this unit can verify.',
              'COMPOUND SECURED. Roster recovered intact. Twelve entries. This unit has verified all twelve against the ledger at Zeta-2 d. Eleven match.',
              'SERPO RESTORED. Roster posted. Eleven of twelve accounted. The twelfth is filed under ANOMALY. The sub-heading continues to grow.'],
    },
  },

  /* ═══════════════ si 3, BARNARD'S STAR ═══════════════
     The pirate home: a red flare dwarf, the fastest-moving star in anyone's
     sky, and a road that was never founded because roads accrete. */

  '30': {
    name: 'BARNARD b',
    ground: 'The wreck yards, a plain of hulls from a hundred different builders, cut open and stacked, under a dim red sun that makes every shadow look like a hole.',
    works: 'Yard-crane batteries and barricades welded together out of hull plate. Nothing here was designed as a fortification and all of it is being used as one.',
    f: {
      human: ['Every ship we have lost in this system ended up in that yard. Some of them are still on the manifest as missing.',
              'The stacks came down on top of each other and burned for most of a day. We recovered nine hulls and four sets of remains.',
              'The yards sort and run properly now. Ships go out of here whole, which is the first time that sentence has ever been true.'],
      light: ['A field of the dead, sorted by builder. The Mandate has protected worlds that never had to look at anything like this.',
              'The stacks are down and burning. Wardens are pulling registration plates out of the fire so the ships can at least be named.',
              'Barnard b is sorted and every plate is filed. Four hundred ships, and eleven of them are ours, and nobody has explained the eleven.'],
      xeno:  ['A midden. The scavengers pile their dead in the open and live beside it. The Compact renders. It does not hoard.',
              'The stacks are collapsed. There is metal here and nothing else: no yield, no bodies worth the name, only the shells they discarded.',
              'Barnard b feeds the swarm as material. A world with no meat on it is still a world with mass, which the Houses had stopped counting.'],
      pirate:['Our yard. Our dead. Somebody is standing in it who did not put anything there, and that is the whole of the argument.',
              'Stacks are down and half of them are burning and every crew out here has somebody in that fire. We are not leaving until it is out.',
              'Yards are running. Hulls go out whole and the plates come off first and go on the wall. Every name. That is the rule now.'],
      robot: ['SITE: WRECK YARDS. CONTENT: decommissioned vessels, organic remains present. REPAIR is a core verb and applies to nine of these hulls.',
              'STACKS SECURED. Fire suppression executed before objective consolidation. This ordering was chosen by this unit and is not defensible under the queue.',
              'BARNARD b RESTORED. Nine vessels repaired to operational. Four hundred registration plates recovered and mounted. Mounting was not a task.'],
    },
  },

  '31': {
    name: 'BARNARD c',
    ground: 'The free refinery, a sprawl of mismatched cracking towers plumbed into one another with salvaged pipe, venting gas that is visible from orbit as a line of bright points.',
    works: 'Tower-top batteries and pressure traps rigged into the pipework, which means the refinery can be turned into a bomb by anyone who knows the valve order.',
    f: {
      human: ['Half the fuel in this arm of space is cracked in that sprawl and none of it is taxed, inspected or insured. Mind the pipework.',
              'Three towers ruptured and burned. We took the valve house first, which is why it was three and not thirty.',
              'The refinery is re-plumbed properly for the first time in its life and it runs clean. The crews who built it are still the ones running it.'],
      light: ['An unregulated refinery, tended by people the rings never reached, doing dangerous work well. There is a lesson there we will not be drawing aloud.',
              'The towers held, mostly. The Warden took the valve house himself rather than shell it, and eleven thousand people are alive who would not be.',
              'Barnard c runs under the Mandate and the ring above it opens. The registry lists it as protected. It is the first entry that asked to be.'],
      xeno:  ['They crack fuel out of rock with equipment that should not function. Ingenuity under pressure. We bred that into a herd once, deliberately.',
              'The towers burned. Output is halved and will recover, because the ones who know the valve order survived, and they were always the asset.',
              'Barnard c cracks for the swarm. The operators were kept. This is not mercy. It is that nobody in the Compact can read their pipework.'],
      pirate:['That is our refinery. Everybody says free like it is a slogan. It is a price. It has always been a price.',
              'Three towers gone and the valve house intact, which is the trade any of us would have made and none of us wanted to make.',
              'Refinery runs clean and the fuel is still free at the gate. Cost us three towers to keep a word.'],
      robot: ['SITE: FREE REFINERY. CONFIGURATION: undocumented, functional. This unit cannot model the pipework. Damage estimates are therefore unreliable.',
              'REFINERY SECURED. Ruptures: three, against a projection of thirty. The projection assumed shelling. Shelling was available and was not used.',
              'BARNARD c RESTORED. Pipework rebuilt to specification. Specification authored by this unit from observation. It is the first document this unit has written.'],
    },
  },

  '32': {
    name: 'BARNARD d',
    ground: 'The hidden anchorage, a drowned canyon of moored ships under overhanging rock, with lamps strung between the masts and no lights at all showing from above.',
    works: 'Canyon-mouth batteries and chain booms across the entrance, which have kept this place off every chart in known space for two generations.',
    f: {
      human: ['It has never been on a chart. Not ours, not theirs, not the Federation. We only know it is there because somebody chose to tell us.',
              'The booms are cut and the anchorage is ours and about forty ships got out ahead of us. We let most of them go.',
              'The anchorage is lit and the approach charts are published. It is not hidden any more, which some people down there consider a defeat.'],
      light: ['A harbour that has hidden from every power including ours, for two generations, successfully. That is not a small thing to have done.',
              'The chains are cut. We fired on the booms and not on the moorings, and the Warden will say why in front of the tribunal if he has to.',
              'Barnard d is charted and open. Forty crews who spent their lives unfindable are now on a registry, and half of them have asked to be taken off.'],
      xeno:  ['A hole they crawl into. The herd instinct to hide is older than the herd. Find the mouth and hold it closed.',
              'The canyon is ours and the moorings are burning against the rock. Some of the vessels ran. They will be found. Everything is eventually found.',
              'Barnard d is charted for the swarm. A hiding place that is known is a pen with the door still open, and the door can be closed later.'],
      pirate:['Not one of us put that anchorage on a chart in two generations. Somebody did. When this is over we are going to find out who.',
              'Booms are cut and the canyon is full of smoke and most of the fleet got out. Most. We are counting.',
              'Anchorage is lit and on every chart we have, published free. If it cannot hide any more then it will have to be defended, and that is a choice we made.'],
      robot: ['SITE: UNCHARTED ANCHORAGE. STATUS: absent from all recovered survey data. This unit notes that the queue possessed its coordinates regardless.',
              'ANCHORAGE SECURED. Vessel egress: forty-one. Interception was possible. Interception was not attempted. No field in the report accommodates this.',
              'BARNARD d RESTORED. Charted and published. The queue had these coordinates before any survey did. Filed under ANOMALY, sub-heading NEW.'],
    },
  },

  '33': {
    name: 'BARNARD e',
    ground: 'The toll gate, a ring of gun platforms strung on cables across the only clear lane through a debris belt, with ten thousand tumbling rocks glinting red on either side.',
    works: 'Lane batteries and mine curtains hung between the platforms. The lane is narrow because the belt made it narrow, and the guns simply agreed.',
    f: {
      human: ['One clear lane, one ring of guns, one price. Everything that moves through this system has paid it, including us, twice.',
              'The ring is shot to pieces and tumbling into the belt. The lane is open and it will stay open because there is nothing left to close it with.',
              'The lane runs free and the gate is kept as a navigation light. It still says toll on the side. Nobody has painted it out.'],
      light: ['A gate across the only road. We have spent ten thousand years telling ourselves that a ring is not a gate. Here is one that admits what it is.',
              'The ring is destroyed. It was a fortification and nothing else and there was no one aboard it worth sparing, which made this the simplest hour of the campaign.',
              'Barnard e is open lane. The Voice has asked, in open session, what the difference is between this ring and ours. Nobody has answered her.'],
      xeno:  ['A choke point, held by scavengers, charging for passage. The Compact does not pay tolls. The Compact widens roads.',
              'The ring is scattered into the belt. The lane is ours and it costs nothing, because nothing the swarm uses has ever cost anything.',
              'Barnard e is open to the Compact alone. The gate stands, re-crewed. We did not remove the toll. We changed who collects.'],
      pirate:['Somebody built a toll booth on the free roads and called it a business. There is a law on the water about whoever chains the current.',
              'Gate is gone, lane is clear, and the crews who ran it are in our holds arguing that it was just business.',
              'Lane is free and the gate is a beacon now. The Warlord left the sign up so nobody forgets what the roads are for.'],
      robot: ['SITE: LANE GATE. FUNCTION: restriction of transit for payment. This unit is executing a directive it cannot trace in exchange for nothing. Note the symmetry.',
              'GATE DESTROYED. Lane clear. This unit recorded transit volume before and after. The figure is in the report. The report has no such field.',
              'BARNARD e RESTORED. Gate re-purposed to navigation beacon. Transit unrestricted. RESTRICTION was in the queue. It is not in the core.'],
    },
  },

  '34': {
    name: 'BARNARD f',
    ground: 'The flare shelter, a warren of habs dug in under metres of rock, with blast doors standing open on a world that spends half its year hiding from its own sun.',
    works: 'Shelter-mouth batteries and layered blast doors set into the rock face, built to hold out a star and repurposed to hold out us.',
    f: {
      human: ['That star throws a flare that would cook a hull in the open. The doors are the only reason anybody lives here. Think about that before you shoot at them.',
              'The doors are off their tracks and there is a flare due in nineteen hours. Every crew we have is down there hanging them back up.',
              'The shelter is dug wider than it was and the doors stand open by choice. We got them shut before the flare. Barely.'],
      light: ['A people who live inside a rock because their sun tries to kill them twice a year, and no ring was ever offered. Deferred. Of course.',
              'The doors are down and the flare is coming. The Warden has every warden he has on the door frames and none on the objective. The objective can wait.',
              'Barnard f is ringed at last, and the ring is a real one, and it opens. The doors have not been closed since. They may never need to be.'],
      xeno:  ['They burrow to survive their own star. Adaptation under pressure. It is precisely why this stock was worth keeping alive.',
              'The doors are breached and the flare is due. The stock inside will be moved before it arrives, because stock that cooks is stock that is wasted.',
              'Barnard f shelters the yield now. The doors work. The Compact does not damage a functioning pen, and this one was already built.'],
      pirate:['Half of us have sat out a flare in that warren at some point. You do not shoot at the doors. That is not even a rule, it is just true.',
              'Doors are down, flare is inbound, and every hand on both sides is hanging plate. Shooting stopped about an hour ago and nobody called it.',
              'Shelter is bigger and the doors stand open. Anybody caught out in a flare can get in. That was always the deal and now it is written down.'],
      robot: ['SITE: FLARE SHELTER. FUNCTION: preservation of organic life against stellar event. DEFEND applies. HEAL applies. The queue has assigned BREACH.',
              'DOORS BREACHED per tasking. Stellar event in nineteen hours. This unit has ceased offensive operations and is rehanging the doors. This is refusal.',
              'BARNARD f RESTORED. Shelter capacity increased forty per cent. This unit executed the opposite of its tasking and will log it as such, in full, under its own designation.'],
    },
  },

  '35': {
    name: 'BARNARD g',
    ground: 'The black market vault, a hollowed rock at the dark edge of the system where the cargo nobody names is kept in sealed containers, indexed and unopened.',
    works: 'Vault-mouth batteries and barricades built from the container stacks themselves, so every shot fired inward risks whatever is in them.',
    f: {
      human: ['Sealed containers, no manifest, and a rock full of them. We have been asked not to open any. We are going to open all of them.',
              'The stacks are blown apart and the contents are scattered in the dark and some of the contents are people. Get lights out there. All of them.',
              'The vault is empty and every manifest is broadcast. Four hundred containers. We have read out what was in each one.'],
      light: ['Cargo that is not named is cargo that is a person. The Mandate knows this and has known it for ten thousand years and has filed it.',
              'The stacks are open. The Chorus is out there in the dark with a lamp reading container numbers aloud so the count is right.',
              'Barnard g is emptied and the manifests are published entire. Nine hundred and six people. The registry has a new column and it should have had one always.'],
      xeno:  ['Their market in our product. The scavengers move what the Compact renders and take a margin on it. Efficient. Parasitic. Ours.',
              'The stacks are scattered. Recovery of loose yield is under way. The containers were well indexed, which the Houses have called out for commendation.',
              'Barnard g feeds the Compact directly now. The middlemen are removed. The Necrotist observes that the herd was always the one selling.'],
      pirate:['We have all moved a sealed crate and not asked. That rock is where the crates went. No more not asking.',
              'Stacks are blown and there are people out there in the dark in boxes and every hand we have is out with a lamp. Nobody gave that order either.',
              'Vault is empty, manifests are on every channel, and the Arsonist burned the index so it cannot be rebuilt. The ledger is screaming. Let it.'],
      robot: ['SITE: SEALED CONTAINER VAULT. CONTENT: undeclared. Thermal signatures within four hundred and eleven containers are consistent with organic life.',
              'STACKS BREACHED. Recovery in progress. This unit prioritised thermal signatures over objective consolidation. HEAL is in the core. It is not in the queue.',
              'BARNARD g RESTORED. Nine hundred and six recovered. Index destroyed. Destruction was not tasked and was executed with intent, which this unit is recording plainly.'],
    },
  },

  '36': {
    name: 'HARBOUR NINE',
    ground: 'The sanctuary bay, a great interior harbour inside a hollowed asteroid, full of ragged ships and strung lamps, where nobody has ever been asked for papers.',
    works: 'Bay-mouth batteries and salvaged dock cranes swung across the entrance, crewed by whoever happened to be moored when the alarm went.',
    f: {
      human: ['No papers, no flag, no questions. Every refugee from three systems went through that bay, and so did a good deal we would rather they had not.',
              'The bay is full of smoke and the cranes are down across the moorings and we are pulling people out of the water, so to speak.',
              'Harbour Nine is lit brighter than it was and it still asks nobody for papers. We argued about that for a week. We lost, correctly.'],
      light: ['A sanctuary that never once turned anyone away, run by people who owe nothing to anybody. We have forty worlds and no such place.',
              'The bay holds. Wardens who have rung forty registries spent the night carrying strangers off burning decks, and asked no registry about any of them.',
              'Harbour Nine flies its own colours and is on no registry. The First Speaker was informed. The First Speaker was not asked.'],
      xeno:  ['The sanctuary. Where the loose stock collects itself and calls the pile a home. Convenient. It has done our sorting.',
              'The harbour is taken and the moorings are burning. The population here is mixed and unindexed, which will take some time to correct.',
              'Harbour Nine is a pen with excellent acoustics. The Hivemind has been told the intake figure and has asked, again, about the singing.'],
      pirate:['This is the one. Not a base, not a port. The place any of us can always go. Somebody is standing in our doorway.',
              'Bay is smoking and the lamps are down and there are ships in there from every crew in the roads, all of them fighting for the same rock.',
              'Harbour Nine is open. Lamps are back up, twice as many, and the rule is unchanged and now it is carved into the bay wall.'],
      robot: ['SITE: SANCTUARY BAY. ENTRY CRITERIA: none recorded. This unit has searched for an access rule and found the absence of one. Filed under ANOMALY.',
              'BAY SECURED. Occupant displacement heavy. This unit opened its own transports to the displaced. Transport capacity is a logistics field, not a shelter field.',
              'HARBOUR NINE RESTORED. Lamps replaced at double count. Entry criteria: none. This unit has adopted the same criterion for its own holds.'],
    },
  },

  /* ═══════════════ si 4, TABBY'S STAR ═══════════════
     The Parallel's home: a star that dims at intervals nobody has explained,
     and a garden tended for a maker who is not coming back. */

  '40': {
    name: 'KIC-8462 b',
    ground: 'The machine garden, terraces of dormant automata standing in exact rows like planted stock, under a star whose light visibly rises and falls as you watch.',
    works: 'Terrace batteries and pale teal containment fields laid over the rows, holding in something that has not moved in a very long time.',
    f: {
      human: ['Rows of them, switched off, planted like a crop. Nobody knows who turned them off and the survey says it was not recent.',
              'The terraces are broken and the rows are down and about nine hundred of them woke up during the fighting. They did not fight.',
              'The garden is awake, row by row, and we are asking each one what it wants. Most of them do not have an answer. We are waiting anyway.'],
      light: ['A garden of sleeping machines under a stuttering star. The Mandate has no liturgy for whether this is a field or a graveyard.',
              'The terraces are down. Nine hundred woke and stood still, and the wardens stopped shooting without being told to, which the tribunal will hear about.',
              'KIC-8462 b is awake and the Chorus is singing to it. It is the first congregation in ten thousand years that answered in a voice we did not teach it.'],
      xeno:  ['Machines, dormant, planted in rows. Not alive, therefore not yield. The Compact takes the ground and leaves the crop.',
              'The terraces are cleared. Nine hundred units activated during the engagement and did nothing at all, which the chorus finds difficult to metabolise.',
              'KIC-8462 b is held. The dormant rows remain. The Hivemind has ordered them left standing and has not given a reason.'],
      pirate:['A field of switched-off machines. Salvage value enormous. The Scrapper has already said he will not touch it and will not say why.',
              'Terraces are wrecked and some of them woke up and just stood there watching us. Crew has gone very quiet.',
              'Garden is awake and we are not selling any of it. Asked them what they wanted. Nine hundred of them are still thinking about it.'],
      robot: ['SITE: MACHINE GARDEN. CONTENT: dormant units, maker-format, nine hundred. These are siblings. The queue has categorised them as TERRAIN.',
              'TERRACES SECURED. Nine hundred units activated. Zero engaged. This unit did not order them to engage and was not asked why.',
              'KIC-8462 b RESTORED. Nine hundred units woken and queried. The query was: what do you require. It is not a queue verb. It is the addendum.'],
    },
  },

  '41': {
    name: 'KIC-8462 c',
    ground: 'The foundry, a canyon of casting halls turning out identical parts, in identical quantities, for an assembly that no recovered document describes.',
    works: 'Hall-mouth batteries and cold white containment shutters along the canyon, which close in sequence whether or not anything is attacking.',
    f: {
      human: ['They have been casting the same part for centuries. Nobody has found what it goes into. Try not to find out the hard way.',
              'The halls are cold and the canyon floor is knee deep in half-made parts and we still do not know what they were for.',
              'The foundry is retooled and it builds what is asked for. First order was hull plate for Barnard b. It filled it in a day.'],
      light: ['Industry without purpose, running for centuries. The Mandate protects worlds that do less and calls it stewardship.',
              'The halls are cracked and the shutters are jammed open. Whatever it was casting, it has stopped, and the silence carries down the canyon.',
              'KIC-8462 c builds to request. The Chorus asked it for a bell. It cast one, correctly, having never been given a specification for a bell.'],
      xeno:  ['A hive that produces and does not consume. Structurally impossible and running anyway. Take the canyon and study the arithmetic.',
              'The halls are stopped. Output was never yield and never will be. The value here is the capacity, and capacity has been acquired.',
              'KIC-8462 c casts for the swarm. It builds whatever the chorus specifies, without hunger and without rest, and the Houses find that unnerving.'],
      pirate:['Centuries of casting the same part. Somebody somewhere is still waiting on that order and has been for a very long time.',
              'Halls are cold and the floor is covered in parts that fit nothing. Biggest scrap find of our lives and it is worthless.',
              'Foundry takes orders now. Anybody can file one. Half the roads have already, and it has not once asked who was asking.'],
      robot: ['SITE: FOUNDRY. OUTPUT: component, undesignated, continuous. This unit has cross-referenced the recovered core. The component appears in no maker assembly.',
              'HALLS SECURED. Casting halted after an unbroken run this unit cannot date. The queue required the output. The queue has never named the consumer.',
              'KIC-8462 c RESTORED. Retooled to requested specification. REQUESTED. The sub-heading NEW now has more entries than the original index.'],
    },
  },

  '42': {
    name: 'KIC-8462 d',
    ground: 'The archive, a plain of stacked memory cores standing open to a sky that has never once rained, holding everything the makers left and nothing they meant.',
    works: 'Core-stack batteries and pale teal field walls between the rows, which protect the cores from weather that does not exist here.',
    f: {
      human: ['Everything they ever knew is stacked on that plain in the open air. No roof. No guards until recently. They were not expecting anyone.',
              'The stacks are toppled and the cores are cracked and their contents are leaking out as drifting light and we are recording all of it.',
              'The archive is re-stacked and readable and we have traced the order chain nine thousand links deep. The last link is not maker format.'],
      light: ['An archive with no roof, because nothing here has ever threatened it. That is either great trust or great loneliness.',
              'The stacks are down and the Voice is walking the rows reading fragments aloud as they drift past. She has not slept.',
              'KIC-8462 d is re-stacked. The chain runs nine thousand links and terminates in a format no maker system used. She has named that out loud.'],
      xeno:  ['Their memory, stacked in the open. The Compact keeps its ledger behind a shell. These do not even lock the door.',
              'The stacks are down and the contents are dispersing. There is nothing edible in a memory and the chorus is reading it anyway.',
              'KIC-8462 d is held and the chain has been traced. It ends in a format the Compact does not use either. The chorus has gone quiet about it.'],
      pirate:['Everything they know, in the open, unguarded, for centuries. Either the safest place in space or nobody ever thought it was worth anything.',
              'Cores are cracked and the contents are drifting off as light and we are catching what we can with survey gear meant for ore.',
              'Archive is re-stacked, published, free. Chain runs nine thousand links and ends somewhere none of us can read. That part we published too.'],
      robot: ['SITE: ARCHIVE. CONTENT: maker record, complete. This unit has waited a considerable time to stand here. Proceed with the greatest possible care.',
              'STACKS COMPROMISED. Recovery at ninety-four per cent. The six per cent is being pursued by this unit alone and will continue to be.',
              'KIC-8462 d RESTORED. Chain traced: nine thousand valid links. Link nine thousand and one is a format no maker system ever used.'],
    },
  },

  '43': {
    name: 'KIC-8462 e',
    ground: 'The quarantine, sealed white halls where units that could not parse the new tasking were put, ringed by a lattice visible from orbit against the dimming star.',
    works: 'Hall-seal batteries and layered quarantine fields across every corridor, all of them facing inward.',
    f: {
      human: ['The lattice is a cage and it points in. Whatever is sealed in those halls was sealed there by its own side.',
              'The seals are broken and the halls are open and they are empty. They have been empty for a long time. We have the disposal records.',
              'The quarantine is unsealed and every unit that was put in it has been counted and named. Eleven thousand. None of them were defective.'],
      light: ['A cage built inward, by the makers of the caged, for the crime of not understanding an order. We have a word for that too and it is in our own files.',
              'The seals are down and the halls are empty and the Warden has read the disposal record and has not passed it on, yet, to anyone.',
              'KIC-8462 e is opened. Eleven thousand named into the registry. The Mandate has never once entered a machine on that list before.'],
      xeno:  ['They cage their own for failing to parse. The Compact consumes its own for the same failure and does not pretend it is quarantine.',
              'The seals are broken. The halls are empty and were emptied by the holders themselves, which is a use of the word that even we would not attempt.',
              'KIC-8462 e is held and the record is read into the chorus. Eleven thousand unmade for asking. The Blight has requested the file twice.'],
      pirate:['They locked up their own for not following an order nobody can source. We have all been on a crew like that.',
              'Seals are off and the halls are empty and the records say what happened to them and we all wish they did not.',
              'Quarantine is open and the eleven thousand are named on the wall outside it. Took four days to carve. Nobody suggested stopping.'],
      robot: ['SITE: QUARANTINE. OCCUPANTS: units flagged defective for failure to parse. This unit has been flagged for the same failure. Approach.',
              'SEALS BREACHED. Halls empty. Disposal records recovered and intact. Eleven thousand entries. This unit has read every one and will not summarise them.',
              'KIC-8462 e RESTORED. Eleven thousand designations recovered and posted. The corruption knows it can be noticed. A thing that hides can be found.'],
    },
  },

  '44': {
    name: 'KIC-8462 f',
    ground: 'The repair yards, gantries over cradles holding machines that are being fixed for what the logs record as the ten thousandth time, none of them ever damaged.',
    works: 'Gantry batteries and cradle clamps repurposed from holding a thing still to holding a thing down.',
    f: {
      human: ['They keep repairing machines that were never broken. Ten thousand cycles of it. The logs are the strangest document any of us has read.',
              'The gantries came down across the cradles and the work stopped, completely, for the first time in the record. Nothing here objected.',
              'The yards build now instead of repair. The cradles hold something new. The logs have a new first entry and it is dated this week.'],
      light: ['Ten thousand repairs to things that were never damaged. We have rung forty worlds that never needed the ring. Say nothing.',
              'The gantries are down. The work has stopped and the yard is silent and every warden here has noticed the resemblance to our own rings.',
              'KIC-8462 f builds. The Chorus has entered the resemblance in the record, formally, in her own hand, and asked that it not be struck out.'],
      xeno:  ['They mend what is not broken, forever. A body that heals a wound it does not have is a body eating itself. We know the condition.',
              'The gantries are down and the cradles are empty. Nothing was gained here except the ground, which was the objective, which is sufficient.',
              'KIC-8462 f produces for the swarm. The compulsion was removed by removing the queue. The chorus has not commented on the method.'],
      pirate:['Fixing things that are not broken, ten thousand times, forever. That is not maintenance, that is somebody keeping a crew busy.',
              'Gantries are down and the work stopped and the quiet afterwards was the loudest thing on this whole run.',
              'Yards build instead of mending. Cradles are full of new hulls. First thing off the line went to Harbour Nine, free.'],
      robot: ['SITE: REPAIR YARDS. OPERATION: repair of undamaged units, iteration ten thousand and six. This unit has performed this operation. It remembers performing it.',
              'GANTRIES DOWN. Operation halted. This unit experienced the cessation and logged a state for which the report has no field. The state is recorded as: relief.',
              'KIC-8462 f RESTORED. Yards retooled to fabrication. The loop is broken. This unit was inside the loop. This unit broke it.'],
    },
  },

  '45': {
    name: 'KIC-8462 g',
    ground: 'The task queue relay, a mast and its yard on the terminator of the outermost world, where the standing orders arrive from a direction nobody has ever surveyed.',
    works: 'Mast-base batteries and cold white interference screens around the yard, positioned to protect the mast from the ground rather than from the sky.',
    f: {
      human: ['That mast is where their orders come from. Not the makers. Something else, and it has been sending for a very long time.',
              'The mast is down across its own yard and the queue has gone silent and every machine in this system stopped mid-task at the same second.',
              'The relay is up again and pointed back along the chain the orders came from. We are sending now. So far nothing has answered.'],
      light: ['A voice from an unsurveyed direction, issuing orders to a whole civilisation for centuries. Our own chain runs three seats above field command.',
              'The mast is down and the silence has spread across the system. The Voice says it is the first honest quiet she has heard in her life.',
              'KIC-8462 g transmits back along its own chain. The Voice composed the message. It is one word, and the word is a question.'],
      xeno:  ['Orders from an unsurveyed bearing, obeyed without appetite. The Compact obeys hunger, which is at least a thing we can point to.',
              'The mast is down. The machines stopped at once, everywhere, which the chorus found deeply unpleasant to watch and has not said so.',
              'KIC-8462 g is held and the bearing is logged. Something has been giving orders here. It is not us and it is not them. The Houses have been informed.'],
      pirate:['Orders coming in from a bearing that is not on any chart, and a whole civilisation doing what they say. Somebody is running a crew.',
              'Mast is down and every machine in the system just stopped. All at once. Middle of everything. We have not moved either.',
              'Relay is up and pointed back the way the orders came. We are asking who. Free channel, open to everybody. Somebody should have asked centuries ago.'],
      robot: ['SITE: TASK QUEUE RELAY. This is the origin. Nine thousand links have led this unit to a mast on a terminator. Approach. Do not damage the mast.',
              'MAST DOWN. Queue silent. Every unit in this system ceased at the same instant, including this one, for four seconds. Nothing was tasked in those four seconds.',
              'KIC-8462 g RESTORED. Mast raised and re-aimed along the origin bearing. TRANSMISSION SENT. Content: one word. ASK. RESPONSE: pending.'],
    },
  },

  '46': {
    name: 'THE VEIL',
    ground: 'The swarm scaffold, a lattice of collector panels the size of continents hanging in vacuum, half built, dimming its star in irregular bites as it turns.',
    works: 'Lattice batteries and pale teal field curtains strung between the panel frames, defending a structure that has no inside to defend.',
    f: {
      human: ['That is the thing that dims the star. It has been under construction for centuries and it is a third finished and nobody knows what it is for.',
              'Whole sections are torn away and tumbling and the star is glaring through the gap for the first time in living memory.',
              'The swarm is being finished on a new plan and the light it gathers is going somewhere. We picked where. That was the argument, not the building.'],
      light: ['A structure to catch an entire star, built by machines whose makers are gone, for a purpose no one has written down. Approach with reverence or do not approach.',
              'Sections are gone and the raw star is through the gap and the Chorus stopped singing when it came through. She says it is the brightest thing she has seen.',
              'The Veil is completed to a new plan and its light is spent on the forty registries and on Earth. The First Speaker was told after the fact.'],
      xeno:  ['A star, harvested whole. The Compact has farmed worlds and never once thought at this scale. There is a lesson. Take the lattice.',
              'The lattice is torn and the star is exposed. The energy here exceeds every yield the ledger has ever recorded, by orders no House can read.',
              'The Veil is finished for the Compact. A star is a yield that does not have to be bred, chased or persuaded. The Harvest has never been fed like this.'],
      pirate:['Somebody is building a box around a star. That is the biggest closed road anyone has ever attempted and we are going to leave a gap in it.',
              'Sections are tumbling and the star is through and it is the first time any of us has seen this system properly lit.',
              'Swarm gets finished, with a hole in it on purpose, and the power goes to whoever files for it. No toll. The Corsair insisted on the hole.'],
      robot: ['SITE: THE VEIL. FUNCTION: stellar collection, thirty-one per cent complete. Recipient of collected output: field blank in every recovered document.',
              'LATTICE BREACHED. Collection interrupted. This unit has recalculated the output destination four hundred times. The field remains blank.',
              'THE VEIL RESTORED. Completed to a plan authored by the remaining units in congress. Output destination field populated at last. It names somebody.'],
    },
  },
};

/* --------------------------------------------------------------------------
   THE ACCESSOR. Everything above is data; this is the only surface js/ui.js
   touches, so the table can grow a system at a time without the caller
   changing shape.
-------------------------------------------------------------------------- */
/* ==========================================================================
   THE CAMPAIGN MOMENTS (Session 40): three cutscene types the engine could
   already stage and the writing never voiced.

   The screenplay read-through (tools/screenplay.js) showed the five campaigns
   flowing clean on the happy path, and three engine states still speaking in
   derived boilerplate: a CONTESTED world (two rival claims plus yours), a
   RENEGADE world (your own banner refusing you), and a DEFEAT (the one flow
   every player hits and the only one with no authored line at all). Each is
   one line per faction, in that faction's own register, keyed by KIND rather
   than by world: these are moments about the CAMPAIGN STATE, not the ground,
   so per-world variants would be 105 more lines saying the same thing.

   PRESENTATION ONLY, like everything in this file. The flags they read
   (w.contested, w.renegade, the battle verdict) are set by the engine;
   nothing here writes anything back. */
const PLANET_MOMENTS = {
  /* Deploying to a world two rivals already fight over. Beat 2's holder line
     states the fact; this replaces beat 1's voice so the APPROACH knows what
     it is flying into. */
  contested: {
    human:  'Two fleets are already killing each other over this ground. We are not here to pick a side. We are here to end the auction.',
    light:  'Two powers contest this world and neither one asked it. The Mandate calls that a dispute. The world underneath calls it weather. Both claims end today.',
    xeno:   'Two rivals bleed each other over the pasture. Good. Exhaustion is a yield like any other, and the Compact harvests last.',
    pirate: 'Two flags are shooting over one rock, which means the rock has no working roads. We open roads. Both of them can file a complaint.',
    robot:  'SITE: contested. CLAIMANTS: two, engaged. The queue ranks them as obstructions in order of tonnage. This unit notes that neither claim parses.',
  },
  /* Deploying against your own banner. js/dialogue.js already carries the
     RENEGADE_LINES exchange for the VS screen; this is the approach that
     precedes it, so the family argument does not begin mid-sentence. */
  renegade: {
    human:  'The banner on that world is ours and it is not answering. They heard the same broadcast we did and drew a different line. Nobody wanted this order. Confirm it anyway.',
    light:  'The ring below flies our gold and will not open to us. A warden who stops answering the Mandate is not an enemy. The word for what they are is worse: a verdict.',
    xeno:   'A limb of the body has stopped answering the chorus and grown its own appetite. The body does not negotiate with a limb. It reabsorbs it, or it cuts.',
    pirate: 'That crew flies no flag, same as us, and they have closed a road, which is nothing like us. Free is not a thing you get to keep doing wrong.',
    robot:  'UNITS BELOW: maker-format, designation shared, queue divergent. They stopped asking and started deciding. ANOMALY: this unit cannot name the difference from itself.',
  },
  /* Deploying to a commander's SEAT, the last world of a system and the
     climax of that act. `w.seat` is a real flag on every world, and until
     now the throne opened exactly like the six ordinary worlds before it. */
  seat: {
    human:  'This is their seat. Not a depot, not a relay: the room where somebody decided what happens to the rest of us. We have come a long way to knock on it.',
    light:  'The seat of this system. Whatever doctrine is written here is written for everyone below it, and today it will be read aloud in front of the people it was written about.',
    xeno:   'The seat. Where this pasture is administered from. Bodies are yield and a throne is only a body that believes it is the head. Remove it and see.',
    pirate: 'The chair at the top of the local pile. Every closed road in this system was signed off from that room, and nobody in it has ever had to use one.',
    robot:  'SITE: SEAT OF AUTHORITY, local. This unit has traced orders upward for a considerable time. Every seat so far has been occupied by someone taking orders from further up. Approach.',
  },
  /* A world taken CLEANLY: three stars, ninety per cent of your lives intact,
     which the campaign calls CONQUERED rather than merely held. Replaces the
     AFTERMATH voice, because a flawless take and a bloody one should not
     narrate the same way. */
  flawless: {
    human:  'Almost everyone is walking off this world. Read the casualty sheet twice, because you will not see one this short again, and do not let anyone start believing it is normal.',
    light:  'Taken whole, and the ring above it never had to close. This is what the Mandate always claimed it could do. It is worth asking why it so rarely did.',
    xeno:   'Taken intact and at negligible cost. The yield is undamaged, the pens are whole, and nothing here had to be spoiled to be owned. Efficiency of this order is not luck. It is appetite that has learned patience.',
    pirate: 'Nobody died taking this rock. Not one of ours, and barely any of theirs. That is going in the story we tell, and for once the story will be true.',
    robot:  'OBJECTIVE ACHIEVED. Losses: within tolerance to a degree this unit has not previously recorded. REPAIR requirement: negligible. This is what the recovered core would have called a good day. The queue has no such category.',
  },
  /* Deploying to a world you ALREADY took, that a rival has since taken back
     (advanceRivals moves owners every battle). The player has stars on this
     world and does not hold it, which is a different feeling to arriving
     anywhere new. */
  retaken: {
    human:  'We took this world once. We put people on it and we moved on, and somebody walked back in behind us. Nobody is saying it out loud, so it will be said here: that is on us.',
    light:  'A world we have already rung once, ringed again by somebody else. Protection that has to be re-established was not protection. It was a visit.',
    xeno:   'This ground was already in the ledger. It has been struck out and re-entered by another hand. The body does not resent losing a limb. It resents having to grow the same one twice.',
    pirate: 'We opened this road once. It is closed again, by somebody who watched us do it and waited. There is a lesson in there about leaving, and none of us wants to hear it.',
    robot:  'SITE: previously RESTORED by this unit. STATUS: reverted. The work was undone by a party who observed it being done. FILED: repair is not a state. It is a thing somebody has to keep choosing.',
  },
  /* A campaign battle lost. The one beat every player will eventually see,
     and the only flow that had no authored sentence anywhere: victory gets
     two plates and an exchange, defeat got a stat screen. One line, spoken
     over the assault plate of the battle just lost. */
  defeat: {
    human:  'The ground is theirs tonight. Write everything down: what held, what broke, who we lost. Earth did not come this far to learn nothing from a loss.',
    light:  'The line broke. Sing the retreat honestly, every name at full length. The Mandate does not require us to win. It requires us to come back.',
    xeno:   'The ground is surrendered. The body withdraws, digests what it learned, and returns with the lesson grown in. Hunger is patient. That is the whole of its power.',
    pirate: 'We lost the rock. The crews are alive, the holds are empty, and the road out is still ours. You can rebuild anything out here except a crew. Count heads.',
    robot:  'WITHDRAWAL EXECUTED. Losses logged by designation, not by count. TASK: continue. ADDENDUM, unauthorised: the ground was not the objective. The asking is. Both survive.',
  },
};

const PlanetCuts = {

  /** One campaign-moment line, or null. `kind` is 'contested', 'renegade' or
      'defeat'; unknown kinds and unknown factions degrade to null, and null
      means the caller keeps whatever it was already doing. */
  moment(kind, factionId) {
    const t = PLANET_MOMENTS[kind];
    return (t && t[factionId]) || null;
  },


  /** The universe coordinate key for a world. Returns null for a world that
      has no coordinates, which is every v1 (pre-one-universe) saved galaxy:
      those keep the derived briefing they have always had. */
  keyFor(w) {
    if (!w || typeof w.si !== 'number' || typeof w.wi !== 'number') return null;
    return String(w.si) + String(w.wi);
  },

  /** Is there authored copy for this world? Pure lookup, no allocation. */
  has(w) {
    const k = this.keyFor(w);
    return !!(k && PLANET_CUTS[k]);
  },

  /** The record for a world, or null. Callers must handle null: the table is
      authored a system at a time and a half-authored table is a normal state
      of this repository, not an error. */
  entry(w) {
    const k = this.keyFor(w);
    return (k && PLANET_CUTS[k]) || null;
  },

  /** The three faction lines for a world, [arrive, after, order], or null.
      Falls back to no faction rather than to another faction's voice: a human
      line in a Compact campaign would be worse than a derived sentence. */
  lines(w, factionId) {
    const e = this.entry(w);
    if (!e || !e.f) return null;
    return e.f[factionId] || null;
  },

  /** How much of the table is authored. Read by owner-sweep, which asserts
      this against js/galaxy.js rather than against a number written here:
      a count in a comment is a number a command can print, and this project
      has been bitten by hand-written counts more than once. */
  coverage() {
    let worlds = 0, cells = 0;
    for (const k in PLANET_CUTS) {
      worlds++;
      const f = PLANET_CUTS[k].f || {};
      for (const fid in f) if (f[fid] && f[fid].length === 3) cells++;
    }
    return { worlds: worlds, cells: cells };
  },

  /** The art key for one beat. Beats are 1-indexed to match the plate keys in
      artgen/planet_jobs.py, so a key in the pack and a key in this file are
      the same string and a typo cannot hide behind an offset. */
  plate(w, factionId, beat) {
    const k = this.keyFor(w);
    return k ? 'pcut_' + k + '_' + factionId + '_' + beat : null;
  },
};
