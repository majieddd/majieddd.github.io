/* ==========================================================================
   PORTRAITS AND PRE-BATTLE DIALOGUE

   Portraits are procedural: an abstract armored bust drawn from the
   commander's faction silhouette and colours. Deliberately geometric — an
   insignia, not a face — so twenty-one of them stay consistent and none of
   them fall into the uncanny valley.
   ========================================================================== */

function _hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** The generated image for a key, or '' when the pack has no such art.
    Every art site funnels through here so a partial pack degrades cleanly:
    a missing key simply leaves that surface on the artwork it shipped with. */
function art(key) {
  return (typeof ARTPACK !== 'undefined' && ARTPACK[key]) || '';
}

/** An <img> for an art key, or '' — safe to interpolate straight into HTML. */
function artImg(key, cls, alt) {
  const src = art(key);
  return src ? `<img class="${cls}" src="${src}" alt="${alt || ''}" loading="lazy">` : '';
}

/** The painted planet for a world: one of up to three variants per KIND,
    chosen deterministically from the world's own id so a system reads as a
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
   DIALOGUE — the two commanders address each other before a battle.
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
    dregg:   'Kneel now and save us both the ammunition. No? Good.'
  },
  replies: {
    human:  ['We adapted to worse than you. Hold the line.',
             'Humanity buried every empire that called itself inevitable.'],
    light:  ['The Light does not bargain with what it must save.',
             'All life is one life. Yours included — surrendered or not.'],
    xeno:   ['You are not an enemy. You are an acquisition.',
             'Everything you are will be folded into us by nightfall.'],
    pirate: ['No flags on my hull, no mercy in my hold.',
             'The swarm eats whoever loses. Try to make it you.']
  },
  pairs: {
    'seraph|sevra': [
      { who: 1, text: 'Necrotist. Those souls you puppet are owed rest.' },
      { who: 0, text: 'Rest is a resource, Radiant. I simply spend it better.' }
    ],
    'sevra|seraph': [
      { who: 1, text: 'Your congregation marches prettily, Seraph. They will march for me by dusk.' },
      { who: 0, text: 'They surrendered their lives to the Light. There is nothing left for you to take.' }
    ],
    'rake|dregg': [
      { who: 1, text: 'Rake. You still owe me a ship.' },
      { who: 0, text: 'And you still owe me the crew that was on it. Even, then.' }
    ],
    'vanta|cantor': [
      { who: 1, text: 'Archivist. Your books end today.' },
      { who: 0, text: 'Odd. I have already filed the record of your defeat.' }
    ]
  }
};

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

/** Two or three lines for this matchup: [{cmd, text, side}] */
function battleDialogue(playerCmd, rivalCmd, playerFaction) {
  const key = playerCmd.id + '|' + rivalCmd.id;
  const special = DIALOGUE.pairs[key];
  if (special) return special.map(l => ({ cmd: l.who ? rivalCmd : playerCmd, side: l.who, text: l.text }));
  const opener = DIALOGUE.openers[rivalCmd.id] || 'You should not have come here.';
  const pool = DIALOGUE.replies[playerFaction] || DIALOGUE.replies.human;
  const reply = pool[_hash(playerCmd.id + rivalCmd.id) % pool.length];
  return [{ cmd: rivalCmd, side: 1, text: opener },
          { cmd: playerCmd, side: 0, text: reply }];
}

/* --------------------------------------------------------------------------
   ABILITY FX — a per-commander activation signature.
   Kind decides the shape (offense radiates out, defense draws in); the
   commander's colour and roster index decide tint and pitch.
-------------------------------------------------------------------------- */
function abilityFxFor(side, abilityDef) {
  const cmd = side.commander || {};
  return {
    color: cmd.color || (abilityDef.kind === 'offense' ? '#fbbf24' : '#7dd3fc'),
    kind: abilityDef.kind,
    pitch: COMMANDER_ROSTER.findIndex(c => c.id === cmd.id)
  };
}
