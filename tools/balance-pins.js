/* Balance pin harness. Mirror-AI drives BOTH seats so a run reflects competent
   play, and the loadout is PINNED — passing a pool to AI.pickLoadout only sets
   a budget, it never filters cores, so an unpinned run silently re-bases. */
window.PINS = (function () {
  const PIN = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
  const KEY = Meta.KEY;

  function wipe() { try { localStorage.removeItem(KEY); } catch (e) {} Meta._root = null; }

  function maxProfile(tier) {
    wipe();
    const p = Meta.load();
    for (const c of COMMANDERS) {
      p.commanders[c.id].xp = 999999;
      p.commanders[c.id].unlocked = c.tech.map(t => t.id);
    }
    for (const id of TOWER_ORDER) p.towerXp[id] = 999999;
    const v = Meta.vault();
    /* Unlocks are shelved PER BANNER since 19.6, so writing the retired flat
       list would leave the "maxed" pin holding one tower and read as a
       catastrophe -- the third documented way to mis-measure this pin. */
    for (const k of Object.keys(v.unlockedBy)) v.unlockedBy[k] = TOWER_ORDER.slice();
    v.cmdUnlocked = COMMANDERS.map(c => c.id);
    p.souls = 99999;
    /* Galaxy tier is DELIBERATELY left at zero. It multiplies enemy scaling,
       so a maxed-unlocks run at tier 4 measures the escalation curve, not the
       player's ceiling -- and the documented 26-27 pin is the ceiling. */
    p.galaxyTier = tier;
    p.campaign = p.campaign || {};
    p.campaign.tier = tier;
    Meta.save();
  }

  /* A maxed run can outlast any single tool call, so the loop is RESUMABLE:
     begin() arms it, tick(n) advances at most n frames and reports. */
  let R = null;

  function begin(mapIdx, diff) {
    Game.start({
      map: MAPS[mapIdx % MAPS.length].id,
      difficulty: diff,
      loadout: PIN.slice(),
      commander: COMMANDERS[0].id,
      skirmish: false
    });
    Game.sides[0].loadout = PIN.slice();
    const brain = Object.create(AI);
    brain.init(Game.sides[0], Game.difficulty);
    brain.loadout = PIN.slice();
    R = { brain: brain, steps: 0, map: MAPS[mapIdx % MAPS.length].id, err: null };
    return R.map;
  }

  const DT = 1 / 60;
  const CAP = 60 * 60 * 45;

  function tick(n) {
    if (!R) return { done: true, err: 'not begun' };
    let i = 0;
    while (i < n && Game.state !== 'over' && R.steps < CAP) {
      if (Game.state === 'choosing' && Game.pendingChoice)
        Game.takeMod(Game.pendingChoice[0]);
      else if (Game.state === 'escalating' && Game.pendingEscalation)
        (Game.takeEscalation || Game.takeMod).call(Game, Game.pendingEscalation[0]);
      else {
        try { R.brain.update(DT, Game); Game.step(DT); }
        catch (e) { R.err = String(e); break; }
      }
      R.steps++; i++;
    }
    const done = !!R.err || Game.state === 'over' || R.steps >= CAP;
    /* A run can end EITHER way, and "wave reached" alone conflates the two:
       a wave-7 finish is a rout if the player died and a rout the other way
       if the rival did. Compare like with like or the pin means nothing. */
    const lives = Game.sides.map(s => s.lives);
    const outcome = !done ? 'running'
      : lives[0] <= 0 ? 'loss'
      : lives.slice(1).every(l => l <= 0) ? 'win' : 'capped';
    return { done: done, wave: Game.wave, steps: R.steps, err: R.err,
             capped: R.steps >= CAP, map: R.map, state: Game.state,
             outcome: outcome, lives: lives };
  }

  function runOne(mapIdx, diff) {
    begin(mapIdx, diff);
    let r;
    do { r = tick(20000); } while (!r.done);
    return { wave: r.wave, steps: r.steps, timeout: r.capped, err: r.err };
  }

  function med(a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

  return {
    begin: begin, tick: tick, maxProfile: maxProfile, wipe: wipe,
    fresh(n) {
      const out = [];
      for (let i = 0; i < n; i++) { wipe(); out.push(runOne(i, 'contested')); }
      const w = out.filter(r => !r.err).map(r => r.wave);
      return { runs: out, median: med(w), max: Math.max.apply(null, w), errs: out.filter(r => r.err) };
    },
    maxed(n, tier) {
      const out = [];
      for (let i = 0; i < n; i++) { maxProfile(tier || 0); out.push(runOne(i, 'contested')); }
      const w = out.filter(r => !r.err).map(r => r.wave);
      return { runs: out, median: med(w), max: Math.max.apply(null, w), errs: out.filter(r => r.err) };
    }
  };
})();
'PINS ready';
