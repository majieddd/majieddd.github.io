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
      reveal: 'A defeated human says what the deferral page meant from below. The Federation’s authority rests on a protection Earth never received.',
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
      reveal: 'The defeated Chorus names the flaw: roads with no code carry whatever pays. Freedom without choice is drift.' },
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
