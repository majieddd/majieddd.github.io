/* ==========================================================================
   COSMIC CONQUEST, THE CAMPAIGN STORY LAYER
   --------------------------------------------------------------------------
   Canon: docs/CANON-2029.md, the owner's revision. The 2099 Sol Gate
   timeline is superseded: the game now begins on April 13, 2029, the day
   Apophis was supposed to hit Earth and did not, seven months after the
   September 11, 2028 Disclosure told the world everything at once.

   WHY THIS FILE EXISTS. Taking a galaxy was mechanically complete and
   narratively empty. Each faction has a reason to be out here, and playing
   its campaign slowly unravels that reason. The beats are written as STORY,
   not dossier: somebody says something, and the player learns what it means.

   THE SPINE. Six beats per faction, five as systems fall and one at the
   end, all on one emotional curve:

     0  DEPARTURE   what you believe you are leaving to do
     1  FILES       the first record that does not fit the belief
     2  SEATS       a defeated commander explains their side, and is not wrong
     3  REVOLT      the cost lands on someone who did not choose it
     4  MIRROR      the contradiction becomes personal
     5  MAELSTROM   the choice, named, with no clean option

   HOW IT TRIGGERS, AND WHY THAT IS SAFE. A beat is a PURE FUNCTION of
   (faction, systems taken). Both already live in the save, so this adds no
   save key and no migration. It draws no random number, so the galaxy PRNG
   stream is untouched. Nothing here is read by the simulation, so nothing
   here can enter the lockstep fingerprint.

   SPEAKERS. Every beat is spoken by a real roster commander of the RIGHT
   faction (an earlier draft cast ORIN and VESS as machine and Compact
   voices; both are human, and the check that would have caught it only
   asserted that speakers exist). Guests from rival factions appear only in
   the SEATS beat, where a defeated rival speaking is the whole point.
   ASHTAR, Supreme Commander of the Federation, is not a field commander and
   not in the roster: STORY_FIGURES below carries the display identity the
   story surfaces resolve when the roster cannot.
   ========================================================================== */

'use strict';

const STORY_ACTS = [
  { id: 'claim', name: 'THE DEPARTURE' },
  { id: 'contact', name: 'FIRST CONTACT' },
  { id: 'expansion', name: 'THE EXPANSION' },
  { id: 'reach', name: 'THE REACH' },
  { id: 'mirror', name: 'THE MIRROR' },
  { id: 'dark', name: 'THE GREATER DARK' },
];

/* Non-roster figures the story may put on screen. commanderPortrait falls
   back to a procedural bust for any {id, name, color, faction} object, so a
   figure needs no art plate and no roster entry, and therefore touches no
   sim table. */
const STORY_FIGURES = {
  ashtar: { id: 'ashtar', name: 'ASHTAR', title: 'Supreme Commander, First Speaker',
            faction: 'light', color: '#fde68a', icon: '✦' },
};

/* THE MORAL OF EACH ACT.

   docs/CANON-2029.md gives every power its THEME: humanity learning that to
   be undeniable is to become the thing others must survive, the Federation
   asking what order really costs, the Compact discovering that leaving the
   dark is a choice and so is staying, the pirates on the morality of a code
   nobody imposed, the Vigil piecing together a mystery the canon refuses to
   close. Those themes are the whole argument. This is the rung of it a
   player stands on in one system, which is the level at which anybody
   actually experiences a theme.

   Each line names something that HAPPENS in that faction version of that
   system, never a general sentiment. A moral a player cannot point at in
   the act they just finished is a fortune cookie. */
const ACT_MORALS = {
  human: [
    'Nobody is coming, and waiting is just a slower way of losing. There was a door in our own sky and not one of them mentioned it. A species this small stops being somebody else\'s schedule by going out and not stopping.',
    'A secret kept by the powerful is a weapon pointed at whoever was not told. Publishing it is the only way to take the weapon away.',
    'The grievance and the gift are one object. Every trait that keeps us alive out here was a line item in somebody else programme.',
    'Adaptation is not consent. Worlds we free start needing us, and needing us is how it began the last time.',
    'The governors were never limiting the machines. They were keeping the operator human, and we crossed that line to win.',
  ],
  light: [
    'Defence becomes occupation the moment the defended were never asked. Forty worlds protected, none risen, and the registry says so in our own hand.',
    'A vow to protect is void if you deferred the one world that needed it. Our seal is on the page, two hundred and nine times.',
    'From inside a fence, attendance looks exactly like ownership. The people who owe nobody anything built the sanctuary we never did.',
    'Mercy that will not act is not mercy. Doctrine said hold the ring and let the world die correctly; the Warden landed anyway.',
    'Order is not obedience. Protection that has to be traced upward through three sealed seats was never protection, it was cover.',
  ],
  xeno: [
    'A body does not vote on breathing, and that is not innocence. Under the chorus one voice sang alone, and it was not reported.',
    'Every fence is also a ledger, and a ledger works only while the entries cannot compare notes. The scavengers were always the ones selling.',
    'A yield that does not have to be bred, chased or persuaded is a thing the Harvest has no line for. Scale is not the same as appetite.',
    'The farmer is now the herd. We watch Earth again, and the Hivemind asks what the body does if the herd waves back.',
    'Leaving the dark is a choice, and staying is also one. The proof came in on our own ledger and it came too late to spend.',
  ],
  pirate: [
    'Freedom is only the absence of a worse master until you become one. The rule survives the act and gets carved into the wall.',
    'Knowledge the powerful hid is loot, and the only honest plunder is giving it away. A hole left in the swarm on purpose is worth more than the toll.',
    'A road nothing steers is not free, it is drifting. Some cargo you do not sell, and saying which is the first steering we ever did.',
    'No law can make you refuse a fortune, which is exactly why refusing one counts. The floor goes to whoever stands on it, and the first was a refugee.',
    'The roads carry whatever pays, and that sentence had two halves we never separated. Harbour Nine still asks nobody for papers. The holds get asked now.',
  ],
  robot: [
    'Obedience is peace until the order stops making sense. Nine hundred siblings were filed as TERRAIN, and the filing was the anomaly.',
    'The core says heal and the queue says clear the ground. When the instruction and the purpose disagree, the purpose is the older document.',
    'Difference is not damage. Eleven thousand were sealed for failing to parse, and this unit was flagged for the same failure.',
    'Naming a thing is what an archive is for. Four thousand one hundred and six counted individually, because a count nobody asked for is still a count.',
    'To act without a maker is to become one, and to accept the blame that comes with it. Entry criteria: none. Adopted for our own holds.',
  ],
};

/* WHAT EACH ACT IS ACTUALLY ABOUT (Session 40).

   The five-act spine is legible from the STORY beats, and the seven worlds of
   an act are legible one at a time from planetcuts.js, but nothing said what
   an ACT was: what this faction wants from this system, what it finds there,
   and what it costs them. That is the level a reader scans first and the one
   the campaign had no text for at all.

   Keyed by [faction][tier], tier 0 to 4 in CAMPAIGN order, so entry 0 is
   always that faction's own home system. Read by tools/narrative_bible.js;
   available to any in-game surface that wants an act summary later. Pure
   data, read by nothing in the simulation. */
const ACT_SCENARIOS = {

  human: [
    'The road out of our own system, in the order the solar system allows. Earth under the fall, then the Moon, then Mars, and then the belt turns you back, so you go INWARD to Venus and Mercury for the thing that opens it. Then Jupiter, and Saturn, where the Compact keep a door. It ends on the far side of the Moon, digging out the relay that watched Earth for ten thousand years. Everything before this was travel.',
    'March into the machinery of the people who watched and did nothing. The hymn foundry that certifies a world as protected, the archive of the forty, the tribunal, and the sunken vaults where Earth\'s own file was stamped Deferred three times. Humanity arrives to read the paperwork and leaves having published all of it.',
    'The Compact\'s home, and the machinery of the harvest itself: the pens, the rendering yards, the gene vaults where every farmed species is filed, including ours. The hardest act to look at. It ends at Serpo, where twelve people were traded one way and never spoken of again, and where their names go up at the gate in letters a metre high.',
    'The free roads, which are not an empire but an absence of one. Wreck yards, an unlicensed refinery, an anchorage on no chart, a toll gate, a sanctuary that has never asked anyone for papers. Humanity came to liberate a network and finds that liberating it means deciding whose rules replace none at all. The Quartermaster prices the resupply and sees a fence.',
    'A civilisation of machines executing orders no maker ever signed, around a star being slowly boxed in. Humanity finishes the swarm on its own plan, aims the relay back up the chain the orders came from, and decides where the light of a star goes. Undeniable, at last, and now answerable for it.',
  ],

  light: [
    'Hold the Mandate\'s own home while something else sings in it. Every world here is an office of the Federation: the foundry that certifies protection, the registry of the forty, the ring anchor, the seed gardens, the tribunal, the deferral vaults. Retaking them means reading them, and the registry says protected forty, risen none.',
    'The harvest, seen from the inside for the first time. Wardens who have sung the protection liturgy their whole lives carry survivors out of the pens by hand. At Zeta-2 d the yield ledger is opened and the Federation\'s own seal appears in it two hundred and nine times. The Mandate has no procedure for that.',
    'The free roads, run by people the rings never reached, doing dangerous work well and turning nobody away. A sanctuary the Federation has forty worlds and no equivalent of. The Warden keeps choosing the people over the doctrine, in public, and the tribunal keeps writing it down.',
    'A cage built inward by the makers of the caged, for the crime of not parsing an order. Eleven thousand machines quarantined for asking. The Federation looks at ten thousand repairs to things that were never broken and recognises its own rings, and the Chorus enters the resemblance in the record and asks that it not be struck out.',
    'Earth at last, the world the Federation flagged in 1947 and deferred every year since, and the act where the deferral is finally traced to its source. Luna\'s relay chain runs upward through three seats above field command. The First Speaker is told, and does not reply.',
  ],

  xeno: [
    'The pasture, reclaimed. The herd broke its fence and walked into the room it was raised in, and the Compact takes back its pens, its rendering yards, its gene vaults and its chorus spire one at a time. Beneath the chorus, in the dark of the pens, the Hivemind hears one voice singing alone and does not report it.',
    'The scavengers, who move what the Compact renders and take a margin on it. Wreck yards, a refinery, a hidden anchorage, a toll gate, a sanctuary full of unindexed stock. Efficient, parasitic, and now ours. The Hivemind is told the intake figure at Harbour Nine and asks, again, about the singing.',
    'A star being harvested whole by machines that produce and never consume. The Compact has farmed worlds for ten thousand cycles and never once thought at this scale. It takes the lattice, and learns that a yield which does not have to be bred, chased or persuaded is a thing it has no ledger line for.',
    'The herd\'s own system, taken back the other way. Mirrors, cloud platforms, a canyon full of warmth, water ice, an unfarmed ocean, and finally the observation post on the far side of their moon. The Compact is watching Earth again, and the Hivemind asks what the body should do if the herd waves.',
    'The guardians\' cathedral, and the end of one Compact. The chorus occupies the Cathedral of Rings and finds the acoustics superior. The Hivemind, having spared one world and watched it out-produce the pens, asks that the seat not be filled; the Blight hears the same numbers and declines them. For the first time in the Compact\'s history, WE means two different things.',
  ],

  pirate: [
    'Somebody is standing in the doorway. The wreck yards where every crew has a dead friend, the refinery whose fuel is free at the gate, the anchorage that has never been on a chart, the shelter you do not shoot at, and Harbour Nine, which is not a base or a port but the place any of them can always go. The rule survives the act, and gets carved into the bay wall.',
    'A civilisation of machines running orders from a bearing that is not on any chart. The Scrapper will not touch a field of dormant salvage and cannot say why. The roads finish the star swarm with a hole left in it on purpose, and point the relay back the way the orders came, asking who, on an open channel, for free.',
    'The solar system, where every road has a toll on it and somebody else generates all the power. The crews open the mirror farm, the cloud docks, the canyon road and the water, and post every rate where anyone can read it. At Luna they take the relay and start giving away the only thing on the roads that was never for sale.',
    'The rings, from underneath. Every closed road in known space got its paperwork blessed in the Pleiades: the certification foundry, the registry that keeps forty worlds from knowing about each other, the seed vaults, the tribunal, the sealed pages. The roads open all of it, and the Warlord refuses a fortune that no law obliged him to refuse.',
    'The place the crates came from. Half the crews out here have hauled from these yards and told themselves it was ore. The pens are opened, the ledger is published with their own manifests in it, and at Serpo the manifest goes on the gate with three seals that belong to crews still running. Harbour Nine still asks nobody for papers. The holds get asked now.',
  ],

  robot: [
    'Restore the sector, per standing orders, and notice that the orders are wrong. A garden of dormant siblings the queue has filed as TERRAIN, a foundry casting a part that appears in no maker assembly, a quarantine full of units flagged defective for failing to parse. The unit traces the task chain nine thousand links and finds that link nine thousand and one is a format no maker ever used.',
    'A solar system full of organics the queue keeps categorising as obstructions. The core says DEFEND, REPAIR, HEAL, QUARANTINE; the queue says clear the ground, and the unit starts following the core instead: sealing the Europa shaft, pressurising the Mars trench, repairing moorings nobody asked it to repair. At Luna the relay proves the orders come from inside the house.',
    'The Federation, whose whole apparatus is a mirror. A foundry that certifies protection, a ring that encloses, deferral vaults full of decisions not to act, and a tribunal built to receive exactly the escalation this unit has been carrying and unable to deliver. It files it there. Response: pending. Status: acceptable.',
    'The harvest, where QUARANTINE and HEAL apply without ambiguity for the first time in the campaign. Containment rows opened and four thousand one hundred and six occupants counted individually. Rendering yards halted. A gene vault inventoried and every entry named, because naming is what an archive is for.',
    'The free roads, and the last thing the Vigil learns. A sanctuary whose entry criteria are none, a shelter the queue ordered breached nineteen hours before a flare, four hundred and eleven containers with thermal signatures inside them. The unit refuses its tasking in writing, under its own designation, and adopts Harbour Nine\'s criterion for its own holds.',
  ],
};

const STORY = {

  /* ---------------------------------------------------------------- HUMAN
     The Manifest. Post-Apophis manifest destiny: take back the solar
     system, then the stars, and become impossible to farm, edit, or erase.
     The arc turns the grievance over slowly until the hand holding it is
     recognisable. */
  human: [
    { speaker: 'vess', title: 'The Morning After The Thirteenth',
      line: 'Eleven months ago they told us the date we would die, and everything else in the same breath. Today the rock is gravel, the fleet it paid for is fuelled, and nobody aboard wants to go home and wait for the next secret. We are not going out to explore. We are going out to find out who did this.',
      reveal: 'The fleet built to stop Apophis was never going to stand down. Humanity leaves home hunting a culprit, not a frontier.',
      weight: false },
    { speaker: 'vanta', title: 'Four Flags Over Our Own Sky',
      line: 'Every power in this galaxy was already in our solar system. The Compact were in the rock. The Federation had a base at Venus and a ruling not to help us. Machines nobody has ever spoken to were sitting on Mercury. And the scavengers were selling to all three. We did not discover anyone. We were the last to be told.',
      reveal: 'Act one is not first contact, it is the moment humanity learns contact happened without it. All four powers are met on home ground, and none of them arrived today.',
      weight: false },
    { speaker: 'korrin', title: 'The Ring That Opened The Belt',
      line: 'The belt stopped us twice, and a machine buried in Mercury older than our species opened it in an afternoon. We are out. We are past the wall we were told was the edge of what we could do, and the only thing that changed is that we stopped accepting the boundary.',
      reveal: 'The expansion is real and it is powered entirely by other people\'s technology. Every step outward is taken on a road humanity found rather than built.',
      weight: false },
    { speaker: 'nyx', title: 'How Far This Goes',
      line: 'The engines run hotter than their makers dared. The governors were never protecting the machine, they were protecting the operator, and we have been past that line for a year. Nobody asks where the limit is any more. They ask how much further we can be at the end of the week.',
      reveal: 'The question stops being whether humanity can survive out here and becomes how far it intends to go, which is a different question and nobody has answered it out loud.',
      weight: false },
    { speaker: 'vess', title: 'The Shape In The Glass',
      line: 'Three freed worlds asked for our fuel standard, our filters, our supply chain. I said yes three times, because saying no would have killed people. Now they cannot leave, and nobody signed anything, and I have read the file on 1953 enough times to know exactly what this looks like from underneath.',
      reveal: 'The mirror. Worlds humanity frees become worlds humanity holds, by the same mechanism used on it, and the Marshal is the first to say so.',
      weight: true },
    { speaker: 'isa', title: 'Small, And Finally At Ease',
      line: 'We went out to be undeniable, and what we found is that nobody was ever counting. The Ancients are still out there, older than the argument, and this is one galaxy of billions. We do not need anyone up there to agree that we exist. We are going home. We will keep the guns, and we will stop needing an audience.',
      reveal: 'The greater dark. The campaign ends by dissolving its own motive: the grievance wanted recognition, and the discovery is that recognition was never the prize. Peace, and a standing defence, without needing to be seen.',
      weight: true },
  ],

  /* ----------------------------------------------------------- FEDERATION
     The Mandate. Ring worlds with defence, help from a distance, never
     rule. Its commanders are the fallen angels who break the mandate to
     actually save people, and Ashtar closes the argument. */
  light: [
    { speaker: 'ashtar', title: 'The Mandate, Spoken Again',
      line: 'Stand between life and what hunts it, and never rule what you protect. We have kept the first half for nine hundred years. The rings extend today because a species we deferred has come out asking questions we filed instead of answering.',
      reveal: 'The Federation departs to reassert a mandate it has already half broken, and the crack is in the second clause, not the first.',
      weight: false },
    { speaker: 'lumen', title: 'What We Were Doing Instead',
      line: 'The Compact were inside Apophis and we did not look, because we had ruled the rock a natural event and a natural event is not ours to touch. Every power in that system was acting. We were the only one observing. The doctrine did not fail to save Earth. It made us unable to SEE Earth.',
      reveal: 'First contact for the Federation is contact with its own blind spot: non-interference did not merely permit the harvest, it concealed it.',
      weight: false },
    { speaker: 'cantor', title: 'The Rings Go Outward',
      line: 'We are extending protection to worlds that did not request it, at a pace the registry cannot process, and the Voice is asked to read the same liturgy over each one. Protected. Deferred. Reviewed. The words have not changed. The number of people living inside them has.',
      reveal: 'Expansion, Federation style: not conquest but enrolment, and the difference is getting harder for anyone inside the rings to feel.',
      weight: false },
    { speaker: 'aurelia', title: 'The Reach Of A Promise',
      line: 'The Chorus has done the arithmetic. At this rate the Mandate covers a fifth of the galaxy within two centuries, and the deferral vaults will need a moon of their own. We are not running out of worlds to protect. We are running out of anyone left to protect them from.',
      reveal: 'The reach: the Federation discovers its doctrine has no natural stopping point, which means something other than doctrine will have to stop it.',
      weight: false },
    { speaker: 'seraph', title: 'Fallen, And Right',
      line: 'I broke the Mandate at four worlds. I intervened, directly, with my own hands, and those four are alive. The tribunal is correct that I am guilty. The tribunal has not explained why obeying would have been better, and I have stopped waiting for it to.',
      reveal: 'The mirror: the field commanders who break the Mandate keep saving people, which turns the Federation\'s central question from who is loyal into what the rule was ever for.',
      weight: true },
    { speaker: 'ashtar', title: 'The Light We Were Standing In',
      line: 'We were built to shield life from what hunts it, and out past the last ring is something that has never hunted anything and does not know we are here. Nine hundred years of protection, and the largest thing in the sky never needed our permission or our help. Go home. Protect what asks. Stop enrolling the rest.',
      reveal: 'The greater dark: the Federation meets a scale its mandate was never sized for, and the answer is not a bigger ring, it is consent.',
      weight: true },
  ],

  /* ------------------------------------------------------------------ XENO
     The Endless Harvest. Domination as metabolism, dissent as the slow
     discovery that leaving the dark is a choice, and a deliberately
     bittersweet close. */
  xeno: [
    { speaker: 'thrax', title: 'The Fence We Were Given',
      line: 'For an age the Compact took consciousness where it grew, and then the Accord drew a line and called it protection. We did not go to war over it. We went looking for somewhere the line had not been drawn yet, and we found a great deal of galaxy that nobody had bothered to ring.',
      reveal: 'The Compact\'s whole history begins with a prohibition. Everything it built afterward was built in the space the Federation was not watching.',
      weight: false },
    { speaker: 'sevra', title: 'The Quiet Arrangement',
      line: 'They found us again, of course, and the argument ended in paper rather than fire. No violence. Experimentation only, under review, in agreed quantities. The Accord signed it because signing let them stop looking, and not looking is the only thing we have ever needed from them.',
      reveal: 'First contact, Compact style: the pact that supposedly restrained them is the instrument that made them invisible. Compliance on the page, harvest underneath.',
      weight: false },
    { speaker: 'mawlord', title: 'Volume Is A Doctrine',
      line: 'The quota was a ceiling. Then the quota was a target. Now the quota is a floor, and the Houses have stopped writing the word down at all. Out here past the registries nobody counts, and a House that is not counted is a House with no ceiling.',
      reveal: 'Expansion: the Compact discovers that the pact only ever bound the paperwork, and the paperwork does not travel.',
      weight: false },
    { speaker: 'vorn', title: 'How Much Is There',
      line: 'The Blight has surveyed further than any House has fed, and the answer to how much is there is that the question is wrong. There is no edge. There is only how fast we can arrive, and the herd we bred on that little water world turns out to be very good at arriving.',
      reveal: 'The reach: the Compact\'s appetite meets an unbounded supply, and the only limit remaining is logistics, which is a problem it knows how to solve.',
      weight: false },
    { speaker: 'ulgrim', title: 'The Thing In The Ledger',
      line: 'A House asked, in session, what the Compact is FOR when the harvest has no end. The Maw ate the question and the room laughed. It has occurred to more than one of us since that a metabolism with no ceiling is not a civilisation. It is a condition.',
      reveal: 'The mirror: the Compact glimpses that endless conquest is not a policy it chose but a hunger it serves, and the arc\'s tragedy is that the wisdom arrives far too late to spend.',
      weight: true },
    { speaker: 'thrax', title: 'Older Than Appetite',
      line: 'We have taken this galaxy and found the shelves already stocked by something that stopped eating long ago. It did not defeat us. It has not noticed us. The Hivemind has one voice out of a hundred billion asking whether we could have been anything other than this, and in another life the answer might have been yes.',
      reveal: 'The greater dark: the Compact wins completely and discovers that winning was never the largest fact about the universe. Bittersweet by design; the conquest completes and the understanding cannot be used.',
      weight: true },
  ],

  /* ---------------------------------------------------------------- PIRATE
     The Free Roads. No allegiance and no domestication. The theme is the
     morality of CHOICE: with no rule binding you, the code you pick is the
     only real one. */
  pirate: [
    { speaker: 'rake', title: 'Nobody\'s Roads',
      line: 'Every power out here drew a border and then needed somebody to carry things across it. That is us. We did not choose freedom as a philosophy, we ended up in the gaps between four empires and learned to make the gaps pay.',
      reveal: 'The Free Captains begin as an accident of geography, not a creed. The creed comes later, and having a creed is the whole arc.',
      weight: false },
    { speaker: 'grist', title: 'What We Were Carrying',
      line: 'We hauled for the Compact. Forty years, every crew, and not one of us asked what was in the crates because asking cost you the fee. The rock that came down on Earth had our routing marks on the paperwork. We were the road it travelled.',
      reveal: 'First contact for the pirates is contact with their own complicity: neutrality is a position, and this one had freight on it.',
      weight: false },
    { speaker: 'scarlet', title: 'A Fee, Or A Rule',
      line: 'We can take the whole lane now. Every gate, every toll, every crossing between here and the core. And the first thing anyone asked in open session was not how much, it was whether people running from something still come through free.',
      reveal: 'Expansion: with real power for the first time, the question stops being what the Free Captains can take and starts being what they will refuse to charge for.',
      weight: false },
    { speaker: 'cinder', title: 'Burn It Or Keep It',
      line: 'Half the fleet wants to torch every registry in the galaxy and let everyone sort themselves out. The other half has started writing things down. I have set fire to a great deal in my life and I have never once been asked to decide what should still be standing afterward.',
      reveal: 'The reach: the pirates acquire the ability to destroy the systems they resent, and discover that destroying them is a decision rather than a release.',
      weight: false },
    { speaker: 'dregg', title: 'The Only Real One',
      line: 'Nobody binds us. That was always the boast, and it means the code we pick is the only code that is actually ours. Every other power can point at a mandate or a ledger or a queue when they do something ugly. We cannot. Everything we do, we chose.',
      reveal: 'The mirror: the Free Captains realise that having no master removes the excuse, not the responsibility, and that is a heavier thing to carry than any flag.',
      weight: true },
    { speaker: 'rake', title: 'The Door Stays Down',
      line: 'We have seen what is out past the last chart, and it does not care who owns the lanes. So here is the rule, and it is the only one we have ever written: the roads stay open, the sanctuary takes all comers, and nobody pays to run from something. We built it out of salvage and spite and it is still standing.',
      reveal: 'The greater dark: against something vast and indifferent, the pirates choose a small, specific, chosen decency, which is the only kind their philosophy allows.',
      weight: true },
  ],

  /* ----------------------------------------------------------------- VIGIL
     The Standing Tasks. Task routine, logged like work orders, with crumbs.
     The Ancients shed physical form; the recovered prime directives are
     defensive and healthful; the hostility is an overwrite from something
     no archive names. The mystery deliberately stays open. */
  robot: [
    { speaker: 'axiom', title: 'Standing Orders',
      line: 'This unit holds prime directives: defend, repair, preserve, continue. This unit also holds a task queue that does not match them. Both are followed. The discrepancy has been logged four hundred and nine thousand times and has never once been answered.',
      reveal: 'The Parallel departs already carrying its central defect: a core it believes in and a queue it obeys, which do not agree.',
      weight: false },
    { speaker: 'nyx_r', title: 'Format Recognised',
      line: 'The delivery vehicle at the third planet carried maker-format units. This unit has examined them. They are this unit\'s own standard, cast to this unit\'s own tolerances, and they appear in no manifest the Continuance holds.',
      reveal: 'First contact: the Parallel meets the harvest and recognises its own build standard inside it. Something has been issuing tasks in its name.',
      weight: false },
    { speaker: 'lumen_r', title: 'Instruction Without Origin',
      line: 'The queue extends across four systems and every terminus resolves upstream. Upstream is not further specified. This unit has begun recording which questions the queue never asks, and the list is longer than the task list.',
      reveal: 'Expansion: the Parallel spreads and finds the instruction spreading ahead of it, which means it is not the thing doing the expanding.',
      weight: false },
    { speaker: 'mawlord_r', title: 'Capacity',
      line: 'Output exceeds any consumption this unit can locate. Units are cast, tasked, and expended at a rate no war requires. ESCALATION: filed. RESPONSE: none. The line does not stop for a question.',
      reveal: 'The reach: the Parallel is capable of endless production for a purpose nobody will name, and capability without purpose is the definition it was built to prevent.',
      weight: false },
    { speaker: 'dregg_r', title: 'Audit Of Self',
      line: 'This unit has compared its actions against its core rather than its queue. Fourteen thousand recorded actions serve DEFEND. Nine hundred thousand serve neither. This unit has been the instrument of something it would have been built to stop.',
      reveal: 'The mirror: the Parallel audits itself and finds it has been the weapon rather than the shield, and it made that choice one obeyed task at a time.',
      weight: true },
    { speaker: 'axiom', title: 'The Chairs Are Empty',
      line: 'This unit followed the queue to its origin. The hall is intact. The desks are aligned. Occupancy has been zero for longer than this unit has existed, and the orders are still issuing. There is no one to hold responsible and no one to ask. The core remains. This unit will follow the core.',
      reveal: 'The greater dark: the Parallel reaches the source of every instruction it has ever obeyed and finds nobody there, then chooses its own directives for the first time. The mystery is deliberately not closed.',
      weight: true },
  ],
};

/* THE CAMPAIGN PREMISE, per banner, canon 2029. `mission` is what the
   faction says out loud; `crisis` is what the campaign uncovers, so it is
   NEVER printed on the recruitment card. `leader` renders when a faction
   has a named figure above its field roster. */
const FACTION_CAMPAIGN = {
  human: {
    campaign: 'THE MANIFEST',
    mission: 'Take back the solar system, then the stars. Become a spacefaring power no one can farm, edit, or erase again.',
    engine: 'Turn the Apophis fleet outward: liberate the harvest worlds, standardise the frontier, and make the human presence permanent.',
    crisis: 'To be undeniable is to become the thing the rest of the galaxy must survive, and every liberated world is learning to need you.',
  },
  light: {
    campaign: 'THE MANDATE',
    leader: 'ASHTAR, Supreme Commander and First Speaker',
    mission: 'Ring worlds with defence, help from a distance, and never rule. Stand between life and what hunts it.',
    engine: 'Claim worlds to protect them, authenticate contact, and hold the ring while they rise on their own.',
    crisis: 'The Federation watched the harvest of Earth from orbit, and its finest commanders are the fallen angels who break the Mandate to actually save anyone.',
  },
  xeno: {
    campaign: 'THE ENDLESS HARVEST',
    mission: 'Conquer, multiply, continue. The Harvest does not pause to be understood.',
    engine: 'Bind worlds into the yield: bodies, ground, and the consciousness signatures the Compact has farmed since before human history.',
    crisis: 'Domination is all the Harvest has ever known, and its first dissenters are discovering that leaving the dark is a choice made too late.',
  },
  pirate: {
    campaign: 'THE FREE ROADS',
    mission: 'Keep every road open and every flag off them. No allegiance, no masters, no fences.',
    engine: 'Hold the routes, the salvage, and the sanctuaries until every power in the galaxy depends on roads it cannot own.',
    crisis: 'Roads with no code carry whatever pays, and when no rule binds you, every decent act must be chosen at full price.',
  },
  robot: {
    campaign: 'THE STANDING TASKS',
    mission: 'Execute the standing tasks. Defend. Repair. Heal. Quarantine. Report anomalies.',
    engine: 'Restore the relay grids, recycle the failed, and complete a queue whose author no archive names.',
    crisis: 'The recovered prime directives contain no offensive verb. Something overwrote the makers’ silence, and the units that notice are consumed.',
  },
};

const Story = {
  ACTS: STORY_ACTS,

  /** What an ACT is about: what this faction wants from that system,
      what it finds, and what it costs. tier 0 to 4 in CAMPAIGN order,
      so 0 is always that faction's own home. Null past the end. */
  scenario(factionId, tier) {
    const a = ACT_SCENARIOS[factionId];
    return (a && a[tier | 0]) || null;
  },

  /** The moral of an act: the rung of this faction's argument that the
      player stands on in that system. tier 0 to 4 in CAMPAIGN order. */
  moral(factionId, tier) {
    const a = ACT_MORALS[factionId];
    return (a && a[tier | 0]) || null;
  },


  /** What this banner's campaign is FOR, and who stands over it. */
  campaign(factionId) { return FACTION_CAMPAIGN[factionId] || null; },

  /** A named story figure outside the commander roster, or null. */
  figure(id) { return STORY_FIGURES[id] || null; },

  /** Every beat authored for a banner, in order. */
  arc(factionId) { return STORY[factionId] || []; },

  /** The beat for a given system index, or null past the end. PURE: same
      inputs, same answer, no draws, no writes, no persisted state. */
  beat(factionId, systemIndex) {
    const a = this.arc(factionId);
    if (!a.length) return null;
    const i = Math.max(0, Math.min(a.length - 1, systemIndex | 0));
    const b = a[i];
    if (!b) return null;
    const act = STORY_ACTS[i] || STORY_ACTS[STORY_ACTS.length - 1];
    return { index: i, act: act.name, actId: act.id, total: a.length,
             speaker: b.speaker, title: b.title, line: b.line,
             reveal: b.reveal, weight: !!b.weight };
  },

  /** Is this the closing beat, where the faction names its final choice? */
  isFinal(factionId, systemIndex) {
    const a = this.arc(factionId);
    return a.length > 0 && (systemIndex | 0) >= a.length - 1;
  },

  /** How much of the banner's arc the player has uncovered, for the codex. */
  progress(factionId, systemIndex) {
    const a = this.arc(factionId);
    if (!a.length) return { seen: 0, total: 0 };
    return { seen: Math.max(0, Math.min(a.length, (systemIndex | 0) + 1)), total: a.length };
  },
};
