/* DO FRIENDLY BODIES EVER FIGHT EACH OTHER?
 *
 * Owner: "the humans troops ... are almost attacking eachother ... when they
 * are coming out of the gate."
 *
 * Two possibilities and they need different fixes, so this distinguishes them
 * instead of guessing:
 *
 *   1. A REAL pairing bug. resolveMelee engages a pair that share a side, so
 *      the player's own bodies genuinely trade blows. That is a defect.
 *   2. A READABILITY failure. The pairs are legitimate (a sent body of yours
 *      against a WAVE body), but on a human-held world the wave roster is
 *      drawn from FACTION_ENEMIES[holder], so both bodies are human units
 *      wearing the same sprite. It looks like friendly fire and is not.
 *
 * Instruments resolveMelee directly and records every pair it engages.
 */
(function meleeFF() {
  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', pass: !!cond, detail: String(detail).slice(0, 300) });
  const info = (id, detail) =>
    C.push({ id: id, verdict: 'INFO', pass: true, detail: String(detail).slice(0, 300) });

  const PIN = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
  Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });

  /* Watch every strike resolveMelee lands, by wrapping takeDamage for the
     duration. The pairing itself is what is under test, so nothing here may
     change it. */
  const seen = [];
  const origTake = Enemy.prototype.takeDamage;
  let capturing = true;
  Enemy.prototype.takeDamage = function (amt, type, opts) {
    if (capturing && this._ffAttacker) {
      const a = this._ffAttacker;
      seen.push({
        aOwner: a.owner, aHostile: a.hostileTo, aType: a.def && a.def.id,
        vOwner: this.owner, vHostile: this.hostileTo, vType: this.def && this.def.id
      });
    }
    return origTake.call(this, amt, type, opts);
  };
  /* resolveMelee calls best.takeDamage(...) with `e` as the attacker, and the
     attacker is not passed, so it is stamped on the victim just before the
     call by re-implementing the same pairing scan is NOT acceptable: that
     would test a copy. Instead the engine's own loop is run and the attacker
     is recovered from _meleeRef, which resolveMelee maintains. */
  const origResolve = Game.resolveMelee.bind(Game);
  Game.resolveMelee = function (dt) {
    for (const e of Game.enemies) if (e._meleeRef) e._meleeRef._ffAttacker = e;
    return origResolve(dt);
  };

  /* Seed a real fight: wave bodies aimed at seat 0, plus sent bodies of seat 0
     aimed at seat 1, all near the mouth where the owner reports it. */
  const S = Game.sides[0];
  S.doctrine = 'human';
  for (let i = 0; i < 8; i++)
    Game.spawnFromQueue({ side: 0, type: 'trooper', lane: 0, hpMul: 1, bountyMul: 1, rageMul: 1 });
  const base = ENEMY_TYPES['trooper'];
  const path = Game.sendPathFor(0, 1, base);
  for (let i = 0; i < 8; i++)
    Game.enemies.push(new Enemy(base, path, { hostileTo: 1, owner: 0, startDist: 120 + i * 6 }));
  for (const e of Game.enemies) e.updatePosition();
  /* PUT THEM ON TOP OF EACH OTHER. The first cut spawned wave bodies on the
     LANE path and sent bodies on the SEND path, which are opposite ends of the
     board: they never came within MELEE_RANGE_PAD and the probe recorded ZERO
     strikes, so F1 and F2 passed having measured nothing at all. A vacuous
     green is worse than a red here, because the question is whether a pairing
     happens. Co-locating them is what the veterancy check does for the same
     reason. */
  const live = Game.enemies.filter(e => !e.dead && !e.leaked);
  const cx = live.length ? live[0].x : 0, cy = live.length ? live[0].y : 0;
  for (const e of live) { e.x = cx + (Math.random() - 0.5) * 6; e.y = cy + (Math.random() - 0.5) * 6; }
  info('F0 setup', live.length + ' bodies co-located at ' + Math.round(cx) + ',' + Math.round(cy) +
       '; roles ' + [...new Set(live.map(e => e.role))].join('/') +
       '; UNIT_ROLES_ON=' + (typeof UNIT_ROLES_ON !== 'undefined' ? UNIT_ROLES_ON : '?'));

  for (let i = 0; i < 200; i++) Game.resolveMelee(0.05);
  capturing = false;
  Enemy.prototype.takeDamage = origTake;
  Game.resolveMelee = origResolve;

  info('F0 engagements observed', seen.length + ' melee strikes recorded');

  /* ---- F1 no pair that shares a side ever engages ---------------------- */
  const sameSide = seen.filter(p => p.aOwner >= 0 && p.vOwner >= 0 && p.aOwner === p.vOwner);
  ok('F1 two bodies of the same commander never fight each other',
     sameSide.length === 0,
     sameSide.length
       ? sameSide.length + ' same-owner strikes, e.g. owner ' + sameSide[0].aOwner +
         ' ' + sameSide[0].aType + ' hit owner ' + sameSide[0].vOwner + ' ' + sameSide[0].vType
       : 'no strike had a matching owner on both sides');

  /* ---- F2 no pair that shares a target ever engages -------------------- */
  const sameTarget = seen.filter(p => p.aHostile === p.vHostile);
  ok('F2 two bodies marching on the same commander never fight each other',
     sameTarget.length === 0,
     sameTarget.length
       ? sameTarget.length + ' strikes between bodies both aimed at seat ' + sameTarget[0].aHostile
       : 'every strike was between bodies aimed at different seats');

  /* ---- F3 how much of it LOOKS like friendly fire ---------------------- */
  /* The readability question, and the one that is most likely the report:
     a legitimate pair wearing the same sprite. */
  const lookalike = seen.filter(p => p.aType === p.vType);
  info('F3 same-sprite engagements',
       lookalike.length + ' of ' + seen.length + ' strikes were between bodies of the ' +
       'IDENTICAL unit type' + (lookalike.length ? ' (e.g. ' + lookalike[0].aType +
       ' owner ' + lookalike[0].aOwner + ' against ' + lookalike[0].vType +
       ' owner ' + lookalike[0].vOwner + '), which is legitimate but reads as friendly fire' : ''));

  const pass = C.filter(c => c.verdict === 'PASS').length;
  const fail = C.filter(c => c.verdict === 'FAIL').length;
  const out = { pass: pass, fail: fail, info: C.length - pass - fail, checks: C };
  window.__SWEEP = out;
  return out;
})()
