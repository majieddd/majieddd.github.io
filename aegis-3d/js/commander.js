/* lowpoly/js/commander.js — the four commanders and their eight abilities
   (the 2D game's faction starters with their canonical pairs). Abilities are
   timed buffs over the whole field with their own VFX language; broardside and
   dampening field are point-targeted and use the placement cursor. */
(function () {
  'use strict';

  const C = { current: null };

  function make(def) {
    return {
      id: def.id,
      def,
      faction: def.faction,
      passive: def.passive,
      Q: { def: def.Q, cd: 0 },
      E: { def: def.E, cd: 0 },
      QActiveT: 0, EActiveT: 0,
      emitT: 0,
      castPending: null   // 'E' while waiting for a ground click
    };
  }

  C.select = function (id) {
    C.current = make(Data.COMMANDERS.find((c) => c.id === id));
    Audio.setFactionRoot(C.current.faction);
    return C.current;
  };

  C.tick = function (dt, time) {
    const c = C.current;
    if (!c) return;
    c.Q.cd = Math.max(0, c.Q.cd - dt);
    c.E.cd = Math.max(0, c.E.cd - dt);
    if (c.QActiveT > 0) {
      c.QActiveT -= dt;
      if (c.QActiveT <= 0) onEnd(c, 'Q');
    }
    if (c.EActiveT > 0) {
      c.EActiveT -= dt;
      if (c.EActiveT <= 0) onEnd(c, 'E');
    }

    /* Per-frame active VFX, throttled. */
    c.emitT -= dt;
    if (c.emitT <= 0) {
      c.emitT = 0.12;
      if (c.QActiveT > 0) QAmbient(c, dt);
    }
  };

  function QAmbient(c) {
    const col = c.def.Q.name === 'OVERCLOCK' ? '#38e8ff'
      : c.def.Q.name === 'ZEALOTRY' ? '#fbbf24'
      : c.def.Q.name === 'RAVENOUS' ? '#a855f7' : '#ef4444';
    for (const t of Towers.list) {
      if (Math.random() < 0.3) {
        FX.burst(t.x + (Math.random() - 0.5) * 1.6, t.y + 1.4, t.z + (Math.random() - 0.5) * 1.6, col, 1, 1.4, 0.4, 0.16, { gravity: 1 });
      }
    }
    if (c.def.Q.name === 'BROADSIDE') {
      /* One shell per interval during the window. */
      if (c.broadT === undefined) c.broadT = 0;
      c.broadT -= 0.12;
      if (c.broadT <= 0) {
        c.broadT = c.def.Q.dur / c.def.Q.shells;
        const alive = Units.list.filter((e) => !e.dead && !e.flying);
        if (alive.length) {
          const e = alive[Math.random() * alive.length | 0];
          /* Incoming shell: a rising streak, then the strike. */
          FX.beam(e.x, 60, e.z + 14, e.x, e.y + 4, e.z, 0xef4444, 0.16, 0.5);
          FX.burst(e.x, 60, e.z + 14, '#fda4af', 8, 4, 0.5, 0.3, {});
          const c2 = c;
          Game.delayed(0.42, () => {
            if (e.dead) return;
            FX.explosion(e.x, e.y, e.z, 'ember', 2.0);
            FX.shake(0.3);
            Units.damageInRadius(e.x, e.z, c2.def.Q.shellRadius, c2.def.Q.shellDmg, 'fire', null, { splash: true, noMark: true });
            Audio.sfx.impactFire(e.x);
          });
        }
      }
    }
  }

  function onEnd(c, which) {
    if (which === 'E' && c.def.E.name === 'SANCTIFY') {
      for (const t of Towers.list) t.hp = t.maxHp;
    }
  }

  /* Buff query: does the current ability window modify a stat? */
  C.damageMul = function () {
    const c = C.current;
    if (!c) return 1;
    if (c.QActiveT > 0) {
      if (c.def.Q.damageMul) return c.def.Q.damageMul;
    }
    return 1;
  };
  C.rateMul = function () {
    const c = C.current;
    if (!c) return 1;
    if (c.QActiveT > 0 && c.def.Q.rateMul) return c.def.Q.rateMul;
    return 1;
  };
  C.takenMulActive = function () {
    const c = C.current;
    return !!(c && c.QActiveT > 0 && c.def.Q.takenMul);
  };

  /* Point-targeted E (Dampening Field). Called from Game with a ground click,
     or directly if no cast is needed. Returns true if the cast was consumed. */
  C.castE = function (x, z) {
    const c = C.current;
    if (!c || c.E.cd > 0) return false;
    const def = c.def.E;
    if (def.cast) {
      /* Requires a ground target; if none supplied yet, ask Game for the cursor. */
      if (x === undefined) {
        if (Game.state === 'battle') Game.requestCastE();
        return false;
      }
      c.E.cd = def.cd;
      c.EActiveT = def.dur;
      const radius = def.radius;
      for (const e of Units.list) {
        if (e.dead) continue;
        if (Util.dist2(e.x, e.z, x, z) < radius * radius) {
          e.slow = Math.max(e.slow, def.slow);
          e.slowT = Math.max(e.slowT, def.dur);
        }
      }
      FX.ring(x, Terrain.heightAt(x, z) + 0.2, z, 0x38e8ff, radius, 0.9);
      FX.cloud(x, Terrain.heightAt(x, z) + 0.05, z, 0x38e8ff, radius, def.dur, 0.16, true);
      Audio.sfx.waveStart();
      return true;
    }
    /* Instant E. */
    c.E.cd = def.cd;
    c.EActiveT = def.dur;
    const name = def.name;
    if (name === 'SANCTIFY') {
      Audio.sfx.heal(0);
      for (const t of Towers.list) {
        t.hp = t.maxHp;
        FX.ring(t.x, t.y + 0.8, t.z, 0xfbbf24, 1.8, 0.8);
        FX.burst(t.x, t.y + 1.4, t.z, '#fbbf24', 8, 3, 0.6, 0.26, {});
      }
    } else if (name === 'CONSUME') {
      let drained = 0;
      for (const e of Units.list) {
        if (e.dead) continue;
        const dmg = e.hp * def.drainPct;
        drained += dmg;
        e.takeDamage(dmg, 'void', null, { noMark: true });
        FX.burst(e.x, e.y + 1.2, e.z, '#a855f7', 6, 3, 0.5, 0.24, {});
      }
      const gold = Math.round(drained * 0.5);
      Game.gold += gold;
      Game.stats.goldEarned += gold;
      FX.callout(0, 10, 0, '+' + gold, '#fbbf24', 0.8);
      Audio.sfx.coin();
    } else if (name === 'SMOKESCREEN') {
      Audio.sfx.shootCanister(0);
      for (const e of Units.list) {
        if (e.dead) continue;
        e.slow = Math.max(e.slow, def.slow);
        e.slowT = Math.max(e.slowT, def.dur);
        e.shred = Math.max(e.shred || 0, def.shred);
        FX.cloud(e.x, e.y, e.z, 0x94a3b8, 1.6, 1.0, 0.3, false);
      }
    }
    return true;
  };

  /* ------------------------------------------------------------ */
  C.castQ = function () {
    const c = C.current;
    if (!c || c.Q.cd > 0) return false;
    c.Q.cd = c.def.Q.cd;
    c.QActiveT = c.def.Q.dur;
    c.broadT = 0.35;
    const name = c.def.Q.name;
    Audio.sfx.waveStart();
    FX.hitStop(0.04);
    for (const t of Towers.list) {
      FX.ring(t.x, t.y + 0.6, t.z, 0xffffff, 2.0, 0.5);
    }
    if (name === 'OVERCLOCK') {
      for (const t of Towers.list) FX.burst(t.x, t.y + 1.2, t.z, '#38e8ff', 10, 4, 0.6, 0.3, {});
    } else if (name === 'ZEALOTRY') {
      for (const t of Towers.list) FX.burst(t.x, t.y + 1.2, t.z, '#fbbf24', 10, 4, 0.6, 0.3, {});
    } else if (name === 'RAVENOUS') {
      for (const e of Units.list) {
        if (e.dead) continue;
        FX.ring(e.x, e.y + 0.4, e.z, 0xa855f7, 1.4, 0.5);
        e.takenMulT = c.def.Q.dur;
      }
    } else if (name === 'BROADSIDE') {
      FX.callout(Terrain.posAt(0.5).x, 12, Terrain.posAt(0.5).z, 'BROADSIDE', '#ef4444', 1.2);
    }
    return true;
  };

  /* ------------------------------------------------------------ */
  C.overclockActive = function () {
    const c = C.current;
    return !!(c && c.QActiveT > 0 && c.def.Q.rateMul);
  };

  window.Commander = C;
})();
