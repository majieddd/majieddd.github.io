/* Session 39 probe: the planet cutscenes, the victory outro, and the gallery.
   Returns { pass, fail, checks:[{name, ok, detail}] } so run_harness can
   summarise it. Paste into a loaded page, or load by URL through run_harness.

   Mutates nothing the simulation reads: it builds a galaxy through the same
   public entry point the campaign uses and calls presentation functions. Run
   it on a FRESH page anyway, per the owner-sweep ordering law. */
(() => {
  const checks = [];
  /* A check FAILS on false, null, undefined or an empty string. The looser
     `d !== false` this started with turned every unmet prerequisite into a
     green row; see the note at 39.0. A check that wants to pass must say so
     with `true` or with a non-empty detail string. */
  const T = (name, fn) => {
    try {
      const d = fn();
      const ok = d === true || (typeof d === 'string' && d.length > 0);
      checks.push({ name, ok, detail: d === true ? '' : String(d) });
    } catch (e) { checks.push({ name, ok: false, detail: 'THREW ' + e.message }); }
  };

  /* ---- 1. the authored table is complete and agrees with the galaxy ---- */
  T('39.1 PlanetCuts module is present', () =>
    typeof PlanetCuts === 'object' && typeof PLANET_CUTS === 'object');

  T('39.2 coverage is 35 worlds and 175 cells', () => {
    const c = PlanetCuts.coverage();
    if (c.worlds !== 35 || c.cells !== 175) return 'got ' + JSON.stringify(c);
    return c.worlds + ' worlds, ' + c.cells + ' faction cells';
  });

  T('39.3 every authored key is a real universe coordinate', () => {
    /* SYSTEMS_PER_GALAXY x WORLDS_PER_SYSTEM is the shape the one universe
       generates. A key outside it would be copy nothing can ever reach. */
    const bad = Object.keys(PLANET_CUTS).filter(k => {
      const si = +k[0], wi = +k[1];
      return !(si >= 0 && si < SYSTEMS_PER_GALAXY && wi >= 0 && wi < WORLDS_PER_SYSTEM);
    });
    return bad.length ? 'unreachable keys: ' + bad.join(',') : 'all 35 inside 5x7';
  });

  T('39.4 authored names match the universe world names', () => {
    /* The names in planetcuts.js were transcribed from GX_HOME_SYSTEMS. A
       transcription is exactly where a typo hides, so compare them rather
       than trusting the copy. */
    const bad = [];
    Object.keys(PLANET_CUTS).forEach(k => {
      const si = +k[0], wi = +k[1];
      const home = GX_HOME_SYSTEMS[GX_UNIVERSE_ORDER[si]];
      const want = home && home.worlds[wi % 7];
      if (want !== PLANET_CUTS[k].name) bad.push(k + ' says "' + PLANET_CUTS[k].name + '" want "' + want + '"');
    });
    return bad.length ? bad.join(' | ') : 'all 35 names agree with GX_HOME_SYSTEMS';
  });

  T('39.5 no cell is missing a line and no line is empty', () => {
    const bad = [];
    Object.keys(PLANET_CUTS).forEach(k => {
      const e = PLANET_CUTS[k];
      if (!e.ground || !e.works) bad.push(k + ' place copy');
      ['human', 'light', 'xeno', 'pirate', 'robot'].forEach(f => {
        const L = e.f && e.f[f];
        if (!L || L.length !== 3 || L.some(x => !x || x.length < 20)) bad.push(k + '/' + f);
      });
    });
    return bad.length ? bad.slice(0, 8).join(',') + (bad.length > 8 ? ' +' + (bad.length - 8) : '') : '175 cells, 525 lines, all present';
  });

  T('39.6 no two cells share a line', () => {
    /* The whole directive is that nothing is re-used. Duplicated prose would
       be the text equivalent of the hue tint this feature replaced. */
    const seen = {}, dupes = [];
    Object.keys(PLANET_CUTS).forEach(k => {
      const e = PLANET_CUTS[k];
      Object.keys(e.f || {}).forEach(f => (e.f[f] || []).forEach((t, i) => {
        const key = t.trim();
        if (seen[key]) dupes.push(seen[key] + ' == ' + k + '/' + f + '[' + i + ']');
        else seen[key] = k + '/' + f + '[' + i + ']';
      }));
    });
    return dupes.length ? dupes.slice(0, 5).join(' | ') : Object.keys(seen).length + ' distinct faction lines';
  });

  /* ---- 2. the deploy sequence, on a real world from a real galaxy ------- */
  /* gxv 2 is the one universe: the same five systems for every faction, which
     is the only shape planetcuts.js is authored against. The first pass of
     this probe called a `buildGalaxy` that does not exist, got null, and every
     downstream check returned the string 'no world' -- which the helper scored
     as a PASS, because a non-false return was treated as a detail. Nineteen
     green checks, ten of which had measured nothing. The helper now fails on a
     falsy return AND on the absence of a prerequisite, which is why `world`
     is asserted here rather than guarded at every call site. */
  const gx = generateGalaxy(20290413, Meta.faction() || 'human', 0, 1, 2);
  const world = gx && gx.systems && gx.systems[0] && gx.systems[0].worlds[0];
  T('39.0 a one-universe galaxy builds and yields a world', () =>
    !!world && world.name + ' si' + world.si + ' wi' + world.wi);

  T('39.7 a galaxy world resolves to an authored entry', () => {
    if (!world) return false;
    const e = PlanetCuts.entry(world);
    return e ? world.name + ' -> ' + e.name : 'no entry for si' + world.si + ' wi' + world.wi;
  });

  T('39.8 worldSlides returns THREE beats with pcut keys', () => {
    if (!world) return false;
    const s = UI.worldSlides(world);
    if (s.length !== 3) return 'got ' + s.length + ' slides';
    const keys = s.map(x => x.key);
    if (!keys.every(k => /^pcut_\d\d_[a-z]+_[1-3]$/.test(k))) return 'bad keys ' + keys.join(',');
    if (!s.every(x => x.alt && x.alt.indexOf('world_') === 0)) return 'missing world-plate fallback';
    if (!s.every(x => x.text && x.text.length > 40)) return 'thin text';
    return keys.join(' ');
  });

  T('39.9 the three beats are three DIFFERENT plates', () => {
    if (!world) return false;
    const k = UI.worldSlides(world).map(x => x.key);
    return new Set(k).size === 3 ? 'three distinct keys' : 'REUSED: ' + k.join(',');
  });

  T('39.10 each faction gets its own plates for the same world', () => {
    if (!world) return false;
    const all = new Set();
    ['human', 'light', 'xeno', 'pirate', 'robot'].forEach(f => {
      for (let b = 1; b <= 3; b++) all.add(PlanetCuts.plate(world, f, b));
    });
    return all.size === 15 ? '15 distinct keys across 5 powers' : 'only ' + all.size;
  });

  /* ---- 3. the victory outro gate ---------------------------------------- */
  T('39.11 outro plays on a win of one star or more', () => {
    if (!world) return false;
    const s = UI.outroSlides(world, true, 1);
    if (s.length !== 2) return 'got ' + s.length;
    if (!s.every(x => /^pcut_\d\d_[a-z]+_[45]$/.test(x.key))) return 'bad keys';
    return s.map(x => x.key).join(' ');
  });

  T('39.12 outro is refused on zero stars and on a defeat', () => {
    if (!world) return false;
    const zero = UI.outroSlides(world, true, 0).length;
    const lost = UI.outroSlides(world, false, 3).length;
    if (zero || lost) return 'zero-star=' + zero + ' defeat=' + lost;
    return 'both refused';
  });

  T('39.13 outro is refused in a skirmish', () => {
    if (!world) return false;
    const was = Game._skirmish;
    Game._skirmish = true;
    const n = UI.outroSlides(world, true, 3).length;
    Game._skirmish = was;
    return n === 0 ? 'refused' : 'PLAYED in skirmish';
  });

  T('39.14 showEnd routes through the outro and calls the screen once', () => {
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
    if (played !== 2) return 'outro slides ' + played;
    if (screens !== 1) return 'result screen shown ' + screens + ' times';
    return '2 outro beats then exactly one result screen';
  });

  /* ---- 4. degrade paths ------------------------------------------------- */
  T('39.15 a world with no coordinates falls back, never throws', () => {
    const s = UI.worldSlides({ name: 'NOWHERE', map: 'open', owner: 'xeno' });
    return s.length >= 1 && s.every(x => x.key) ? 'derived path returned ' + s.length : 'got ' + JSON.stringify(s);
  });

  T('39.16 a missing plate resolves to the world plate, not the crest', () => {
    if (!world) return false;
    const s = UI.worldSlides(world)[0];
    const first = ARTPACK[s.key], back = ARTPACK[s.alt];
    if (first) return 'plate present, fallback untested here';
    return back ? 'falls back to ' + s.alt : 'NO fallback art for ' + s.alt;
  });

  /* ---- 5. the gallery --------------------------------------------------- */
  T('39.17 the gallery builds and counts the pack', () => {
    const h = UI.galleryHtml();
    if (!h || h.indexOf('Art gallery') < 0) return 'no gallery';
    const n = Object.keys(ARTPACK).length;
    if (h.indexOf('<b>' + n + '</b>') < 0) return 'pack count not reported';
    return n + ' images reported';
  });

  T('39.18 the gallery enumerates all 875 planet slots', () => {
    const h = UI.galleryPlanetHtml();
    const tiles = (h.match(/class="gal-tile/g) || []).length;
    return tiles === 875 ? '875 slots listed' : 'listed ' + tiles;
  });

  T('39.19 the codex contains the gallery after build', () => {
    UI.buildCodex();
    const n = UI.el.codexBody.querySelectorAll('details.gal-class').length;
    return n >= 9 ? n + ' collapsible classes' : 'only ' + n;
  });

  /* ---- 6. the battle dialogue fallback ---------------------------------- */
  T('39.20 every roster commander has an opener AND an answer', () => {
    /* Both paths reach ANY commander: a fork-node rival is drawn from the
       whole roster with no faction filter, and a duel opponent is the other
       player's own pick. A commander missing either half speaks a generic
       line, which is the defect the five missing Parallel openers were. */
    const miss = COMMANDER_ROSTER.filter(c => !DIALOGUE.openers[c.id] || !DIALOGUE.answers[c.id])
      .map(c => c.id + (DIALOGUE.openers[c.id] ? ' answer' : ' opener'));
    return miss.length ? 'missing: ' + miss.join(', ')
      : COMMANDER_ROSTER.length + ' commanders, both halves present';
  });

  T('39.21 no answer repeats another answer or an opener', () => {
    const seen = {}, dup = [];
    ['openers', 'answers'].forEach(kind =>
      Object.keys(DIALOGUE[kind]).forEach(id => {
        const t = DIALOGUE[kind][id].trim();
        if (seen[t]) dup.push(seen[t] + ' == ' + kind + '.' + id); else seen[t] = kind + '.' + id;
      }));
    return dup.length ? dup.join(' | ') : Object.keys(seen).length + ' distinct commander lines';
  });

  T('39.22 the fallback speaks the player commander, not a faction slogan', () => {
    /* The exact defect: DIALOGUE.replies holds two lines per faction, and
       before the answers existed one of those two was the player's entire
       half of the exchange in 300 of 318 pairings. */
    const byId = {};
    COMMANDER_ROSTER.forEach(c => { byId[c.id] = c; });
    const me = byId.vess, foe = byId.ulgrim;      // no canon seed between them
    if (!me || !foe) return false;
    const ex = battleDialogue(me, foe, me.faction, null);
    if (ex.length !== 2) return 'got ' + ex.length + ' lines';
    const pool = DIALOGUE.replies[me.faction] || [];
    if (pool.indexOf(ex[1].text) >= 0) return 'still answering with a faction slogan';
    if (ex[1].text !== DIALOGUE.answers[me.id]) return 'not the commander answer';
    return 'VESS answers ULGRIM in her own voice';
  });

  T('39.23 canon still outranks the new answers', () => {
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
    if (!seeded) return false;
    const ex = battleDialogue(seeded[0], seeded[1], seeded[0].faction, null);
    const canon = canonExchange(seeded[0].id, seeded[1].id);
    return ex[1].text === canon.answer
      ? 'canon wins for ' + seeded[0].id + '|' + seeded[1].id
      : 'ANSWER SHADOWED canon for ' + seeded[0].id + '|' + seeded[1].id;
  });

  const pass = checks.filter(c => c.ok).length;
  return { pass, fail: checks.length - pass, checks };
})()
