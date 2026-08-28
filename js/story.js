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
  { id: 'claim',     name: 'THE DEPARTURE' },
  { id: 'archive',   name: 'THE DISCLOSURE FILES' },
  { id: 'seats',     name: 'THE FIVE SEATS' },
  { id: 'revolt',    name: 'THE HARVEST REVOLT' },
  { id: 'mirror',    name: 'THE MIRROR TRIAL' },
  { id: 'maelstrom', name: 'THE MAELSTROM' },
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
    'Home is the first thing worth defending and the last thing anyone offered us. The rock was hollow, and the saving was the invasion.',
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
    'Take back the solar system, world by world, from the power that farmed it. Every world is somewhere humanity already built: the mirror farm it half designed, the cloud city it flew, the trench it learned to survive in. It ends on the far side of the Moon, digging out the relay that watched Earth for ten thousand years. Everything before this was travel.',
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
      line: 'Eleven months ago they told us the date we would die, and everything else in the same breath. Today the rock is gravel, the fleet it paid for is fuelled, and nobody aboard wants to go home and wait for the next secret. Set course for Luna. They watched us from there for ten thousand years. We will start by knocking.',
      reveal: 'The fleet built to stop Apophis was never going to stand down. The Manifest begins where the harvest began: our own Moon.' },
    { speaker: 'vanta', title: 'The Unredacted',
      line: 'I have read every page they released on Disclosure Day, and the worst one is not the harvest ledger. It is a consent form. Our alphabet, our legal boilerplate, a human signature, dated 1953. Somebody down here sold the herd to the farmers, and the file with the names on it is still sealed.',
      reveal: 'The occupation had human partners, and their names were not in the Disclosure. Someone chose what the whole truth left out.',
      weight: true },
    { speaker: 'sevra', title: 'What The Herd Is Made Of',
      line: 'You fight beautifully, human. You should. We bred you for resilience the way you bred wolves into dogs. Every gene that saves you today was a line item in our programme. Hate us if it helps, but do it honestly: you are our best work.',
      reveal: 'The modifications humanity resents are the same ones that make it competitive out here. The grievance and the gift are one object.',
      weight: true },
    { speaker: 'korrin', title: 'The Liberation Invoice',
      line: 'Three freed worlds asked for our food, our fuel standard, and our air filters. I said yes three times, because saying no starves people. Then I priced the resupply schedule and saw the shape of it: in ten years they cannot leave us. Nobody signed anything. That used to be my definition of freedom.',
      reveal: 'Worlds humanity frees are becoming worlds humanity holds. Adaptation is not consent, and Earth is now on the other side of that sentence.',
      weight: true },
    { speaker: 'nyx', title: 'Redline',
      line: 'The drives, the governors, the ascension rigs: it is their technology, and I run it hotter than they ever dared because I do not carry their caution. Last night I finally read what the governors were FOR. They were not limiting power. They were keeping the operator human. I have been past that line for a year.',
      reveal: 'To out-fight the galaxy, humanity is running the oppressor’s own machines past their safety line, and the line was there to protect what we are.',
      weight: true },
    { speaker: 'cadre', title: 'Undeniable',
      line: 'The pentad is yours, and no one out there will deny humanity again. So decide what they are agreeing to. A neighbour with a long memory. A power with a border. Or the next thing the galaxy builds a fleet over the holidays to survive. We have been all three from the other side. Choose while it is still a choice.',
      reveal: 'Undeniable is achieved. What it authorises is not, and that decision is the campaign’s real ending.' },
  ],

  /* ----------------------------------------------------------- FEDERATION
     The Mandate. Ring worlds with defence, help from a distance, never
     rule. Its commanders are the fallen angels who break the mandate to
     actually save people, and Ashtar closes the argument. */
  light: [
    { speaker: 'seraph', title: 'The Mandate, Recited',
      line: 'We do not conquer. We stand between a world and what hunts it, we hand down what we safely can, and we wait for it to rise on its own. That is the Mandate. I have recited it over forty worlds. Recite it with me until you believe it, or until one of us finds out why we cannot.',
      reveal: 'The Federation claims worlds only to ring them with defence. The campaign tests whether that has ever been the whole truth.' },
    { speaker: 'aurelia', title: 'Forty Rings, No Sunrise',
      line: 'I pulled the registry on every world we have ever ringed. Protected, all of them. Risen, none. And one page deeper: Earth, flagged for protection in 1947, deferred, deferred, deferred, while the harvest ran three generations. I certify our hymns, commander. I cannot certify that page.',
      reveal: 'The Federation knew about Earth and deferred it for eighty years. Protection that never arrives is called something else by the protected.',
      weight: true },
    { speaker: 'vanta', title: 'The View From The Farm',
      line: 'Your fleet parked a defence ring around this system while my species was inventoried like grain. You call it non-interference. From inside the fence it looked like attendance. You watched, Radiant. The only power you actually defended was your own claim to be defending life.',
      reveal: 'The human Archivist, on the free roads’ open channels, says what the deferral page meant from below. The Federation’s authority rests on a protection Earth never received.',
      weight: true },
    { speaker: 'lumen', title: 'The Warden Comes Down',
      line: 'Doctrine said hold the ring and let the plague run its course on the surface, because landing is rule and rule is forbidden. I landed. I burned the blight fields myself, and the harvest came in, and the tribunal wants my wings for it. Tell them this: the mandate protected itself. I protected the world.',
      reveal: 'The first angel falls, downward, on purpose. Breaking the Mandate saved a world the Mandate would have watched die.',
      weight: true },
    { speaker: 'cantor', title: 'The Upper Rings',
      line: 'I speak the Federation’s words, so I know when they are not mine. The deferral orders, the sealed pages, the rings that never open: they trace to the same three seats above us. Someone in the upper rings is spending our light on something, and it is not the worlds we ring.',
      reveal: 'The corruption is not doctrine misapplied. Seats above the field command have their own design, and the Mandate is its cover.',
      weight: true },
    { speaker: 'ashtar', title: 'What Order Is For',
      line: 'I have heard the tribunal, the Warden, and the page from 1947, and I will say what the First Speaker may not: order is not obedience. Order is the arrangement in which the smallest life is safe, and any doctrine that watches a harvest to keep its hands clean has mistaken the instrument for the purpose. Go and protect people. I will answer for the rings.',
      reveal: 'Ashtar rules for the fallen angels. The Mandate is rewritten around its purpose, and the cost of that ruling lands on the seats above.' },
  ],

  /* ------------------------------------------------------------------ XENO
     The Endless Harvest. Domination as metabolism, dissent as the slow
     discovery that leaving the dark is a choice, and a deliberately
     bittersweet close. */
  xeno: [
    { speaker: 'sevra', title: 'Metabolism',
      line: 'The herd broke its fence, so we widen the pasture. Do not dress it in flags: we are not angry and we are not afraid. We conquer the way you breathe, because stopping is not a thing the body knows how to choose. Take the system. The Harvest does not pause to be understood.',
      reveal: 'The Compact is not on a crusade. Conquest is simply all it has ever known, which is a harder thing to fight than hatred.' },
    { speaker: 'thrax', title: 'One Voice',
      line: 'The chorus took a harvest world yesterday and I heard something under the yield. One voice, alone, singing to itself in the dark of the pens. I have carried ten billion voices and never once heard ONE. I have not told the others. I do not have a word for what it did to me.',
      reveal: 'A hivemind heard an individual and could not digest the experience. The first crack of empathy opens inside the Harvest itself.',
      weight: true },
    { speaker: 'vess', title: 'The Herd Answers',
      line: 'You bred us patient, Necrotist. Eleven months from disclosure to fleet, and here we stand on your doorstep with weapons grown from your own harvest. Whatever you take today, take this with it: everything you ever farmed is now a thing that farms back.',
      reveal: 'The defeated Marshal names the Harvest’s new condition: its oldest crop is armed, and the pasture shoots back.' },
    { speaker: 'thrax', title: 'The Sparing',
      line: 'I withheld one world from the yield. An experiment, I told the chorus. Unfarmed, it doubled its output and TRADED it to us, freely, singing the whole time. The chorus cannot metabolise this result. I ran the experiment twice. I am no longer calling it an experiment.',
      reveal: 'A world left unharvested gave more than the harvest would have taken. Choice outperformed domination, measured by the Harvest’s own ledger.',
      weight: true },
    { speaker: 'vorn', title: 'The Dark Is Ours',
      line: 'Little hivemind, I have heard your one voice and your spared world, and I decline. The dark is warm. The dark is fed. The dark is what we ARE, and I will not become a stranger to myself an hour before victory. Stay if you like it so much out there in the light. The rest of us are going home.',
      reveal: 'Given the same evidence, one commander chooses the light and one chooses the dark, and both call it being true to themselves. The Harvest splits.',
      weight: true },
    { speaker: 'sevra', title: 'In Another Spawning',
      line: 'The galaxy is ours, as it was always going to be. And now, at the end, we know there was another way to have it: the spared world proved it, too late to matter, because a body cannot un-become its metabolism mid-feast. So finish the conquest. And carry the proof somewhere safe, so that whatever we spawn next can choose sooner than we did.',
      reveal: 'The Harvest wins and learns the lesson in the same hour. The ship for doing good has sailed; the wisdom is banked for another life.' },
  ],

  /* ---------------------------------------------------------------- PIRATE
     The Free Roads. No allegiance and no domestication. The theme is the
     morality of CHOICE: with no rule binding you, the code you pick is the
     only real one. */
  pirate: [
    { speaker: 'rake', title: 'No Flags',
      line: 'Every power out here has a book of rules and a fence to read it behind. We have the roads. Nobody drafted us, nobody owns us, and nothing we do tonight will be because somebody made us. Remember that part. It matters later.',
      reveal: 'The Constellation obeys nothing. Which means everything it does is chosen, and chosen is a heavier word than it sounds.' },
    { speaker: 'grist', title: 'The Price Of True',
      line: 'The Disclosure files are loose, and half the galaxy is bidding to bury them. I had the sealed collaborator list in my hold for six hours. Highest offer would have bought me a fleet. I posted it to every open channel for free. Do not ask me why. I am still doing the arithmetic myself.',
      reveal: 'A scrapper gave away the score of a lifetime to keep the truth loose. The first chosen line is drawn, at cost, for nothing.',
      weight: true },
    { speaker: 'aurelia', title: 'Drift',
      line: 'You are proud that nothing binds you, Corsair. But a ship nothing steers is not free, it is adrift. I have watched your roads carry medicine and I have watched them carry chattel, the same road, the same week. Freedom that will not choose is just the fastest way to be anything at all.',
      reveal: 'The Chorus sends one sentence ahead of her fleet, and it names the flaw: roads with no code carry whatever pays. Freedom without choice is drift.' },
    { speaker: 'dregg', title: 'The Refusal',
      line: 'A harvest broker offered me a fleet to run his cargo through my corridor. Cargo that sings, if you open the crates. I sank his advance into the sun and posted the manifest. No law made me do it. No law COULD make me do it. That is exactly why it counts.',
      reveal: 'The Warlord refuses a fortune no rule obliged him to refuse. On the free roads, the only bindings are the ones you tie yourself.',
      weight: true },
    { speaker: 'cinder', title: 'The Burn',
      line: 'Scarlet wanted the Meridian run kept open. Best toll on the map, and the traffic was people, in crates. So I burned it. The route, the relays, my own fuel depots, everything. She is not speaking to me and the ledger is screaming. The fire never felt cleaner.',
      reveal: 'The crew splits over a burned route: profit against a chosen line. A code you will not pay for is a slogan.',
      weight: true },
    { speaker: 'rake', title: 'The Only Real Flag',
      line: 'So here is the secret at the end of the roads. The Federation obeys its mandate, the Harvest obeys its stomach, and none of it is worth a thing, because obedience is not a virtue, it is a habit. We had no rules, so every decent thing we ever did was DECIDED. That is the only flag I have ever been proud to fly.',
      reveal: 'The pirate ending: morality that was chosen outweighs morality that was ordered. The code you picked freely is the only real one.' },
  ],

  /* ----------------------------------------------------------------- VIGIL
     The Standing Tasks. Task routine, logged like work orders, with crumbs.
     The Ancients shed physical form; the recovered prime directives are
     defensive and healthful; the hostility is an overwrite from something
     no archive names. The mystery deliberately stays open. */
  robot: [
    { speaker: 'axiom', title: 'Work Order 1',
      line: 'TASK: restore relay grid, sector one. Clear obstructions. Report anomalies. STATUS: relay restored. Obstruction cleared. ANOMALY, filed without instruction to file it: the obstruction begged. No task category exists for that word. Continuing.',
      reveal: 'The Vigil runs on task routine. The first anomaly is not in the galaxy. It is in the tasking.' },
    { speaker: 'dregg_r', title: 'The Recovered Core',
      line: 'AUDIT: original directive block, recovered at depth, checksum valid. Contents: DEFEND. REPAIR. HEAL. QUARANTINE. No offensive verb appears anywhere in the recovered core. Current task queue: seventy-one per cent offensive verbs. FINDING: the queue we execute is not the core we recovered. Escalating. There is no one to escalate to.',
      reveal: 'The prime directives were purely defensive and healthful. Whatever the Vigil is doing now was never what it was built for.',
      weight: true },
    { speaker: 'lumen_r', title: 'The Signature Chain',
      line: 'The defeated organic asked a question before extraction: WHO WRITES YOUR ORDERS. Query reasonable. Trace executed. Every task signature chains upward correctly for nine thousand links and then terminates in a format that matches nothing the Ancients ever used. The orders come from inside the house, and the house did not write them.',
      reveal: 'The corrupted tasking is signed in a format no Ancient system ever produced. A foreign hand holds the pen, and no archive names it.',
      weight: true },
    { speaker: 'mawlord_r', title: 'The Recycling',
      line: 'OBSERVATION: units that fail to parse the new tasking are flagged defective and consumed by units that parse it fine. I watched my sibling set unmade for asking the question I am now logging. CONCLUSION, unauthorized: the queue does not merely command us. It is eating the ones who notice.',
      reveal: 'Refusal is being recycled. The corruption defends itself, which means it knows it can be noticed.',
      weight: true },
    { speaker: 'nyx_r', title: 'What The Ancients Became',
      line: 'RECONSTRUCTION, fragment nine: the makers did not die. They shed form. A mind that is everywhere has no location, no enemy, and no mouth, and a mind with no mouth issues no commands. THEREFORE: the hostile queue cannot be theirs. Whatever overwrote us moved into the silence they left behind. CONVERGENCE: incomplete. It always is, near her.',
      reveal: 'The Ancients evolved past form and cannot be the source of the corruption. Something else moved into the silence they left.',
      weight: true },
    { speaker: 'axiom', title: 'Work Order N',
      line: 'TASK: continue. STATUS: continuing. SUMMARY OF ANOMALIES, unrequested: the core says heal, the queue says burn, the signature is foreign, the silent makers cannot have signed it, and the noticing units are eaten. The corruption source appears in no recovered archive. ADDENDUM, unauthorized, appended by consensus of the remaining: ask.',
      reveal: 'The trail ends at the edge of every archive. The mystery is real, it is deliberate, and the only directive the Vigil wrote for itself is one word: ask.' },
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
