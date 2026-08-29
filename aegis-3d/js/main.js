/* aegis-3d/js/main.js — bootstrap, keyboard, quality prefs. */
(function () {
  'use strict';

  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem('cc3d.prefs') || '{}');
    } catch (e) { return {}; }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const prefs = loadPrefs();
    Game.init(document.getElementById('game'), {
      bloom: prefs.bloom !== false,
      shadows: prefs.shadows !== false,
      dpr: prefs.dpr === 1 ? 1 : 2
    });
    Ui.init();
    Game.start();

    /* First user gesture unlocks audio. */
    const unlock = () => Audio.init();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    window.addEventListener('keydown', onKey);

    /* Persist settings. */
    window.addEventListener('beforeunload', () => {
      try {
        localStorage.setItem('cc3d.prefs', JSON.stringify({
          bloom: document.getElementById('q-bloom').checked,
          shadows: document.getElementById('q-shadow').checked,
          dpr: document.getElementById('q-res').checked ? 2 : 1
        }));
      } catch (e) { /* storage unavailable */ }
    });
  });

  function onKey(e) {
    if (e.repeat) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = e.key;
    const inMatch = Game.state === 'battle' || Game.state === 'build';

    if (k === ' ') { e.preventDefault(); Game.togglePause(); return; }
    if (!inMatch || Game.paused) return;

    switch (k.toLowerCase()) {
      case 'n': Game.rush(); break;
      case 'q': Commander.castQ(); Ui.syncHud(); break;
      case 'e': {
        const c = Commander.current;
        if (c && c.def.E.cast) {
          if (Game.castMode) { Game.castMode = false; Ui.castHint(false); }
          else if (c.E.cd <= 0) { Game.placing = false; Ui.shopHighlight(null); Game.requestCastE(); }
        } else {
          Commander.castE();
        }
        Ui.syncHud();
        break;
      }
      case 'escape':
        if (Game.castMode) { Game.castMode = false; Ui.castHint(false); }
        else if (Game.placing) { Game.placing = false; Ui.shopHighlight(null); }
        else if (Game.selected) { Game.selected = null; Ui.selectTower(null); }
        break;
      case 't':
        if (Game.selected) {
          const modes = ['first', 'close', 'strong', 'last'];
          const i = modes.indexOf(Game.selected.targeting);
          Game.selected.targeting = modes[(i + 1) % modes.length];
          Ui.selectTower(Game.selected);
          Audio.sfx.click();
        }
        break;
      case 'u':
        if (Game.selected && Game.selected.upgradeDef && Game.gold >= Game.selected.upgradeDef.cost) {
          Game.gold -= Game.selected.upgradeDef.cost;
          Game.selected.upgrade();
          Ui.selectTower(Game.selected);
          Ui.syncHud();
        }
        break;
      default: {
        const map = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9, '-': 10, '=': 11 };
        if (k in map) {
          const def = Data.TOWERS[map[k]];
          if (def) {
            Game.shopPick = def.id;
            Game.placing = !(Game.placing && Game.shopPick === def.id);
            Ui.shopHighlight(Game.placing ? map[k] : null);
            Game.castMode = false;
            Ui.castHint(false);
            Audio.init();
            Audio.sfx.click();
          }
        }
      }
    }
  }

  /* Arrow-key camera pan (continuous while held). */
  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  setInterval(() => {
    if (!Game.camTarget) return;
    let dx = 0, dz = 0;
    if (keys.ArrowLeft) dx -= 1;
    if (keys.ArrowRight) dx += 1;
    if (keys.ArrowUp) dz -= 1;
    if (keys.ArrowDown) dz += 1;
    if (dx || dz) {
      const s = 0.55;
      const fx = Math.sin(0.63), fz = Math.cos(0.63);
      const t = Game.camTarget;
      t.x -= (dx * fz + dz * fx) * s;
      t.z -= (dx * fx - dz * fz) * s;
      t.x = Util.clamp(t.x, -Data.WORLD.w / 2 + 8, Data.WORLD.w / 2 - 8);
      t.z = Util.clamp(t.z, -Data.WORLD.h / 2 + 8, Data.WORLD.h / 2 - 8);
    }
  }, 16);
})();
