/* ==========================================================================
   DEBUG MODE, the owner's testing harness inside the game itself.

   THE ONE LAW THIS MODULE OBEYS, and the reason it is written this way:
   every cheat drives the SAME code path real play drives. The owner was
   explicit about the case that matters, in his own words: forcing a star
   rating must still "proc and queue the cutscene to work as a way of
   debugging". A cheat that wrote `stars[world] = 3` directly would set the
   number and skip Meta.recordWorld, which is what computes `systemTaken`,
   which is the only thing ui.js:417 consults before playing the interstitial.
   The cheat would appear to work and would silently disable the very feature
   it exists to test.

   So: INSTANT FINISH calls Game.endMatch, the real terminator. FORCE STARS
   sets a one-shot override that endMatch reads while running its normal
   recordWorld path. Nothing here reaches past the funnel.

   SECOND LAW: a duel is untouchable. Every control is gated on !Net.live.
   Lockstep carries indices and a seeded stream; a seat that granted itself
   gold would desync the match on the next fingerprint, and a seat that
   ended the match locally would simply part from its peer. Debug mode is a
   SINGLEPLAYER instrument and says so on its face rather than failing oddly.
   ========================================================================== */
const Debug = {
  on: false,
  /* Collapsed by default. The first draft docked a full-width bar at bottom
     centre and it sat straight on top of the muster dock, which is the one
     panel you most want reachable WHILE cheating: a testing tool that covers
     the thing under test is worse than no tool. */
  open: false,

  /** Cheats are singleplayer only. One reader, so every control agrees. */
  allowed() {
    return this.on && !(typeof Net !== 'undefined' && Net.live);
  },

  /** In a battle, with a live board to act on. */
  inBattle() {
    return this.allowed() && typeof Game !== 'undefined' &&
           (Game.state === 'playing' || Game.state === 'choosing');
  },

  set(v) {
    this.on = !!v;
    document.body.classList.toggle('debug-on', this.on);
    this.render();
  },

  /* ---------------------------------------------------------- THE CHEATS */

  /**
   * Finish the current battle at a chosen star rating.
   *
   * `Game._debugStars` is a ONE-SHOT override consumed inside endMatch, which
   * then runs Meta.recordWorld, campaignAdvance, advanceRivals and the results
   * screen exactly as a real victory does. That is the whole point: the
   * cutscene that follows a system falling is queued off lastStars.systemTaken,
   * and lastStars is recordWorld's return value.
   */
  finish(stars) {
    if (!this.inBattle()) return false;
    Game._debugStars = Math.max(0, Math.min(3, stars | 0));
    Game.endMatch(true);
    return true;
  },

  /** Lose it, through the same door. */
  lose() {
    if (!this.inBattle()) return false;
    Game._debugStars = null;
    Game.endMatch(false);
    return true;
  },

  /** Gold, through awardGold so every modifier and readout sees it. */
  gold(n) {
    if (!this.inBattle()) return false;
    Game.awardGold(0, n | 0);
    UI.syncAll();
    return true;
  },

  /** Clear the board of hostiles, by killing them through the real funnel so
      bounty, doctrine rites and stats all book exactly as they would. */
  clearWave() {
    if (!this.inBattle()) return false;
    let n = 0;
    for (const e of Game.enemies.slice())
      if (!e.dead && !e.leaked && e.hostileTo === 0) { Game.killEnemy(e); e.dead = true; n++; }
    UI.syncAll();
    return n;
  },

  /** Lives, so a long board can be probed without babysitting it. */
  heal() {
    if (!this.inBattle()) return false;
    Game.sides[0].lives = Game.sides[0].maxLives;
    UI.syncAll();
    return true;
  },

  /* ------------------------------------------------------------ THE BAR */

  render() {
    let bar = document.getElementById('debug-bar');
    if (!this.on) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'debug-bar';
      bar.setAttribute('role', 'toolbar');
      bar.setAttribute('aria-label', 'Debug tools');
      document.body.appendChild(bar);
      bar.addEventListener('click', ev => {
        const b = ev.target.closest('[data-dbg]');
        if (!b) return;
        const a = b.dataset.dbg;
        if (a === 'toggle') { this.open = !this.open; this.render(); return; }
        if (a === 'win1') this.finish(1);
        else if (a === 'win2') this.finish(2);
        else if (a === 'win3') this.finish(3);
        else if (a === 'lose') this.lose();
        else if (a === 'gold') this.gold(5000);
        else if (a === 'clear') this.clearWave();
        else if (a === 'heal') this.heal();
        this.render();
      });
    }
    const live = typeof Net !== 'undefined' && Net.live;
    const can = this.inBattle();
    bar.classList.toggle('open', this.open);
    const head = `<button class="dbg-tag" data-dbg="toggle" aria-expanded="${this.open}"
                    aria-label="${this.open ? 'Collapse' : 'Expand'} debug tools">DEBUG ${this.open ? '▾' : '▸'}</button>`;
    if (!this.open) { bar.innerHTML = head; return; }
    bar.innerHTML = live
      ? `${head}<span class="dbg-note">Cheats are disabled in a duel: lockstep would part.</span>`
      : `${head}
         <button class="dbg-b" data-dbg="win1" ${can ? '' : 'disabled'}>FINISH ★</button>
         <button class="dbg-b" data-dbg="win2" ${can ? '' : 'disabled'}>FINISH ★★</button>
         <button class="dbg-b" data-dbg="win3" ${can ? '' : 'disabled'}>FINISH ★★★</button>
         <button class="dbg-b" data-dbg="lose" ${can ? '' : 'disabled'}>DEFEAT</button>
         <button class="dbg-b" data-dbg="gold" ${can ? '' : 'disabled'}>+5000 ◈</button>
         <button class="dbg-b" data-dbg="clear" ${can ? '' : 'disabled'}>CLEAR WAVE</button>
         <button class="dbg-b" data-dbg="heal" ${can ? '' : 'disabled'}>FULL LIVES</button>
         ${can ? '' : '<span class="dbg-note">Start a battle to use these.</span>'}`;
  }
};
