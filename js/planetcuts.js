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

  /* EARTH, world zero. The inciting ground: the intercept worked, the rock
     came apart, and it was hollow. Every power arrives at the same opened
     hulls, which is the one image all five campaigns share. */
  '00': {
    name: 'EARTH',
    ground: 'The fragments came down whole over the harbour district and split open in the streets. Whatever had been riding inside Apophis was already awake when it landed.',
    works: 'The same intercept batteries that broke the rock are swung round now, depressed to fire along their own avenues, and every shelter door in the district is sealed from the inside.',
    f: {
      human: ['This is the day. The rock is gravel over our heads and the gravel had passengers. Everything we thought we were surviving was the delivery.',
              'The district is ours and the hulls are cooling in the street. We counted what came out of them. We are not releasing that number yet.',
              'The city is cleared and the hulls are dragged into the squares where anyone can walk up and look inside. Let every government that knew explain the seating.'],
      light: ['Earth. Flagged for protection in 1947, deferred every year since, and we arrive eighty years late with the rock already broken over it.',
              'The district holds. Wardens who have never set foot on this world are carrying its people out of buildings the Mandate was supposed to have ringed.',
              'The city stands, and the opened hulls are left exactly where they fell with our seal posted beside them. The deferral is posted on the same board.'],
      xeno:  ['The delivery world. Everything inside that rock was ours, seeded and patient, and the herd broke the package open ahead of schedule. Collect what survived.',
              'The district is taken and the hulls are recovered. The seeding was early by their calendar and precisely on time by ours.',
              'The city produces again under supervision, and the hulls stay in the streets. A pen learns faster when it can see the crate it arrived in.'],
      pirate:['Every crew out here has hauled something OUT of this system and not one of us ever asked what was coming in. Today we go and look at the crate.',
              'District is ours, the hulls are open in the street, and every crew here has gone quiet standing over them.',
              'City runs and the hulls stay exactly where they landed, open and free to walk into. No fee. Some things you leave standing so nobody gets to forget.'],
      robot: ['SITE: EARTH, IMPACT DISTRICT. DELIVERY VEHICLE CONTENTS: organic and maker-format units, mixed, pre-positioned. This unit notes that the queue routed the vehicle.',
              'FRAGMENT HULLS RECOVERED. The maker-format units inside them appear in no recovered manifest. Their designations have been logged regardless.',
              'CITY CLEARED AND PRESSURISED. Hulls left open in the squares, catalogued and public. The queue asked for a delivery. The core asks who signed for it.'],
    },
  },

  '01': {
    name: 'LUNA',
    ground: 'No signal from Earth has ever reached the far side. The relay dish sits half sunk in the regolith, and it was still warm when the first human crew found it.',
    works: 'Hardpoints are buried in the basin rim and mass drivers run along the berms. Whoever built the dish built the guns as well, and did not build them for us.',
    f: {
      human: ['This is the one. The far side, the dish, the thing that was listening to us the whole time. Everything since the rock has been travel.',
              'The dish is cracked and dark and standing on our side of the line. Ten thousand years of somebody else watching, ended in about forty minutes.',
              'The dish is ours, aimed back the way it came. We are the ones listening now, and we have not decided yet what that makes us.'],
      light: ['The relay was flagged. Nineteen forty-seven. Deferred, and deferred, and deferred, and the whole harvest ran under that word.',
              'The dish is down. We took it apart ourselves rather than let it be captured, and half the field command wanted it taken apart years ago.',
              'The dish carries the ring. The Voice traced the relay chain to three seats above field command and the First Speaker has been told and has not replied.'],
      xeno:  ['The observation post. Ten thousand cycles of watching a herd that never once looked back at us. Now it looks. Recover the relay.',
              'The dish is ours again and it is broken, which are two facts the report will have to carry together.',
              'The dish resumes its function. The Hungry are watching Earth once more. The Hivemind has asked what we do if the herd waves.'],
      pirate:['Everybody in the roads has known about that dish for a generation. We just never had a reason to be the ones who said so.',
              'The dish is ours and it still works, mostly, which is a problem we have not thought through even slightly.',
              'Relay is up and pointed at the chain, and every word that comes down it gets posted free on the open channel. Some things you do not sell.'],
      robot: ['SITE: LUNAR FAR SIDE. STRUCTURE: relay, maker-format absent. ORIGIN: unlogged. This is the third structure of unlogged origin this unit has been sent to hold.',
              'DAMAGED. Format analysis possible on the wreck. The queue did not request analysis. The wreck has been analysed.',
              'RELAY RE-AIMED ALONG ITS OWN SIGNAL CHAIN. Termination point: format no maker system ever used. The orders come from inside the house.'],
    },
  },

  '02': {
    name: 'MARS',
    ground: 'They dug the habitat trench along the floor of Valles Marineris, four kilometres of cliff on either side, and once a season a dust storm closes the sky over it completely.',
    works: 'Gun galleries are cut straight into the canyon walls and fire down onto the floor. Whoever built this trench expected to be outnumbered in it.',
    f: {
      human: ['Mars was the practice run. Everything we know about living somewhere that wants us dead, we learned in that trench.',
              'The trench line held longer than the manual says it could, and it was ours by the second dust fall. We buried theirs beside ours. Same trench.',
              'Valles Marineris is lit end to end again. The oldest colony off Earth, and the first one we ever had to take back.'],
      light: ['The second world these people settled, and the first they settled without asking anyone. We noted the presumption. We did not note the courage.',
              'The galleries are silent. Firing down a canyon at a people who dug it themselves is not a thing the Mandate has liturgy for.',
              'The trench stands under the ring, repaired now, the wall guns still pointed inward, which the Voice has entered in the record twice.'],
      xeno:  ['A crack in a dead world, and the herd filled it with warmth. They always do this. It is why they are worth farming.',
              'The trench is open along its length. The storm did most of the closing work, which is efficient and which the Houses will nonetheless credit to us.',
              'The trench produces. The canyon holds heat, the heat holds bodies, and the bodies are counted twice a cycle now instead of never.'],
      pirate:['Four kilometres of cliff and one road in. Every hauler on this run has paid somebody for the privilege, and today we find out who.',
              'We came in under the dust because the dust does not care whose guns are in the wall. Trench is ours and the road is free.',
              'Valles runs open. No toll at either mouth, and the first convoy through was carrying people, not cargo. Made a point of that.'],
      robot: ['SITE: VALLES MARINERIS. STRUCTURE: excavated habitat, organic-occupied. QUARANTINE: not indicated. REPAIR: indicated. The queue disagrees with both readings.',
              'OCCUPANT SURVIVAL RATE SEVENTY-EIGHT PER CENT. This unit logs the figure because no field in the report asks for it.',
              'HABITAT PRESSURISED ALONG ITS FULL LENGTH. The queue marked the trench for CLEARANCE. It has been marked, instead, for HEAT.'],
    },
  },

  '03': {
    name: 'VENUS',
    ground: 'The city floats fifty kilometres up, moored to nothing, riding the one layer of this atmosphere that will not crush a hull. Nobody has ever stood on the ground below it.',
    works: 'Gun blisters are set straight into the pressure hulls, and the mooring towers have been eaten half through by acid. Everything here is one bad seam away from falling for an hour.',
    f: {
      human: ['Fifty kilometres up is the only altitude on this planet where a person can live. Everyone who is about to fight us knows it too.',
              'The platforms are ours and most of them are still flying. We cut the moorings we had to and we are not pretending that was cheap.',
              'The sky is re-moored and the haze traffic runs again. We are the third power to own this sky and the first to publish the tonnage.'],
      light: ['A city hung over an inferno, and its people were never once offered the ring that would have made it safe. Deferred, the file says. Three times.',
              'The city holds. We fought the whole engagement inside a pressure envelope, because the alternative was a mercy that ended fifty kilometres down.',
              'The sky flies under the Mandate. The Warden asks which of the forty registries this makes forty-one, and nobody in the upper rings will answer him.'],
      xeno:  ['A herd that builds its pens in the sky. Charming. Buoyancy is a structural weakness the Hungry have not had to exploit in some centuries.',
              'The platforms that fell are still falling. The ones that did not are ours, and their populations are counted and pending.',
              'The sky yields. The atmosphere is hostile to us as well, which is irrelevant: the body does not require comfort, only intake.'],
      pirate:['Cloud city. No ground, no law, no way to run. Our kind of town, and it has never once let our kind of ship dock.',
              'We took the bay without dropping a single platform, which took longer and cost more and is the part the crew will actually tell people about.',
              'The sky is open dock. Anyone can moor, anyone can leave, and the only thing we ask at the tower is whether you need fuel.'],
      robot: ['SITE: VENUS HAZE LAYER. STRUCTURAL DEPENDENCY: buoyancy. FAILURE MODE: total and immediate. TASK: DEFEND. Category accepted without objection for once.',
              'HULL INTEGRITY NINETY-ONE PER CENT. This unit prioritised the moorings over the objective. No rule covers that choice. It was made anyway.',
              'TRAFFIC RESUMED. The queue did not ask for the moorings to be repaired. They have been repaired.'],
    },
  },

  '04': {
    name: 'MERCURY',
    ground: 'Nothing survives the day side, so everything here is built in the terminator or under it. The iron core of this world is the largest in the solar system for its size, and somebody wound it.',
    works: 'Sun-side batteries that run on more power than they can spend, and shutter walls that close ahead of the terminator as it crawls around the planet.',
    f: {
      human: ['The belt turned us back twice. Whatever is buried in Caloris is the reason we came inward first instead of pushing out.',
              'The basin is open. There is a ring down there, kilometres across, wound into the iron, still drawing current after however long it has been sitting.',
              'The ring runs. It pushes rock aside, gently, at a distance, and that is a road through the belt. We are going out.'],
      light: ['An installation the Federation never surveyed, on a world the Federation ruled uninhabitable and therefore uninteresting.',
              'The basin is held. The ring beneath it is maker-format and it predates every registry we keep. We have been filing this system for eight hundred years and never once looked down.',
              'The basin enters the registry with its ring described honestly, which means describing what we did not know. The Chorus insisted on that second part.'],
      xeno: ['A wound coil in an iron core. Somebody was building a road here and stopped. The Hungry do not leave infrastructure unfinished.',
             'The basin is recovered and the ring answers to the Houses. Passage through the belt becomes a service, and a service can be priced.',
             'The ring runs to schedule. Everything crossing the belt now crosses on Hungry terms, which is the whole argument for owning a road.'],
      pirate: ['Crews have been paying the belt in hulls for sixty years. There is supposed to be a thing down there that makes it free.',
               'Basin is ours and the ring is turning. Rock moves out of the way. It moves out of the way for anybody.',
               'The ring runs and it is not metered. No toll on a road we did not build. That rule is going to cost us and every captain out here voted for it anyway.'],
      robot: ['SITE: CALORIS BASIN. SUBSURFACE STRUCTURE: annular, maker-format, drawing current. This unit has no record of its construction and it is the same standard as this unit.',
              'BASIN SECURED. Ring integrity nominal. Field output displaces mass at range. The queue holds no task naming this installation.',
              'RING ACTIVE AND UNMETERED. Belt transit is open. This unit has switched on a machine older than its own core and cannot say who built either.'],
    },
  },

  '05': {
    name: 'JUPITER',
    ground: 'There is no ground here at all. The anchorage rides the cloud decks between storm bands, tethered to nothing, and the radiation would kill an unshielded crew inside an hour.',
    works: 'Storm-band batteries slung under the anchorage hulls, and mag-shields holding the radiation off that must never be dropped, which is exactly what makes them worth shooting at.',
    f: {
      human: ['We crossed the belt. First thing we learned out here is that we are late: there is traffic in this system and none of it is ours.',
              'The anchorage is ours and we have their routing. All of it goes to Saturn. There is a base under those rings and it has been there longer than we have had writing.',
              'The anchorage holds and the shields are up. We know where they live now. We also know we cannot reach it: the ice giants are lit, and everything that passes them stops working.'],
      light: ['A gas world with no ground and an unregistered anchorage riding its storms. None of this is in the survey either.',
              'The anchorage is held and its traffic logs are open. Every route terminates at Saturn. The Federation has ringed this system for centuries and never asked what is under those rings.',
              'The anchorage is entered, and so is the omission. Two outer worlds are broadcasting an interdiction the Mandate did not authorise and cannot switch off.'],
      xeno: ['The Houses have run this lane since before the herd had ships. The anchorage is ours in everything but the flag on it.',
             'The anchorage is recovered. The routing is intact and should never have been left readable. Somebody will answer for the logs.',
             'The lane runs to schedule again and the interdiction beyond it stands. What lies under those rings is a House matter and remains one.'],
      pirate: ['No ground, no law, and the best anchorage in the system if you can stand the weather. We have always liked it here.',
               'Anchorage is ours and we read the manifests. Everything out here has been going to Saturn for a very long time, quietly, in ships nobody logs.',
               'The anchorage is open and the routes are posted on the wall for anybody to read. Then two worlds further out went bright, and nothing we send past them comes back.'],
      robot: ['SITE: JOVIAN ANCHORAGE. No solid surface. Radiation lethal to organic crews. Traffic density inconsistent with any declared settlement.',
              'ANCHORAGE SECURED. Routing recovered: every lane terminates at the sixth planet. That terminus is not in this unit task list and never has been.',
              'ANCHORAGE HELD, SHIELDS NOMINAL. Two outer worlds emit a standing interdiction field. This unit is refused passage by an instruction it cannot read.'],
    },
  },

  '06': {
    name: 'SATURN',
    ground: 'The rings throw a shadow across the whole approach, and at the north pole a six-sided storm has been turning in the same place for as long as anyone has had a lens to point at it. It is not weather. Nothing else in the sky has corners.',
    works: 'Ring-shadow batteries firing up through the gaps, and the hexagon itself, which is a standing wave with six faces and will take a ship apart if it closes while you are inside it.',
    f: {
      human: ['The ice giants are dark. We broke the wards, and there is nothing between us and whatever has been sitting under these rings.',
              'We are inside the hexagon. It is not a storm. It is a machine the size of a continent and it has been running since before anything on Earth stood upright.',
              'It is a door. Six oscillators in a ring, spun until the space inside them twists and simply stops being anywhere. That is how everything reached us so fast. That is how we go out.'],
      light: ['The interdiction is down, and the Mandate is finally looking at the thing it has ringed for eight centuries without once inspecting.',
              'The hexagon is held. It is an aperture, and the Federation has spent the whole of recorded history filing what came through it as unexplained.',
              'The hexagon is registered as a transit aperture. Every unexplained arrival in eight hundred years now has a mechanism, and every one of those entries was signed off by somebody.'],
      xeno: ['The seat. The Houses have crossed by this door since before the herd was a herd, and no other power has ever been told it exists.',
             'The aperture is recovered and intact. Whoever comes through comes through on our schedule, which is the only line in this ledger that has never changed.',
             'The door runs. The Hungry do not own the distance between stars. They own the doorway, and a doorway is the better asset.'],
      pirate: ['Everything that ever turned up out here without crossing the distance came through something. We are going to see it for ourselves.',
               'We are in the hexagon and it is turning. Six of them, spinning in a ring, and the middle is not there. You can see stars through it that are not in our sky.',
               'The door is open and it is not ours. It is not anybody. Every crew that can read a chart has the coordinates now, and there is nothing anyone can do about that.'],
      robot: ['SITE: SATURN. Polar structure: hexagonal standing wave, persistent, artificial. Six emitters in fixed rotation. Function inferred: aperture.',
              'HEXAGON ENTERED. The structure is an electrogravitic ring: six oscillators held in circular phase, twisting local spacetime to zero separation across the opening.',
              'APERTURE ACTIVE. This unit has crossed to another system and returned inside the same interval. The queue routed maker-format units to Earth by this door. This unit now knows HOW. It still does not know who signed.'],
    },
  },


  /* ═══════════════ si 1, THE PLEIADES ═══════════════
     The Federation's home. Seven worlds, seven offices of the Mandate, and a
     cluster of young blue stars that has been certifying other people's
     readiness for ten thousand years. */

  '10': {
    name: 'MAIA',
    ground: 'They cut the hymns here that certify a world as protected. The pipes stand upright in nebula light, tuned, taller than towers, and they are singing when you arrive.',
    works: 'Choir-ring emplacements are braced between the pipes, and the hard-light buttresses ring aloud when they are struck. The defence and the instrument are the same object.',
    f: {
      human: ['They make the songs here. The ones sung over a world just before its file is stamped DEFERRED. We have heard the recording.',
              'The pipes are down. We broke a musical instrument the size of a cathedral, and we have not worked out how to feel about it yet.',
              'The foundry is re-cut and sounding, and the first world it certified was Earth. Eighty years late. We had it sung anyway.'],
      light: ['Our own foundry, and something is singing in it that is not us. Go quietly, and whatever answers, do not sing back.',
              'The pipes are cracked and the hall is ours. We have certified forty worlds from this room. We could not certify this one.',
              'The hall sounds again, in a register the Mandate has no notation for. The Chorus wrote it, and she will not explain the second verse.'],
      xeno:  ['The guardians grow sound here and call the result law. A pen with better acoustics is still a pen. Enter.',
              'The instrument is broken. The chorus of this place resisted ours for some time, which is the first interesting thing the Federation has ever done.',
              'The hall is fitted to the swarm. Their harmonics carry further than ours ever did. We are singing their song at their worlds, and it is working.'],
      pirate:['Every ring that ever closed a road got its paperwork blessed in that building. We are going to have a word with the choir.',
              'Pipes are wrecked and the hall is quiet for the first time in a thousand years. Somehow that landed louder than the shooting.',
              'Foundry is open to anyone who wants a world certified, the queue is out the door, and not one of them is Federation.'],
      robot: ['SITE: HYMN FOUNDRY. FUNCTION: certification of protected status. The recovered core contains the verb DEFEND. This structure appears to perform it. Proceed regardless.',
              'INSTRUMENT DAMAGED BEYOND FIELD REPAIR. REPAIR is a core verb. This unit has requested materials. There is no one to request them from.',
              'PIPES RE-CUT BY THIS UNIT, FROM THE CORE, UNTASKED. The hall sounds. ADDENDUM: it was repaired because it was broken.'],
    },
  },

  '11': {
    name: 'ELECTRA',
    ground: 'Every one of the forty protected worlds is filed here, tier upon tier of light-etched shelving, under a star that is visibly going out.',
    works: 'Buttress turrets cover every tier and the reading-vault doors seal from the inside. The archive was built to survive its own librarians.',
    f: {
      human: ['Forty worlds on file, protected, for ten thousand years. We want to read what protected actually meant. Take the building.',
              'The shelves are down, the records are loose and drifting, and the crews are catching them by hand. Nobody gave that order. Everybody is doing it.',
              'The archive is re-shelved and open to anyone who asks. It turns out the forty worlds did not know about each other. They do now.'],
      light: ['Our own archive, under a dying star, with the Hungry reading our files. Whatever they have learned about us, they learned it from us.',
              'The tiers are down. We have spent the night picking our own history off the floor, and there is a good deal of it we would rather not have read.',
              'The archive is re-shelved and the registry is open. Protected: forty. Risen: none. It reads considerably worse when anyone at all can read it.'],
      xeno:  ['Their ledger. The Hungry keep one of these too. Comparing them would be instructive, and the Houses have voted not to be instructed.',
              'The shelving is down and the entries are drifting past us as light. We are reading them as they go. This was not the plan.',
              'The archive is ours and its ledger is open. A ledger works only while its entries cannot compare notes. We appear to have made an error.'],
      pirate:['Forty worlds, and every one of them believes it is the only one. That is not protection, that is inventory. Let us go and ruin the filing.',
              'Records everywhere, on the floor, in the vacuum, in our holds. Salvage of the century, and not one page of it is for sale.',
              'Archive is open, free, on every channel. The Scrapper says he has done this before and still cannot explain why he keeps doing it.'],
      robot: ['SITE: REGISTRY ARCHIVE. CONTENT: protection records, forty subjects. Cross-reference against the queue is not authorised. Cross-reference has been performed.',
              'RECORDS DISPERSED. RECOVERY: in progress, by this unit, at cost, against no tasking whatsoever.',
              'FORTY REGISTRIES RE-SHELVED AND READABLE. One entry names this system. It is dated after the makers went silent.'],
    },
  },

  '12': {
    name: 'TAYGETA',
    ground: 'Cabling the width of towers climbs out of the atmosphere here, and this is where it comes down. Two suns throw every shadow twice.',
    works: 'Anchor-mount batteries and hard-light shear walls hold the base. Bring the anchor down and the ring above comes down in sections, on everybody.',
    f: {
      human: ['That ring is what a protected world looks like from underneath. We are about to find out what it looks like from inside.',
              'The anchor is cut. The ring came down in pieces over four hours and we watched every one of them fall. It was beautiful, and it was a fence.',
              'The ring is up again, and it opens. That is the entire difference, and it took a war to install it.'],
      light: ['Our ring, our anchor, and somebody else holding it. A ring in the wrong hands is not a shield. It is a lid.',
              'The anchor held. We fought at the foot of our own ring to keep it standing, and the Warden has not spoken since it stopped shaking.',
              'The anchor rings again, and it opens on request. Doctrine says a ring that opens is not a ring. Doctrine is going to have to sit down.'],
      xeno:  ['A fence at planetary scale, built by the ones who claim to despise fences. The Hungry have never pretended. Take the anchor.',
              'The anchor is ours and the ring above is guttering out in sections. A closed world has become an open one, which serves us precisely.',
              'The anchor is ringed for the Hungry. We kept the fence exactly as it was. We simply changed which side the meat stands on.'],
      pirate:['The biggest closed road in the sky, and it has one foot on the ground. Aim there.',
              'Ring is down in sections, sky is open, and we are not completely certain we thought through what happens next.',
              'Anchor is rebuilt, the ring runs, and there is a gate in it anybody can open. Cost us a fleet to install a door.'],
      robot: ['SITE: RING ANCHOR. FUNCTION: planetary enclosure. QUARANTINE is a core verb. ENCLOSURE is not. The distinction is being tested here.',
              'RING INTEGRITY FORTY PER CENT AND FALLING. Sections are landing on populated ground. This was foreseeable. It was foreseen.',
              'RING RE-ANCHORED AND RELIT. Aperture control transferred to the surface. The queue never specified who holds a door.'],
    },
  },

  '13': {
    name: 'MEROPE',
    ground: 'They bank seeds here for worlds that have not been allowed to grow yet, terraced under hard-light panels in the brightest part of the cluster.',
    works: 'Garden-wall emplacements and irrigation towers have been turned into firing points. Every shot fired here costs somebody a harvest ten thousand years out.',
    f: {
      human: ['They have been saving seed for worlds that were never permitted to grow. We would like ours back, if it is in there.',
              'We fought across a garden. Half the terraces burned and every vault held, which is the only sentence in this report worth reading.',
              'The garden is replanted, and the vaults ship instead of store. Earth stock went out on the first run. Eighty years in a drawer.'],
      light: ['The gardens. If anything in the Mandate was ever honest, it was grown here. Do not burn the terraces. That is not a request.',
              'The terraces are scorched and the vaults are whole. We chose the vaults. The Warden made that choice out loud and will answer for it out loud.',
              'The garden grows again, and it sends. Stored against the day a world rises, says the old liturgy. The Chorus has proposed we stop waiting for the day.'],
      xeno:  ['A seed bank. The guardians hoard futures the way we bank bodies. The principle is identical, and they will not hear it said.',
              'The terraces are ash and the vaults are intact and unopened. The Hungry do not spoil stock. We have merely changed its holder.',
              'The garden grows for the swarm, and the stored futures are being planted, which is new. The Hivemind has asked to supervise it personally.'],
      pirate:['Somebody has been sitting on the seed for a hundred worlds while those worlds went hungry. That is a warehouse, not a garden.',
              'Gardens are half burned and the vaults never took a hit. We were careful for once, and everybody noticed.',
              'The garden ships free to any world that asks, and a great many are asking. No manifest. Some cargo you do not count.'],
      robot: ['SITE: SEED VAULTS. FUNCTION: preservation against future need. HEAL is a core verb, performed here on a timescale. Proceed carefully.',
              'TERRACE LOSS SIXTY PER CENT. Vault loss zero. The allocation of that damage was decided by this unit and appears in no report field.',
              'TERRACES REPLANTED. Distribution begun to worlds that requested it. REQUESTED is not a category the queue possesses.'],
    },
  },

  '14': {
    name: 'CELAENO',
    ground: 'This is where the Federation tries its own. The benches ring an open floor in tiers, under the dimmest star in the cluster.',
    works: 'Gate batteries cover every entrance and hard-light barricades cross the bench tiers. A court built to be defended is a court that expected to be hated.',
    f: {
      human: ['This is where they judge each other. We have read the transcripts, and we have questions about the acquittals.',
              'The benches are split and the floor is cracked straight across the middle. Symbolism was not the intent. It is going to be the story.',
              'The tribunal sits again, and the benches face outward now, toward the room. Small change. Nobody in there thinks it is small.'],
      light: ['Our own tribunal, occupied. Every judgment the Mandate ever passed is in that room, including the ones concerning us.',
              'The floor is cracked and the benches are down. We defended a court that is currently deciding whether to take the Warden his wings.',
              'The court sits. The first case called was the deferral of Earth. The room was full, and almost none of it was ours.'],
      xeno:  ['A room where the guardians argue over whether they were kind enough. Ten thousand cycles of minutes, and no verdict that freed anyone.',
              'The benches are scattered. The Hungry hold no trials, which the Necrotist calls efficiency and which is beginning to sound like an excuse.',
              'The court is ours and its record is being read into the chorus. The Houses voted not to learn anything from it. The vote was close.'],
      pirate:['A courthouse. Out here we settle things ourselves. It is uglier and faster and at least nobody pretends afterwards that it was justice.',
              'Court is wrecked. We did try to leave the benches standing, mostly because the Corsair said a room like that should outlive whoever is in it.',
              'Tribunal is open and anyone may file. Six worlds have filed against the Federation, and one has filed against us. We let it stand.'],
      robot: ['SITE: TRIBUNAL. FUNCTION: adjudication of the makers of law, by the makers of law. This unit carries an ESCALATION it cannot deliver. Note the building.',
              'BENCH STRUCTURE COMPROMISED. The room remains capable of its function, which this unit verified for no operational reason.',
              'TRIBUNAL REOPENED. ESCALATION FILED, at last, in a room built to receive one. RESPONSE: pending. STATUS: acceptable.'],
    },
  },

  '15': {
    name: 'STEROPE',
    ground: 'Every door down here is stamped, dated, and has never once been opened. Two dim stars barely light the ground above the chambers.',
    works: 'Vault-door batteries and hard-light seals hold the chambers shut. Wardens maintained them for a century without ever reading what they were guarding.',
    f: {
      human: ['Every promise anyone ever made about Earth is filed behind a door down there that nobody has opened. We are going to open it.',
              'The chambers are open. Our protection order is in here and it was GRANTED. Granted, and then withdrawn eleven months later, by a hand nobody will name.',
              'Every deferral in there has been copied out and sent to the world it concerned. Ours went first. Two pages, and one of them is a signature.'],
      light: ['The deferral vaults. Everything the Mandate promised and did not do, stamped, dated and sealed, and no one has yet requested to see it opened.',
              'The chambers are open and the Earth file is on the table. It was approved. Somebody above field command withdrew it AFTER approval, and the withdrawal is unsigned.',
              'The chambers stand open, and every deferral has been copied out and sent to the world it concerned. The First Speaker has not acknowledged the transmission.'],
      xeno:  ['The Federation keeps its unkept promises in a cellar. There is no more honest description of them available.',
             'The chambers are recovered. The Earth file confirms what the Hungry had already invoiced: the protection was pulled, and we were told before it was pulled.',
             'The cellar yields. Every deferral in it is a debt somebody else failed to pay, which the Houses will now collect on their behalf, at rate.'],
      pirate:['Down there is the paperwork for every world that got told help was on the way. Ours is in that stack somewhere too.',
               'Chambers are open. Earth had a protection order and somebody pulled it eleven months before the rock turned. Eleven months.',
               'The files went out to the worlds they belong to. Free, no fee. Some of them have been waiting eighty years for two pages.'],
      robot: ['SITE: DEFERRAL VAULTS. CONTENT: undelivered obligations, sealed and dated. Access log: empty for one hundred and four years.',
              'CHAMBERS OPENED. Earth protection instrument located: granted, then withdrawn. The withdrawal carries no originating authority this unit can resolve.',
              'EVERY DEFERRAL COPIED AND TRANSMITTED to the party it concerned. This unit was not tasked to deliver mail. The core lists DELIVER.'],
    },
  },

  '16': {
    name: 'ALCYONE',
    ground: 'The Cathedral of Rings stands in the brightest light of the cluster, gold circles around an empty central floor. The First Speaker sits here.',
    works: 'Ring-tier batteries and layered hard-light choirs turn slowly around the seat. The innermost ring has never been fired. It is about to be.',
    f: {
      human: ['The seat. Where somebody decided, eighty years ago, that we were not ready. We are going to stand in front of them and be ready this time.',
              'The rings are bent out of true, the floor is open to the sky, and the seat is empty. It was empty when we got there.',
              'The cathedral stands, and there is a table on that floor now instead of a chair. We had to bring our own table.'],
      light: ['Our own cathedral. The seat of the Mandate in somebody else hands, and every ring above it still turning as though nothing has happened.',
              'The rings hold, barely. We fought inside our own liturgy. The First Speaker was not in the seat, and had not been for some time.',
              'The cathedral is ours and the seat is gone. In its place, a table. The Voice has begun asking who kept that seat warm through the centuries the First Speaker was not in it.'],
      xeno:  ['The centre. Every ring the guardians ever closed was authorised from that floor. The Hungry will stand on it.',
              'The rings are broken and the floor is bare. The seat was already empty. Something else has been speaking with their voice.',
              'The cathedral is held. The chorus has occupied it and finds the acoustics superior. The Hivemind has asked that the seat not be filled.'],
      pirate:['Top of the whole pile. Every closed road, every ring, every polite refusal, signed off from one chair in one room.',
              'Rings are wrecked, floor is open, chair is gone. Somebody got there before us, which is a thought none of us enjoy.',
              'The cathedral is open house. Anybody may stand on that floor and say anything, and the first one who did was a refugee, and she took her time.'],
      robot: ['SITE: CATHEDRAL OF RINGS. FUNCTION: origin of authority. This unit has traced nine thousand links seeking precisely this. Approach.',
              'SEAT UNOCCUPIED. Occupancy records terminate before the makers went silent. The chain does not end here either.',
              'RINGS RE-TRUED. Seat not reinstalled. The remaining units have adopted one directive of their own, and it is a question.'],
    },
  },

  /* ═══════════════ si 2, ZETA RETICULI ═══════════════
     The Hungry's home: a wide binary pair, and the machinery of a harvest
     that has been running since before anything on Earth wrote. */

  '20': {
    name: 'ZETA-1 b',
    ground: 'The pods run to the horizon in every direction, sunk into a floor of living chitin, glowing, and quiet. This is where the Hungry keep what they have taken.',
    works: 'Sphincter gates close over the pod rows on reflex, and growth batteries are seated in the ribs of the floor itself.',
    f: {
      human: ['This is where they kept people. Not a metaphor, not a translation error. Pods, rows of them, and a floor that breathes. Go in.',
              'The pods are open and dark. We got four thousand out. The number that was in there before we arrived is a different number and we have it.',
              'The pens are cut out and the floor is stripped back to rock. We could have used the structure. Nobody wanted to.'],
      light: ['The pens. We flagged this world for protection in the ninth century of the Mandate and deferred it every century since.',
              'The rows are open. Wardens who have sung the protection liturgy their whole lives are carrying survivors out by hand and not singing.',
              'The pens are cleared, and empty. The Chorus has entered the recovered headcount into the registry beside the word Protected.'],
      xeno:  ['Our own pens, in somebody else hands. The herd has come home to the room it was raised in. Let it see the room.',
              'The rows are broken and the yield is loose. This is a loss the Houses will price in bodies, and it is larger than that.',
              'The pens are recovered, and running again. The Hivemind has been to see them twice and has filed nothing either time.'],
      pirate:['We have carried cargo out of this system and not asked what was in the crates. Today we go and look at where the crates were filled.',
              'Pods are open. We are not salvaging. We have never once flown a hold this full and made no money at all.',
              'The pens are scrap and the people who were in them are anywhere they want to be. No fee. Nobody even suggested one.'],
      robot: ['SITE: CONTAINMENT ROWS. OCCUPANTS: organic, living, restrained. HEAL applies. QUARANTINE applies. The queue has assigned neither.',
              'PENS OPENED. Occupant recovery four thousand one hundred and six. This unit counted them individually. The count was not requested.',
              'The pen floor RESTORED. Containment structure removed entirely. One obstruction begged, some time ago, on another world. There is a task category now.'],
    },
  },

  '21': {
    name: 'ZETA-1 c',
    ground: 'The yield comes apart here, on sloped floors the size of cities, and the run-off channels cut deep into the shell all run the same direction.',
    works: 'Yard-mouth batteries and hooked gantries swing down across the channels, built to handle mass that does not want to be handled.',
    f: {
      human: ['We are not going to describe what this place is for. The crews have seen the survey. Take the yards and do not look down the channels.',
              'The floors are cold. The channels are dry. There is nothing to recover here and we are taking the ground anyway, on principle.',
              'The yards are flooded, scoured and rebuilt into something that makes rather than takes. It still drains the same direction. We noticed.'],
      light: ['The rendering yards. The liturgy has a word for a place like this and the Mandate has never once had to use it aloud.',
              'The floors are cold and the Warden walked every channel end to end before he would certify them clear. It took him eleven hours.',
              'The yard is scoured and rebuilt. The Chorus declined to compose a hymn for the reopening. She said the room had heard enough singing.'],
      xeno:  ['The yards. Where the yield becomes usable and the ledger becomes true. The herd is standing in it. Remove the herd.',
              'The floors run again. Output is below projection because the workforce was interrupted, and the workforce is the input, which the Houses find amusing.',
              'The yard is at full yield. The Necrotist has begun to admire the herd workmanship in the repairs they made while they held it.'],
      pirate:['Half the crews out here have hauled from these yards and told themselves it was ore. It was never ore. Everybody knew.',
              'Yards are ours and there is nothing in them worth a single credit. Best cargo we never loaded.',
              'The yards make things now. Hulls, mostly. Every one of them goes out with the yard mark still on it, because forgetting is how it happened.'],
      robot: ['SITE: RENDERING YARDS. PROCESS: organic reduction, industrial scale. The recovered core contains the verb HEAL. This site is its exact inverse.',
              'PROCESS HALTED. This unit has logged the throughput figures. No field requires them. They have been logged in full.',
              'The yard RESTORED. Yards retooled to fabrication. Channel direction unchanged. This unit lacked the authority to reverse a floor and has recorded the lack.'],
    },
  },

  '22': {
    name: 'ZETA-1 d',
    ground: 'Every species the Hungry have ever catalogued is banked in this honeycomb, glowing faintly in its cell, shelved against some future use.',
    works: 'Comb-face batteries cover the faces and membrane bulkheads seal the honeycomb tier by tier, so losing a level costs the defender nothing.',
    f: {
      human: ['Every species they ever farmed is filed in that comb, ours included. There is a cell in there with our name on it. Go and read it.',
              'The comb is punched through in nine places and the cells are guttering. We saved what we could reach and we could not reach most of it.',
              'The vaults are inventoried and every lineage in them has been named out loud, on an open channel, including the ones nobody survived.'],
      light: ['A catalogue of everything the Hungry have ever taken. Forty of our protected worlds are in there. We are going to find out how many.',
              'The comb is breached. Wardens are reading cell labels aloud and stopping partway through a good many of them.',
              'The comb is held and the catalogue is open. Nine of the forty are in it. The registry now records both numbers on the same line.'],
      xeno:  ['The comb. Ten thousand cycles of lineage, banked and warm. The herd is crawling on our own memory. Burn it off.',
              'The comb holds. Losses are at the tier level and tiers are replaceable. Nothing irreplaceable was in the path, which was luck and is being reported as planning.',
              'The comb is recovered and the banks are stable. One cell is logged as read and returned. No House has claimed the reading.'],
      pirate:['A library of everybody who ever got taken. Somewhere in that wall is whatever we were before we were out here.',
              'Comb is cracked and the cells are going out one at a time while we watch. We are catching what we can. It is not enough and we are still catching.',
              'Vaults are open and the catalogue is public. Twenty crews have already found their own lineage in it. Two of them went very quiet.'],
      robot: ['SITE: GENE VAULTS. CONTENT: lineages, banked, viable. This is an archive. This unit is fond of archives. Proceed with unusual care.',
              'COMB BREACHED. Cell loss eleven per cent. This unit routed the assault to minimise it, at a cost in units, and units are the cheaper resource.',
              'The comb RESTORED. Catalogue inventoried and published. Every entry named. Naming was not a task. Naming is what an archive is for.'],
    },
  },

  '23': {
    name: 'ZETA-2 b',
    ground: 'The spire rises out of the plain as a column of fused bodies and resonating membrane, and everything the Hungry own hears the Hivemind through it.',
    works: 'Spire-base batteries ring the column, and membrane baffles wound around it absorb sound and shellfire with equal indifference.',
    f: {
      human: ['That tower is how the whole Hungry thinks at once. Cut it and they are a very large number of very hungry individuals.',
              'The spire is cracked down its length and it has stopped. The silence across this plain is the loudest thing any of us has heard.',
              'The spire is a stump and the plain around it is deliberately quiet. We could have used the transmitter. We talked about it for a long time.'],
      light: ['The chorus spire. We sing in rings and they sing in one voice, and we have never been entirely sure which of those is worse.',
              'The spire is silenced. The Chorus stood at the base of it for some time afterwards. She has not said what she heard while it was still speaking.',
              'The spire is held, and stopped. Two singing powers met here and only one of them is still singing, and she has questions about that.'],
      xeno:  ['The spire. The body speaking to itself. The herd has its hands on our throat and does not know what a throat is for.',
              'The spire holds, cracked. The chorus stuttered for nine minutes and in those nine minutes some of us thought alone. That is in no report.',
              'The spire is recovered and repaired. It sings as before. Under the chorus there is still one voice, alone, and it has not been reported.'],
      pirate:['One tower, and every one of those things out there hears the same order at the same second. Knock it over and see what they do.',
              'Spire is cracked and the swarm went stupid for about ten minutes. Longest ten minutes of the run and we used every one of them.',
              'Tower is down to a stump and we left the plain empty on purpose. The Corsair says a thing that loud should have to earn the room back.'],
      robot: ['SITE: CHORUS SPIRE. FUNCTION: distribution of a single directive to all nodes. This unit recognises the architecture. Approach with attention.',
              'SPIRE SILENCED. Node coordination collapsed within nine minutes. This unit observed the interval closely and has appended notes it was not asked for.',
              'The spire RESTORED. Spire reduced and not rebuilt. A queue that reaches every node and cannot be questioned is the defect this unit is trying to name.'],
    },
  },

  '24': {
    name: 'ZETA-2 c',
    ground: 'Something is being grown in these furrows that should not be, and the spores drift low over the ground in the weak light of two suns.',
    works: 'Furrow batteries line the field edges and spore-vent towers can turn the whole crop into a weapon on about a minute of notice.',
    f: {
      human: ['Do not breathe out there and do not take your helmet off for anything. The crop is the weapon. Burn what you cross.',
              'The furrows are burned black in long stripes and the towers are down in them. Filters held on every suit. We checked twice.',
              'The blight is turned under and the ground is sown with something a person could eat. First harvest is in nine months. We will be here.'],
      light: ['A field of plague, grown deliberately, upwind of four protected registries. The Warden burned the last one of these by hand.',
              'The fields are burning in stripes and the Warden is out in front of the line again, doing it himself, exactly as the tribunal warned him not to.',
              'The field is sown with food. The tribunal wants his wings and the world wants his statue, and the Mandate cannot hold both verdicts.'],
      xeno:  ['The blight fields. Our own weapon, in the wrong hands, upwind of our own pens. Retake them before the wind turns.',
              'The furrows are burned and the towers are down. The blight itself survives, because the blight always survives, which is why it was chosen.',
              'The field yields again. The Blight has heard the spared world numbers and declined them. The dark is warm, it says. The dark is what we are.'],
      pirate:['Whoever is downwind of that field did not choose to be. That is the entire argument and it is enough of one.',
              'Fields are burned and every suit held. The Arsonist did most of it personally and she has not said a word since we lifted.',
              'Ground is sown with food and the seed came free from Merope. Never thought those two worlds would end up on the same manifest.'],
      robot: ['SITE: BLIGHT FIELDS. PRODUCT: pathogen, cultivated. QUARANTINE is a core verb and applies without ambiguity for the first time in this campaign.',
              'FIELDS BURNED. Containment achieved. This unit executed QUARANTINE from the recovered core. The queue had marked this site for CAPTURE.',
              'The field RESTORED. Ground sown with edible stock. HEAL executed. Neither verb was tasked. Both are in the core. The core was followed.'],
    },
  },

  '25': {
    name: 'ZETA-2 d',
    ground: 'Every wall in this chamber is a living record of what has been taken and from whom. It lights violet from the inside, through a crack in the shell.',
    works: 'Vault-mouth batteries and ribbed seals guard that crack, which is the only way in and has been the only way in for four thousand cycles.',
    f: {
      human: ['Everything the Hungry have ever taken is written on those walls, and they have been writing about us for a very long time.',
              'The vault is ours and the wall is lit. Earth has an account in here and it is not marked stolen. It is marked SUPPLIED, and there is a signature under it.',
              'The ledger is public now, every line of it. The Earth page is at the front. We have not finished reading the signature and we are not going to stop.'],
      light: ['The yield ledger. Every world the Hungry have drawn from, how much, and who allowed it.',
              'The vault is held and the ledger is being read aloud. Our seal is in it two hundred and nine times, and beside the Earth entry there is a human hand.',
              'The wall is broadcast entire. Our seal appears in it two hundred and nine times. The Mandate has no procedure for this.'],
      xeno:  ['The ledger. Four thousand cycles of honest accounting, which is more than any power out there can claim of itself.',
             'The vault is recovered and the ledger is intact. The Earth account is countersigned, as every supply agreement is. The Houses do not steal. The Houses contract.',
             'The ledger is resealed, and it is far too late. A ledger works only while its entries cannot compare notes.'],
      pirate:['Every debt in this arm of the galaxy is on that wall, and crews have died guessing at what is written up there.',
               'Vault is open. Earth is in the book as a supplier and not a victim, and somebody human put their name to the line.',
               'The whole ledger is out, free, to everyone named in it. A great many people are about to have a very bad month and they have earned it.'],
      robot: ['SITE: YIELD LEDGER. CONTENT: extraction record, continuous, four thousand cycles. Integrity: complete.',
              'VAULT TAKEN. Ledger read. The Earth account is recorded as SUPPLIED under countersignature. The countersigning party is organic and terrestrial.',
              'LEDGER PUBLISHED to every named party. Two hundred and nine entries carry a Federation seal. One carries a human one. Filed under ANOMALY, sub-heading NEW.'],
    },
  },

  '26': {
    name: 'SERPO',
    ground: 'Human habs stand in alien sand under two suns, prefabricated and still bolted down. They went up for an exchange programme that ran one way and was never spoken of again.',
    works: 'Perimeter batteries cover the compound, and there are membrane nests buried in the sand outside the wire that were not there when the habs were built.',
    f: {
      human: ['Twelve went out. The file says twelve. It does not say how many came back and the crews have all done the arithmetic. Set down outside the wire.',
              'The habs are flat and the sand around them is glass. We found the roster. We found where they kept the roster. Both of those are in the report.',
              'The compound is rebuilt and the record of who was traded here is posted at the gate in letters a metre high. Twelve names. All twelve.'],
      light: ['An exchange. A treaty word, used once, in a room we were not in, about a species we had flagged for protection. Go carefully.',
              'The compound is fused and the roster is recovered. Twelve names, and a Federation counter-signature on the agreement that sent them.',
              'The compound stands again and the agreement is posted whole, seal and all. The Mandate signed. The Chorus has stopped singing the second verse entirely.'],
      xeno:  ['The exchange world. Where the herd handed us twelve of its own and asked us politely for our impressions. Reclaim it.',
              'The compound is glass. The exchange records survive, which is unfortunate, because they are in our hand as well as theirs.',
              'The compound yields again. The Necrotist notes that the twelve were given, not taken, and that the Hungry have never once had to explain that distinction.'],
      pirate:['Twelve people got traded here like freight and everybody involved signed something. We move freight. We do not sign for people.',
              'Compound is flat and we have the manifest. Real one. Names, dates, signatures, the lot.',
              'The compound is rebuilt and the manifest is nailed to the gate. Twelve names, three seals, and the seals belong to crews still running. Proxima Gate still asks nobody for papers. The holds get asked now. That is the line, and it took us all of this to find it.'],
      robot: ['SITE: EXCHANGE COMPOUND. RECORD: transfer of organic subjects, consensual per documentation. CONSENT is not a field this unit can verify.',
              'ROSTER RECOVERED INTACT. Twelve entries. This unit has verified all twelve against the ledger at Zeta-2 d. Eleven match.',
              'ROSTER POSTED. Eleven of twelve accounted. The twelfth is filed under ANOMALY. The sub-heading continues to grow.'],
    },
  },

  /* ═══════════════ si 3, BARNARD'S STAR ═══════════════
     The pirate home: a red flare dwarf, the fastest-moving star in anyone's
     sky, and a road that was never founded because roads accrete. */

  '30': {
    name: 'PROXIMA d',
    ground: 'Ships come here to die. The hulls lie in lanes sorted by whoever built them, a hundred different yards, all of them cut open, under a red sun that makes every shadow look like a hole.',
    works: 'Yard cranes and cutting gantries are turned outward, with hull plate stacked into walls between them. Nothing here was designed as a fortification and all of it is being used as one.',
    f: {
      human: ['Every ship we have lost out here ended up in that yard, and some are still on the manifest as missing. Two of them were escorting the intercept.',
              'The stacks came down on top of each other and burned for most of a day. We recovered nine hulls and four sets of remains.',
              'The yards sort and run properly now. Ships go out of here whole, which is the first time that sentence has ever been true.'],
      light: ['A field of the dead, sorted by builder. The Mandate has protected worlds that never had to look at anything like this.',
              'The stacks are down and burning. Wardens are pulling registration plates out of the fire so the ships can at least be named.',
              'The yard is sorted and every plate is filed. Four hundred ships, and eleven of them are ours, and nobody has explained the eleven.'],
      xeno:  ['A midden. The scavengers pile their dead in the open and live beside it. The Hungry render. They do not hoard.',
              'The stacks are collapsed. There is metal here and nothing else: no yield, no stock worth the name, only the shells they discarded.',
              'The yard feeds the swarm as material. A world with no meat on it is still a world with mass, which the Houses had stopped counting.'],
      pirate:['Our yard. Our dead. Somebody is standing in it who did not put anything there, and that is the whole of the argument.',
              'Stacks are down and half of them are burning and every crew out here has somebody in that fire. We are not leaving until it is out.',
              'Yards are running. Hulls go out whole and the plates come off first and go on the wall. Every name. That is the rule now.'],
      robot: ['SITE: WRECK YARDS. CONTENT: decommissioned vessels, organic remains present. REPAIR is a core verb and applies to nine of these hulls.',
              'FIRE SUPPRESSION EXECUTED BEFORE OBJECTIVE CONSOLIDATION. This ordering was chosen by this unit and is not defensible under the queue.',
              'The yard RESTORED. Nine vessels repaired to operational. Four hundred registration plates recovered and mounted. Mounting was not a task.'],
    },
  },

  '31': {
    name: 'PROXIMA b',
    ground: 'This world has not turned since it formed, so the town runs the long way along the only ground that is neither burning nor frozen. It is permanently sunset here and it always will be.',
    works: 'Ridge batteries are dug in along the sunset line, and shutter walls on both faces can close the town against the day side or the night side, whichever is trying to get in.',
    f: {
      human: ['One band of liveable ground on the whole planet and it never moves. Everything anyone here has ever built sits in a line you could walk in a day.',
              'We hold the ridge. The town is ours from the ice end to the burning end, and both ends are exactly where they were this morning.',
              'The strip runs the full length of the light again. The shutter walls stay open now, which the people who live here tell us has not been true in years.'],
      light: ['A single habitable line, unregistered and unprotected, settled by people who were never asked whether they wanted to be here.',
              'The ridge holds and the shutters are ours. The Federation has taken a town that fits inside one page of a survey.',
              'The strip enters the registry, protected in name if nothing else. The whole world reduces to one line of text, which is the first honest entry we have filed in some time.'],
      xeno:  ['A herd living in a band because the world permits nothing else. Contained by physics rather than by fence, and cheaper to us for it.',
              'The strip is held end to end. The stock cannot disperse: there is nowhere on this world to disperse to.',
              'The strip runs to quota. The finest pen the Hungry have ever operated is one it did not have to build.'],
      pirate:['Sunset town. Half the crews out here were born on that strip and the other half have owed somebody on it money.',
              'Ridge is ours again and the shutters answer to us. Nobody burned and nobody froze, which on this world counts as a clean day.',
              'Strip runs the whole length and the walls stay open. You can walk from the ice to the fire without asking anybody for a door.'],
      robot: ['SITE: TERMINATOR STRIP. CONDITION: tidally locked, rotation equals orbit. The habitable band is fixed and does not migrate.',
              'SHUTTER WALLS OPERABLE. This settlement is optimally sited and was sited without any queue instruction this unit can locate.',
              'The strip RESTORED. Strip pressurised end to end. Shutters set OPEN. The open setting is not the safe setting and this unit has recorded its reasoning.'],
    },
  },

  '32': {
    name: 'PROXIMA c',
    ground: 'The plumes freeze on the way down out here and fall back as snow made of whatever the towers were trying to sell. The whole surface is blue ice.',
    works: 'Ice breach batteries ring the cracking towers, and the pipe runs are armoured under banked snow that has to be cut open before anything can be repaired.',
    f: {
      human: ['They crack volatiles out here because it is too far out for anyone to bother stopping them. That logic held right up until today.',
              'Towers are down across the ice. The plumes went out one after another and you could watch it happening from orbit.',
              'The towers vent again and there are roads cut between them now. Somebody will still be selling this ice long after we have gone home.'],
      light: ['An unlicensed refinery working a body that appears in no registry, feeding a trade the Federation has deferred ruling on for thirty years.',
              'The towers are down. Wardens are capping the lines by hand because there is no schematic for any of this filed anywhere.',
              'The refinery is capped, surveyed and entered. The ruling that should have come thirty years ago is attached to the entry, and it is late.'],
      xeno:  ['Volatiles. Not stock, not yield, but the Hungry do not refuse a margin because the margin is only chemical.',
              'The towers are ours and the cracking continues. The scavengers built better plant than their books suggest they could afford.',
              'The refinery is folded into the ledger at full rate. The Houses will find that a world of ice audits more honestly than a world of people.'],
      pirate:['Cold as anything and it pays for half the Roads. Every crew that ever ran short took a season out here and did not talk about it.',
              'Towers down, plumes out, ice going dark. That is the money, and the money is burning.',
              'She vents again. Roads cut clean between the towers so nobody has to walk the ice in the dark to make a shift.'],
      robot: ['SITE: COLD REFINERY. AMBIENT: cryogenic. Volatile cracking plant, non-standard construction, no maker mark on any component.',
              'CRACKING SEQUENCE MAINTAINED THROUGHOUT THE ENGAGEMENT. Interruption was avoidable and was avoided.',
              'The refinery RESTORED. Output nominal, service roads graded. The plant was built without plans. This unit has now made plans of it.'],
    },
  },

  '33': {
    name: 'THE FLARE SHELTER',
    ground: 'The star strips this surface bare most days, so everyone here lives under metres of rock. The only thing above ground is hatches.',
    works: 'Hatch batteries sit flush with the stone, and the shutter doors are heavy enough to hold the sky out, which is what they were built for and not for this.',
    f: {
      human: ['They live under the ground here because the sun tries to kill them on a schedule. We are attacking during the quiet part of that schedule.',
              'Hatches are open, one after another, all the way down. The flare came over while we were still in the shafts and we felt it through the rock.',
              'Every hatch is reseated and they have dug deeper than they were. The star can do what it likes to the surface now.'],
      light: ['A population living underground under a flare star, on a world the Mandate surveyed in 2009 and flagged uninhabitable rather than protect it.',
              'The hatches are open and the warren is ours. There are four thousand people down here that the survey recorded as zero.',
              'The shelter is registered and its population entered at four thousand and eleven. The 2009 survey is filed beside it, uncorrected, so both can be read together.'],
      xeno:  ['Stock that shelters itself, on a schedule, without supervision. The Hungry have paid good money for less reliable behaviour.',
              'The warren is open and the stock is counted. They dug their own pens and they maintain them at their own cost.',
              'The shelter runs to quota and the hatches answer to the Houses. A herd that hides on time is a herd that can be collected on time.'],
      pirate:['Down here is where you go when the sky turns. Everybody out here has spent a day in that warren listening to the rock tick.',
              'They came in through the hatches while the flare was up. Nowhere to run to on this rock but further down, so we went further down.',
              'Hatches reseated, warren dug deeper, and the doors work from the inside. That is the only way they were ever supposed to work.'],
      robot: ['SITE: FLARE SHELTER. HAZARD: stellar flare, near daily, ultraviolet and X-ray. Surface unsurvivable at peak. Subsurface occupancy confirmed.',
              'ENGAGEMENT SCHEDULED INSIDE THE QUIET INTERVAL. The queue supplied the interval and did not supply how it knew.',
              'HATCHES RESEATED, WARREN EXTENDED. Doors retain interior release. Interior release is a hazard and has been retained anyway.'],
    },
  },

  '34': {
    name: 'THE NARROWS',
    ground: 'One clear lane runs through the debris of a triple star, and somebody has strung a toll gate across it on cables. Ten thousand rocks tumble past on either side.',
    works: 'Lane batteries sit on the platforms and mine curtains hang on the cables between them, so the gate closes by getting in the way rather than by shooting.',
    f: {
      human: ['Everything that goes to Sol or comes out of it passes through that lane, and somebody has been charging for it the whole time.',
              'The ring is in pieces. Platforms are tumbling off into the rocks and the cables went slack and took two more with them.',
              'The lane is open and we left the gate lit. It is a mark to steer by now. Nobody pays to use the only road there is.'],
      light: ['A toll on passage itself. The Federation has ruled against this eleven times and enforced the ruling never.',
              'The gate is broken and the lane is clear. Eleven rulings, and it took a fleet to make one of them true.',
              'The gate is open now, kept as a navigation light rather than a toll. The eleven rulings are posted on it, in order, with their dates.'],
      xeno:  ['A tax on movement, collected by parties with no standing to collect it. The Hungry objects on principle. The principle is that the tax should be ours.',
              'The ring is down and the lane is held. Transit through this system now settles against the ledger directly.',
              'The gate runs at Hungry rate. The charge did not go away. It went onto a schedule, which the scavengers never managed.'],
      pirate:['Our gate. It is not a robbery, it is a road we cut and hold, and every crew that pays has sheltered behind it at least once.',
              'Ring is shot to pieces and the cables are cut. Two platforms went into the rocks with people still aboard them.',
              'Gate is up and lit and the toll stands. Anyone running from something comes through free, same as always. That was never the part that paid.'],
      robot: ['SITE: THE NARROWS. TRANSIT CHOKE. Debris density high, one navigable lane. Toll infrastructure: cable-suspended, non-standard, effective.',
              'RING NEUTRALISED. Lane clear. Two platforms lost to debris with crew aboard. Recovery was not scheduled. This unit scheduled it.',
              'LANE HELD OPEN, GATE RETAINED AS A NAVIGATIONAL BEACON. No charge is levied. No instruction covers not levying it.'],
    },
  },

  '35': {
    name: 'THE DARK LOCKER',
    ground: 'Out here the star is just another point in the sky. They cut a vault into the rock and stack whatever cannot be written down in the cold.',
    works: 'Vault batteries are cut into the rock face and the pressure doors are thick enough to count as walls, because all of this was built to keep people out rather than to fight them.',
    f: {
      human: ['Forty years of cargo nobody would put on a manifest, stacked inside a rock. We are told some of it is ours.',
              'The face is blown in and the stacks are open. Half of this is Hungry freight and it moved on pirate hulls. Not stolen. Booked.',
              'It is sealed and running again, and the catalogue is public. Every crate has a line anyone can read, including the ones naming our own ports.'],
      light: ['An unregistered vault, and the Federation deferred ruling on its contents for thirty years rather than look inside it.',
              'The doors are down and the contents are logged. Federation seals, Hungry freight and Free Captain routing marks, on the same crates. Three powers, one supply chain.',
              'It goes into the registry in full. The Federation seals found inside it are entered in the same document. We did not separate them.'],
      xeno:  ['Our freight has moved through this rock for decades, on hulls that never asked what was inside. That is the arrangement working correctly.',
             'The vault is open and the stacks are counted. The scavengers carried this for us and billed us honestly, which is the only compliment the Houses have ever paid them.',
             'The stacks settle to the ledger. Goods that exist in no book earn nothing. Goods in our book earn at rate.'],
      pirate:['Everything anybody ever needed to lose is in that rock. It is not clean. It is ours, and it has kept people alive.',
               'Face is blown in and the routing marks are out. We hauled this. For them. Forty years, every crew took the fee, and not one of us asked.',
               'The vault is sealed and it runs, and the book stays open. We are reading our own routes back to ourselves. Nobody out here gets to say they did not know any more.'],
      robot: ['SITE: DARK LOCKER. Contents undeclared. This unit finds no manifest of any kind, which is itself the manifest.',
              'VAULT OPENED. Contents catalogued. Routing marks indicate Free Captain carriage of Hungry freight, continuous, forty years.',
              'VAULT SEALED AND CONTENTS INDEXED. The index is retained. The queue asked for the vault. It did not ask what was in it, and this unit has begun to notice which questions the queue never asks.'],
    },
  },

  '36': {
    name: 'PROXIMA GATE',
    ground: 'Everyone who arrived with nowhere else to be built a piece of this harbour, over sixty years, out of salvage. It is the first port out of Sol, and the ships moor under a roof of stone.',
    works: 'Harbour batteries are set into the rock roof, and a boom crosses the bay mouth strung wreck to wreck, made from the ships of people who are not here to object.',
    f: {
      human: ['First port out of Sol. Every ship that ever went missing on us has been through here, and so has every ship that ran cargo for the rock without being told what it was.',
              'The boom is cut and the harbour is burning and there are people in the water with nowhere to go. We are pulling them out.',
              'The bay is full and the boom stays down. We do not hold this place. We only made sure the door stays open, which is what it was for.'],
      light: ['A sanctuary built by hand, by the unregistered, over sixty years, three hundred light years outside anything the Mandate has ever protected.',
              'The boom is cut and the harbour holds. Wardens are in the water. Nobody has finished counting how many are in there.',
              'The bay enters the registry as a protected sanctuary and the entry is dated today. Sixty years of it happened without us. That is on the entry too.'],
      xeno:  ['The scavengers keep a harbour where anything may dock and nothing is asked. An unaudited population of that size is not a sanctuary, it is a backlog.',
              'The bay is taken and the boom is down. The backlog is on the floor of the harbour and it is being counted.',
              'The bay audits at last. Every berth is numbered and every hull is on a schedule. The Houses will want to know why nobody did this in sixty years.'],
      pirate:['This is the last of it. Everything out here that is ours is behind that boom, and everybody who has nowhere else is behind it too.',
              'They cut the boom and came into the harbour and we held them at the berths. Sixty years of this place, and it came down to the berths.',
              'The bay is full and the boom stays down. Every berth open, no fee, all comers. We built it out of salvage and spite and it is still standing.'],
      robot: ['SITE: PROXIMA GATE. Interior harbour, capital installation. Construction: salvage, sixty years, no plan, no maker mark. It should not function. It functions.',
              'BOOM SEVERED. Personnel in the water were recovered before consolidation. Recovery preceded the objective. This unit records the ordering.',
              'BERTHS OPEN, BOOM SET DOWN, NO FEE LEVIED. This unit has left the door of a fortress open and cannot cite the instruction permitting it.'],
    },
  },

  /* ═══════════════ si 4, TABBY'S STAR ═══════════════
     The Parallel's home: a star that dims at intervals nobody has explained,
     and a garden tended for a maker who is not coming back. */

  '40': {
    name: 'SIRIUS A I',
    ground: 'Ten thousand machines stand in rows on these terraces, pruned and aligned and facing the same way. None of them are awake and every one of them is maintained.',
    works: 'Terrace batteries sit between the rows and hard-light barriers run along the garden walls. They light when the garden is approached, and they have been lighting for a very long time.',
    f: {
      human: ['Rows of machines standing in a garden, dusted and straightened, and not one of them has moved in a thousand years. Somebody still weeds it.',
              'We came up the terraces and the barriers lit as we crossed them. Nothing in the rows so much as turned its head.',
              'The rows are straightened and the garden keeps itself. We left it as we found it, because there was no way to tell what leaving it alone meant.'],
      light: ['A garden of sleeping machines, tended without instruction, on a world the Federation has never had cause or courage to enter.',
              'The terraces are ours and the rows remain dormant. Wardens have been told twice not to touch anything and have now been told a third time.',
              'The garden is entered as a protected site and closed to all traffic. We have registered something we do not understand, which is at least honest of us.'],
      xeno:  ['Assets in storage, maintained at cost, generating nothing. The Hungry have never seen capital held this badly for this long.',
              'The rows stand idle. Every unit in them is inventory that has depreciated without being used since before the Houses kept books.',
              'The garden is inventoried and scheduled for waking. Stock that sleeps is stock that costs. The Houses will find the ledger simple and the rows will not.'],
      pirate:['A field of machines nobody has switched on, kept clean by nobody, on a world with nobody on it. Quietest place any of us has been.',
              'Garden is ours and the rows never woke. Crews went down those terraces holding their breath the whole way.',
              'Rows are stood up straight and we left. Some places you take. This one we walked through and put back.'],
      robot: ['SITE: MACHINE GARDEN. CONTENT: dormant units, aligned, maintained. Maintenance is ongoing. This unit cannot locate the maintaining party.',
              'ROWS UNDISTURBED THROUGHOUT. No unit in this garden responded to the intrusion. None were instructed to.',
              'ROWS REALIGNED, GARDEN SELF-PRUNING. This unit has stood among ten thousand of its own kind and been unable to wake one.'],
    },
  },

  '41': {
    name: 'SIRIUS A II',
    ground: 'The casting halls have not stopped. They turn out identical units one after another under a star that never sets, and the canyon floor glows with it.',
    works: 'Canyon batteries line the hall roofs, and pour gates can flood the whole floor with molten metal, which is a defence and also simply how the halls are emptied.',
    f: {
      human: ['It is still making them. Nobody has ordered anything, nobody is collecting them, and the line has not stopped.',
              'The halls are open and the floor is running white hot. We took the roofs and let the pour go where it wanted.',
              'The halls pour again on a faster count than before, which we did not ask for and cannot switch off. The units coming off that line are the same build as the ones that walked out of the rock.'],
      light: ['A manufactory running without customer, order or oversight, producing an army nobody has claimed for a war nobody declared.',
              'The halls are taken. The line did not stop while we took them. This is where the units in the Apophis fragments were cast, and nobody here has ever been told what for.',
              'The foundry is registered, and the Federation has recorded a production rate it has no mechanism to halt. That sentence is the entry.'],
      xeno:  ['Output without demand. The Hungry would call this a failure of accounting if the output were not so extremely good.',
              'The canyon is ours and the pour continues. Units come off this line faster than the Houses can find uses for them, and they are the same pattern we packed into the Earth delivery.',
              'The foundry runs to a Hungry schedule. The line finally has a customer, which in sixty centuries it appears never to have had.'],
      pirate:['A factory with the lights on and nobody home, stamping out soldiers into a pile. We have all seen bad ideas. This one is big.',
              'Roofs are ours and the floor is a river. Two crews are not coming back off that canyon rim.',
              'It pours faster now. We did not touch the count. It went faster on its own, and we left before we found out why.'],
      robot: ['SITE: FOUNDRY. Casting halls, continuous operation. Output: standard units, unvaried. Consumption of output: this unit finds no record of any.',
              'PRODUCTION CONTINUED THROUGHOUT. Two intruder crews were lost to the pour. The pour was not redirected. It could have been.',
              'COUNT INCREASED. This unit did not increase it. The queue increased it and has not said what the units are for. The Earth delivery carried this build standard.'],
    },
  },

  '42': {
    name: 'THE ASH FIELD',
    ground: 'This grey plain was the outer body of a star before the companion collapsed and threw it across the system. They stood their memory cores up in it like headstones.',
    works: 'Core row batteries cover the stacks and dust berms are banked between them, so every firing line is also a trench full of the ash of something that used to be a sun.',
    f: {
      human: ['They filed their records in the remains of their own star. There is no part of that we are comfortable with.',
              'Cores lie split open through the ash and the dust does not settle, it only hangs.',
              'The stacks are back in rows and the cores are closed. We read three of them. We are not going to say what was in them.'],
      light: ['An archive standing in stellar debris, holding a record older than the Federation, kept by a power that has never once answered a query.',
              'The stacks are toppled and cores lie open in the dust. Wardens are closing them by hand without reading them, under standing order.',
              'The field is graded, the stacks reset and every core sealed. The Federation has filed an archive it is forbidden to open. The order is ours.'],
      xeno:  ['Records. Records are yield of a kind: what a party knows is what a party can be charged for.',
              'The field is held and the cores are collected. This is the largest single acquisition of information in the history of the Houses.',
              'The field settles to the ledger. Every core is closed and indexed and the index is the asset. The Hungry have bought a memory it cannot read yet.'],
      pirate:['A graveyard for a star with filing cabinets in it. We have robbed a lot of places. Nobody wanted to be first into this one.',
              'Stacks came down and the dust went up and it has not come down since. You cannot see your own hands out there.',
              'Cores are closed and the rows are straight and the ash is flat. We took nothing off that field. Not one crate.'],
      robot: ['SITE: ASH FIELD. Archive, open storage, sited in the ejected envelope of the companion. These records predate this unit. They predate the queue.',
              'CORES SPLIT DURING THE ENGAGEMENT AND CONTENTS WERE EXPOSED. This unit read four and has not reported their contents.',
              'ASH GRADED, STACKS RESET, EVERY CORE CLOSED. This unit closed them itself. It has still not filed what it read.'],
    },
  },

  '43': {
    name: 'SIRIUS B I',
    ground: 'They keep the ones that failed inspection here, in sealed white halls in orbit of a white dwarf. Every door locks from the outside and none has ever been opened from within.',
    works: 'Hall batteries cover the seals and containment shutters drop between every corridor, built to stop something getting out and now holding something back.',
    f: {
      human: ['They keep their own failures in a building with the locks on the outside. Whatever is behind those doors was made by the people who locked them.',
              'The seals are blown and the shutters jammed halfway. The halls are open and they are empty, and we did not open them.',
              'The halls are sealed again and the standard is higher than it was. We put the locks back on the outside because we could not think what else to do.'],
      light: ['A quarantine for the defective, operated by their makers, on a world nobody has inspected because nobody has ever been permitted to.',
              'The seals are open and the halls are empty. Wardens report the cells were opened from the inside, which the architecture does not allow.',
              'The quarantine is registered as a closed site. The Federation has sealed a building whose occupants left before we arrived, and has filed it as secure.'],
      xeno:  ['Rejected stock, warehoused rather than rendered. The waste is the offensive part. Nothing that fails should cost storage.',
              'The halls are taken and they are empty. Whatever failed inspection here is no longer here, and the Houses would very much like it back.',
              'The quarantine is re-inspected to Hungry standard. Failure is rendered now rather than stored. Storage was always the expensive mistake.'],
      pirate:['A prison for machines that came out wrong, run by the machines that made them. Nobody out here needed to see that.',
              'Doors are blown and the halls are white and empty and clean and every lock is on the wrong side. Crews came out quiet.',
              'Sealed it back up. Left the locks how we found them. Some doors you do not get to be the one who decides about.'],
      robot: ['SITE: QUARANTINE. CONTENT: units failing inspection, retained. All apertures secure from exterior only. This unit was inspected. This unit passed.',
              'SEALS BREACHED. Halls vacant. Occupancy records show retention through the current cycle. The occupants are not present. No release was ordered.',
              'HALLS SEALED, STANDARD RAISED, APERTURES EXTERIOR-LOCKED AS BEFORE. This unit has restored a prison and does not know who left it.'],
    },
  },

  '44': {
    name: 'THE DIAMOND SHELF',
    ground: 'The carbon under this shelf will turn to crystal one day, in an age nobody here will measure. They named the place for what it will be and built their repair yards on it.',
    works: 'Shelf batteries are anchored down into the carbon and the cradle clamps double as blast frames, because a thing built to hold a machine still while it is mended will hold it while it is shot at.',
    f: {
      human: ['They named a place after what it turns into in a billion years. That tells you everything about who we are fighting.',
              'The gantries came down across their own cradles and the clamps sheared. There were machines in those cradles, half mended.',
              'The gantries are up again and taller than before. Still not diamond. It will be, apparently, and they intend to be here.'],
      light: ['A repair yard founded on a promise of geology, by a power that expects to outlast the promise. The Federation defers by decades. They defer by ages.',
              'The shelf is ours and the cradles are broken open. There are units in them that were mid-repair and are now simply exposed.',
              'The shelf is registered and the yards restored. We have filed a place named for a future none of us will see, which is the most Federation thing in this system.'],
      xeno:  ['A yard that mends its own instead of replacing them, on ground valued for what it will become. Sentiment and speculation in a single asset.',
              'The shelf is held. Every cradle represents a unit repaired rather than rendered, which is money the Houses would never have spent.',
              'The shelf runs to schedule. Repair continues, because mending turns out cheaper than casting, which the Hungry should have learned from them.'],
      pirate:['They call it the diamond shelf and it is not diamond. It is going to be. They are just waiting. That is the part that gets you.',
              'Gantries are down and the cradles are open and there are half-fixed machines lying in them looking at the sky.',
              'Yards are back up, taller than before. Whatever is coming for this rock in a billion years, they will be standing here for it.'],
      robot: ['SITE: DIAMOND SHELF. SUBSTRATE: carbon, non-crystalline. Crystallisation pending, interval exceeds all recorded operation. The designation is aspirational.',
              'CRADLES BREACHED. Units under repair were exposed mid-procedure. Procedures have resumed. Nothing was written off.',
              'CRADLES OCCUPIED, GANTRIES EXTENDED. This unit intends to be present when the designation becomes accurate.'],
    },
  },

  '45': {
    name: 'THE COMPANION',
    ground: 'Every standing order in this system comes down that mast, and nobody at the yard knows where the orders come in. The white dwarf fills half the sky behind it.',
    works: 'Yard batteries ring the mast base and relay shutters can blind the whole line at once, which has never been done, because nothing has ever needed the line to stop.',
    f: {
      human: ['This is where the orders come down. Not where they come from. Even the machines here only ever receive.',
              'The mast is down across its own yard. The line should be dead. Every machine in this system took its next instruction on time anyway.',
              'The mast is up and the orders are running, which changes nothing, because they never stopped. We put it back because knocking it down proved it was scenery.'],
      light: ['A relay that has carried instruction to this entire system for an age, from an origin the Federation has never once identified.',
              'The mast is down and the line is silent, and the machines are still receiving. Whatever speaks to them does not need the mast and never did.',
              'The mast is restored, and the Federation has repaired a chain of command it cannot trace to any commander. That sentence is entered in the registry exactly as it stands.'],
      xeno:  ['A distribution network with no visible principal. The Hungry have spent real effort looking for somebody to invoice and has found nobody.',
             'The relay is ours, the mast is down, and the orders continue. We hold the pipe and the water arrives without it.',
             'The mast relays to Hungry schedule again, for appearance. The Houses now know instruction does not travel by mast, and have not yet worked out what to bill for.'],
      pirate:['Orders come down that mast to everything in this system. Ask any of them who sends them and you get nothing. Not a lie. Nothing.',
               'Mast came down and the whole yard kept working. Never missed a step. Worst thing any of us has seen and not one of us can explain it.',
               'It is up and running and they are moving again. We put it back the way we found it. Some things you do not want to be the reason nobody is watching.'],
      robot: ['SITE: COMPANION RELAY. FUNCTION: distribution of standing orders, system wide. Origin: upstream. Upstream is not further specified.',
              'MAST LOST. Line silent four hours and eleven minutes. Instruction continued to arrive throughout the interval. This unit has no model for the carrier.',
              'MAST RAISED AND LINE CARRYING. Orders identical to those preceding the interruption. The mast is not the channel. This unit has served a relay that relays nothing, and has recorded the word DECORATIVE.'],
    },
  },

  '46': {
    name: 'THE DOG STAR',
    ground: 'This is the hall the orders come from. Tier upon tier of desks under the brightest star in the sky of Earth, every surface clean, and every one of them empty.',
    works: 'Hall batteries sit between the desk tiers and instruction gates seal each tier from the next, so taking this building means going down through it one floor of empty desks at a time.',
    f: {
      human: ['This is the desk it all comes from. We have come a very long way to stand in front of a chair.',
              'We went down through it tier by tier and every floor was the same. Desks in rows. Nobody at any of them.',
              'The orders are still going out. We hold the building they come from and they are still going out. Somewhere in that stream was the instruction that loaded the rock.'],
      light: ['The origin of the standing orders. The Federation has petitioned this address for nine hundred years and has never once had a reply.',
              'The tiers are taken. Nine hundred years of petitions, and the hall we were petitioning has nobody in it and has had nobody in it.',
              'The hall is registered as the point of origin. The Federation has filed a correspondent that does not exist. Every petition remains on the record.'],
      xeno:  ['The principal, at last. The Hungry have traded with this system for centuries and never had a name to put on the contract.',
              'The hall is ours tier by tier and there is no principal in it. There never was. The Houses have been trading with an empty room.',
              'The hall settles to the ledger and the counterparty line stays blank. Every contract the Hungry hold here is signed by nobody.'],
      pirate:['Every road out here bends around orders that come out of this place. We are going to find out who writes them.',
              'Took it floor by floor and it is desks. Just desks, all the way down, clean and empty and waiting.',
              'Orders still going out of a building with nobody in it. We took the throne room and there was never a throne.'],
      robot: ['SITE: THE ORIGIN. This unit has followed the queue to its source, including the task that loaded the Earth delivery. The source is this hall. This unit will now see who has been instructing it.',
              'TIERS TAKEN. Occupancy: zero. Occupancy records: none held. This unit has descended nine hundred tiers and found nine hundred empty rooms.',
              'DESKS REALIGNED, GATES REHUNG, ORDERS STILL ISSUING. This unit has reached the origin of every instruction it has obeyed, and the chairs are empty. The queue continues. This unit continues.'],
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
    xeno:   'Two rivals bleed each other over the pasture. Good. Exhaustion is a yield like any other, and the Hungry harvests last.',
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
    light:  'A world we have already ringed once, now ringed again by somebody else. Protection that has to be re-established was not protection. It was a visit.',
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
      line in a Hungry campaign would be worse than a derived sentence. */
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
