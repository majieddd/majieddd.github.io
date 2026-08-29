// ===== boot.js : wire everything, run loop, manage state transitions =====

(function () {
  const canvas = document.getElementById('scene');
  const errEl = document.getElementById('err');
  function fail(msg) { errEl.style.display = 'block'; errEl.textContent = 'ERR: ' + msg; console.error(msg); }

  let rt, audio, game, ui;
  try {
    audio = makeAudio(); audio.init();
    rt = new RtGame(canvas);
    game = new Game(rt, audio);
    ui = makeUI(game, audio);
    game.ui = ui; // frame() drives UI sync (rAF-throttle-safe)
    makeInput(game, rt, ui);
  } catch (e) { fail(e && e.message ? e.message : String(e)); return; }

  rt.resize();
  window.addEventListener('resize', () => rt.resize());

  // gate (audio autoplay policy)
  const gate = document.getElementById('gate');
  gate.addEventListener('click', () => {
    audio.resume(); audio.startMusic();
    gate.classList.add('hide');
    ui.syncAll();
    ui.toast('DEFEND THE CORE — WORLD ZERO', 'win');
  });

  function loop(now) {
    requestAnimationFrame(loop);
    try {
      game.frame(now);
      ui.syncAll(); // also handles win/lose overlay (robust to rAF throttling)
    } catch (e) { fail(e && e.message ? e.message : String(e)); throw e; }
  }
  requestAnimationFrame(loop);

  // expose for debugging
  window.__cc = { rt, game, audio, ui };
})();
