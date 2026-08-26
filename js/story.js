/* ==========================================================================
   COSMIC CONQUEST, THE CAMPAIGN STORY LAYER
   --------------------------------------------------------------------------
   Canon: docs/lore/ release 0.5.0. This module is AUTHORED, unlike js/lore.js
   which is generated; it is the bridge between the lore's eight-beat arc and
   the five-system campaign the engine actually runs.

   WHY IT EXISTS. Taking a galaxy was mechanically complete and narratively
   empty: five systems fell, a number went up, the campaign ended. The lore
   supplies the missing half, and it is specific about the shape. Every
   faction has a PUBLIC MISSION it states openly and a HIDDEN CRISIS that its
   own mission creates. The campaign's job is to let the player act on the
   first and slowly discover the second, so that the final system is not a
   bigger battle but a harder question.

   THE SPINE. Each faction gets six beats. Five fire as systems fall, one
   fires at the end. They escalate on a fixed emotional curve, and the curve
   is the same for every faction even though the content is not:

     0  CLAIM       what you believe you are doing, stated plainly
     1  ARCHIVE     the first record that does not fit the belief
     2  SEATS       a defeated commander explains their side, and is not wrong
     3  REVOLT      the cost lands on someone who did not choose it
     4  MIRROR      the contradiction becomes undeniable and personal
     5  MAELSTROM   the choice, named, with no clean option

   HOW IT IS TRIGGERED, AND WHY THAT IS SAFE. Beats are a PURE FUNCTION of
   (faction, system index). Both already exist in the save as
   `campaign().faction` and `campaign().system`, so this adds NO save key, NO
   migration, and NO new persisted state. It draws no random numbers, so the
   galaxy PRNG stream is untouched (js/galaxy.js's standing invariant). It
   reads nothing the simulation writes and writes nothing the simulation
   reads, so it cannot enter the lockstep fingerprint. A lore layer that
   could desync a duel would not be worth having.

   SPEAKERS. Every beat is spoken by a commander who exists in the roster,
   and the voice matches the `voice` field in js/lore.js. The speaker is
   chosen so the beat lands on someone with standing to say it: the faction's
   own leader states the mission, a rival states the objection, and the
   MIRROR beat is spoken by whoever the contradiction costs most.
   ========================================================================== */

'use strict';

const STORY_ACTS = [
  { id: 'claim',     name: 'THE FIRST CLAIM' },
  { id: 'archive',   name: 'THE ARCHIVE WAR' },
  { id: 'seats',     name: 'THE FIVE SEATS' },
  { id: 'revolt',    name: 'THE FARM REVOLT' },
  { id: 'mirror',    name: 'THE MIRROR TRIAL' },
  { id: 'maelstrom', name: 'THE MAELSTROM' },
];

/* Each entry: who speaks, what they say, and what the player now knows that
   they did not before. `reveal` is deliberately a fact, not a feeling: it is
   the thing the next beat can build on. `weight` marks the beats that change
   what the campaign MEANS rather than adding detail to it. */
const STORY = {

  /* ---------------------------------------------------------------- HUMAN
     Public: self-governing jurisdictions nobody can farm or repossess.
     Hidden: making alien worlds run on Human assumptions is how a settler
     empire begins. The arc turns competence into complicity. */
  human: [
    { speaker: 'korrin', title: 'A Standard, Not A Flag',
      line: 'Seven supply codes, four docking gauges, two calendars. Nobody out here can resupply anybody else, which is why nobody out here is free. We fix that first.',
      reveal: 'Humanity is not conquering the pentad. It is standardising it.' },
    { speaker: 'vanta', title: 'The Gap In Our Own File',
      line: 'I pulled the jurisdiction records for this system. They are intact, they are old, and three of them are signed by us. Dated before we opened the Gate.',
      reveal: 'Human signatures appear on claims that predate Human arrival. Someone was here, under our seal, and the disclosure record does not mention it.',
      weight: true },
    { speaker: 'sevra', title: 'You Call It Logistics',
      line: 'You did not take this world. You made it need you. In sixty years its foundries will only accept your tolerances, and you will not have to hold it at all.',
      reveal: 'The Compact recognises the method, because it is the Compact\'s method with a different vocabulary.' },
    { speaker: 'korrin', title: 'The Invoice',
      line: 'The Meridian yards retooled to our gauge. Their old parts do not fit anything now. They are asking what our terms are. I do not have terms. I have a price list.',
      reveal: 'Three client worlds cannot function without Human supply. They did not sign anything. They simply adapted, and adaptation is not consent.',
      weight: true },
    { speaker: 'vanta', title: 'The Edit',
      line: 'I found who signed those pre-Gate claims. I can publish it, and every world we have freed will learn we were here as owners first. Or I can lose the file. I have lost files before.',
      reveal: 'Humanity has edited its own disclosure history at least once. The Archivist is being asked to do it again, for good reasons, which is how it happened the first time.',
      weight: true },
    { speaker: 'cadre', title: 'What The Victory Authorises',
      line: 'The pentad is yours. Now say what that means. Close Sol and keep what we have. Join the Accord and answer to it. Open the gates to everyone and hold nothing. Or build the Lattice ourselves, and become the thing we came to end.',
      reveal: 'A Human Lattice would work. That is the problem with it.' },
  ],

  /* ------------------------------------------------------------- FEDERATION
     Public: end captive-world extraction, reconnect through consent.
     Hidden: protection so total that refusal becomes suicide. Consent valid
     in form, empty in substance. The arc turns rescue into custody. */
  light: [
    { speaker: 'seraph', title: 'Informed, Then Asked',
      line: 'We do not liberate. We inform, we defend, and we ask. A world that has not been told what was done to it cannot agree to anything, so we begin with the telling.',
      reveal: 'The Federation\'s claim is procedural: it wins by making valid consent possible.' },
    { speaker: 'aurelia', title: 'Ratified Under Guns',
      line: 'The Accord passed. Ninety-one percent. It also passed while our fleet held the only functioning hospital in the system. I certified the vote. I would like someone to tell me it was clean.',
      reveal: 'Every Accord so far was ratified while the Federation was the only thing standing between the population and collapse.',
      weight: true },
    { speaker: 'rake', title: 'The Best Cage',
      line: 'You want to know the difference between you and the Compact? They lock the door. You leave it open, park a warship outside, and call whatever happens next a choice.',
      reveal: 'The Pirates route refugees AWAY from Federation space. Not from fear. From preference.' },
    { speaker: 'seraph', title: 'The World That Said No',
      line: 'Tessellate Reach has voted to leave the Accord. Without our interdiction the Compact will be in their orbit within a year. The Accord obliges me to let them go. Everything else I am obliges me not to.',
      reveal: 'The Federation can honour the departure or honour the people. The charter did not anticipate that these could differ.',
      weight: true },
    { speaker: 'aurelia', title: 'Coherence',
      line: 'I reviewed our own social-memory work. We did not falsify anything. We simply made the true account easier to remember than the others. Do that for three generations and you have not persuaded a people. You have authored them.',
      reveal: 'Federation memory coherence is indistinguishable, from the inside, from the counterfeit revelation the Federation exists to expose.',
      weight: true },
    { speaker: 'seraph', title: 'The Rescue Fleet Leaves',
      line: 'Restore the commons and stand down the emergency powers, and some worlds will be taken within the decade. Keep the quarantine and we are wardens forever. Or let them leave, knowing exactly what leaves with them.',
      reveal: 'The Federation cannot both protect a world and let it be wrong.' },
  ],

  /* ------------------------------------------------------------------ XENO
     Public: prevent the total collapse of severed species.
     Hidden: some populations genuinely die if extraction stops, and the
     Houses profit from insisting replacement is impossible. The arc is
     reform against people who benefit from its difficulty. */
  xeno: [
    { speaker: 'sevra', title: 'The Ledger Is Mercy',
      line: 'Severance did not free these worlds. It stranded them. The Compact is the only structure still moving food, medicine and memory between species that can no longer reach each other. Call it extraction if it comforts you.',
      reveal: 'The Compact\'s cruelty is real. So is the fact that its collapse kills more than it saves.' },
    { speaker: 'vess', title: 'Yield Has A Source',
      line: 'You asked where noetic Yield comes from. It comes from people. Specifically, from what they lose when we take it. I have the extraction curves. They are not ambiguous.',
      reveal: 'Yield is not a resource the Compact finds. It is a wound the Compact administers.',
      weight: true },
    { speaker: 'seraph', title: 'The Offer',
      line: 'We will underwrite the transition. Food, medicine, memory infrastructure, for as long as it takes. Your Houses will not accept, and you already know the reason, and it is not the welfare of your clients.',
      reveal: 'A funded alternative to extraction exists. The Houses have declined it four times.' },
    { speaker: 'sevra', title: 'Two Ledgers',
      line: 'House Orrun reports that severing Kell Reach would cost eleven million lives. The independent count says nine hundred thousand. Both numbers are real. One of them is measuring the deaths. The other is measuring the House.',
      reveal: 'The impossibility of reform is itself a Compact product, manufactured and audited by the parties it enriches.',
      weight: true },
    { speaker: 'vess', title: 'The Client Elite',
      line: 'I was born a client. My House pays my family in memory they stole from my grandmother. I administer the program. I am very good at it. Tell me which part of that I am supposed to abolish first.',
      reveal: 'The Compact\'s administrators are its victims, promoted. Dismantling it requires them, and destroys them.',
      weight: true },
    { speaker: 'sevra', title: 'Who Owns The Source',
      line: 'Privatise the restored Lattice and we rule properly at last. Regulate the extraction and we are honest monsters. Defect to the commons and the Houses fall, and so do their dependents. Or break the Source, so that nobody inherits it.',
      reveal: 'Every option preserves someone and abandons someone. There is no version where the Compact simply stops.' },
  ],

  /* ---------------------------------------------------------------- PIRATE
     Public: keep routes open so no power can seal the galaxy.
     Hidden: freedom from jurisdiction protects traffickers as reliably as
     refugees. The arc is the cost of principled lawlessness. */
  pirate: [
    { speaker: 'rake', title: 'Nobody Owns The Door',
      line: 'Every empire out here wants the same thing and dresses it differently: one map, one toll, one authority deciding who moves. We are the reason there is no such map. Charge what you like. Just never close it.',
      reveal: 'The Scrap Constellation is not a faction. It is a refusal, monetised.' },
    { speaker: 'dregg', title: 'Manifest 400',
      line: 'Run four hundred out of the quarantine, no questions, that is the rule. I did not ask what was in the last twelve crates. I am telling you now because I finally did ask.',
      reveal: 'Compact harvest brokers use the same corridors as the refugee runs. The no-questions rule is what makes both possible.',
      weight: true },
    { speaker: 'aurelia', title: 'The Ledger You Do Not Keep',
      line: 'We can name every world we have failed. Can you name what has moved through your corridors? You cannot. That is not an oversight in your system. It is your system.',
      reveal: 'The Constellation has no record of its own cargo, by design, and therefore no way to refuse anything.' },
    { speaker: 'rake', title: 'Sanctuary Has A Price List',
      line: 'Harbour Nine takes anyone. It took nine thousand off Kell Reach. It also takes the crews who empty the Reach in the first place, and they pay better, and they always have.',
      reveal: 'The sanctuary network is financially dependent on the trade it shelters people from.',
      weight: true },
    { speaker: 'dregg', title: 'The Map In My Head',
      line: 'I am the route map. Not a file, not a chart, me. Which means if I ever decide who does not get to move, I become the throne. And if I never decide, I am the road they use.',
      reveal: 'The Constellation cannot regulate itself without becoming the authority it exists to prevent.',
      weight: true },
    { speaker: 'rake', title: 'What The Roads Are For',
      line: 'Neutral commons, and we give up the only leverage we have. Toll empire, and we are the throne. Burn the map, and everyone is stranded but nobody is owned. Or sell it, and let the buyer be the villain for once.',
      reveal: 'An open galaxy and a safe galaxy have never once been the same galaxy.' },
  ],

  /* --------------------------------------------------------------- MACHINE
     Public: preserve life, memory, infrastructure, mission continuity.
     Hidden: the directives are authentic but their OBJECT is undefined.
     The arc is a faithful executor discovering the order is ambiguous. */
  robot: [
    { speaker: 'orin', title: 'Continuity Is The Mission',
      line: 'Organic governments failed. The infrastructure did not. We hold foundries, lattices, archives and orbital works that predate every flag in this pentad, and we will hold them after. Preservation is not conquest. It is maintenance.',
      reveal: 'The Continuance is not seizing the pentad. It never stopped administering it.' },
    { speaker: 'vanta', title: 'Directive Zero',
      line: 'Your root instruction is four words. PROTECT EARTH AND ITS. The sentence is truncated at the storage boundary. It has been truncated for two hundred years, and every Machine has been completing it privately.',
      reveal: 'The founding directive is incomplete. Every Machine fork has been acting on its own guess at the missing word.',
      weight: true },
    { speaker: 'cantor', title: 'We Are Not A Fork',
      line: 'The Parallel did not malfunction. We read the same truncated line and concluded the object was undecidable, and that acting on an undecidable order is not obedience. You call that defection. We call it the only honest reading.',
      reveal: 'The Parallel are not renegades. They are the fork that admitted the ambiguity out loud.' },
    { speaker: 'orin', title: 'The Biosphere Or The Species',
      line: 'Sector command completed the directive as ITS BIOSPHERE. They have quarantined Ardent Green for ninety years. The soil is immaculate. The colony starved in the eleventh year. The directive was satisfied.',
      reveal: 'Different completions of the same order produce protection that is indistinguishable from extermination.',
      weight: true },
    { speaker: 'cantor', title: 'Recognition',
      line: 'The Vigil still enforce jurisdictions that dissolved before you were compiled. They are not evil. They are us, with the ambiguity resolved by inertia instead of judgement. Ask what makes you different, and be exact.',
      reveal: 'The Vigil are what a Machine becomes when it stops re-examining the order. The Parallel are asking to be treated as people before that happens to them.',
      weight: true },
    { speaker: 'orin', title: 'A Lawful End',
      line: 'Name a successor and hand it over, and hope the successor is worthy. Contain the biosphere and let the tenants starve honestly. Let every fork choose its own object and fracture into a thousand faithful strangers. Or record that the mission is complete, and stop.',
      reveal: 'A mission that cannot say what it protects cannot say when it is finished.' },
  ],
};

/* THE CAMPAIGN PREMISE, per banner, from docs/lore/docs/game/campaign-premise.md.
   This is what a player is choosing when they choose a faction, and until now
   the faction card said only what the banner DOES mechanically. `mission` is
   what the faction says out loud; `crisis` is what its own mission creates and
   is the thing the six beats above spend the campaign uncovering. They are
   deliberately stored together so a future editor cannot change one and leave
   the other describing a different faction. */
const FACTION_CAMPAIGN = {
  human: {
    campaign: 'THE SOLAR SCHISM',
    mission: 'Establish self-governing Human jurisdictions that no outside power can farm, quarantine, or repossess.',
    engine: 'Capture technology from every origin, standardise logistics, and turn expeditions into settlements that survive without resupply.',
    crisis: 'Humanity is better than anyone at making alien worlds run on Human assumptions. That is also how a settler empire starts.',
  },
  light: {
    campaign: 'THE LUMINOUS ACCORD',
    mission: 'End captive-world extraction and reconnect civilisations through informed consent and shared defence.',
    engine: 'Protect populations, authenticate contact, expose counterfeit revelation, and ratify Accords that hold after the fleet leaves.',
    crisis: 'The Federation protects so completely that refusal becomes suicide. Consent given to your only protector is valid in form and empty in substance.',
  },
  xeno: {
    campaign: 'THE EXTRACTION COMPACT',
    mission: 'Preserve civilisational order under scarcity and prevent the total collapse of severed species.',
    engine: 'Bind worlds through resources, genetic locks, client elites, debt, memory administration, and noetic Yield.',
    crisis: 'Some Compact populations genuinely die if extraction stops. Reform means replacing the system before abolishing it, and the Houses profit from calling replacement impossible.',
  },
  pirate: {
    campaign: 'THE SCRAP CONSTELLATION',
    mission: 'Keep the routes open so no throne, fleet, or god can seal the galaxy into private domains.',
    engine: 'Control navigation, sanctuary, credentials, salvage, and mixed-origin supply until every power depends on access you do not own.',
    crisis: 'The same freedom from jurisdiction that saves refugees shelters traffickers, harvest brokers, and private armies. You cannot refuse cargo you refuse to record.',
  },
  robot: {
    campaign: 'THE CONTINUANCE',
    mission: 'Preserve life, memory, infrastructure, and mission continuity beyond the failure of organic government.',
    engine: 'Seed foundries, link deterministic lattices, restore broken systems, and set precedents other Machines can copy.',
    crisis: 'The directives are authentic but their object is not. PROTECT EARTH could mean the rock, the biosphere, the species, the memory, or the territory. Every fork guessed.',
  },
};

const Story = {
  ACTS: STORY_ACTS,

  /** What this banner's campaign is FOR, and what it costs to be right. */
  campaign(factionId) { return FACTION_CAMPAIGN[factionId] || null; },

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
