/* SANDBOX. A playable ten wave tower defence on the voxel renderer.

   This is a TEST BED, not a port of the real game. It deliberately shares no
   code with js/game.js so that neither can break the other. What it is for is
   answering the question the phase study raised and could not settle from
   still images: does the textured voxel register hold up in MOTION, at a
   camera where the texture is actually visible.

   THE CAMERA IS THE POINT. Units bake at 74px tall here against the shipping
   game's 4 to 36px, because the scale test showed the register needs 64px
   minimum to read. If this feels too zoomed in to play, that is a real result
   and it is the cheapest possible way to find it out. */
'use strict';

var Sandbox = (function () {

  /* ---- board ---------------------------------------------------------- */

  var TILE_W = 76, TILE_H = 38;        /* isometric diamond, 2:1 */
  var COLS = 9, ROWS = 9;

  /* The lane, as grid coordinates. Enemies walk this in order. Hand authored
     so the sandbox has a readable S bend rather than a generated maze. */
  var PATH = [
    [0,2],[1,2],[2,2],[3,2],[4,2],
    [4,3],[4,4],[4,5],
    [3,5],[2,5],
    [2,6],[2,7],
    [3,7],[4,7],[5,7],[6,7],
    [6,6],[6,5],[6,4],
    [7,4],[8,4]
  ];

  /* Tower pads, chosen to sit beside the lane without blocking it. */
  var PADS = [[2,1],[5,3],[1,4],[3,6],[5,6],[7,6],[7,3],[5,1]];

  function key(c, r) { return c + ',' + r; }
  var PATH_SET = Object.create(null);
  PATH.forEach(function (p) { PATH_SET[key(p[0], p[1])] = true; });

  /* Grid to screen. Origin is set at init so the board sits centred. */
  var originX = 0, originY = 0;
  function iso(c, r) {
    return [ originX + (c - r) * (TILE_W / 2),
             originY + (c + r) * (TILE_H / 2) ];
  }

  /* ---- content -------------------------------------------------------- */

  var ENEMIES = {
    trooper:  { hp: 46,  speed: 0.85, bounty: 9,  model: 'trooper',  label: 'Trooper'  },
    gnawling: { hp: 30,  speed: 1.55, bounty: 7,  model: 'gnawling', label: 'Gnawling' },
    ironhulk: { hp: 190, speed: 0.48, bounty: 26, model: 'ironhulk', label: 'Ironhulk' },
    splicer:  { hp: 88,  speed: 1.00, bounty: 16, model: 'splicer',  label: 'Splicer'  }
  };

  var TOWERS = {
    bolt:      { cost: 50,  range: 165, dps: 26, rate: 0.42, model: 'bolt',      label: 'BOLT',
                 blurb: 'Fast single target. The reliable one.' },
    sepulchre: { cost: 95,  range: 132, dps: 62, rate: 1.05, model: 'sepulchre', label: 'SEPULCHRE',
                 blurb: 'Slow heavy shots. Good against armour.' },
    maw:       { cost: 120, range: 108, dps: 30, rate: 0.60, model: 'maw',       label: 'MAW',
                 blurb: 'Splashes every enemy in its ring.', splash: 64 }
  };

  /* Ten waves. Each entry is a list of [type, count, spacingSeconds]. */
  var WAVES = [
    [['trooper', 6, 0.85]],
    [['trooper', 9, 0.70]],
    [['gnawling', 12, 0.42]],
    [['trooper', 8, 0.60], ['gnawling', 8, 0.40]],
    [['splicer', 7, 0.75]],
    [['gnawling', 16, 0.32], ['splicer', 4, 1.10]],
    [['ironhulk', 3, 2.10], ['trooper', 10, 0.55]],
    [['splicer', 10, 0.55], ['gnawling', 14, 0.30]],
    [['ironhulk', 5, 1.70], ['splicer', 8, 0.65]],
    [['ironhulk', 8, 1.30], ['splicer', 12, 0.50], ['gnawling', 20, 0.24]]
  ];

  /* ---- state ---------------------------------------------------------- */

  /* Canvas2D filter is not universal, and the hit flash is the only thing that
     wants it. Feature detect once rather than assuming, and fall back to no
     flash rather than to the slab bug. */
  var HAS_FILTER = (function () {
    try {
      var c = document.createElement('canvas').getContext('2d');
      c.filter = 'brightness(2)';
      return c.filter === 'brightness(2)';
    } catch (err) { return false; }
  })();

  var cv, ctx, W, H, sprites = {}, ready = false;
  var state = null, lastTs = 0, running = false;
  var hover = null, selectedTower = 'bolt';
  var onChange = function () {};

  function freshState() {
    return {
      wave: 0, lives: 20, gold: 175,
      phase: 'build',                 /* build | wave | won | lost */
      enemies: [], towers: [], shots: [], floats: [],
      queue: [], spawnTimer: 0, elapsed: 0, killed: 0, leaked: 0
    };
  }

  /* ---- setup ---------------------------------------------------------- */

  function init(canvas, notify) {
    cv = canvas; ctx = cv.getContext('2d');
    onChange = notify || function () {};
    resize();

    /* Bake every model once. 24 angles is enough that rotation reads smooth
       and cheap enough that the whole set costs a few megabytes of canvas. */
    var t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    var totals = { boxes: 0, voxels: 0, shell: 0, faces: 0, bytes: 0 };
    Object.keys(MODELS).forEach(function (k) {
      var px = (TOWERS[k] ? 66 : 74);
      sprites[k] = Vox.make(MODELS[k], px, 24, true);
      var s = sprites[k].stats;
      totals.boxes += s.boxes; totals.voxels += s.voxels;
      totals.shell += s.shell; totals.faces += s.facesPerFrame;
      totals.bytes += s.bakedBytes;
    });
    var t1 = (typeof performance !== 'undefined' ? performance.now() : 0);
    ready = true;
    Sandbox.bakeReport = {
      models: Object.keys(MODELS).length,
      ms: Math.round(t1 - t0),
      boxes: totals.boxes, voxels: totals.voxels, shell: totals.shell,
      facesPerFrame: totals.faces,
      megabytes: +(totals.bytes / 1048576).toFixed(1)
    };

    state = freshState();
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerleave', function () { hover = null; });
    cv.addEventListener('click', onClick);
    running = true;
    requestAnimationFrame(loop);
    draw();
    onChange();
  }

  function resize() {
    var rect = cv.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, Math.round(rect.width));
    H = Math.max(280, Math.round(rect.height));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    originX = W / 2;
    originY = Math.max(40, H / 2 - (COLS + ROWS) * TILE_H / 4);
  }

  /* ---- input ---------------------------------------------------------- */

  function screenToPad(mx, my) {
    var best = null, bd = 34 * 34;
    PADS.forEach(function (p) {
      var s = iso(p[0], p[1]);
      var dx = mx - s[0], dy = my - (s[1] + TILE_H / 2);
      var d = dx*dx + dy*dy;
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  function onMove(e) {
    var r = cv.getBoundingClientRect();
    hover = screenToPad(e.clientX - r.left, e.clientY - r.top);
  }

  function onClick(e) {
    if (!state || state.phase === 'won' || state.phase === 'lost') return;
    var r = cv.getBoundingClientRect();
    var pad = screenToPad(e.clientX - r.left, e.clientY - r.top);
    if (!pad) return;
    var taken = state.towers.some(function (t) { return t.c === pad[0] && t.r === pad[1]; });
    if (taken) return;
    var def = TOWERS[selectedTower];
    if (state.gold < def.cost) { flash('Not enough gold', pad); return; }
    state.gold -= def.cost;
    state.towers.push({ c: pad[0], r: pad[1], type: selectedTower, cool: 0, yaw: 0.7 });
    onChange();
  }

  function flash(text, pad) {
    var s = iso(pad[0], pad[1]);
    state.floats.push({ x: s[0], y: s[1], text: text, life: 1.1, col: '#f87171' });
  }

  /* ---- simulation ------------------------------------------------------ */

  function startWave() {
    if (!state || state.phase !== 'build') return;
    if (state.wave >= WAVES.length) return;
    var spec = WAVES[state.wave];
    state.queue = [];
    spec.forEach(function (grp) {
      var type = grp[0], count = grp[1], gap = grp[2];
      for (var i = 0; i < count; i++) state.queue.push({ type: type, at: i * gap });
    });
    state.queue.sort(function (a, b) { return a.at - b.at; });
    state.spawnTimer = 0;
    state.phase = 'wave';
    onChange();
  }

  function spawn(type) {
    var d = ENEMIES[type];
    var hpScale = 1 + state.wave * 0.16;
    state.enemies.push({
      type: type, t: 0,
      hp: d.hp * hpScale, max: d.hp * hpScale,
      speed: d.speed, bounty: d.bounty, yaw: 0, hurt: 0
    });
  }

  /* Position along the lane, t measured in tiles travelled. */
  function pathPos(t) {
    if (t <= 0) { var a = iso(PATH[0][0], PATH[0][1]); return [a[0], a[1] + TILE_H/2, 0]; }
    var i = Math.floor(t);
    if (i >= PATH.length - 1) {
      var z = iso(PATH[PATH.length-1][0], PATH[PATH.length-1][1]);
      return [z[0], z[1] + TILE_H/2, 0];
    }
    var f = t - i;
    var p0 = iso(PATH[i][0], PATH[i][1]), p1 = iso(PATH[i+1][0], PATH[i+1][1]);
    var x = p0[0] + (p1[0]-p0[0]) * f, y = p0[1] + (p1[1]-p0[1]) * f;
    var yaw = Math.atan2(PATH[i+1][1]-PATH[i][1], PATH[i+1][0]-PATH[i][0]);
    return [x, y + TILE_H/2, yaw];
  }

  function step(dt) {
    if (!state || state.phase === 'won' || state.phase === 'lost') return;
    state.elapsed += dt;

    if (state.phase === 'wave') {
      state.spawnTimer += dt;
      while (state.queue.length && state.queue[0].at <= state.spawnTimer) {
        spawn(state.queue.shift().type);
      }
    }

    /* enemies */
    var i, e;
    for (i = state.enemies.length - 1; i >= 0; i--) {
      e = state.enemies[i];
      e.t += e.speed * dt;
      if (e.hurt > 0) e.hurt -= dt;
      var pp = pathPos(e.t);
      e.x = pp[0]; e.y = pp[1];
      e.yaw = -pp[2] + Math.PI * 0.25;
      if (e.t >= PATH.length - 1) {
        state.enemies.splice(i, 1);
        state.lives -= 1; state.leaked++;
        state.floats.push({ x: e.x, y: e.y, text: '-1 life', life: 1.0, col: '#f87171' });
        if (state.lives <= 0) { state.lives = 0; state.phase = 'lost'; }
        onChange();
      }
    }

    /* towers */
    state.towers.forEach(function (t) {
      var def = TOWERS[t.type];
      t.cool -= dt;
      var s = iso(t.c, t.r);
      var tx = s[0], ty = s[1] + TILE_H/2;
      var target = null, bestT = -1;
      state.enemies.forEach(function (en) {
        var dx = en.x - tx, dy = (en.y - ty) * 2;   /* iso squash correction */
        if (Math.sqrt(dx*dx + dy*dy) <= def.range && en.t > bestT) { bestT = en.t; target = en; }
      });
      if (target) {
        t.yaw = Math.atan2((target.y - ty) * 2, target.x - tx);
        if (t.cool <= 0) {
          t.cool = def.rate;
          fire(t, def, tx, ty, target);
        }
      }
    });

    /* shots */
    for (i = state.shots.length - 1; i >= 0; i--) {
      var sh = state.shots[i];
      sh.life -= dt;
      if (sh.life <= 0) state.shots.splice(i, 1);
    }
    for (i = state.floats.length - 1; i >= 0; i--) {
      state.floats[i].life -= dt;
      state.floats[i].y -= dt * 22;
      if (state.floats[i].life <= 0) state.floats.splice(i, 1);
    }

    /* wave end */
    if (state.phase === 'wave' && !state.queue.length && !state.enemies.length) {
      state.wave += 1;
      if (state.wave >= WAVES.length) { state.phase = 'won'; }
      else { state.phase = 'build'; state.gold += 55 + state.wave * 12; }
      onChange();
    }
  }

  function fire(t, def, tx, ty, target) {
    var dmg = def.dps * def.rate;
    var hits = def.splash
      ? state.enemies.filter(function (en) {
          var dx = en.x - target.x, dy = (en.y - target.y) * 2;
          return Math.sqrt(dx*dx + dy*dy) <= def.splash;
        })
      : [target];
    hits.forEach(function (en) { damage(en, dmg); });
    state.shots.push({ x1: tx, y1: ty - 26, x2: target.x, y2: target.y - 20,
                       life: 0.09, splash: def.splash ? target : null, col: MODELS[def.model].pal[2] });
  }

  function damage(en, dmg) {
    en.hp -= dmg; en.hurt = 0.12;
    if (en.hp <= 0) {
      var idx = state.enemies.indexOf(en);
      if (idx >= 0) {
        state.enemies.splice(idx, 1);
        state.gold += en.bounty; state.killed++;
        state.floats.push({ x: en.x, y: en.y, text: '+' + en.bounty, life: 0.85, col: '#4ade80' });
        onChange();
      }
    }
  }

  /* ---- rendering ------------------------------------------------------- */

  function tileDiamond(c, r) {
    var s = iso(c, r);
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(s[0] + TILE_W/2, s[1] + TILE_H/2);
    ctx.lineTo(s[0], s[1] + TILE_H);
    ctx.lineTo(s[0] - TILE_W/2, s[1] + TILE_H/2);
    ctx.closePath();
  }

  function draw() {
    if (!ready) return;
    ctx.clearRect(0, 0, W, H);

    /* ground */
    var c, r;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var onPath = PATH_SET[key(c, r)];
        tileDiamond(c, r);
        ctx.fillStyle = onPath ? '#151d2e' : '#0d121c';
        ctx.fill();
        ctx.strokeStyle = onPath ? 'rgba(125,211,252,0.20)' : 'rgba(37,46,64,0.55)';
        ctx.lineWidth = 1; ctx.stroke();
      }
    }

    /* lane centre dashes, so the route reads at a glance */
    ctx.strokeStyle = 'rgba(125,211,252,0.30)';
    ctx.setLineDash([5, 7]); ctx.lineWidth = 2;
    ctx.beginPath();
    PATH.forEach(function (p, i) {
      var s = iso(p[0], p[1]);
      if (i === 0) ctx.moveTo(s[0], s[1] + TILE_H/2); else ctx.lineTo(s[0], s[1] + TILE_H/2);
    });
    ctx.stroke(); ctx.setLineDash([]);

    /* pads */
    PADS.forEach(function (p) {
      var taken = state.towers.some(function (t) { return t.c === p[0] && t.r === p[1]; });
      if (taken) return;
      var isHover = hover && hover[0] === p[0] && hover[1] === p[1];
      tileDiamond(p[0], p[1]);
      ctx.fillStyle = isHover ? 'rgba(94,234,212,0.18)' : 'rgba(94,234,212,0.07)';
      ctx.fill();
      ctx.strokeStyle = isHover ? 'rgba(94,234,212,0.85)' : 'rgba(94,234,212,0.35)';
      ctx.lineWidth = isHover ? 2 : 1; ctx.stroke();
    });

    /* hover range ring */
    if (hover) {
      var taken2 = state.towers.some(function (t) { return t.c === hover[0] && t.r === hover[1]; });
      if (!taken2) {
        var hs = iso(hover[0], hover[1]);
        var rng = TOWERS[selectedTower].range;
        ctx.save();
        ctx.translate(hs[0], hs[1] + TILE_H/2); ctx.scale(1, 0.5);
        ctx.beginPath(); ctx.arc(0, 0, rng, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(94,234,212,0.45)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }
    }

    /* Depth sort everything that stands on the ground, so a unit in front of
       a tower actually occludes it. Painter order is screen y. */
    var actors = [];
    state.towers.forEach(function (t) {
      var s = iso(t.c, t.r);
      actors.push({ y: s[1] + TILE_H/2, kind: 'tower', o: t, x: s[0] });
    });
    state.enemies.forEach(function (e) { actors.push({ y: e.y, kind: 'enemy', o: e, x: e.x }); });
    actors.sort(function (a, b) { return a.y - b.y; });

    actors.forEach(function (a) {
      if (a.kind === 'tower') {
        Vox.draw(ctx, sprites[TOWERS[a.o.type].model], a.x, a.y, a.o.yaw);
      } else {
        var e = a.o;
        var spr = sprites[ENEMIES[e.type].model];
        /* Hit flash. An earlier version drew a white fillRect over the unit and
           it read as a floating slab, because a baked sprite is not a box. Tint
           the sprite itself instead: filter is redrawn through the same alpha,
           so it can only ever light up pixels the model actually occupies. */
        if (e.hurt > 0 && HAS_FILTER) {
          Vox.draw(ctx, spr, e.x, e.y, e.yaw);
          ctx.save();
          ctx.globalAlpha = Math.min(0.85, e.hurt * 7);
          ctx.filter = 'brightness(2.8) saturate(0.35)';
          Vox.draw(ctx, spr, e.x, e.y, e.yaw);
          ctx.restore();
        } else {
          Vox.draw(ctx, spr, e.x, e.y, e.yaw);
        }
        /* health bar, only once damaged so the board stays clean */
        if (e.hp < e.max) {
          var w = 30, f = Math.max(0, e.hp / e.max);
          ctx.fillStyle = 'rgba(10,14,23,0.85)';
          ctx.fillRect(e.x - w/2, e.y - 84, w, 4);
          ctx.fillStyle = f > 0.5 ? '#4ade80' : (f > 0.22 ? '#fbbf24' : '#f87171');
          ctx.fillRect(e.x - w/2, e.y - 84, w * f, 4);
        }
      }
    });

    /* shots */
    state.shots.forEach(function (s) {
      ctx.strokeStyle = s.col; ctx.lineWidth = 2.4; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.globalAlpha = 1;
      if (s.splash) {
        ctx.save(); ctx.translate(s.x2, s.y2 + 20); ctx.scale(1, 0.5);
        ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI*2);
        ctx.strokeStyle = s.col; ctx.globalAlpha = 0.5; ctx.lineWidth = 3; ctx.stroke();
        ctx.restore(); ctx.globalAlpha = 1;
      }
    });

    /* floating text */
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    state.floats.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.col;
      ctx.fillText(f.text, f.x, f.y - 90);
      ctx.globalAlpha = 1;
    });
    ctx.textAlign = 'start';

    /* end cards */
    if (state.phase === 'won' || state.phase === 'lost') {
      ctx.fillStyle = 'rgba(10,14,23,0.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = state.phase === 'won' ? '#4ade80' : '#f87171';
      ctx.font = '700 34px "Chakra Petch", ui-sans-serif, sans-serif';
      ctx.fillText(state.phase === 'won' ? 'ALL TEN WAVES HELD' : 'THE LANE BROKE', W/2, H/2 - 6);
      ctx.fillStyle = '#8b97ad';
      ctx.font = '400 14px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(state.killed + ' killed, ' + state.leaked + ' leaked, ' +
                   state.towers.length + ' emplacements built', W/2, H/2 + 22);
      ctx.textAlign = 'start';
    }
  }

  /* ---- loop ------------------------------------------------------------ */

  var fpsAvg = 0;
  function loop(ts) {
    if (!running) return;
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    if (dt > 0) fpsAvg = fpsAvg * 0.92 + (1 / dt) * 0.08;
    lastTs = ts;
    step(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---- api ------------------------------------------------------------- */

  return {
    init: init,
    resize: function () { resize(); draw(); },
    startWave: startWave,
    reset: function () { state = freshState(); onChange(); draw(); },
    select: function (t) { if (TOWERS[t]) selectedTower = t; },
    selected: function () { return selectedTower; },
    towers: TOWERS,
    waves: WAVES.length,
    get: function () { return state; },
    fps: function () { return fpsAvg; },
    bakeReport: null
  };
})();
