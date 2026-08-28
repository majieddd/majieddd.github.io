/* Session 39 probe: the planet cutscenes, the victory outro, the field manual
   gallery, and the battle dialogue fallback.

   Returns { pass, fail, checks:[{name, ok, detail}] } so run_harness can
   summarise it. Load by URL through run_harness, or paste into a loaded page.

   Mutates nothing the simulation reads: it builds a galaxy through the same
   entry point the campaign uses and calls presentation functions. Run it on a
   FRESH page anyway, per the owner-sweep ordering law.

   ------------------------------------------------------------------------
   PASS AND FAIL MUST NOT SHARE A CHANNEL.

   This harness produced a FALSE GREEN twice in one session, and both times the
   cause was the same shape: a check returned a string describing what went
   WRONG, and the helper could not tell it apart from a string describing what
   went RIGHT.

     v1 scored `d !== false` as a pass. generateGalaxy had been called by a
     name that does not exist, so ten checks returned the literal text
     "no world" and all ten were counted green: 19 of 19, having measured
     nothing at all.

     v2 scored any non-empty string as a pass. Check 39.24 then passed while
     its own detail column read "no text rendered", which was the exact defect
     that check existed to catch.

   So failure is now a THROW and nothing else. bad() raises, the catch records
   it, and a returned string can only ever be pass detail. A check that forgets
   to signal returns undefined and fails loudly rather than passing quietly.
   There is no third case left to get wrong.
   ------------------------------------------------------------------------ */
(() => {
  const checks = [];
  const bad = msg => { throw new Error(msg); };
  /* EVERY ROW CARRIES `id` AND `verdict` AS WELL AS `ok`.
     tools/gate.js counts a harness's failures with `c.verdict === 'FAIL'` and
     names the row with `c.id`. A probe that reported only `ok` would hand the
     gate an empty failure list no matter how red it was, and the gate would
     print pass=N fail=0 and go clean. That would have been the THIRD false
     green of this session and the worst of them, because it would have been
     the gate lying rather than the probe. Both shapes are emitted so
     run_harness and gate.js read the same run correctly. */
  const T = (name, fn) => {
    const id = name.split(' ')[0];
    const push = (ok, detail) =>
      checks.push({ name, id, ok, detail, verdict: ok ? 'PASS' : 'FAIL' });
    try {
      const d = fn();
      if (d === true) return push(true, '');
      if (typeof d === 'string' && d.length) return push(true, d);
      push(false, 'returned ' + JSON.stringify(d) + ' rather than true, a detail string, or bad()');
    } catch (e) { push(false, e.message); }
  };
  const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];

  /* ---- 1. the authored table is complete and agrees with the galaxy ---- */
  T('39.1 PlanetCuts module is present', () =>
    (typeof PlanetCuts === 'object' && typeof PLANET_CUTS === 'object')
      || bad('PlanetCuts or PLANET_CUTS is not defined'));

  T('39.2 coverage is 35 worlds and 175 cells', () => {
    const c = PlanetCuts.coverage();
    if (c.worlds !== 35 || c.cells !== 175) bad('got ' + JSON.stringify(c));
    return c.worlds + ' worlds, ' + c.cells + ' faction cells';
  });

  T('39.3 every authored key is a real universe coordinate', () => {
    /* A key outside the grid the one universe generates is copy that no player
       can ever reach. */
    const out = Object.keys(PLANET_CUTS).filter(k => {
      const si = +k[0], wi = +k[1];
      return !(si >= 0 && si < SYSTEMS_PER_GALAXY && wi >= 0 && wi < WORLDS_PER_SYSTEM);
    });
    if (out.length) bad('unreachable keys: ' + out.join(','));
    return 'all 35 inside ' + SYSTEMS_PER_GALAXY + 'x' + WORLDS_PER_SYSTEM;
  });

  T('39.4 authored names match the universe world names', () => {
    /* The names in planetcuts.js were transcribed from GX_HOME_SYSTEMS, and a
       transcription is exactly where a typo hides. Compare, do not trust. */
    const out = [];
    Object.keys(PLANET_CUTS).forEach(k => {
      const home = GX_HOME_SYSTEMS[GX_UNIVERSE_ORDER[+k[0]]];
      const want = home && home.worlds[(+k[1]) % 7];
      if (want !== PLANET_CUTS[k].name)
        out.push(k + ' says "' + PLANET_CUTS[k].name + '" want "' + want + '"');
    });
    if (out.length) bad(out.join(' | '));
    return 'all 35 names agree with GX_HOME_SYSTEMS';
  });

  T('39.5 no cell is missing a line and no line is thin', () => {
    const out = [];
    Object.keys(PLANET_CUTS).forEach(k => {
      const e = PLANET_CUTS[k];
      if (!e.ground || !e.works) out.push(k + ' place copy');
      FACS.forEach(f => {
        const L = e.f && e.f[f];
        if (!L || L.length !== 3 || L.some(x => !x || x.length < 20)) out.push(k + '/' + f);
      });
    });
    if (out.length) bad(out.slice(0, 8).join(',') + (out.length > 8 ? ' +' + (out.length - 8) : ''));
    return '175 cells, 525 faction lines, 70 place lines, all present';
  });

  T('39.6 no two cells share a line', () => {
    /* The whole directive is that nothing is re-used. Duplicated prose is the
       text equivalent of the hue tint this feature replaced. */
    const seen = {}, dupes = [];
    Object.keys(PLANET_CUTS).forEach(k => {
      const e = PLANET_CUTS[k];
      Object.keys(e.f || {}).forEach(f => (e.f[f] || []).forEach((t, i) => {
        const key = t.trim();
        if (seen[key]) dupes.push(seen[key] + ' == ' + k + '/' + f + '[' + i + ']');
        else seen[key] = k + '/' + f + '[' + i + ']';
      }));
    });
    if (dupes.length) bad(dupes.slice(0, 5).join(' | '));
    return Object.keys(seen).length + ' distinct faction lines';
  });

  /* ---- 2. the deploy sequence, on a real world from a real galaxy ------- */
  /* gxv 2 is the one universe, which is the only shape planetcuts.js is
     authored against. An earlier pass of this probe called a buildGalaxy that
     does not exist; see the false-green note in the header. */
  const gx = generateGalaxy(20290413, Meta.faction() || 'human', 0, 1, 2);
  const world = gx && gx.systems && gx.systems[0] && gx.systems[0].worlds[0];
  T('39.0 a one-universe galaxy builds and yields a world', () =>
    world ? world.name + ' si' + world.si + ' wi' + world.wi
          : bad('generateGalaxy returned no world'));

  T('39.7 a galaxy world resolves to an authored entry', () => {
    const e = PlanetCuts.entry(world);
    return e ? world.name + ' -> ' + e.name
             : bad('no entry for si' + world.si + ' wi' + world.wi);
  });

  T('39.8 worldSlides returns THREE beats with pcut keys', () => {
    const s = UI.worldSlides(world);
    if (s.length !== 3) bad('got ' + s.length + ' slides');
    const keys = s.map(x => x.key);
    if (!keys.every(k => /^pcut_\d\d_[a-z]+_[1-3]$/.test(k))) bad('bad keys ' + keys.join(','));
    if (!s.every(x => x.alt && x.alt.indexOf('world_') === 0)) bad('missing world-plate fallback');
    if (!s.every(x => x.text && x.text.length > 40)) bad('thin slide text');
    return keys.join(' ');
  });

  T('39.9 the three beats are three DIFFERENT plates', () => {
    const k = UI.worldSlides(world).map(x => x.key);
    return new Set(k).size === 3 ? 'three distinct keys' : bad('REUSED: ' + k.join(','));
  });

  T('39.10 each power gets its own plates for the same world', () => {
    const all = new Set();
    FACS.forEach(f => { for (let b = 1; b <= 3; b++) all.add(PlanetCuts.plate(world, f, b)); });
    return all.size === 15 ? '15 distinct keys across 5 powers' : bad('only ' + all.size);
  });

  /* ---- 3. the victory outro gate ---------------------------------------- */
  T('39.11 outro plays on a win of one star or more', () => {
    const s = UI.outroSlides(world, true, 1);
    if (s.length !== 2) bad('got ' + s.length + ' slides');
    if (!s.every(x => /^pcut_\d\d_[a-z]+_[45]$/.test(x.key))) bad('bad keys');
    return s.map(x => x.key).join(' ');
  });

  T('39.12 outro is refused on zero stars and on a defeat', () => {
    const zero = UI.outroSlides(world, true, 0).length;
    const lost = UI.outroSlides(world, false, 3).length;
    if (zero || lost) bad('zero-star=' + zero + ' defeat=' + lost);
    return 'both refused';
  });

  T('39.13 outro is refused in a skirmish', () => {
    const was = Game._skirmish;
    Game._skirmish = true;
    const n = UI.outroSlides(world, true, 3).length;
    Game._skirmish = was;
    return n === 0 ? 'refused' : bad('PLAYED in a skirmish');
  });

  T('39.14 showEnd routes through the outro and opens the screen once', () => {
    /* The failure this catches is a continuation called twice or not at all,
       which is how a result screen goes missing behind a cutscene overlay. */
    const realScreen = UI.showEndScreen, realPlay = Cutscenes.playList;
    let screens = 0, played = null;
    UI.showEndScreen = () => { screens++; };
    Cutscenes.playList = (f, list, done) => { played = list.length; done(); };
    const wasW = Game.worldRecord, wasS = Game.lastStars, wasK = Game._skirmish;
    Game.worldRecord = world; Game.lastStars = { stars: 2 }; Game._skirmish = false;
    try { UI.showEnd(true); } finally {
      UI.showEndScreen = realScreen; Cutscenes.playList = realPlay;
      Game.worldRecord = wasW; Game.lastStars = wasS; Game._skirmish = wasK;
    }
    if (played !== 2) bad('outro slide count was ' + played);
    if (screens !== 1) bad('result screen opened ' + screens + ' times');
    return '2 outro beats then exactly one result screen';
  });

  /* ---- 4. degrade paths ------------------------------------------------- */
  T('39.15 a world with no coordinates falls back, never throws', () => {
    const s = UI.worldSlides({ name: 'NOWHERE', map: 'open', owner: 'xeno' });
    return (s.length >= 1 && s.every(x => x.key))
      ? 'derived path returned ' + s.length + ' slides'
      : bad('got ' + JSON.stringify(s));
  });

  T('39.16 every planet beat names a world plate that exists', () => {
    /* A fallback only helps if the key it names is in the pack. This is the
       check that would catch an `alt` pointing at nothing. */
    const slides = UI.worldSlides(world);
    const missing = slides.filter(s => !ARTPACK[s.alt]).map(s => s.alt);
    if (missing.length) bad('no fallback art for ' + missing.join(','));
    return 'fallback art present: ' + slides[0].alt;
  });

  /* ---- 5. the gallery --------------------------------------------------- */
  T('39.17 the gallery builds and counts the pack', () => {
    const h = UI.galleryHtml();
    if (!h || h.indexOf('Art gallery') < 0) bad('no gallery section');
    const n = Object.keys(ARTPACK).length;
    if (h.indexOf('<b>' + n + '</b>') < 0) bad('pack count not reported');
    return n + ' images reported';
  });

  T('39.18 the gallery enumerates all 875 planet slots', () => {
    const tiles = (UI.galleryPlanetHtml().match(/class="gal-tile/g) || []).length;
    return tiles === 875 ? '875 slots listed' : bad('listed ' + tiles);
  });

  T('39.19 unrendered planet plates show as gaps, not as absences', () => {
    /* During an eleven-hour render a pack-only view would read as finished the
       whole time. The gallery walks the AUTHORED table instead. */
    const holes = (UI.galleryPlanetHtml().match(/gal-missing/g) || []).length;
    const have = Object.keys(ARTPACK).filter(k => k.split('_')[0] === 'pcut').length;
    if (holes + have !== 875) bad('holes ' + holes + ' plus rendered ' + have + ' is not 875');
    return have + ' rendered, ' + holes + ' still gaps, 875 accounted for';
  });

  T('39.20 the codex contains the gallery after build', () => {
    UI.buildCodex();
    const n = UI.el.codexBody.querySelectorAll('details.gal-class').length;
    return n >= 9 ? n + ' collapsible classes' : bad('only ' + n);
  });

  /* ---- 6. the battle dialogue fallback ---------------------------------- */
  T('39.21 every roster commander has an opener AND an answer', () => {
    /* Both paths reach ANY commander: a fork-node rival is drawn from the whole
       roster with no faction filter, and a duel opponent is the other player's
       own pick. A commander missing either half speaks a generic line. */
    const miss = COMMANDER_ROSTER
      .filter(c => !DIALOGUE.openers[c.id] || !DIALOGUE.answers[c.id])
      .map(c => c.id + (DIALOGUE.openers[c.id] ? ' answer' : ' opener'));
    if (miss.length) bad('missing: ' + miss.join(', '));
    return COMMANDER_ROSTER.length + ' commanders, both halves present';
  });

  T('39.22 no commander line repeats another', () => {
    const seen = {}, dup = [];
    ['openers', 'answers'].forEach(kind =>
      Object.keys(DIALOGUE[kind]).forEach(id => {
        const t = DIALOGUE[kind][id].trim();
        if (seen[t]) dup.push(seen[t] + ' == ' + kind + '.' + id); else seen[t] = kind + '.' + id;
      }));
    if (dup.length) bad(dup.join(' | '));
    return Object.keys(seen).length + ' distinct commander lines';
  });

  T('39.23 the fallback speaks the player commander, not a faction slogan', () => {
    /* The exact defect: DIALOGUE.replies holds two lines per faction, and
       before the answers existed one of those two was the player's entire half
       of the exchange in 300 of the 318 pairings that can meet. */
    const byId = {};
    COMMANDER_ROSTER.forEach(c => { byId[c.id] = c; });
    const me = byId.vess, foe = byId.ulgrim;      // no relationship seed between them
    if (!me || !foe) bad('roster lookup failed');
    const ex = battleDialogue(me, foe, me.faction, null);
    if (ex.length !== 2) bad('got ' + ex.length + ' lines');
    const pool = DIALOGUE.replies[me.faction] || [];
    if (pool.indexOf(ex[1].text) >= 0) bad('still answering with a faction slogan');
    if (ex[1].text !== DIALOGUE.answers[me.id]) bad('not the commander answer');
    return 'VESS answers ULGRIM in her own voice';
  });

  T('39.24 canon still outranks the new answers', () => {
    /* Adding a per-commander answer must not shadow a relationship-seeded
       exchange, which is exactly what the four removed `pairs` entries did. */
    let seeded = null;
    for (const a of COMMANDER_ROSTER) {
      for (const b of COMMANDER_ROSTER) {
        if (a.faction && a.faction === b.faction) continue;
        if (canonExchange(a.id, b.id)) { seeded = [a, b]; break; }
      }
      if (seeded) break;
    }
    if (!seeded) bad('no relationship-seeded pair found to test against');
    const ex = battleDialogue(seeded[0], seeded[1], seeded[0].faction, null);
    const canon = canonExchange(seeded[0].id, seeded[1].id);
    return ex[1].text === canon.answer
      ? 'canon wins for ' + seeded[0].id + '|' + seeded[1].id
      : bad('ANSWER SHADOWED canon for ' + seeded[0].id + '|' + seeded[1].id);
  });

  /* ---- 7. the overlay actually paints a planet plate --------------------- */
  T('39.25 playList paints the pcut plate and the authored text', () => {
    /* REDUCED MOTION ON PURPOSE. playList types the slide one word per 90ms,
       so a synchronous probe reads an EMPTY paragraph and concludes the text
       is missing. That is exactly the false green this file's header
       describes: the previous version of this check reported "no text
       rendered" and was scored green. Under reduced motion the same code path
       assigns textContent in one go, which makes the assertion deterministic
       rather than a race against a timer. */
    const hadRm = document.body.classList.contains('rm-user');
    document.body.classList.add('rm-user');
    const slides = UI.worldSlides(world);
    let finished = 0;
    try {
      Cutscenes.playList(Meta.faction() || 'human', slides, () => { finished++; });
      const ov = document.getElementById('cutscene');
      if (!ov || !ov.className) bad('overlay did not open');
      const el = ov.querySelector('img.cs-art, video.cs-art');
      if (!el) bad('crest fallback painted instead of a plate');
      const src = el.getAttribute('src') || '';
      const want = slides[0].key + '.webp';
      const txt = (ov.querySelector('.cs-text') || {}).textContent || '';
      const count = (ov.querySelector('.cs-count') || {}).textContent;
      const skip = ov.querySelector('#cs-skip'); if (skip) skip.click();
      if (src.indexOf(want) < 0 && src.indexOf('data:image') !== 0)
        bad('painted ' + src.slice(0, 70) + ' rather than ' + want);
      if (txt.length < 40) bad('text was ' + JSON.stringify(txt.slice(0, 40)));
      if (count !== '1 / 3') bad('counter reads ' + count);
      if (finished !== 1) bad('close ran ' + finished + ' times');
      return 'beat 1 of 3, ' + txt.length + ' chars, from ' +
             (src.indexOf('data:') === 0 ? 'the inline pack' : src);
    } finally { if (!hadRm) document.body.classList.remove('rm-user'); }
  });

  T('39.26 the deploy text names the world, the holder and the scenario', () => {
    const all = UI.worldSlides(world).map(x => x.text).join(' ');
    if (all.indexOf(world.name.toUpperCase()) < 0) bad('world name absent');
    /* The holder sentence is read live off the world, which is the whole
       reason it is not baked into planetcuts.js. */
    const holder = world.owner && FACTIONS[world.owner];
    if (holder && !world.contested && !world.renegade && all.indexOf(holder.name) < 0)
      bad('holder ' + holder.name + ' not named');
    return world.name + ', holder named, ' + all.length + ' characters across 3 beats';
  });

  /* ---- 8. the coupling the deploy path actually depends on -------------- */
  T('39.27 EVERY world in a generated galaxy resolves to authored copy', () => {
    /* 39.7 proves one world resolves. This proves the table has no holes a
       player can walk into: a single unauthored world would silently drop that
       battle back to the derived briefing, which looks like nothing is wrong. */
    const misses = [];
    gx.systems.forEach(sy => sy.worlds.forEach(w => {
      if (!PlanetCuts.entry(w)) misses.push(w.name + ' si' + w.si + ' wi' + w.wi);
      else if (PlanetCuts.entry(w).name !== w.name)
        misses.push(w.name + ' resolved to ' + PlanetCuts.entry(w).name);
    }));
    if (misses.length) bad(misses.slice(0, 6).join(', '));
    let n = 0; gx.systems.forEach(sy => { n += sy.worlds.length; });
    return n + ' of ' + n + ' worlds resolve to their own authored entry';
  });

  T('39.28 worldById returns a world the planet cutscenes can key', () => {
    /* THE DEPLOY PATH'S ACTUAL ARGUMENT. js/ui.js:583 does not hand
       worldSlides the object this probe built; it hands it whatever
       worldById returns. If that ever became a plain id, a copy, or a
       stripped record, keyFor would return null and every planet cutscene in
       the game would quietly fall back to the derived briefing with no error
       anywhere. That is the failure this check exists for, and nothing else
       in the suite was watching the seam. */
    const id = gx.systems[2].worlds[4].id;
    const w = UI.worldById(gx, id);
    if (!w) bad('worldById returned nothing for ' + id);
    if (typeof w.si !== 'number' || typeof w.wi !== 'number')
      bad('worldById returned a world with no coordinates: ' + JSON.stringify(Object.keys(w)).slice(0, 80));
    const key = PlanetCuts.keyFor(w);
    if (!key || !PLANET_CUTS[key]) bad('worldById world does not key: ' + key);
    const s = UI.worldSlides(w);
    if (s.length !== 3) bad('deploy path produced ' + s.length + ' slides');
    return id + ' -> ' + w.name + ' -> ' + s.map(x => x.key).join(' ');
  });

  /* ---- 9. the campaign arc, not just the individual slide ---------------- */
  /* THE SPINE. js/galaxy.js rotates the campaign so every faction opens at its
     OWN home and conquers outward: campTier(u) = (u - uHome + 5) % 5, and the
     systems array is sorted by it. So a faction's five SEAT worlds, read in
     tier order, are the five acts of its campaign, and they are the only five
     slides every player of that faction is guaranteed to see in a fixed
     order. If the writing has an arc anywhere, it has to be there. */
  const SEATS = { 0: '06', 1: '16', 2: '26', 3: '36', 4: '46' };
  const UORDER = ['human', 'light', 'xeno', 'pirate', 'robot'];
  const spineOf = fac => {
    const h = UORDER.indexOf(fac);
    const out = [];
    for (let t = 0; t < 5; t++) {
      const e = PLANET_CUTS[SEATS[(h + t) % 5]];
      out.push({ act: t + 1, world: e.name, text: e.f[fac][2] });
    }
    return out;
  };

  T('39.29 every faction has a five-act seat spine in campaign order', () => {
    const out = [];
    UORDER.forEach(f => {
      const s = spineOf(f);
      if (s.length !== 5 || s.some(x => !x.text)) bad(f + ' spine incomplete');
      if (s[0].world !== PLANET_CUTS[SEATS[UORDER.indexOf(f)]].name)
        bad(f + ' does not open on its own home seat');
      out.push(f + ':' + s[0].world);
    });
    return out.join(' ');
  });

  T('39.30 no faction repeats itself across its own five acts', () => {
    /* MEASURED AND FIXED, Session 39. The Federation named "three seats above
       field command" in act 1 AND act 5, so its climax was pre-empted by its
       opening. The pirates closed both act 3 and act 5 on "some things you do
       not sell". Both read fine slide by slide and only fail as an arc, which
       is why a per-slide check could never have caught them. */
    const dupes = [];
    UORDER.forEach(f => {
      const lines = spineOf(f);
      for (let i = 0; i < 5; i++) {
        const a = lines[i].text.toLowerCase().match(/[a-z0-9]+/g) || [];
        for (let j = i + 1; j < 5; j++) {
          const b = lines[j].text.toLowerCase().match(/[a-z0-9]+/g) || [];
          const set = new Set();
          for (let k = 0; k + 6 <= b.length; k++) set.add(b.slice(k, k + 6).join(' '));
          for (let k = 0; k + 6 <= a.length; k++) {
            const ph = a.slice(k, k + 6).join(' ');
            if (set.has(ph)) dupes.push(f + ' act' + (i + 1) + '/act' + (j + 1) + ' "' + ph + '"');
          }
        }
      }
    });
    if (dupes.length) bad(dupes.slice(0, 4).join(' | '));
    return '25 act lines across 5 factions, no shared six-word phrase';
  });

  T('39.31 a faction reclaims only at home, and invades everywhere else', () => {
    /* A faction takes its OWN home first and is the aggressor for the other
       four systems, so possessive reclaiming language outside home would be
       wrong. "recovered" is excluded: the Parallel says "the recovered core"
       constantly and means retrieved, not repossessed. */
    const RECLAIM = /\b(our own (pens|ring|archive|tribunal|cathedral|foundry|yard|anchorage|shelter)|ours again|we built (this|these|it))\b/i;
    const bads = [];
    Object.keys(PLANET_CUTS).forEach(wk => {
      const si = +wk[0], e = PLANET_CUTS[wk];
      UORDER.forEach(f => {
        if (UORDER.indexOf(f) === si) return;          // home, reclaiming is right
        (e.f[f] || []).forEach((t, i) => {
          /* LUNA's relay dish IS a Compact installation, so the Compact saying
             "ours again" there is canon, not a slip. The one allowed pair. */
          if (wk === '06' && f === 'xeno') return;
          if (RECLAIM.test(t)) bads.push(e.name + '/' + f + ' beat' + [1, 4, 5][i]);
        });
      });
    });
    if (bads.length) bad(bads.join(', '));
    return 'no faction claims ownership of a world it is invading';
  });

  T('39.32 no TURNING act names a system the player is not on yet', () => {
    /* THREE NARRATIVE LAYERS HAVE TO AGREE ABOUT WHERE THE PLAYER IS.
       THE OATH opens the campaign, the planet cutscenes play per world, and
       THE TURNING fires after each SYSTEM falls, one act per system. Because
       js/galaxy.js rotates the campaign to open at each faction's own home,
       act N fires after the system at universe index (home + N - 1) % 5, and
       that is a different system for every faction.

       So a proper noun in a TURNING slide is a claim about WHEN the player
       reads it. "The Pleiades stand secured" is correct in the Federation's
       act 1 and wrong in anybody else's, and the same sentence would be wrong
       in the Federation's act 3. The acts are written generically for exactly
       this reason, except act 1, which names each faction's home and is the
       one place a name is safe.

       Nothing else in the suite was checking this, and it is the kind of thing
       a later writing pass breaks without noticing, because every slide still
       reads perfectly well on its own. */
    if (typeof CUTSCENES === 'undefined') bad('CUTSCENES not loaded');
    const OWNS = {
      'earth system': 'human', 'luna': 'human',
      'pleiades': 'light', 'alcyone': 'light',
      'zeta reticuli': 'xeno', 'serpo': 'xeno',
      'barnard': 'pirate', 'harbour nine': 'pirate',
      'tabby': 'robot', 'the veil': 'robot',
    };
    const wrong = [];
    UORDER.forEach(fac => {
      const home = UORDER.indexOf(fac);
      const acts = (CUTSCENES[fac] && CUTSCENES[fac].sys) || [];
      acts.forEach((slide, i) => {
        const owner = UORDER[(home + i) % 5];      // whose system act i+1 follows
        const text = ((slide.a || '') + ' ' + (slide.b || '')).toLowerCase();
        Object.keys(OWNS).forEach(noun => {
          if (text.indexOf(noun) >= 0 && OWNS[noun] !== owner)
            wrong.push(fac + ' act' + (i + 1) + ' names "' + noun + '" (belongs to ' +
                       OWNS[noun] + ', act follows the ' + owner + ' system)');
        });
      });
    });
    if (wrong.length) bad(wrong.slice(0, 4).join(' | '));
    return '25 turning acts, every system name lands on the act that follows it';
  });

  /* ---- 10. the story-beat interleave (Session 40) ----------------------- */
  T('39.33 THE DEPARTURE plays at campaign start and never on seat 1', () => {
    /* Found by reading the assembled screenplay: beat 0 is a campaign-opening
       address ("Set course for Luna", "Take the system") and rendered on the
       result screen AFTER that conquest. It now plays via
       playStoryInterstitial at campaign start, and the result surface must
       suppress index 0 or the player hears the send-off twice, an act late. */
    if (typeof UI.playStoryInterstitial !== 'function') bad('playStoryInterstitial is missing');
    const realC = Meta.campaign;
    try {
      Meta.campaign = () => ({ faction: 'human', systemsTaken: ['s0'] });
      const one = UI.storyBeatHtml();
      Meta.campaign = () => ({ faction: 'human', systemsTaken: ['s0', 's1'] });
      const two = UI.storyBeatHtml();
      if (one !== '') bad('seat 1 still renders a beat card');
      if (!two || two.indexOf('The Unredacted') < 0)
        bad('seat 2 should carry beat 1 (The Unredacted), got ' + String(two).slice(0, 60));
      return 'seat 1 empty, seat 2 carries FILES, departure surface present';
    } finally { Meta.campaign = realC; }
  });

  T('39.34 no layer claims a defeat that has not happened yet', () => {
    /* Two shipped: the Federation's "defeated Archivist" (the Federation
       never fights a human garrison anywhere in its campaign) and the
       pirates' "Chorus, beaten" one act before they ever fight the
       Federation. Both reframed as transmissions. The phrases are banned
       outright because both were wrong for the same reason and a future
       writing pass could reintroduce either verbatim. */
    const BANNED = [/defeated archivist/i, /chorus,\s*beaten/i];
    const hits = [];
    UORDER.forEach(fac => {
      (CUTSCENES[fac].sys || []).forEach((sl, i) => {
        const t = (sl.a || '') + ' ' + (sl.b || '');
        BANNED.forEach(re => { if (re.test(t)) hits.push(fac + ' turning act' + (i + 1)); });
      });
      Story.arc(fac).forEach((b, i) => {
        const t = (b.line || '') + ' ' + (b.reveal || '');
        BANNED.forEach(re => { if (re.test(t)) hits.push(fac + ' story beat ' + i); });
      });
    });
    if (hits.length) bad(hits.join(', '));
    return 'both premature-defeat phrasings absent from all 60 slides and beats';
  });

  const pass = checks.filter(c => c.ok).length;
  return { pass, fail: checks.length - pass, checks };
})()
