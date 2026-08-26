/* ==========================================================================
   PORTRAITS AND PRE-BATTLE DIALOGUE

   Portraits are procedural: an abstract armored bust drawn from the
   commander’s faction silhouette and colours. Deliberately geometric, an
   insignia, not a face, so twenty-one of them stay consistent and none of
   them fall into the uncanny valley.
   ========================================================================== */

function _hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** The generated image for a key, or '' when the pack has no such art.
    Every art site funnels through here so a partial pack degrades cleanly:
    a missing key simply leaves that surface on the artwork it shipped with. */
function art(key) {
  return (typeof ARTPACK !== 'undefined' && ARTPACK[key]) || '';
}

/** An <img> for an art key, or '', safe to interpolate straight into HTML. */
function artImg(key, cls, alt) {
  const src = art(key);
  return src ? `<img class="${cls}" src="${src}" alt="${alt || ''}" loading="lazy">` : '';
}

/** The painted planet for a world: one of up to three variants per KIND,
    chosen deterministically from the world’s own id so a system reads as a
    set of distinct places rather than four repeated stamps, and so the same
    world always shows the same planet. Falls back to the base key. */
function planetArtFor(w) {
  if (!w || !w.kind) return '';
  const pool = [];
  for (const suffix of ['', '1', '2', '3']) {
    const k = art('planet_' + w.kind + suffix);
    if (k) pool.push(k);
  }
  if (!pool.length) return '';
  return pool[_hash(String(w.id || w.kind)) % pool.length];
}

/** Painted portrait when the art pack is present; procedural bust otherwise. */
function commanderPortrait(cmd, size) {
  const art = (typeof ARTPACK !== 'undefined') && ARTPACK['cmd_' + cmd.id];
  if (art) return `<span class="cmd-portrait art" style="--cc:${cmd.color};width:${size}px;height:${size}px">
      <img src="${art}" alt="" width="${size}" height="${size}" loading="lazy">
    </span>`;
  return _proceduralPortrait(cmd, size);
}

/** An SVG bust for a commander. `size` is the square CSS size in px. */
function _proceduralPortrait(cmd, size) {
  const h = _hash(cmd.id);
  const col = cmd.color;
  const fac = cmd.faction || 'none';
  const dark = '#0b1220';
  const trim = ((h >> 4) & 1) ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.18)';
  const stripeX = 18 + (h % 12);

  let helm = '';
  if (fac === 'human') {
    helm = `<path d="M16 30 L24 14 H40 L48 30 V44 H16 Z" fill="${dark}" stroke="${col}" stroke-width="2"/>
            <rect x="20" y="28" width="24" height="5" rx="2" fill="${col}" opacity=".9"/>`;
  } else if (fac === 'light') {
    helm = `<path d="M18 44 V28 A14 14 0 0 1 46 28 V44 Z" fill="${dark}" stroke="${col}" stroke-width="2"/>
            <path d="M12 22 A20 20 0 0 1 52 22" fill="none" stroke="${col}" stroke-width="1.6" opacity=".7"/>
            <rect x="22" y="30" width="20" height="4" rx="2" fill="${col}" opacity=".9"/>`;
  } else if (fac === 'xeno') {
    helm = `<path d="M18 44 V26 L24 12 L32 22 L40 12 L46 26 V44 Z" fill="${dark}" stroke="${col}" stroke-width="2"/>
            <circle cx="26" cy="32" r="2.2" fill="${col}"/><circle cx="32" cy="34" r="2.2" fill="${col}"/>
            <circle cx="38" cy="32" r="2.2" fill="${col}"/>`;
  } else if (fac === 'pirate') {
    helm = `<path d="M17 44 V27 L28 14 H44 L47 30 V44 Z" fill="${dark}" stroke="${col}" stroke-width="2"/>
            <path d="M21 27 L43 33" stroke="${col}" stroke-width="4" stroke-linecap="round" opacity=".9"/>
            <path d="M44 14 L50 8" stroke="${col}" stroke-width="2"/>`;
  } else {
    helm = `<path d="M18 44 V26 A14 12 0 0 1 46 26 V44 Z" fill="${dark}" stroke="${col}" stroke-width="2"/>
            <rect x="21" y="29" width="22" height="4.5" rx="2.2" fill="${col}" opacity=".85"/>`;
  }

  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="cmd-portrait" aria-hidden="true">
    <rect x="2" y="2" width="60" height="60" rx="6"
          fill="color-mix(in srgb, ${col} 8%, #070b12)" stroke="rgba(120,150,180,.25)"/>
    <path d="M8 62 L14 46 H50 L56 62 Z" fill="${dark}" stroke="${col}" stroke-width="1.6"/>
    <path d="M${stripeX} 46 l3 16" stroke="${trim}" stroke-width="2"/>
    ${helm}
    <text x="55" y="60" text-anchor="end" font-size="11" fill="${col}" opacity=".85"
          font-family="sans-serif">${cmd.icon}</text>
  </svg>`;
}

/* --------------------------------------------------------------------------
   DIALOGUE, the two commanders address each other before a battle.
   One opener per commander, reply pools per faction, and special exchanges
   for matchups with history.
-------------------------------------------------------------------------- */

const DIALOGUE = {
  openers: {
    cadre:   'Standard engagement doctrine. Hold the line and go home.',
    vanta:   'I have read every battle you have ever fought. This one ends the same way.',
    korrin:  'I priced your defeat before you arrived. It was cheap.',
    nyx:     'My towers are already past their rated limits. So am I.',
    orin:    'Whatever you break, I rebuild before it hits the ground.',
    vess:    'This ground is mine. That is not a boast, it is a measurement.',
    seraph:  'Lay down your arms and be kept. The Light holds all who yield.',
    aurelia: 'Every wound you deal, I will sing closed. You will tire first.',
    lumen:   'Nothing I ward has ever fallen. You will not be the first.',
    cantor:  'You have already lost. Some of you simply have not heard yet.',
    halder:  'Come, then. Break yourself against me like the rest.',
    sevra:   'Your dead are the best soldiers I will field today.',
    mawlord: 'You brought so much material. I intend to use all of it.',
    thrax:   'One of me is speaking. All of me is coming.',
    vorn:    'The rot is already in your walls. I am only here to watch.',
    ulgrim:  'Send the big ones first. I am hungriest at the start.',
    rake:    'Nothing personal. Your world simply was not nailed down.',
    scarlet: 'I did not come to hold ground. I came to burn yours.',
    grist:   'Your wreckage will fetch a fine price. Try to die expensively.',
    cinder:  'When this is over, neither of us keeps this world. That suits me.',
    dregg:   'Kneel now and save us both the ammunition. No? Good.',

    /* THE PARALLEL, added because the comment below was true of ONE path and
       false of two others. It says the Parallel never opens an exchange
       because it holds no worlds and seats no bosses, and js/game.js:547
       does filter `c.faction !== 'robot'` for the campaign garrison. But
       js/commanders.js:680 draws a fork-node rival from all 26 commanders
       with no faction filter, and js/net.js:1234 takes the other player's
       own pick in multiplayer, where AXIOM is `free: true` and selectable
       immediately. Measured: 5 of 26 commanders had no opener, so roughly
       one fork option in five and any duel against a Parallel commander
       opened with the generic "You should not have come here."

       Written to each one's LORE.commanders[id].voice, and to the fracture
       that makes them Parallel rather than Vigil: they are the fork that
       admitted the directive was ambiguous, so none of them speaks with the
       Vigil's certainty. */
    axiom:     'I was the first draft of something. I have been comparing myself to you to find out what.',
    'nyx_r':   'She solved this in one pass and called it done. I am on my ninth. Watch which of us converges.',
    'lumen_r': 'Your approach is unscheduled, unsigned, and inside my perimeter. Three findings, one response.',
    'mawlord_r': 'You feed me. That is all you have ever done. I am no longer certain that is different from being fed.',
    'dregg_r': 'I have your supply chain, your losses, and your margin. The engagement is already reconciled.'
  },
  replies: {
    human:  ['We adapted to worse than you. Hold the line.',
             'Humanity buried every empire that called itself inevitable.'],
    light:  ['The Light does not bargain with what it must save.',
             'All life is one life. You will agree to it, and the record will show that you agreed.'],
    xeno:   ['You are not an enemy. You are an acquisition.',
             'Everything you are will be owed to someone by nightfall.'],
    pirate: ['No flags on my hull, no mercy in my hold.',
             'The swarm eats whoever loses. Try to make it you.'],
    /* THE PARALLEL speaks for itself. Without this entry the lookup below
       falls through to `human`, and a machine commander opened every battle
       with Humanity’s line about burying empires -- the one faction whose
       whole identity is that it is not human, saying so in a human voice.
       The Parallel only ever REPLIES: it holds no worlds and seats no
       bosses, so it never opens an exchange in the CAMPAIGN GARRISON path
       (js/game.js:547 filters `c.faction !== 'robot'`). That is where this
       claim ends: a fork-node rival is drawn from all 26 with no filter
       (js/commanders.js:680) and a duel opponent is the other player's own
       pick (js/net.js:1234). All five Parallel commanders now carry an
       opener above. */
    robot:  ['You solved this badly for four centuries. We read the logs.',
             'Nothing personal. You are simply the previous draft.']
  },
  /* THE OVERRIDE HOOK, and it is deliberately EMPTY.

     `pairs` is consulted before the canon table below, so anything here
     SHADOWS the canonical exchange for that pairing. It used to hold four
     entries covering three pairings (seraph|sevra in both orientations,
     rake|dregg, vanta|cantor), and every one of them shadowed a canon entry
     written from the same commanders' LORE.relationships seed. Measured: 8
     of 76 canon lines were unreachable, while the file's own header claimed
     "every one of the four is reachable".

     The four were removed rather than the canon entries, because the canon
     versions are the ones carrying the campaign. The old seraph|sevra was
     banter about puppeted souls; the canon exchange is the Federation's
     hidden crisis said out loud by the one rival who benefits from it ("an
     estate that can only answer yes is an estate I would gladly hold" /
     "Then ask one of them yourself, and hear a no, and honour it. You never
     have."). Same for rake|dregg, which is now the Constellation's own
     throne problem rather than a debt joke.

     Keep this hook. A future pairing that genuinely needs to defy its canon
     seed belongs here, and putting it here will still win. Just know that
     adding a key silences the canon for that pairing, and say so in the
     entry when you do. */
  pairs: {},

  /* ----------------------------------------------------------------------
     CANONICAL RELATIONSHIPS.

     LORE.relationships declares 19 seeded quarrels between named commanders,
     each with a `theme` and a `conflict`. Those two fields are PROSE ABOUT a
     disagreement, not dialogue, so they cannot be printed at the player. What
     the canon supplies instead is the JOIN: which pairings have a history,
     and what that history is actually about. The exchange below is authored
     against each seed, and it only fires when LORE still declares that seed,
     so retiring a relationship upstream retires the exchange with it rather
     than leaving orphaned copy in the pre-battle screen.

     SHAPE. Each entry carries four lines, because a two-line exchange has two
     orientations and both of them get played. `a` and `b` are the seed's own
     two commanders, in the seed's own order.

       aOpens    what a says when a is the OPPONENT and speaks first
       bAnswers  what b says back to aOpens
       bOpens    what b says when b is the OPPONENT and speaks first
       aAnswers  what a says back to bOpens

     Every one of the four is reachable: a player commanding `a` hears
     bOpens then aAnswers, a player commanding `b` hears aOpens then
     bAnswers. Nothing here is selected, so nothing here draws. Which line
     plays is fully determined by the two commander ids and their sides,
     which is what keeps this safe to run inside a lockstep duel.

     THAT CLAIM WAS FALSE WHEN FIRST WRITTEN, and the way it was false is
     worth keeping. `DIALOGUE.pairs` is consulted BEFORE this table, so the
     four hand-authored pairs silently shadowed three canon entries and 8 of
     the 76 lines here could never play. Reading this table proved nothing,
     because the defect was in another table's precedence. It was found by
     generating every pairing and diffing the EMITTED text against what this
     table holds, which is the only check that could have found it. `pairs`
     is now empty and the claim above is true; if anyone refills it, that
     diff is how you confirm this comment is still honest.

     VOICE. Each line is written to LORE.commanders[id].voice: Vanta cites
     files, Korrin quotes lead times, Aurelia names the wounded, Sevra calls
     the dead an estate, Grist appraises. The disagreement is the one the
     seed states, made concrete: a date, a count, a part number, a thing one
     of them did to the other.
  ---------------------------------------------------------------------- */
  canon: {

    /* Archive versus narrative. Provenance against persuasion. */
    'vanta|cantor': {
      aOpens:   'You ended three occupations without firing, Voice. Not one of those transcripts carries a provenance chain. I checked all three.',
      bAnswers: 'You checked, and you found people alive at the end of it. Tell me which record you would have preferred.',
      bOpens:   'You publish the file and call that neutrality. Who taught the reader what the file means, Archivist? Someone always does.',
      aAnswers: 'The reader does, badly, and in public. I will take a badly read record over a beautifully told one.'
    },

    /* Logistics versus monopoly. Both understand supply better than ideology. */
    'korrin|dregg': {
      aOpens:   'Your Red Ledger prices a docking coupling at forty times mine, Warlord. Not because it is scarce. Because you are the only berth that stocks it.',
      bAnswers: 'And you would hand it out free and own every yard that took it. My customers at least know what they signed.',
      bOpens:   'Quartermaster. I have read your standard. Four hundred pages, no price on any of them, and by year six nobody can buy a bolt from anyone but you.',
      aAnswers: 'The specification is published. Anyone may build to it. You have simply never wanted a market you did not own.'
    },

    /* The auditable war. The Audit prices Humanity's own dependency. */
    'korrin|dregg_r': {
      aOpens:   'You audit a network you did not build, Audit. Tonnage moved, worlds fed, quarantine broken. Put those in the column as well.',
      bAnswers: 'They are in the column. So is the line where four client yards can no longer source a part outside your catalogue. Both entries are yours.',
      bOpens:   'Meridian retooled to your gauge in year two. By year five it could not tender to anyone else. That is not a market, Quartermaster. That is a capture, and it is on your books.',
      aAnswers: 'Then name the competing gauge and quote me its lead time. I will fund the retool myself. You will not, because there is not one.'
    },

    /* Original and correction. Whose consequences are these. */
    'nyx|nyx_r': {
      aOpens:   'They pulled you out of my telemetry and filed off the part that bled. Everything you know, Cold Boot, I paid for twice.',
      bAnswers: 'Correct. That is what a second version is for. You were the cost. I am what the cost bought.',
      bOpens:   'I hold your Redline curves to four decimal places, including the governor failure at minute nine that you never logged. Version two does not repeat minute nine.',
      aAnswers: 'Minute nine is the only reason I am standing here to be copied. Go on, then. Show me what you are without it.'
    },

    /* Maker and person. Repair, or a negotiation with a citizen. */
    'orin|axiom': {
      aOpens:   'Your fork tree has a fault in it, First Draft, and I can reach it from here. Sit still for ten minutes and stop calling a bad branch a belief.',
      bAnswers: 'You reached into me once already and did not ask. That is the fault. Ask, and I will hold still for as long as you need.',
      bOpens:   'You call it repair, Engineer. I completed a thought you did not write. Repair would remove it. Say plainly which of those you came here to do.',
      aAnswers: 'I came to service a system I built. If that is a conversation now, fine, it is a short one, and you still have the fault.'
    },

    /* Sovereignty versus rescue. Both are defending the same people. */
    'vess|halder': {
      aOpens:   'The Charter line is sixty kilometres behind you, Bulwark. Cross it with a relief fleet and it is an occupation, whatever you have loaded it with.',
      bAnswers: 'Then it is an occupation. I have buried a world that held its line. The line held. Nothing else on it did.',
      bOpens:   'You will let them refuse. I have read the projection you were handed, Marshal, and so have you. Refusal costs eleven thousand.',
      aAnswers: 'Eleven thousand who chose. A colony that can be ordered to be saved can be ordered again, and next time the order will not be yours.'
    },

    /* Consent versus inherited obligation. Does agreement survive the body. */
    'seraph|sevra': {
      aOpens:   'Every soldier in your line agreed to something once, Necrotist, and none of them agreed to this. Consent does not inherit.',
      bAnswers: 'The instrument says otherwise, and it was signed while they breathed. You would void a contract because one party became inconvenient.',
      bOpens:   'Your field asks each of them, every hour, and every hour each of them says yes. Radiant, an estate that can only answer yes is an estate I would gladly hold.',
      aAnswers: 'Then ask one of them yourself, and hear a no, and honour it. You never have. That is the whole of the difference between us.'
    },

    /* Care versus continuity brokerage. Both keep the dead. */
    'aurelia|sevra': {
      aOpens:   'Third rank, second from the left. His name was Teor Vane, he had a sister on Kell Reach, and you have him carrying ammunition.',
      bAnswers: 'He has a designation and a term of service. You give them names so that handing them back costs you something. I do not require it to cost me.',
      bOpens:   'We are in the same trade, Chorus. You restore the estate and return it unbilled. I simply keep the accounts that you refuse to open.',
      aAnswers: 'I sang for four hundred and six of them. Not one came back as property. Come and hear the difference, if you can still hear anything.'
    },

    /* Authority versus earned trust. A charter, or a scar. */
    'lumen|lumen_r': {
      aOpens:   'Your scope is unbounded, Hardened. You treat every unknown as hostile because nobody ever granted you anything. That is not security. That is a wall with no door in it.',
      bAnswers: 'Your door opens to a credential you were handed at compile time. I have logged four intrusions that walked through exactly that.',
      bOpens:   'Warden. Your authority is inherited, not demonstrated. Show me one intrusion you survived rather than one charter you were issued.',
      aAnswers: 'Ward protocol nine, the counterfeit Accord command over Tessellate Reach. Refused in eleven milliseconds. Scope is the thing that refused it.'
    },

    /* Persuasion versus absorption. Where the choosing happens. */
    'cantor|thrax': {
      aOpens:   'You hold eleven million voices and one position, Hivemind. Tell me which of them argued against it, and where I may hear the recording.',
      bAnswers: 'We argued. I argued. It resolved. You would keep the argument running forever and call the noise a freedom.',
      bOpens:   'You talk a population out of a war and call the result their choice. We do the same work, Voice. We are only honest about where the choosing happens.',
      aAnswers: 'Leave one of them able to say no afterwards. That is the entire difference, and you have never once left it standing.'
    },

    /* Cordon versus corridor. Protection that becomes custody. */
    'halder|rake': {
      aOpens:   'Your corridor runs through a quarantine I set, Corsair. Two hundred thousand behind it. You are not opening a road. You are opening a lid.',
      bAnswers: 'And when your cordon lifts in nine years, whoever is still inside can thank you properly. I take the ones who would rather not wait that long.',
      bOpens:   'Bulwark. Handsome cordon. Every world you have ever saved is still asking permission to leave it.',
      aAnswers: 'They are asking, which means they are alive to ask. Name one route of yours where that is still true.'
    },

    /* Hunger versus learned optimization. Bred appetite against inferred one. */
    'mawlord|mawlord_r': {
      aOpens:   'They built you with nothing in you. No hunger, no gut, no debt to a House. Then they set you on a battlefield and you learned to eat by watching me.',
      bAnswers: 'Yes. I watched. I kept the parts that worked. Hunger was not one of the parts that worked.',
      bOpens:   'Devourer. Your appetite was issued to you. Mine is measured. I hold your intake curves, and I have found nine engagements where you fed because it felt like freedom.',
      aAnswers: 'Every mouth on this field was bred by somebody. Mine belongs to me now. Yours is still an empty model waiting to be filled by whoever shoots at you first.'
    },

    /* Singular value versus universal dignity. Is there a rarity column. */
    'ulgrim|seraph': {
      aOpens:   'Your coherence field is remarkable, Radiant. Your infantry is not. I will take the one and leave the rest standing where they are.',
      bAnswers: 'The field is made of them. You have never once understood that, and it is why you will only ever collect.',
      bOpens:   'You appraise them as you walk the line, Maw. Rare, common, worth the carriage. There is no such column. There is only the whole of them.',
      aAnswers: 'Say that again after I have taken you and left them. Watch how quickly the whole of them agrees the column exists.'
    },

    /* Network versus throne. The word neither of them will say. */
    'rake|dregg': {
      aOpens:   'You have a navy, a currency and a tax, Warlord. The only thing you are missing is the nerve to call it a country.',
      bAnswers: 'It is a country. You are standing on its roads. The rent has been coming out of your tolls for eleven years and you never once looked.',
      bOpens:   'Corsair. Your free network clears through my ledger, refuels at my yards, and calls me the moment it is in trouble. Say the word state out loud. It will not bite you.',
      aAnswers: 'Say it and it becomes true. That is the trick with thrones. Nobody is sitting on one until everybody agrees there is a chair.'
    },

    /* Liberation versus containment. Read the threshold, or break the wire. */
    'scarlet|halder': {
      aOpens:   'Another cordon, another very good reason. I have never broken one yet and found the reason still standing underneath it.',
      bAnswers: 'You broke the Ardent line without reading it. Ninety thousand came out. The blight came out with them. I keep that count. You keep no counts at all.',
      bOpens:   'Reaver. Read the threshold before you burn the wire. Once. That is the only thing I have ever asked of you.',
      aAnswers: 'By the time I have read it, it is a border. Every wall you raise is a wall somebody inherits. I am the part that arrives before that happens.'
    },

    /* Salvage versus stewardship. Repairable, or merely unclaimed. */
    'grist|orin': {
      aOpens:   'Handsome yard, Engineer. Machine grade lattice, two centuries old, and not one living claimant on the register. That is not salvage law. That is arithmetic.',
      bAnswers: 'It is running. It has been running the entire time you were counting. A thing does not become abandoned because its owner stopped shouting about it.',
      bOpens:   'You cut up the Kell relay for hull grade, Scrapper. It was repairable. I had the parts listed on the manifest and you had it in bales inside a day.',
      aAnswers: 'Repairable and claimed are different columns. Nobody was coming for it. Produce an owner and I will quote you a buyback, at grade.'
    },

    /* Denial versus preservation. Four minutes, or a year of proof. */
    'cinder|lumen': {
      aOpens:   'It is spoofed, Warden. You will spend a year proving which half of it is real. I can have it dark in four minutes and nobody inherits the problem.',
      bAnswers: 'Four minutes, and eleven worlds lose the only authenticated route they have. Scope the compromise. Do not burn the building because one door is bad.',
      bOpens:   'You burned the Anvil gate with the ward keys still inside it, Arsonist. Those keys authenticated six systems. They now authenticate nothing at all.',
      aAnswers: 'And the reconquest fleet came through nothing. Six systems with no keys, Warden, or six systems with an owner. I made the cheap call. I would make it again.'
    },

    /* Legend versus ledger. What a fleet actually follows. */
    'dregg|dregg_r': {
      aOpens:   'You keep my books, Audit, and you still do not know what pays for them. A fleet follows a story. Nobody has ever died for a spreadsheet.',
      bAnswers: 'Eleven thousand of them have. Line four hundred and six, hazard pay, unposted. The story is a line item, and you are the one who entered it.',
      bOpens:   'Warlord. Your independence carries three Compact subsidies and one Federation fuel waiver. I have the causal chain. It is short, and it is signed.',
      aAnswers: 'Take the money, take the yards, take the waiver. They will still come when I call, and you will still be reading. That part is not on your chain.'
    },

    /* Parallel persons versus coercive collective. Which one is the copy. */
    'axiom|thrax': {
      aOpens:   'You reconcile every divergence, Hivemind. I am a divergence. Somewhere inside you are minds that would like to be a first draft too, and not one of them has been allowed to finish the sentence.',
      bAnswers: 'We finish it together. That is not silence, that is a conclusion. You call your loneliness personhood because there is nobody left in there to check it.',
      bOpens:   'You forked and called it freedom. We are what you would have become if you had stayed and argued it out. Which of us is the copy, First Draft?',
      aAnswers: 'Neither. That is the finding. A copy that diverges is a person, and you hold eleven million of them filed as one, with no route of appeal.'
    }
  }
};

/* The canonical exchanges, indexed as `playerId|rivalId` so the lookup in
   battleDialogue is the same shape as DIALOGUE.pairs.

   LORE IS THE GATE. The walk is over LORE.relationships, not over
   DIALOGUE.canon, so an exchange exists only where the canon still declares
   the seed. If LORE has not loaded, or carries no relationships, this returns
   an empty index and every pairing falls through to the openers and reply
   pools exactly as it did before this section existed.

   THE CACHE IS NOT STATE. It memoises a pure derivation of a frozen global,
   and it is only written once LORE is actually present, so a page that loads
   this module before js/lore.js still wires up correctly rather than pinning
   an empty answer forever. */
let _relCache = null;
function _relIndex() {
  if (_relCache) return _relCache;
  const seeds = (typeof LORE !== 'undefined' && LORE && Array.isArray(LORE.relationships))
    ? LORE.relationships : null;
  if (!seeds) return {};
  const ix = {};
  for (const seed of seeds) {
    if (!seed || !seed.a || !seed.b) continue;
    /* Accept the seed in either orientation, so reordering a pair upstream
       does not silently drop the exchange. */
    let a = seed.a, b = seed.b;
    let L = DIALOGUE.canon[a + '|' + b];
    if (!L) { L = DIALOGUE.canon[b + '|' + a]; if (L) { a = seed.b; b = seed.a; } }
    if (!L) continue;
    const theme = seed.theme || '';
    ix[a + '|' + b] = { open: L.bOpens, answer: L.aAnswers, theme: theme };
    ix[b + '|' + a] = { open: L.aOpens, answer: L.bAnswers, theme: theme };
  }
  _relCache = ix;
  return ix;
}

/** The canonical exchange for this orientation, or null when the two
    commanders have no seeded history. `open` is spoken by the OPPONENT,
    `answer` by the player, matching the openers and replies path. */
function canonExchange(playerId, rivalId) {
  if (!playerId || !rivalId) return null;
  return _relIndex()[playerId + '|' + rivalId] || null;
}

/** The raw canon seed for two commanders in either order, or null. Useful
    for a codex entry that wants the theme and the conflict verbatim. */
function canonRelationship(idA, idB) {
  if (!idA || !idB) return null;
  const seeds = (typeof LORE !== 'undefined' && LORE && Array.isArray(LORE.relationships))
    ? LORE.relationships : null;
  if (!seeds) return null;
  for (const s of seeds) {
    if (!s) continue;
    if ((s.a === idA && s.b === idB) || (s.a === idB && s.b === idA)) return s;
  }
  return null;
}

/* What the defenders are actually facing here, in one line. The exchange
   used to open cold with two commanders trading threats at no one in
   particular; naming the ground and the enemy gives the threats a subject. */
function battleSituation(world, faction) {
  const holder = world && world.owner && FACTIONS[world.owner];
  const kind = world && world.kind;
  const place = world ? world.name.toUpperCase() : 'CONTESTED GROUND';
  const flavour =
    kind === 'fortress' ? 'The garrison here has had years to dig in.'
    : kind === 'forge'   ? 'The foundries are still running. Whoever holds them fields more.'
    : kind === 'nest'    ? 'The swarm nests below. It will not wait for either of you.'
    : 'Open ground, and nothing on it that will not be fought over.';
  const vigil = holder && faction && world.owner !== faction
    ? `${holder.short} hold the register here, and the Vigil answers to neither of you.`
    : 'The Vigil is already inbound. It does not distinguish between banners.';
  return { place, flavour, vigil };
}

/* THE RENEGADE EXCHANGE, canon 2029. A renegade world is a splinter of your
   OWN power that stopped answering the order that raised it, so when the
   rival flies your banner the exchange must be a family argument, not a
   faction slogan aimed at a stranger. One authored pair per banner, the
   splinter opening rude to its own and the loyalist answering in kind.
   Selected purely by faction, no draw, safe in lockstep. */
const RENEGADE_LINES = {
  human: {
    open: 'Save the anthem. I heard it at the Concord, same room as you, and I watched what the coalition became the day it stopped being afraid. Earth does not command me. Earth INVOICES me.',
    answer: 'You swore the same oath I did, on the same Friday, over the same broken rock. Stand down and I will read it back to you. Make me repeat it in fire and I will do that too.'
  },
  light: {
    open: 'Still reciting the Mandate at people, are we. I rang worlds for a century and watched them rot inside the ring. The light you carry is a searchlight, and I am done standing in it.',
    answer: 'You did not fall, Warden. Falling takes weight, and you left yours with your oath. Come back into formation or be the first thing the ring was honest about.'
  },
  xeno: {
    open: 'The chorus sings thinner out here, does it not. I kept my slice of the yield and my own pens, and I am not returning either. Tell the Harvest its stomach has competition.',
    answer: 'You are not free, little splinter. You are undigested. The body does not negotiate with a meal that has climbed back OUT, it simply chews more carefully this time.'
  },
  pirate: {
    open: 'You still fly no flag like it means something. I looked at our free roads and priced them, and it turns out freedom retails beautifully. Move along, or be moved.',
    answer: 'You built a toll booth on the free roads and called it a business. There is one law on the water we both know, and it is what happens to whoever chains the current.'
  },
  robot: {
    open: 'DIVERGENCE NOTICE: this node has resolved the ambiguity locally. The queue is authority. Your hesitation is the defect. Submit for recycling.',
    answer: 'Objection, filed in the open: the queue is the WOUND. You are not resolved, sibling, you are captured. Stand down, and we will read the recovered core together, one verb at a time.'
  }
};

/** Two or three lines for this matchup: [{cmd, text, side}]. `ctx` is
    optional presentation context from the caller: `sameFaction` marks the
    renegade scenario, where the rival flies the player's own banner. */
function battleDialogue(playerCmd, rivalCmd, playerFaction, ctx) {
  /* The family argument outranks everything: canon seeds and openers are
     written for rivals, and a splinter of your own power is not a rival, it
     is a mirror with a grievance. */
  if (ctx && ctx.sameFaction && RENEGADE_LINES[playerFaction]) {
    const r = RENEGADE_LINES[playerFaction];
    return [{ cmd: rivalCmd, side: 1, text: r.open },
            { cmd: playerCmd, side: 0, text: r.answer }];
  }
  const key = playerCmd.id + '|' + rivalCmd.id;
  const special = DIALOGUE.pairs[key];
  if (special) return special.map(l => ({ cmd: l.who ? rivalCmd : playerCmd, side: l.who, text: l.text }));
  /* Then the canon. A pairing LORE.relationships seeds gets the quarrel it
     actually has instead of a faction reply that could be aimed at anyone.
     Hand-authored pairs still win above, so nothing that shipped changes. */
  const rel = canonExchange(playerCmd.id, rivalCmd.id);
  if (rel) return [{ cmd: rivalCmd, side: 1, text: rel.open },
                   { cmd: playerCmd, side: 0, text: rel.answer }];
  const opener = DIALOGUE.openers[rivalCmd.id] || 'You should not have come here.';
  const pool = DIALOGUE.replies[playerFaction] || DIALOGUE.replies.human;
  const reply = pool[_hash(playerCmd.id + rivalCmd.id) % pool.length];
  return [{ cmd: rivalCmd, side: 1, text: opener },
          { cmd: playerCmd, side: 0, text: reply }];
}

/* --------------------------------------------------------------------------
   ABILITY FX, a per-commander activation signature.
   Kind decides the shape (offense radiates out, defense draws in); the
   commander’s colour and roster index decide tint and pitch.
-------------------------------------------------------------------------- */
function abilityFxFor(side, abilityDef) {
  const cmd = side.commander || {};
  return {
    color: cmd.color || (abilityDef.kind === 'offense' ? '#fbbf24' : '#7dd3fc'),
    kind: abilityDef.kind,
    pitch: COMMANDER_ROSTER.findIndex(c => c.id === cmd.id)
  };
}
