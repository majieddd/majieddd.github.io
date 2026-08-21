/* ==========================================================================
   AEGIS PROTOCOL: ATTRITION — Bootstrap & Keyboard
   ========================================================================== */

'use strict';

(function boot() {

  /* Only five towers deploy, so 1-5 covers the whole loadout. */
  const HOTKEYS = ['1', '2', '3', '4', '5'];

  function start() {
    Sound.init();
    UI.init();
    Game.init(document.getElementById('game'));
    bindKeys();
    const wake = () => { Sound.resume(); window.removeEventListener('pointerdown', wake); };
    window.addEventListener('pointerdown', wake);
  }

  const overlayOpen = () => document.querySelector('.overlay:not(.hidden)') !== null;

  function closeTopOverlay() {
    /* Some overlays are REQUIRED decisions and Esc must not skip them: hiding
       one leaves Game.state parked ('choosing', 'escalating') with no way back,
       which froze the battle outright — every control gates on state
       'playing', and the only writer back to it is the modal's own click
       handler. The two static overlays were listed by id; the escalation modal
       is created dynamically and was missed. Mark them with a class instead,
       so the next dynamically-created blocking modal is covered by default. */
    const open = Array.from(document.querySelectorAll('.overlay:not(.hidden)'))
      .filter(o => o.id !== 'overlay-choice' && o.id !== 'overlay-end'
                && o.id !== 'escal-choice' && !o.classList.contains('required'));
    if (!open.length) return false;
    const top = open[open.length - 1];
    top.classList.add('hidden');
    /* HIDING IS NOT CLOSING. The pre-battle dialogue and the enemy dossier
       both pause the battle and unpause in their own button handler, so Esc
       left the game paused behind a play button claiming otherwise -- and left
       their timers running against a modal nobody could see. An overlay with
       work to do on the way out publishes it here; anything without the hook
       is unaffected. */
    if (typeof top._escDismiss === 'function') top._escDismiss();
    return true;
  }

  function bindKeys() {
    window.addEventListener('keydown', e => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();

      if (k === 'escape') {
        if (closeTopOverlay()) { e.preventDefault(); return; }
        Game.selectedType = null; Game.selected = null; Game.aimingAbility = null; UI.syncAll();
        e.preventDefault(); return;
      }

      /* While the draft is up, number keys pick a card and nothing else responds. */
      if (Game.state === 'choosing') {
        const i = ['1', '2', '3', '4', '5'].indexOf(k);
        if (i >= 0 && Game.pendingChoice && Game.pendingChoice[i]) {
          Game.takeMod(Game.pendingChoice[i]);
          e.preventDefault();
        }
        return;
      }

      if (overlayOpen() || Game.state !== 'playing') return;

      if (e.altKey && ['1', '2', '3'].includes(k)) {
        Game.speed = Number(k); UI.syncSpeed(); Sound.play('click'); e.preventDefault(); return;
      }

      const loadout = Game.sides[0].loadout;
      const idx = HOTKEYS.indexOf(k);
      if (idx >= 0 && idx < loadout.length) {
        const id = loadout[idx];
        Game.selectedType = Game.selectedType === id ? null : id;
        Game.selected = null;
        Sound.play('click'); UI.syncAll();
        e.preventDefault(); return;
      }

      switch (k) {
        case ' ': case 'p':
          UI.togglePause(); e.preventDefault(); break;
        case 'n': case 'enter':
          Sound.resume(); Game.rushWave(); e.preventDefault(); break;
        case 'u':
          if (Game.selected && Game.selected.side === 0) {
            const next = Game.selected.nextUpgrade();
            /* A branch fork is a permanent identity choice — never auto-pick. */
            if (next.kind === 'branch') Sound.play('denied');
            else Game.upgrade(Game.selected);
          }
          e.preventDefault(); break;
        case 's':
          if (Game.selected && Game.selected.side === 0) Game.sell(Game.selected);
          e.preventDefault(); break;
        case 'q': case 'e': {
          /* Commander abilities. Q is the offensive slot, E the defensive one.
             An aimed one arms the cursor here and fires on the next click. */
          const slot = e.key.toLowerCase() === 'q' ? 0 : 1;
          if (Game.state === 'playing' && Game.armAbility(slot)) UI.syncAbilities();
          e.preventDefault(); break;
        }
        case 'tab':
          if (Game.selected && !Game.selected.isSupport && Game.selected.side === 0) {
            const modes = TARGET_MODES.map(m => m.id);
            const i = modes.indexOf(Game.selected.targetMode);
            Game.selected.targetMode = modes[(i + 1) % modes.length];
            Sound.play('click'); UI.syncAll();
          }
          e.preventDefault(); break;
      }
    });
  }

  /* The board is fitted to its container, so it has to be re-fitted whenever the
     container changes size. Debounced, and it re-bakes the terrain layer because
     that is rendered at the display scale. */
  let resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!Game.canvas || !FIELD) return;
      Game.resize();
      if (Game.renderBackground) Game.renderBackground();
    }, 120);
  });

  /* A backgrounded tab lets the audio clock run on while the scheduler is
     throttled to ~1s, so on return the lookahead loop would schedule every
     missed note at a timestamp already in the past and fire them all at once. */
  /* Coalesced saves must not be lost if the tab goes away. */
  window.addEventListener('beforeunload', () => Meta.flush());
  window.addEventListener('pagehide', () => Meta.flush());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Meta.flush();
    if (document.hidden) Sound.stopMusic();
    else if (Game.state === 'playing') Sound.startMusic();
  });

  /* Painted key art, when the art pack has been generated. Applied as CSS
     custom properties so the CSS layer decides how each one is used. */
  function applyArtPack() {
    if (typeof ARTPACK === 'undefined') return;
    const root = document.documentElement;
    if (ARTPACK.nebula) root.style.setProperty('--art-nebula', `url("${ARTPACK.nebula}")`);
    if (ARTPACK.galaxy_bg) { root.style.setProperty('--art-galaxy', `url("${ARTPACK.galaxy_bg}")`);
                             document.body.classList.add('has-galaxyart'); }
    /* The title screen is a CSS nebula now (owner-set, Session 16) -- the
       painted key art is no longer used as a backdrop. The variable is still
       published for anything else that wants the painting; the class that
       swapped the backdrop is deliberately not set. */
    if (ARTPACK.title) root.style.setProperty('--art-title', `url("${ARTPACK.title}")`);
    if (Object.keys(ARTPACK).length) document.body.classList.add('has-artpack');
  }
  applyArtPack();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
