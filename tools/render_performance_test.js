/* Browser pins for camera culling and overview detail. The comparison runs in
   one page so Canvas, viewport, GPU and thermal state are shared. Absolute
   timings are information only; semantic visibility and the relative win are
   gates. This harness owns its page because it replaces the active match. */
(async function () {
  'use strict';

  const checks = [];
  function add(id, verdict, detail) { checks.push({ id, verdict, detail }); }
  function stat(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const at = f => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
    return {
      n: sorted.length,
      p50: +at(0.5).toFixed(3),
      p95: +at(0.95).toFixed(3),
      max: +sorted[sorted.length - 1].toFixed(3),
      total: +sorted.reduce((a, b) => a + b, 0).toFixed(3)
    };
  }

  Game.loop = function () {};
  const profile = Meta.load();
  profile.seenEnemies = Object.keys(ENEMY_TYPES);
  Meta.save();
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById('screen-game').classList.remove('hidden');
  Game.start({ maelstrom: 20, epoch: 0, skirmish: true, difficulty: 'contested',
               seed: 7331, commander: COMMANDERS[0].id, faction: 'human',
               loadout: ['bolt', 'cryo', 'mortar', 'flak'] });
  Game.state = 'playing';
  await new Promise(resolve => setTimeout(resolve, 500));

  Game.waveRunning = false;
  Game.spawnQueue.length = 0; Game.constructs.length = 0;
  Game.projectiles.length = 0; Game.enemies.length = 0;
  Game.puddles.length = 0; Game.particles.length = 0;
  Game.beams.length = 0; Game.floaters.length = 0;
  Game.incubators.length = 0;
  for (const side of Game.sides) side.towers.length = 0;
  Game.cam.x = 0; Game.cam.y = 0; Game.cam.z = 1;
  Game.draw();

  const view = Game._renderView;
  const visibleY = view.top + (view.bottom - view.top) * 0.35;
  const hiddenY = view.bottom + 440;
  const left = Math.max(80, view.left + 80);
  const span = Math.max(200, Math.min(Game.width - left - 80, view.right - view.left - 160));

  function drawBody(ctx) {
    this.draws++;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.color; ctx.shadowBlur = 9;
    ctx.fillStyle = this.color;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(k * 2 - 3, k - 2, 8 + k, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
  }
  function makeBody(i, visible, kind) {
    return {
      x: left + (i * 47) % span,
      y: (visible ? visibleY : hiddenY) + (i % 17) * 3,
      radius: 11, color: kind === 'tower' ? '#38e8ff' : kind === 'projectile' ? '#ffd166' : '#f87171',
      flying: kind === 'enemy' && i % 7 === 0,
      def: {}, foot: 1, rangePx: 72, wards: null,
      isSupport: false, draws: 0, draw: drawBody
    };
  }

  const visibleBodies = [], hiddenBodies = [];
  for (let i = 0; i < 450; i++) visibleBodies.push(makeBody(i, true, 'enemy'));
  for (let i = 0; i < 900; i++) hiddenBodies.push(makeBody(i, false, 'enemy'));
  Game.enemies = visibleBodies.concat(hiddenBodies);
  const visibleTowers = [], hiddenTowers = [];
  for (let i = 0; i < 180; i++) visibleTowers.push(makeBody(i, true, 'tower'));
  for (let i = 0; i < 360; i++) hiddenTowers.push(makeBody(i, false, 'tower'));
  Game.sides[0].towers = visibleTowers.concat(hiddenTowers);
  const visibleShots = [], hiddenShots = [];
  for (let i = 0; i < 280; i++) visibleShots.push(makeBody(i, true, 'projectile'));
  for (let i = 0; i < 560; i++) hiddenShots.push(makeBody(i, false, 'projectile'));
  Game.projectiles = visibleShots.concat(hiddenShots);
  for (let i = 0; i < 300; i++) Game.particles.push({
    x: left + (i * 31) % span, y: i < 100 ? visibleY : hiddenY,
    life: 1, maxLife: 1, size: 5, kind: 'spark', color: '#38e8ff'
  });
  for (let i = 0; i < 90; i++) Game.puddles.push({
    x: left + (i * 59) % span, y: i < 30 ? visibleY : hiddenY,
    life: 1, maxLife: 1, radius: 26, seed: i
  });

  Game.draw();
  const visibleDrawn = visibleBodies.concat(visibleTowers, visibleShots).every(o => o.draws === 1);
  const hiddenRejected = hiddenBodies.concat(hiddenTowers, hiddenShots).every(o => o.draws === 0);
  add('render.1 camera culls only offscreen bodies', visibleDrawn && hiddenRejected ? 'PASS' : 'FAIL',
      'visible drawn ' + visibleDrawn + ', hidden rejected ' + hiddenRejected +
      ', view bottom ' + view.bottom.toFixed(1) + ', hidden y ' + hiddenY.toFixed(1));

  /* Drive a real Enemy through both detail levels. Method counters prove the
     overview policy without depending on screenshot pixels. */
  const base = Object.values(ENEMY_TYPES).find(d => !d.boss && !d.miniboss && !d.aura);
  const probe = new Enemy(base, Game.lanes[0][0], { hostileTo: 0 });
  probe.x = Game.width * 0.5; probe.y = Game.height * 0.5;
  probe.hp = probe.maxHp * 0.5;
  let bars = 0, glyphs = 0;
  probe.drawHealthBar = function () { bars++; };
  probe.drawStatusGlyphs = function () { glyphs++; };
  Game.enemies = [probe]; Game.projectiles = [];
  Game.particles = []; Game.puddles = [];
  Game.sides[0].towers = [];
  Game.cam.z = 1; Game.draw();
  const detailNormal = !Game.renderOverview && bars === 1 && glyphs === 1;
  Game.cam.z = Game.camMinZoom(); Game.draw();
  const detailOverview = Game.renderOverview && bars === 1 && glyphs === 1;
  probe.hp = probe.maxHp * 0.2; Game.draw();
  const criticalRetained = bars === 2 && glyphs === 1;
  add('render.2 overview keeps signal and drops subpixel labels',
      detailNormal && detailOverview && criticalRetained ? 'PASS' : 'FAIL',
      'normal ' + detailNormal + ', overview ' + detailOverview +
      ', critical bar ' + criticalRetained + ', calls ' + bars + '/' + glyphs);

  Game.enemies = visibleBodies.concat(hiddenBodies);
  Game.sides[0].towers = visibleTowers.concat(hiddenTowers);
  Game.projectiles = visibleShots.concat(hiddenShots);
  Game.cam.z = 1;
  const circleVisible = Game.renderCircleVisible;
  const boundsVisible = Game.renderBoundsVisible;
  function bench(culled, rounds) {
    const samples = [];
    Game.renderCircleVisible = culled ? circleVisible : function () { return true; };
    Game.renderBoundsVisible = culled ? boundsVisible : function () { return true; };
    try {
      for (let r = 0; r < rounds; r++) {
        const t0 = performance.now(); Game.draw(); samples.push(performance.now() - t0);
      }
    } finally {
      Game.renderCircleVisible = circleVisible;
      Game.renderBoundsVisible = boundsVisible;
    }
    return stat(samples);
  }
  bench(false, 8); bench(true, 8);
  const full = bench(false, 50);
  const culled = bench(true, 50);
  const speedup = full.total / Math.max(0.001, culled.total);
  add('render.3 camera culling removes invisible Canvas work', speedup >= 1.35 ? 'PASS' : 'FAIL',
      speedup.toFixed(2) + 'x, full ' + full.total + 'ms, culled ' + culled.total + 'ms');
  add('render.info draw samples', 'INFO', JSON.stringify({ full, culled }));

  const pass = checks.filter(c => c.verdict === 'PASS').length;
  const fail = checks.filter(c => c.verdict === 'FAIL').length;
  const info = checks.filter(c => c.verdict === 'INFO').length;
  return { pass, fail, info, checks };
})();
