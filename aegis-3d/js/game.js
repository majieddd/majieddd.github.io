/* lowpoly/js/game.js — the engine. Fixed-timestep simulation, the state
   machine (menu → build → battle → banner → victory/defeat), the camera rig,
   pointer input (place/select/pan/zoom), wave scheduling, economy, stats, and
   the juice channels (hit-stop, screen shake). All UI speaks through Game.ui,
   which ui.js installs, so the engine never touches the DOM. */
(function () {
  'use strict';

  const G = {
    state: 'menu',          // menu | build | battle | over
    result: null,
    gold: 0, lives: 0, wave: 0,
    difficulty: Data.DIFFICULTIES[1],
    seed: 20260829,
    time: 0,
    hitStop: 0,
    shake: 0,
    speed: 1,
    paused: false,
    selected: null,         // Tower | null
    shopPick: 'bolt',       // tower id ready to place
    placing: false,
    castMode: false,
    buildT: 0,
    spawnQueue: [],
    spawnTimer: 0,
    waveClearT: 0,
    ui: null,
    stats: { kills: 0, leaks: 0, goldEarned: 0, reactions: {}, towerDamage: 0, wavesCleared: 0, towersBuilt: 0, time: 0 },
    _delayed: [],
    _acc: 0, _last: 0,
    camera: null
  };

  let scene, camera, renderer, composer, fxaaPass;
  let canvas, raycaster, pointer;
  const cam = { target: new THREE.Vector3(0, 0, 0), yaw: 0.63, pitch: 0.98, radius: 54, shakeT: 0 };
  let ghost = null, ghostRing = null;
  let hoverPoint = null;
  const quality = { bloom: true, shadows: true, dpr: 2 };

  /* ------------------------------------------------------------ */
  G.init = function (canvasEl, qualityPrefs) {
    canvas = canvasEl;
    if (qualityPrefs) Object.assign(quality, qualityPrefs);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.dpr));
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputEncoding = THREE.sRGBEncoding;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
    G.scene = scene;
    G.camera = camera;

    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    /* Post: bloom + FXAA. */
    const rt = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat
    });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.55, 0.75, 0.78);
    composer.addPass(bloom);
    G.bloom = bloom;
    if (THREE.FXAAShader) {
      fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
      fxaaPass.uniforms['resolution'].value.set(1 / W, 1 / H);
      fxaaPass.renderToScreen = true;
      composer.addPass(fxaaPass);
    } else {
      composer.passes[composer.passes.length - 1].renderToScreen = true;
    }

    G.resize();
    window.addEventListener('resize', () => G.resize());
    bindInput();

    FX.init(scene, camera, document.getElementById('overlay'));
  };

  G.resize = function () {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    composer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    if (fxaaPass) fxaaPass.uniforms['resolution'].value.set(1 / W, 1 / H);
    FX.resize(W, H);
  };

  /* ------------------------------------------------------------ */
  G.startMatch = function (opts) {
    const o = opts || {};
    G.seed = o.seed || (Date.now() & 0xffff);
    G.difficulty = o.difficulty || Data.DIFFICULTIES[1];
    G.gold = Data.WORLD.startGold;
    G.lives = Data.WORLD.lives;
    G.wave = 0;
    G.result = null;
    G.selected = null;
    G.placing = false;
    G.castMode = false;
    G.speed = 1;
    G.paused = false;
    G.spawnQueue = [];
    G.spawnTimer = 0;
    G.hitStop = 0;
    G.shake = 0;
    G._delayed = [];
    G.stats = { kills: 0, leaks: 0, goldEarned: 0, reactions: {}, towerDamage: 0, wavesCleared: 0, towersBuilt: 0, time: 0 };

    Commander.select(o.commander || 'vanta');

    /* Rebuild scene contents. FX pools and UI ghosts are marked keep and
       survive; terrain, units and towers are torn down and rebuilt. */
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const c = scene.children[i];
      if (!c.userData.keep) scene.remove(c);
    }
    ghost = null;
    ghostRing = null;
    Units.clear();
    Towers.clear();
    Terrain.build(scene, { seed: G.seed, color: Data.FACTIONS[Commander.current.faction].color });

    G.state = 'build';
    G.buildT = Data.WORLD.buildWindow;
    G.ui.enterBattle();
    G.ui.banner('WAVE 1 INCOMING', 'Build your line. Rush with N for bonus gold.');
    Audio.sfx.waveStart();
  };

  G.requestCastE = function () {
    G.castMode = true;
    G.placing = false;
    G.ui.castHint(true);
  };

  /* Camera focus point, exposed for keyboard panning. */
  G.camTarget = cam.target;

  G.togglePause = function () {
    if (G.state !== 'battle' && G.state !== 'build') return;
    G.paused = !G.paused;
    G.ui.pauseOverlay(G.paused);
  };

  G.rush = function () {
    if (G.state === 'build') {
      G.buildT = 0;
    }
  };

  G.delayed = function (t, fn) {
    G._delayed.push({ t, fn });
  };

  G.setSpeed = function (s) {
    G.speed = s;
    G.ui.speedUI(s);
  };

  /* ------------------------------------------------------------ */
  /* Placement. */
  function updateGhost() {
    /* No ghost work outside placement, and never before the terrain exists
       (the menu has no ground to raycast against). */
    if (!G.placing || !Terrain.ground) {
      if (ghost) ghost.visible = false;
      if (ghostRing) ghostRing.visible = false;
      hoverPoint = null;
      return;
    }
    const pt = groundPoint();
    if (!pt) {
      if (ghost) ghost.visible = false;
      if (ghostRing) ghostRing.visible = false;
      hoverPoint = null;
      return;
    }
    if (!ghost) {
      ghost = Towers.buildGhost(G.shopPick);
      ghost.visible = false;
      ghost.userData.keep = true;
      scene.add(ghost);
      ghostRing = new THREE.Mesh(
        new THREE.RingGeometry(1.35, 1.75, 40),
        new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })
      );
      ghostRing.rotation.x = -Math.PI / 2;
      ghostRing.position.y = 0.06;
      ghostRing.visible = false;
      ghostRing.userData.keep = true;
      scene.add(ghostRing);
    }
    hoverPoint = { x: pt.x, z: pt.z };
    const def = Data.TOWERS.find((t) => t.id === G.shopPick);
    const ok = Terrain.buildable(pt.x, pt.z, 1.5)
      && G.gold >= def.cost
      && !Towers.list.some((t) => Util.dist2(t.x, t.z, pt.x, pt.z) < 3.2 * 3.2);
    ghost.visible = true;
    ghost.position.set(pt.x, Terrain.heightAt(pt.x, pt.z), pt.z);
    ghostRing.visible = true;
    ghostRing.position.set(pt.x, Terrain.heightAt(pt.x, pt.z) + 0.08, pt.z);
    ghostRing.material.color.setHex(ok ? 0x38e8ff : 0xef4444);
    ghostRing.material.opacity = 0.75;
    G._placeOK = ok;
  }

  function groundPoint() {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((G._mx - r.left) / r.width) * 2 - 1;
    pointer.y = -((G._my - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(Terrain.ground, false);
    if (!hits.length) return null;
    return hits[0].point;
  }

  function bindInput() {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2 || e.button === 1) { G._panning = true; G._px = e.clientX; G._py = e.clientY; return; }
      if (e.button !== 0) return;
      if (G.state !== 'build' && G.state !== 'battle') return;
      if (G.paused) return;
      Audio.init();

      if (G.castMode) {
        const pt = groundPoint();
        if (pt) {
          Commander.castE(pt.x, pt.z);
          G.castMode = false;
          G.ui.castHint(false);
        }
        return;
      }
      if (G.placing) {
        if (G._placeOK) {
          const pt = groundPoint();
          const def = Data.TOWERS.find((t) => t.id === G.shopPick);
          if (pt && G.gold >= def.cost) {
            G.gold -= def.cost;
            Towers.place(G.shopPick, pt.x, pt.z);
            G.stats.towersBuilt++;
            G.ui.syncHud();
            if (!e.shiftKey) {
              G.placing = false;
              G.ui.shopHighlight(null);
            }
          }
        } else {
          Audio.sfx.err();
        }
        return;
      }
      /* Select a tower. */
      let found = null, best = 3.2;
      for (const t of Towers.list) {
        const d = hoverPoint ? Math.hypot(t.x - hoverPoint.x, t.z - hoverPoint.z) : 1e9;
        if (d < best) { best = d; found = t; }
      }
      G.selected = found;
      G.ui.selectTower(found);
      if (found) Audio.sfx.click();
    });
    canvas.addEventListener('pointermove', (e) => {
      G._mx = e.clientX; G._my = e.clientY;
      if (G._panning) {
        const dx = e.clientX - G._px, dy = e.clientY - G._py;
        G._px = e.clientX; G._py = e.clientY;
        const scale = cam.radius / 340;
        const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw);
        cam.target.x -= (dx * fz + dy * fx) * scale;
        cam.target.z -= (dx * fx - dy * fz) * scale;
        clampTarget();
      }
    });
    window.addEventListener('pointerup', () => { G._panning = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      cam.radius = Util.clamp(cam.radius * (1 + Math.sign(e.deltaY) * 0.09), 20, 85);
    }, { passive: false });
  }

  function clampTarget() {
    cam.target.x = Util.clamp(cam.target.x, -Data.WORLD.w / 2 + 8, Data.WORLD.w / 2 - 8);
    cam.target.z = Util.clamp(cam.target.z, -Data.WORLD.h / 2 + 8, Data.WORLD.h / 2 - 8);
  }

  G.updateCameraPos = function () {
    const r = cam.radius;
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * r,
      cam.target.y + Math.sin(cam.pitch) * r,
      cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * r
    );
    camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
    if (G.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * G.shake;
      camera.position.y += (Math.random() - 0.5) * G.shake;
      camera.position.z += (Math.random() - 0.5) * G.shake;
    }
  };

  /* ------------------------------------------------------------ */
  /* Waves. */
  function beginWave() {
    G.wave++;
    const mix = Data.waveComposition(G.wave, Util.mulberry32(G.seed * 31 + G.wave * 7));
    G.spawnQueue = mix;
    G.spawnTimer = 0;
    G.state = 'battle';
    G.ui.banner('WAVE ' + G.wave, G.wave === 20 ? 'THE HARBINGER COMES' : G.wave === 15 ? 'A COLOSSUS APPROACHES' : '');
    Audio.sfx.waveStart();
    if (G.wave >= 10) Audio.setIntensity(0.55);
    if (G.wave >= 16) Audio.setIntensity(0.9);
  }

  function waveCleared() {
    G.stats.wavesCleared++;
    const bonus = Math.round(Data.waveReward(G.wave) * G.difficulty.gold);
    G.gold += bonus;
    G.stats.goldEarned += bonus;
    Audio.sfx.waveClear();
    if (G.wave >= 20) {
      G.result = 'victory';
      G.state = 'over';
      G.ui.endScreen(true);
      Audio.sfx.victory();
      Audio.setIntensity(0);
      return;
    }
    G.state = 'build';
    G.buildT = Data.WORLD.waveGap;
    G.ui.banner('WAVE ' + G.wave + ' CLEARED', '+' + bonus + ' gold');
  }

  /* ------------------------------------------------------------ */
  const STEP = 1 / 60;

  function loop(now) {
    requestAnimationFrame(loop);
    if (!G._last) G._last = now;
    let frame = (now - G._last) / 1000;
    G._last = now;
    if (frame > 0.25) frame = 0.25;

    if (G.paused) {
      render(0);
      return;
    }

    /* Hit-stop consumes real time but not simulation time. */
    if (G.hitStop > 0) {
      G.hitStop -= frame;
      render(0);
      return;
    }

    const dt = frame * G.speed;
    G._acc += dt;
    let n = 0;
    while (G._acc >= STEP && n < 5) {
      update(STEP);
      G._acc -= STEP;
      n++;
    }
    render(frame);
  }

  function update(dt) {
    G.time += dt;
    G.stats.time += dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 2.6);

    const time = G.time;

    /* Delayed callbacks. */
    for (let i = G._delayed.length - 1; i >= 0; i--) {
      const d = G._delayed[i];
      d.t -= dt;
      if (d.t <= 0) { G._delayed.splice(i, 1); d.fn(); }
    }

    /* Status DOTs across all enemies. */
    for (const e of Units.list) {
      if (e.dead) continue;
      if (e.burnT > 0 && e.burn > 0) {
        e.hp -= e.burnDps * dt;
        e.damageTaken += e.burnDps * dt;
        if (e.hp <= 0) e.die(null);
      }
      if (e.venomStacks.length) {
        let dps = 0;
        for (const v of e.venomStacks) dps += v.dps;
        e.hp -= dps * dt;
        e.damageTaken += dps * dt;
        if (e.hp <= 0) e.die(null);
      }
    }

    Commander.tick(dt, time);
    Towers.update(dt, time);
    Units.update(dt, time);
    FX.update(dt);
    Audio.tick(dt);

    if (G.state === 'build') {
      G.buildT -= dt;
      if (G.buildT <= 0) beginWave();
    } else if (G.state === 'battle') {
      if (G.spawnQueue.length) {
        G.spawnTimer -= dt;
        if (G.spawnTimer <= 0) {
          const entry = G.spawnQueue.shift();
          G.spawnTimer = entry.gap;
          const e = Units.spawn(entry.id);
          if (e.def.boss) {
            G.ui.banner('THE HARBINGER', '');
            Audio.sfx.boss();
            Audio.setIntensity(1);
          }
        }
      } else if (!Units.list.some((e) => !e.dead)) {
        waveCleared();
      }
    }

    /* Music intensity from danger: nearest enemy to the core. */
    let danger = 0;
    for (const e of Units.list) {
      if (e.dead) continue;
      const prox = 1 - e.pathT;
      if (prox > danger) danger = prox;
    }
    if (G.state === 'battle') Audio.setIntensity(Math.min(0.9, 0.18 + danger * 0.6));

    /* Leak check. */
    for (const e of Units.list) {
      if (!e.dead && e.reached) {
        e.leak();
        if (G.lives <= 0) {
          G.result = 'defeat';
          G.state = 'over';
          G.ui.endScreen(false);
          Audio.sfx.defeat();
          Audio.setIntensity(0);
          return;
        }
      }
    }

    updateGhost();
    G.ui.tick(dt);
  }

  function render(frameDt) {
    G.updateCameraPos();
    /* Portal + core idle animation. */
    if (Terrain.portal) {
      Terrain.portal.rotation.y += 0.002 + 0.0004 * G.time;
      Terrain.portal.children[1].material.opacity = 0.28 + Math.sin(G.time * 2.2) * 0.1;
    }
    if (Terrain.core) {
      Terrain.core.children[1].rotation.y += 0.008;
      Terrain.core.children[2].rotation.y -= 0.006;
      Terrain.core.children[1].position.y = 1.1 + Math.sin(G.time * 1.4) * 0.08;
    }
    if (quality.bloom) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    FX.renderOverlay(frameDt);
  }

  /* ------------------------------------------------------------ */
  G.setQuality = function (key, val) {
    quality[key] = val;
    if (key === 'shadows') {
      renderer.shadowMap.enabled = val;
    }
    if (key === 'dpr') {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, val));
      G.resize();
    }
  };

  G.start = function () { G._last = 0; requestAnimationFrame(loop); };

  window.Game = G;
})();
