/* RELIQUARY :: 13-game
   The loop, the camera, the input, and the drawing of everything the sim
   owns. This is the layer where the simulation becomes a picture.

   FIXED TIMESTEP, INTERPOLATED NOTHING. The sim runs at a fixed 120Hz
   substep and the renderer draws whatever the latest state is. Interpolation
   was considered and rejected: at 120Hz the positional error is under a
   millimetre at gameplay speeds, and the bookkeeping to interpolate every
   rig, turret and particle would cost more than it buys.

   THE ACCUMULATOR IS CLAMPED. A backgrounded tab produces a multi-second dt on
   its first frame back. Feeding that to the accumulator makes the sim run
   hundreds of substeps in one frame, which locks the page for a second and
   then dumps a wave that spawned while nobody was looking. Clamping to 0.25s
   loses time and keeps the game playable, which is the correct trade. */
'use strict';

var GAME = (function () {

  var V = U.V;
  var canvas = null;
  var running = false;
  var raf = 0;
  var lastT = 0;
  var accum = 0;
  var STEP = 1 / 120;

  var speed = 1;
  var paused = false;
  var G = null;

  /* rig instances, keyed by denizen uid, pooled by archetype */
  var rigs = Object.create(null);
  var rigPool = Object.create(null);
  var liveUids = new Set();

  var cam = {
    yaw: 0, pitch: 0.86, dist: 74,
    targetYaw: 0, targetPitch: 0.86, targetDist: 74,
    focus: [0, 0, 0], targetFocus: [0, 0, 0],
    fitDist: 100, shakeSeed: 0
  };

  var input = {
    mx: 0, my: 0, down: false, dragging: false,
    lastX: 0, lastY: 0, dragDist: 0,
    hoverPlot: null, hoverTower: null, ground: null
  };

  var stats = { fps: 60, frameMs: 0, drawCalls: 0, particles: 0, tris: 0 };
  var fpsSamples = [];

  var errors = [];
  function recordError(where, e) {
    if (errors.length < 40) errors.push({ where: where, msg: String(e && e.message || e) });
    if (typeof console !== 'undefined') console.error('[GAME:' + where + ']', e);
  }

  /* ---------- boot ---------- */

  function init(cv) {
    canvas = cv;
    R.init(cv);
    resize();
    window.addEventListener('resize', resize);
    bindInput();
    return true;
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    /* DPR IS CAPPED AT 1.5, NOT 2.
       The post chain is fill-rate bound, so cost scales with the SQUARE of the
       device pixel ratio: at 2 on a Retina or 4K panel the game renders four
       times the logical pixels, and the player simply experiences that as
       slow. 1.5 keeps edges and the ink pass crisp while cutting the pixel
       count by 44 percent against 2. The adaptive scaler tunes from there. */
    R.resize(w, h, Math.min(1.5, window.devicePixelRatio || 1));
    /* Re-fit on resize, so rotating a tablet or dragging a window narrow does
       not leave half the board off screen. */
    if (G) fitCamera(true);
  }

  function fitCamera(keepUserZoom) {
    if (!G) return;
    var aspect = R.W / Math.max(1, R.H);
    var extent = Math.max(G.board.halfW / aspect, G.board.halfH) * 1.12;
    var d = extent / Math.tan(R.cam.fov / 2);
    d = U.clamp(d, 30, 210);
    /* On a resize the player may have zoomed deliberately, so only the LIMIT
       moves; on a fresh run the camera snaps to the fit. */
    if (keepUserZoom) {
      cam.targetDist = Math.min(cam.targetDist, d);
    } else {
      cam.targetDist = cam.dist = d;
      cam.targetYaw = cam.yaw = 0;
      cam.targetPitch = cam.pitch = 0.86;
      cam.focus = [0, 0, 0];
      cam.targetFocus = [0, 0, 0];
    }
    cam.fitDist = d;
  }

  /* Board meshes belong to a RUN, not to the cache, because the board changes
     between runs. GL.mesh uploads a VAO and one or two buffers per call, and
     nothing reclaims them when the reference is dropped: WebGL objects are not
     garbage collected on the JS side. Twenty restarts leaked twenty ground
     meshes and twenty decor meshes of GPU memory, which is invisible until it
     is not. */
  /* One fixed sun for the whole game. A moving key light would mean recomputing
     the shadow box and re-baking nothing, for no gameplay gain. */
  var SUN_DIR = [0.34, 0.88, 0.42];

  var runMeshes = [];
  function trackMesh(m) { if (m) runMeshes.push(m); return m; }
  function disposeRunMeshes() {
    for (var i = 0; i < runMeshes.length; i++) {
      try { runMeshes[i].dispose(); } catch (e) { recordError('disposeMesh', e); }
    }
    runMeshes.length = 0;
  }

  function start(opts) {
    disposeRunMeshes();
    G = SIM.create(opts);
    R.setPalette(opts.faction || 'human');
    rigs = Object.create(null);
    rigPool = Object.create(null);
    FX.clear();

    /* Board meshes, rebuilt per run because the board can change. */
    G.groundMesh = trackMesh(GL.mesh(G.board.groundData));
    G.padMesh = G.board.padData ? trackMesh(GL.mesh(G.board.padData)) : null;
    G.planetMesh = G.board.planetData ? trackMesh(GL.mesh(G.board.planetData)) : null;
    G.decorMesh = G.board.decorData ? trackMesh(GL.mesh(G.board.decorData)) : null;
    G.spireMesh = G.board.spireData ? trackMesh(GL.mesh(G.board.spireData)) : null;
    var pal = R.palette();
    /* Seed the ambient dust from the board extents and the faction key, so the
       air belongs to this board and this faction rather than being a generic
       overlay. */
    FX.moteSetup(G.board, pal);
    G.goalMesh = MODELS.goalMesh(pal.accent);
    G.spawnMesh = MODELS.spawnMesh(PAINT.FACTIONS[G.enemyFaction].accent);
    G.rangeRing = MODELS.ring(0.985, 1.0, 72, pal.accent);
    G.plotRing = MODELS.ring(0.80, 1.0, 6, pal.accent);
    G.beamMesh = MODELS.beam('#ffffff');
    /* A near-solid disc: inner radius is a hair above zero so the fan does not
       emit degenerate triangles at the centre. */
    G.shadowDisc = MODELS.ring(0.02, 1.0, 18, '#ffffff');

    /* FRAME THE WHOLE BOARD, computed rather than guessed.
       A hand-picked multiplier cropped the plate at 16:9 and would have
       cropped it differently at every other aspect ratio. The half-extent the
       camera must cover is halfW/aspect horizontally or halfH vertically,
       whichever is larger, and the distance that covers it is that extent over
       tan(fov/2). The 1.12 is real margin for the spires that sit outside the
       play area. */
    fitCamera();
    /* Cover the plate plus the margin the rim decor sits in. */
    R.sun.extent = Math.max(G.board.halfW, G.board.halfH) * 1.18;
    R.sun.distance = R.sun.extent * 2.2;
    R.sun.dir = SUN_DIR;
    G.status = 'play';
    G.waveTimer = 0;
    speed = 1;
    paused = false;
    AUDIO.startMusic();
    if (!running) { running = true; lastT = U.nowMs(); raf = requestAnimationFrame(frame); }
    return G;
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    AUDIO.stopMusic();
    SIM.clear();
  }

  /* ---------- input ---------- */

  function bindInput() {
    canvas.addEventListener('mousemove', function (e) {
      input.mx = e.clientX; input.my = e.clientY;
      if (input.down) {
        var dx = e.clientX - input.lastX, dy = e.clientY - input.lastY;
        input.dragDist += Math.abs(dx) + Math.abs(dy);
        if (input.dragDist > 5) input.dragging = true;
        if (input.dragging) {
          cam.targetYaw -= dx * 0.005;
          cam.targetPitch = U.clamp(cam.targetPitch + dy * 0.004, 0.42, 1.32);
        }
      }
      input.lastX = e.clientX; input.lastY = e.clientY;
    });
    canvas.addEventListener('mousedown', function (e) {
      input.down = true; input.dragging = false; input.dragDist = 0;
      input.lastX = e.clientX; input.lastY = e.clientY;
      AUDIO.resume();
    });
    window.addEventListener('mouseup', function (e) {
      if (input.down && !input.dragging) handleClick(e.button);
      input.down = false; input.dragging = false;
    });
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.targetDist = U.clamp(cam.targetDist * (1 + Math.sign(e.deltaY) * 0.10), 26, (cam.fitDist || 160) * 1.15);
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* Touch: one finger orbits, two pinch to zoom. Enough to be playable on a
       tablet without pretending this is a mobile-first layout. */
    var touchDist = 0;
    canvas.addEventListener('touchstart', function (e) {
      AUDIO.resume();
      if (e.touches.length === 1) {
        input.lastX = e.touches[0].clientX; input.lastY = e.touches[0].clientY;
        input.mx = input.lastX; input.my = input.lastY;
        input.down = true; input.dragging = false; input.dragDist = 0;
      } else if (e.touches.length === 2) {
        touchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                               e.touches[0].clientY - e.touches[1].clientY);
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (e.touches.length === 1 && input.down) {
        var dx = e.touches[0].clientX - input.lastX, dy = e.touches[0].clientY - input.lastY;
        input.dragDist += Math.abs(dx) + Math.abs(dy);
        if (input.dragDist > 8) input.dragging = true;
        if (input.dragging) {
          cam.targetYaw -= dx * 0.006;
          cam.targetPitch = U.clamp(cam.targetPitch + dy * 0.005, 0.42, 1.32);
        }
        input.lastX = e.touches[0].clientX; input.lastY = e.touches[0].clientY;
        input.mx = input.lastX; input.my = input.lastY;
      } else if (e.touches.length === 2) {
        var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX,
                           e.touches[0].clientY - e.touches[1].clientY);
        if (touchDist > 0) cam.targetDist = U.clamp(cam.targetDist * (touchDist / d), 26, (cam.fitDist || 160) * 1.15);
        touchDist = d;
      }
    }, { passive: true });
    canvas.addEventListener('touchend', function () {
      if (input.down && !input.dragging) handleClick(0);
      input.down = false; input.dragging = false; touchDist = 0;
    }, { passive: true });
  }

  function handleClick(button) {
    if (!G || G.status !== 'play') return;
    AUDIO.resume();
    if (button === 2) { G.selected = null; G.inspecting = null; UI.refresh(); return; }
    if (input.hoverPlot && G.selected) {
      var r = SIM.place(input.hoverPlot.id, G.selected);
      if (r) {
        AUDIO.play('build', { pan: SIM.panOf(r.pos) });
        FX.burst([r.pos[0], r.pos[1] + 1, r.pos[2]], R.palette().rim,
          { count: 18, speed: 8, life: 0.6, size: 0.4 });
        FX.shockRing([r.pos[0], r.pos[1] + 0.2, r.pos[2]], R.palette().rim, 5, 0.4);
        FX.hit(0.25);
        G.inspecting = r;
        /* Keep the tower selected so a player laying down a line of the same
           tower does not have to re-pick it every single time. */
        if (G.gold < DATA.TOWERS[G.selected].cost) G.selected = null;
      } else {
        AUDIO.play('denied');
      }
      UI.refresh();
      return;
    }
    if (input.hoverTower) {
      G.inspecting = input.hoverTower;
      G.selected = null;
      AUDIO.play('click');
      UI.refresh();
      return;
    }
    G.inspecting = null;
    G.selected = null;
    UI.refresh();
  }

  function keydown(e) {
    if (!G) return;
    var k = e.key;
    AUDIO.resume();
    if (k === ' ') { e.preventDefault(); toggleSpeed(); return; }
    if (k === 'p' || k === 'P' || k === 'Escape') { togglePause(); return; }
    if (k === 'q' || k === 'Q') { SIM.useAbility('q'); UI.refresh(); return; }
    if (k === 'e' || k === 'E') { SIM.useAbility('e'); UI.refresh(); return; }
    if (k === 'u' || k === 'U') {
      if (G.inspecting && SIM.upgrade(G.inspecting)) {
        AUDIO.play('upgrade', { pan: SIM.panOf(G.inspecting.pos) });
        FX.burst([G.inspecting.pos[0], G.inspecting.pos[1] + 2, G.inspecting.pos[2]],
          R.palette().rim, { count: 22, speed: 9, life: 0.7, size: 0.4 });
      } else AUDIO.play('denied');
      UI.refresh();
      return;
    }
    if (k === 's' || k === 'S') {
      if (G.inspecting) {
        AUDIO.play('sell', { pan: SIM.panOf(G.inspecting.pos) });
        FX.burst([G.inspecting.pos[0], G.inspecting.pos[1] + 1, G.inspecting.pos[2]],
          [0.9, 0.75, 0.3], { count: 14, speed: 7, life: 0.6, size: 0.34 });
        SIM.sell(G.inspecting);
      }
      UI.refresh();
      return;
    }
    if (k === 'Enter') { if (!G.waveActive) { SIM.startWave(); UI.refresh(); } return; }
    var n = parseInt(k, 10);
    if (!isNaN(n) && n >= 1 && n <= 9) {
      var id = DATA.TOWER_ORDER[n - 1];
      if (id) { G.selected = (G.selected === id) ? null : id; AUDIO.play('click'); UI.refresh(); }
    }
  }

  function toggleSpeed() {
    speed = speed === 1 ? 2 : (speed === 2 ? 4 : 1);
    UI.refresh();
  }
  function togglePause() {
    paused = !paused;
    UI.refresh();
  }

  /* ---------- picking ---------- */

  function updateHover() {
    input.hoverPlot = null;
    input.hoverTower = null;
    if (!G || G.status !== 'play') return;
    var g = R.screenToGround(input.mx, input.my, 0);
    input.ground = g;
    if (!g) return;
    var best = null, bestD = 1e9, bestT = null;
    for (var i = 0; i < G.board.plots.length; i++) {
      var p = G.board.plots[i];
      var dx = p.x - g[0], dz = p.z - g[2];
      var d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = p; }
    }
    /* A generous radius: the player is pointing at a plot on a tilted plane
       through a perspective camera, and demanding pixel accuracy there feels
       broken rather than precise. */
    if (best && bestD < 9.0) {
      if (best.tower) { input.hoverTower = best.tower; bestT = best.tower; }
      else if (G.selected) input.hoverPlot = best;
      else input.hoverPlot = best;
    }
  }

  /* ---------- animation ----------
     Everything below decides how the game MOVES, which is most of what makes
     it feel expensive. */

  function rigFor(d) {
    var r = rigs[d.uid];
    if (r) return r;
    var model = MODELS.denizen(d.def.rig, G.enemyFaction);
    /* Pool by archetype: a wave spawns and dies in bursts, and building a
       fresh part tree for every chitling is a guaranteed allocation spike at
       exactly the moment the screen is busiest. */
    var pool = rigPool[d.def.rig] || (rigPool[d.def.rig] = []);
    r = pool.pop();
    if (!r) {
      r = RIG.build(model.parts.map(function (p) {
        return { name: p.name, parent: p.parent, bind: p.bind, mesh: p.mesh, cast: p.cast };
      }));
    }
    /* The archetype is stamped on the rig so the release pass can put it back
       in the right pool without needing the denizen that owned it, which by
       then may already be gone from the list. */
    r.__arch = d.def.rig;
    rigs[d.uid] = r;
    return r;
  }

  function scaleOf(d) { return d.scale; }

  /* The creature transform is translate(pos) * rotateY(yaw) * scale(s), so it
     inverts in closed form and needs no matrix. */
  function localToWorld(p, d, cy, sy) {
    var s = d.scale;
    var x = p[0] * s, y = p[1] * s, z = p[2] * s;
    return [
      d.pos[0] + (x * cy + z * sy),
      d.pos[1] + y,
      d.pos[2] + (-x * sy + z * cy)
    ];
  }
  function worldToLocal(w, d, cy, sy) {
    var s = Math.max(1e-4, d.scale);
    var dx = w[0] - d.pos[0], dy = w[1] - d.pos[1], dz = w[2] - d.pos[2];
    return [
      (dx * cy - dz * sy) / s,
      dy / s,
      (dx * sy + dz * cy) / s
    ];
  }

  function poseDenizen(d, rig, dt) {
    RIG.rest(rig);
    /* 0 while alive, rising to 1 across the death fade. */
    var dyingT = (!d.alive && d.dying > 0) ? U.sat(1 - d.dying / 0.55) : 0;
    var body = rig.get('body');
    var moving = d.stun <= 0 && d.airborne <= 0;
    /* The creature's own facing, needed to place footfall dust in world space
       from a hip offset authored in local space. */
    var cosYaw = Math.cos(d.yaw), sinYaw = Math.sin(d.yaw);
    /* Dust takes the BOARD's colour, not the creature's: it is ground being
       kicked up, and tinting it to the unit would read as an emission. */
    var dustColor = R.palette().ambientSky;

    if (d.def.rig === 'flyer') {
      /* Flyers bank into the turn and bob on a slow sine. The vanes counter
         rotate, which is a two-line touch that reads as active control
         surfaces rather than as a decoration. */
      var t = G.time * 2.2 + d.animPhase * 9;
      if (body) {
        body.pos[1] = Math.sin(t) * 0.22;
        body.rot[2] = d.lean * 1.6 + Math.sin(t * 0.7) * 0.06;
        body.rot[0] = Math.sin(t * 1.3) * 0.05 - 0.06;
      }
      var vl = rig.get('vaneL'), vr = rig.get('vaneR');
      if (vl) vl.rot[2] = Math.sin(t * 3.1) * 0.20 - d.lean * 0.5;
      if (vr) vr.rot[2] = -Math.sin(t * 3.1) * 0.20 - d.lean * 0.5;
      return;
    }

    /* WALKING RIGS. Legs are driven by gait + IK to world-stationary foot
       targets, expressed in the creature's local frame. */
    var legCount = 0;
    while (rig.get('legU' + legCount)) legCount++;
    if (!legCount) return;

    /* Read from the ONE shared table rather than restating the numbers.
       The previous version hand-duplicated them here AND in the leg builder,
       and set hipY to upper + lower, which is FULL LEG EXTENSION: the IK
       therefore solved every stance leg to a dead straight line, which is why
       the walks read as stiff. The table gives the hip about 0.82 of the leg's
       reach, so a leg has slack to bend into. */
    var D = MODELS.RIG_DIMS[d.def.rig];
    if (!D) return;
    var strideLen = D.stride;
    var lift = D.lift;
    var upperLen = D.upper;
    var lowerLen = D.lower;
    var hipY = D.hipY;

    var plantedCount = 0;
    var bodyDip = 0;
    for (var i = 0; i < legCount; i++) {
      var up = rig.get('legU' + i);
      if (!up) continue;
      /* Diagonal gait: legs on opposite corners move together, which is what
         a real quadruped does and reads instantly as animal rather than as
         machine. Bipeds get a simple half-cycle offset. */
      var phaseOff = legCount === 2 ? (i * 0.5) : ((i === 0 || i === 3) ? 0 : 0.5);
      var phase = d.animPhase + phaseOff;
      var g = moving ? RIG.gait(phase, strideLen, lift, D.duty)
                     : { x: 0, y: 0, planted: true, t: 0 };
      /* A dying creature stops walking and its legs give way outward. */
      if (dyingT > 0) {
        g = { x: g.x, y: 0, planted: false, t: 0 };
      }
      if (g.planted) { plantedCount++; }

      /* DUST ON THE FRAME THE FOOT LANDS.
         The gait function already knows precisely when a leg crosses from
         swing into stance, and that transition is the one moment a footfall
         can be sold. Tracking the previous state per leg on the rig part costs
         one boolean and turns a sliding walk into one with weight. Gated on
         real movement and on the foot being near the ground, so a stationary
         or airborne unit does not smoke. */
      if (moving && g.planted && !up.__wasPlanted && d.airborne <= 0 && !d.flying) {
        var fx0 = d.pos[0] + (up.bind[0] * cosYaw + (up.bind[2] + g.x) * sinYaw) * scaleOf(d);
        var fz0 = d.pos[2] + (-up.bind[0] * sinYaw + (up.bind[2] + g.x) * cosYaw) * scaleOf(d);
        FX.dust([fx0, d.pos[1], fz0], 0.55 + d.scale * 0.45, dustColor);
      }
      up.__wasPlanted = g.planted;

      var hip = [up.bind[0], hipY, up.bind[2]];
      /* The foot sits slightly outboard of the hip, which widens the stance
         and stops a four-legged walk reading as a tightrope. */
      var foot = [up.bind[0] * 1.10, g.y, up.bind[2] + g.x];
      if (dyingT > 0) {
        /* Splay outward and drop, so the silhouette breaks apart rather than
           sinking as a rigid unit. */
        foot = [up.bind[0] * (1.10 + dyingT * 1.5), -dyingT * 0.25,
                up.bind[2] + g.x + (up.bind[2] >= 0 ? dyingT : -dyingT) * 0.6];
      }

      /* WORLD-SPACE FOOT LOCK.
         Deriving the gait rate from the stride gets a foot CLOSE to stationary,
         but only on flat ground, at constant speed, in a straight line.
         Measured foot travel against body travel per frame: 0.41 for the
         crawler, 0.29 walker, 0.21 strider. Better than the 0.45 to 0.52 of
         the hand-tuned rate, and still visibly not planted.

         The exact fix is to stop computing where the foot SHOULD be and
         remember where it actually LANDED. On the frame a leg enters stance
         its world position is stored; for the rest of the stance the IK aims
         at that stored point, transformed back into creature space each frame.
         Slopes, turns, slows, stuns and the boss enrage then cost nothing:
         the foot is nailed to the ground because it is literally solving to a
         world coordinate.

         The lock RELEASES if the point drifts out of reach, which happens when
         a creature turns sharply or is launched, because a leg stretched past
         its limit looks far worse than one that takes an extra step. */
      if (g.planted && dyingT <= 0) {
        if (!up.__planted) {
          var fw = localToWorld(foot, d, cosYaw, sinYaw);
          up.__plantW = fw;
          up.__planted = true;
        }
        if (up.__plantW) {
          var lp = worldToLocal(up.__plantW, d, cosYaw, sinYaw);
          var reach = (upperLen + lowerLen) * 0.99;
          var dx = lp[0] - hip[0], dy = lp[1] - hip[1], dz = lp[2] - hip[2];
          if (dx * dx + dy * dy + dz * dz < reach * reach) foot = lp;
          else up.__plantW = null;
        }
      } else {
        up.__planted = false;
        up.__plantW = null;
      }
      /* The pole points forward so knees bend backward on the rear pair and
         forward on the front, which is the difference between a walking
         creature and a folding chair. */
      var pole = [0, 0, (legCount > 2 && i >= 2) ? -1 : 1];
      RIG.driveLeg(rig, 'legU' + i, 'legL' + i, hip, foot, upperLen, lowerLen, pole);
      if (GAME.__probeIK) { up.__wantFoot = [foot[0], foot[1], foot[2]]; }
      if (g.planted) bodyDip += Math.sin(g.t * Math.PI) * 0.04;
    }

    if (body) {
      /* Body bob at twice stride frequency, plus the dip from loaded legs.
         Weight is most of what separates expensive animation from cheap. */
      var bobT = d.animPhase * U.TAU * 2;
      body.pos[1] = (moving ? Math.sin(bobT) * 0.085 : Math.sin(G.time * 1.6 + d.animPhase * 6) * 0.03) - bodyDip;
      body.rot[2] = d.lean;
      body.rot[0] = moving ? Math.sin(bobT + 1.1) * 0.045 : 0;
      body.rot[1] = Math.sin(d.animPhase * U.TAU) * 0.06;

      /* IDLE BREATH. A creature held still by a stun or a smokescreen used to
         be perfectly rigid, which reads as a paused video rather than as a
         living thing waiting. A slow swell on two axes, out of phase, costs two
         sines and is the difference. */
      if (!moving) {
        var br = Math.sin(G.time * 1.15 + d.animPhase * 5.1);
        body.scl[0] = 1 + br * 0.035;
        body.scl[2] = 1 + br * 0.035;
        body.scl[1] = 1 - br * 0.028;
      }

      /* DEATH COLLAPSE. Before this a body simply dissolved in place, still
         standing to attention, which drained every kill of its payoff. It now
         drops, pitches forward and splays as the dissolve takes it, so the
         shatter has something to come apart FROM. */
      if (dyingT > 0) {
        var k = 1 - dyingT;                 /* 0 at the moment of death, 1 at the end */
        var fall = U.ease.inQuad(k);
        body.pos[1] -= fall * hipY * 0.72;
        body.rot[0] += fall * 0.85;
        body.rot[2] += fall * 0.45 * (d.uid % 2 ? 1 : -1);
        body.scl[1] = 1 - fall * 0.25;
      }
    }
    var head = rig.get('head');
    if (head) {
      /* The head lags the body and looks slightly toward the goal, so the
         creature reads as intent rather than as a machine on a rail. */
      head.rot[0] = -0.12 + Math.sin(d.animPhase * U.TAU * 2 + 2.2) * 0.05;
      head.rot[1] = Math.sin(d.animPhase * U.TAU + 0.7) * 0.10 - d.lean * 0.5;
    }
    /* Stun and launch read on the pose, not just on a status icon. */
    if (d.stun > 0 && body) {
      body.rot[2] += Math.sin(G.time * 30) * 0.12;
    }
    if (d.airborne > 0 && body) {
      body.rot[0] += d.airborne * 0.8;
      body.rot[2] += Math.sin(G.time * 6) * 0.3;
    }
  }

  /* ---------- draw ---------- */

  var TMP = U.m4ident();

  function drawDenizens() {
    var pal = PAINT.FACTIONS[G.enemyFaction] || PAINT.FACTIONS.xeno;
    for (var i = 0; i < G.denizens.length; i++) {
      var d = G.denizens[i];
      var rig = rigFor(d);
      var dying = !d.alive && d.dying > 0;

      var scale = d.scale;
      /* Squash and stretch on hit. Brief, and the single cheapest way to make
         a hit feel like it connected. */
      var sq = 1 + d.flash * 0.16;
      var sy = scale * (1 - d.flash * 0.12) * (dying ? Math.max(0.1, d.dying / 0.55) : 1);

      var root = U.m4trs(d.pos[0], d.pos[1], d.pos[2], 0, d.yaw, 0,
        scale * sq, sy, scale * sq, TMP);

      poseDenizen(d, rig, 0);
      RIG.resolve(rig, root);

      /* THE SHATTER, fired exactly once on the frame a body starts dying.
         It reads the model's own facets and throws each one as a flake in its
         own colour, so the creature comes apart into the strokes it was
         painted with rather than into generic debris. The `shattered` flag is
         on the denizen rather than local, because this runs every frame while
         the corpse fades and firing it twice would double every death. */
      if (dying && !d.shattered) {
        d.shattered = true;
        var mdl = MODELS.denizen(d.def.rig, G.enemyFaction);
        var origin = [d.pos[0], d.pos[1] + 0.8 * scale, d.pos[2]];
        for (var pi = 0; pi < mdl.parts.length; pi++) {
          var part = rig.parts[pi];
          if (!part || !mdl.parts[pi].data) continue;
          FX.shatter(mdl.parts[pi].data, part.world, {
            max: d.def.boss ? 30 : 12,
            force: d.def.boss ? 13 : 8,
            size: 0.34 * scale,
            origin: origin
          });
        }
      }

      /* SMALL UNITS DO NOT CAST INTO THE SHADOW MAP.
         Every rig part was drawn twice, once lit and once for shadows, and the
         shadow half was HALF OF ALL DRAW CALLS in the frame (measured: 151 of
         304 with only 11 denizens on the board). What it bought was a few
         pixels of cast shadow under a body that already has a contact disc
         beneath it. Bosses and elites still cast, because at their size the
         cast shadow is a real part of how they read as heavy. */
      var opts = {
        flash: d.flash * 0.8,
        flashColor: d.mark ? U.hex2rgb(DATA.ELEMENTS[d.mark].color) : [1, 0.85, 0.9],
        dissolve: dying ? U.sat(1 - d.dying / 0.55) * 0.9 : 0,
        rimScale: 0.34,
        /* Unit-scale detail: the atlas features must be much smaller in
           world units on a 2-unit body than on a 95-unit board, otherwise
           one magnified cell is what a creature wears as its skin. Fine
           enough that a body reads as textured hide, not as machine grid. */
        detailScale: 0.75,
        /* Units cast again. Restricting it to the trunk (see RIG.draw) makes
           it one or two draws per creature instead of ten, which is what made
           it too expensive before. A body without a cast shadow reads as
           floating no matter how good the contact disc is. */
        castShadow: true
      };
      RIG.draw(rig, opts);

      /* A CONTACT SHADOW under every body.
         The shadow map alone does not do this job: a unit is small, its cast
         shadow falls away from the camera, and against a lit lane the body
         ends up looking pasted on rather than standing on the ground. A dark
         disc directly beneath it costs one blended draw and is most of what
         makes a unit feel present. Flyers get a smaller, fainter one further
         below, which also reads as altitude. */
      if (!dying) {
        var groundY = G.board.heightAt(d.pos[0], d.pos[2]);
        var alt = d.pos[1] - groundY;
        var shR = scale * (d.flying ? 0.62 : 0.92) / (1 + alt * 0.10);
        R.pushUnlit(G.shadowDisc,
          U.m4trs(d.pos[0], groundY + 0.06, d.pos[2], 0, 0, 0, shR, 1, shR),
          { tint: [0.02, 0.01, 0.05], alpha: U.clamp(0.55 / (1 + alt * 0.22), 0.10, 0.55),
            additive: false });
      }

      /* A mark ring under a marked body, so the player can see at a glance
         which reaction is available without reading a health bar. */
      if (d.mark && !dying) {
        var mc = U.hex2rgb(DATA.ELEMENTS[d.mark].color);
        R.pushUnlit(G.rangeRing,
          U.m4trs(d.pos[0], d.pos[1] + 0.08, d.pos[2], 0, G.time * 1.2, 0,
            1.1 * scale, 1, 1.1 * scale),
          { tint: mc, alpha: 0.55, additive: true, pulse: 0.5 });
      }
    }
  }

  function drawTowers() {
    var pal = R.palette();
    for (var i = 0; i < G.towers.length; i++) {
      var t = G.towers[i];
      var model = MODELS.tower(t.id, t.tier);
      var def = DATA.TOWERS[t.id];
      var s = SIM.stats(t);

      /* BUILD-IN. A tower rises and settles rather than appearing. The
         overshoot is what makes it land. */
      var b = U.sat(t.buildT);
      var rise = (1 - U.ease.outBack(b)) * -2.4;
      var bs = 0.7 + 0.3 * U.ease.outBack(b);

      R.push(model.base,
        U.m4trs(t.pos[0], t.pos[1] + rise, t.pos[2], 0, 0, 0, bs, bs, bs),
        { dissolve: (1 - b) * 0.55, detailScale: 0.85 });

      if (model.turret) {
        /* Recoil pushes the turret back along its own facing. */
        var rec = t.recoil * 0.42;
        var tx = t.pos[0] - Math.sin(t.yaw) * rec;
        var tz = t.pos[2] - Math.cos(t.yaw) * rec;
        var ty = t.pos[1] + model.turretY + rise;
        var spin = def.kind === 'support' ? t.spin : 0;
        R.push(model.turret,
          U.m4trs(tx, ty, tz, 0, t.yaw + spin, 0, bs, bs, bs),
          { dissolve: (1 - b) * 0.55, detailScale: 1.0 });
        if (model.barrel) {
          /* The barrel recoils further than the turret, and CYCLONE's fan
             spins continuously instead. */
          var brec = def.kind === 'cone' ? 0 : t.recoil * 0.75;
          var bx = t.pos[0] - Math.sin(t.yaw) * brec;
          var bz = t.pos[2] - Math.cos(t.yaw) * brec;
          var barrelSpin = t.id === 'cyclone' ? t.spin : 0;
          R.push(model.barrel,
            U.m4trs(bx, ty, bz, 0, t.yaw, barrelSpin, bs, bs, bs),
            { dissolve: (1 - b) * 0.55, detailScale: 1.25 });
        }
      }

      /* BEAM towers draw a continuous shaft to their target. */
      if (def.kind === 'beam' && t.target && t.beamOn > 0.02) {
        drawBeam(
          muzzleWorldOf(t, model),
          [t.target.pos[0], t.target.pos[1] + 0.8 * t.target.scale, t.target.pos[2]],
          model.accent, 0.10 + t.beamRamp * 0.10, t.beamOn * 0.9);
      }
      /* SWEEP towers draw a fixed-length shaft along their facing. */
      if (def.kind === 'sweep') {
        var from = muzzleWorldOf(t, model);
        var to = [from[0] + Math.sin(t.yaw) * s.range, from[1] - 0.6, from[2] + Math.cos(t.yaw) * s.range];
        drawBeam(from, to, model.accent, 0.22, 0.55);
      }
      /* FIELD towers draw a pulsing dome. */
      if (def.kind === 'field') {
        R.pushUnlit(MODELS.dome('#ffffff'),
          U.m4trs(t.pos[0], t.pos[1] + 0.1, t.pos[2], 0, t.spin * 0.4, 0, s.range, s.range * 0.55, s.range),
          { tint: model.accent, alpha: 0.10, additive: true, fresnel: 0.9, pulse: 0.35 });
      }
      /* transient arcs and hitscan beams */
      if (t.arcs) {
        for (var a = 0; a < t.arcs.length; a++) {
          var arc = t.arcs[a];
          drawBeam(arc.a, arc.b, model.accent, 0.09, U.sat(arc.life / 0.16));
        }
      }
      if (t.beams) {
        for (var bm = 0; bm < t.beams.length; bm++) {
          var be = t.beams[bm];
          drawBeam(be.a, be.b, model.accent, be.width * U.sat(be.life / 0.22), U.sat(be.life / 0.22));
        }
      }
    }
  }

  function muzzleWorldOf(t, model) {
    var m = model.muzzle;
    var cy = Math.cos(t.yaw), sy = Math.sin(t.yaw);
    return [
      t.pos[0] + m[0] * cy + m[2] * sy,
      t.pos[1] + model.turretY + m[1],
      t.pos[2] + (-m[0] * sy + m[2] * cy)
    ];
  }

  /* A beam is a unit prism scaled and aimed. Building the matrix by hand from
     an orthonormal basis is both cheaper and more stable than composing two
     rotations, which gimbal-locks when the beam points straight down. */
  function drawBeam(a, b, color, width, alpha) {
    var d = V.sub(b, a);
    var len = V.len(d);
    if (len < 0.01) return;
    var fwd = V.scale(d, 1 / len);
    var up = Math.abs(fwd[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    var right = V.norm(V.cross(up, fwd));
    var realUp = V.cross(fwd, right);
    var m = new Float32Array(16);
    m[0] = right[0] * width; m[1] = right[1] * width; m[2] = right[2] * width; m[3] = 0;
    m[4] = realUp[0] * width; m[5] = realUp[1] * width; m[6] = realUp[2] * width; m[7] = 0;
    m[8] = fwd[0] * len; m[9] = fwd[1] * len; m[10] = fwd[2] * len; m[11] = 0;
    m[12] = a[0]; m[13] = a[1]; m[14] = a[2]; m[15] = 1;
    R.pushUnlit(G.beamMesh, m, { tint: color, alpha: alpha, additive: true, pulse: 0.25 });
  }

  function drawProjectiles() {
    for (var i = 0; i < G.projs.length; i++) {
      var p = G.projs[i];
      var el = DATA.ELEMENTS[p.element];
      var col = el ? el.color : '#ffffff';
      var mesh = MODELS.projectile(p.splash > 0 ? 'shell' : 'bolt', col);
      var yaw = p.dir ? Math.atan2(p.dir[0], p.dir[2]) : 0;
      var pitch = p.dir ? Math.asin(U.clamp(-p.dir[1], -1, 1)) : 0;
      var sc = p.splash > 0 ? 1.5 : 1.1;
      R.push(mesh, U.m4trs(p.pos[0], p.pos[1], p.pos[2], pitch, yaw, p.spin, sc, sc, sc),
        { castShadow: false });
      /* A short trail, emitted rather than drawn, so it inherits the paint
         particle look instead of being a stripe. Given the projectile's own
         velocity so each segment stretches along the flight path. */
      if (Math.random() < 0.9) {
        var c = U.hex2rgb(col);
        var pv = p.dir ? [p.dir[0] * p.speed, p.dir[1] * p.speed, p.dir[2] * p.speed] : [0, 0, 0];
        FX.trail(p.pos, pv, c, sc);
      }
    }
  }

  function drawBoard() {
    /* THE GROUND TAKES ALMOST NO RIM.
       Rim is a Fresnel term, so it peaks where a surface is seen edge-on, and
       a large flat plane is seen edge-on across its entire far half. At full
       strength that washed the whole foreground toward white whenever the
       camera dropped low, which is precisely when the player has zoomed in to
       look at something. Rim exists to separate a silhouette from its
       background; the ground IS the background. */
    R.push(G.groundMesh, U.m4ident(), { castShadow: false, facetJitter: 0.015, rimScale: 0.18, mat: 'ground' });
    /* Paving slabs stand on the ground; give them their own quiet scale. */
    if (G.padMesh) R.push(G.padMesh, U.m4ident(), { mat: 'ground', detailScale: 0.6, rimScale: 0.25, facetJitter: 0.015 });
    /* THE WORLD. The planet sphere renders first (bottom of the stack) so
       the board sits into it; soft rock detail, no cast shadow (it IS the
       ground of the universe). */
    if (G.planetMesh) R.push(G.planetMesh, U.m4ident(), { mat: 'stone', detailScale: 0.5, castShadow: false, facetJitter: 0.02, rimScale: 0.4 });
    /* Scenery takes a reduced rim so the rocks and spires stay BEHIND the
       towers in the read. With a brighter board and full rim they were as
       bright as the things the player is meant to be looking at. */
    if (G.decorMesh) R.push(G.decorMesh, U.m4ident(), { rimScale: 0.45, mat: 'stone', detailScale: 0.5 });
    if (G.spireMesh) R.push(G.spireMesh, U.m4ident(), { rimScale: 0.40, castShadow: false, mat: 'stone', detailScale: 0.5 });

    var pal = R.palette();
    var sp = G.board.spawn, gl = G.board.goal;
    R.push(G.spawnMesh, U.m4trs(sp[0], G.board.heightAt(sp[0], sp[2]) - 0.3, sp[2], 0, 0, 0, 1, 1, 1));
    R.push(G.goalMesh, U.m4trs(gl[0], G.board.heightAt(gl[0], gl[2]) - 0.2, gl[2], 0, 0, 0, 1, 1, 1));

    /* The goal pulses harder as lives drop, which is a readable panic signal
       that costs nothing and needs no UI. */
    var danger = 1 - G.lives / G.maxLives;
    R.pushUnlit(G.rangeRing,
      U.m4trs(gl[0], G.board.heightAt(gl[0], gl[2]) + 0.15, gl[2], 0, G.time * 0.5, 0, 4.5, 1, 4.5),
      { tint: danger > 0.5 ? [1, 0.3, 0.35] : pal.rim, alpha: 0.4 + danger * 0.4, additive: true, pulse: 0.6 + danger });

    /* Build plots. Only drawn while a tower is selected, so the board is not
       permanently covered in UI. */
    if (G.selected) {
      var def = DATA.TOWERS[G.selected];
      var afford = G.gold >= def.cost;
      for (var i = 0; i < G.board.plots.length; i++) {
        var p = G.board.plots[i];
        if (p.tower) continue;
        var isHover = input.hoverPlot === p;
        var col = afford ? (isHover ? pal.rim : pal.keyRgb) : [0.7, 0.25, 0.3];
        R.pushUnlit(G.plotRing,
          U.m4trs(p.x, p.y + 0.30, p.z, 0, 0.4, 0, 1.5, 1, 1.5),
          { tint: col, alpha: isHover ? 0.85 : 0.45, additive: true, pulse: isHover ? 0.5 : 0 });
      }
      /* Ghost preview at the hovered plot, including its range. */
      if (input.hoverPlot) {
        var m = MODELS.tower(G.selected, 0);
        var hp = input.hoverPlot;
        R.push(m.base, U.m4trs(hp.x, hp.y, hp.z, 0, 0, 0, 1, 1, 1),
          { dissolve: 0.45, castShadow: false, alpha: 0.6 });
        R.pushUnlit(G.rangeRing,
          U.m4trs(hp.x, hp.y + 0.30, hp.z, 0, 0, 0, def.range, 1, def.range),
          { tint: afford ? pal.rim : [1, 0.3, 0.3], alpha: 0.5, additive: true, pulse: 0.3 });
      }
    }

    /* Range ring for the inspected or hovered tower. */
    var show = G.inspecting || input.hoverTower;
    if (show) {
      var st = SIM.stats(show);
      if (st.range > 0) {
        R.pushUnlit(G.rangeRing,
          U.m4trs(show.pos[0], show.pos[1] + 0.16, show.pos[2], 0, 0, 0, st.range, 1, st.range),
          { tint: pal.rim, alpha: 0.55, additive: true, pulse: 0.25 });
      }
      R.pushUnlit(G.plotRing,
        U.m4trs(show.pos[0], show.pos[1] + 0.14, show.pos[2], 0, 0.4, 0, 1.7, 1, 1.7),
        { tint: pal.rim, alpha: 0.7, additive: true, pulse: 0.4 });
    }
  }

  /* ---------- frame ---------- */

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    var t0 = U.nowMs();
    try {
      var dt = (now - lastT) / 1000;
      lastT = now;
      if (!isFinite(dt) || dt < 0) dt = 1 / 60;
      /* Clamped: see the header note on backgrounded tabs. */
      dt = Math.min(dt, 0.25);

      fpsSamples.push(dt);
      if (fpsSamples.length > 40) fpsSamples.shift();
      var avg = 0;
      for (var f = 0; f < fpsSamples.length; f++) avg += fpsSamples[f];
      stats.fps = fpsSamples.length / Math.max(1e-6, avg);

      AUDIO.tick(dt);
      FX.updateImpact(dt);

      var simDt = paused ? 0 : FX.consumeStop(dt) * speed;
      if (simDt > 0 && G) {
        accum += simDt;
        var steps = 0;
        while (accum >= STEP && steps < 40) {
          SIM.step(STEP);
          accum -= STEP;
          steps++;
        }
        if (steps >= 40) accum = 0;
        FX.update(simDt);
        FX.moteUpdate(simDt);
        FX.updateText(simDt);

        /* RETURN RIGS OF DEPARTED DENIZENS TO THE POOL.
           Done here rather than in the sim because a rig is a presentation
           concern the sim knows nothing about. The live-uid set is rebuilt
           each pass: the previous version compared `key | 0` against uids
           inside a nested loop, which was both O(rigs x denizens) every frame
           and leaked, because it deleted the entry without ever pushing the
           rig back to its pool. Left alone that turns the pool into a
           permanent allocator and defeats the reason it exists. */
        liveUids.clear();
        for (var li = 0; li < G.denizens.length; li++) liveUids.add(G.denizens[li].uid);
        for (var key in rigs) {
          if (liveUids.has(+key)) continue;
          var rr = rigs[key];
          delete rigs[key];
          var arch = rr && rr.__arch;
          if (arch) {
            var pool = rigPool[arch] || (rigPool[arch] = []);
            if (pool.length < 48) pool.push(rr);
          }
        }
      }

      if (G) {
        updateCamera(dt);
        updateHover();
        R.reset();
        drawBoard();
        drawTowers();
        drawDenizens();
        drawProjectiles();
        FX.submit();
        R.render(dt);
        UI.tickOverlay(dt);
      }
      stats.particles = FX.count;
      stats.frameMs = U.nowMs() - t0;
      /* The renderer owns the decision; the loop only reports the measurement. */
      R.tickAdaptive(stats.frameMs);
      stats.renderScale = R.quality.scale;
    } catch (e) {
      recordError('frame', e);
    }
  }

  function updateCamera(dt) {
    cam.yaw = U.damp(cam.yaw, cam.targetYaw, 9, dt);
    cam.pitch = U.damp(cam.pitch, cam.targetPitch, 9, dt);
    cam.dist = U.damp(cam.dist, cam.targetDist, 8, dt);
    cam.focus[0] = U.damp(cam.focus[0], cam.targetFocus[0], 5, dt);
    cam.focus[1] = U.damp(cam.focus[1], cam.targetFocus[1], 5, dt);
    cam.focus[2] = U.damp(cam.focus[2], cam.targetFocus[2], 5, dt);

    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    R.cam.pos = [
      cam.focus[0] + Math.sin(cam.yaw) * cp * cam.dist,
      cam.focus[1] + sp * cam.dist,
      cam.focus[2] + Math.cos(cam.yaw) * cp * cam.dist
    ];
    R.cam.target = [cam.focus[0], cam.focus[1] + 1.5, cam.focus[2]];
    /* THE SHADOW BOX IS FITTED TO THE BOARD, NOT THE CAMERA.
       Recomputing it from cam.dist every frame meant the light frustum resized
       and recentred whenever the player zoomed or panned, so every shadow edge
       crawled across its own texels: the classic shadow swim. Fitting it once
       to the play area makes the texel grid stationary in world space, which is
       both stable and a known density (a 96 unit box at 2048 is under 5cm per
       texel). Set in start(); the sun direction is constant. */
    R.sun.dir = SUN_DIR;
  }

  /* Draw exactly one frame, synchronously, without touching the simulation.
     Exists so a harness can exercise the DRAW path (poses, footfall dust,
     beams, the whole submit chain) which requestAnimationFrame otherwise makes
     unreachable from a test. The project law is that code no gate executes is
     code that ships untested, and before this the entire animation layer was
     in that category. */
  function renderOnce(dt) {
    if (!G) return false;
    dt = dt || (1 / 60);
    try {
      updateCamera(dt);
      R.reset();
      drawBoard();
      drawTowers();
      drawDenizens();
      drawProjectiles();
      FX.submit();
      R.render(dt);
      return true;
    } catch (e) {
      recordError('renderOnce', e);
      return false;
    }
  }

  return {
    init: init, start: start, stop: stop, resize: resize, renderOnce: renderOnce,
    __rigFor: rigFor,
    /* Read by the IK accuracy gate in tools/adversarial.js. */
    __probeIK: false,
    keydown: keydown, toggleSpeed: toggleSpeed, togglePause: togglePause,
    get state() { return G; },
    get speed() { return speed; },
    set speed(v) { speed = v; },
    get paused() { return paused; },
    set paused(v) { paused = v; },
    cam: cam, input: input, stats: stats,
    /* Read by the culling gate, which has to restore the default framing
       after zooming in to check that nothing is trimmed at full view. */
    __fitCamera: function () { fitCamera(false); },
    errors: function () { return errors.slice(); }
  };
})();


