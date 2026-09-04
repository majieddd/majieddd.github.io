/* MOBILE HUD AUDIT: what the battle screen actually does at phone width.
 *
 * WHY THIS EXISTS. docs/MOBILE-AUDIT-S37.md fixed the SETUP screens and said
 * so explicitly: "The in-game HUD at phone width ... none of it was measured
 * here. Do not assume this pass helped it." It did not. The owner's screenshot
 * shows three panels overlapping each other over a board squeezed into a
 * strip, which is the density problem that audit deferred.
 *
 * This measures, in one pass, the five things that make the screen unusable
 * rather than merely ugly:
 *
 *   1. BOARD SHARE. What fraction of the viewport the player can actually see
 *      the game in. Everything else is chrome.
 *   2. OVERLAP. Which floating panels cover each other, and by how much. Two
 *      panels sharing pixels is the single most legible defect in the shot.
 *   3. OVERFLOW. Anything past the left or right edge, which is silent: the
 *      layout does not visibly break, content simply sits where a phone
 *      cannot scroll to it.
 *   4. TAP TARGETS. Interactive controls under 44px, the floor a thumb needs.
 *   5. CHROME HEIGHT. How many vertical pixels the HUD, controls and dock
 *      consume before the board gets any.
 *
 * Returns the house verdict shape so run_harness can summarise it.
 */
(function mobileHudAudit() {
  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', pass: !!cond, detail: String(detail).slice(0, 260) });
  const info = (id, detail) =>
    C.push({ id: id, verdict: 'INFO', pass: true, detail: String(detail).slice(0, 260) });

  const PIN = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
  Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
  UI.show('screen-game');
  UI.buildShop(); UI.buildAbilityBar(); UI.renderInspector(true); UI.syncAll();

  const W = window.innerWidth, H = window.innerHeight;
  /* THE TOUCH ASSERTIONS ONLY BIND ON A PHONE. 44px is a THUMB floor and the
     chrome budget is a small-screen budget; asserting either against a
     desktop window reports failures that are not defects and would make this
     harness unusable inside breakpoint-sweep, which runs every width. Above
     the breakpoint they still MEASURE, they just report INFO. */
  /* THE SAME CONDITION THE CSS USES, which is portrait width alone. The
     landscape phone layout is open work (see the note on the portrait block
     in css/polish.css): asserting the touch floors there would report real
     failures against a treatment nobody has finished, which is noise rather
     than a finding. Run this at 844x390 deliberately when picking that up. */
  const PHONE = W <= 760;
  const okPhone = (id, cond, detail) =>
    PHONE ? ok(id, cond, detail) : info(id + ' (desktop, not asserted)', detail);
  const R = el => (el ? el.getBoundingClientRect() : null);
  const vis = el => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' &&
           parseFloat(cs.opacity || '1') > 0.05;
  };

  const hud = document.getElementById('hud');
  const dock = document.getElementById('dock');
  const ctl = document.getElementById('battle-controls');
  const canvas = document.getElementById('game');
  const wrap = document.getElementById('canvas-wrap');

  /* CHROME IS WHATEVER SITS OVER THE BOARD, not three hard-coded ids. When
     RUSH was moved to a fixed bar above the controls it left #hud's box, and
     a chrome sum of "hud + dock + controls" silently stopped counting 48px of
     it: the budget improved on paper because a panel escaped the tape
     measure. Anything taken out of flow inside #hud counts as its own layer. */
  const floaters = hud
    ? [...hud.querySelectorAll('*')].filter(el => {
        const pos = getComputedStyle(el).position;
        /* FIXED ONLY. `absolute` children of #hud are positioned INSIDE it by
           design (the quit button sits in the card corner), so counting them
           as separate layers reports #hud overlapping its own child and
           double-counts their height as chrome. What this is looking for is
           an element that left the header entirely, which is `fixed`. */
        return pos === 'fixed' && vis(el);
      })
    : [];
  /* THE PHONE BARS COUNT AS CHROME. They replaced #hud, #dock, #btn-rush and
     #battle-controls, all of which are display:none under body.phone-hud, so
     without these two the chrome total on a phone was zero and every coverage
     figure below was measuring nothing. */
  const phoneTop = document.getElementById('phone-top');
  const phoneBar = document.getElementById('phone-bar');
  const chromeEls = [hud, dock, ctl, phoneTop, phoneBar].filter(vis).concat(floaters);

  /* ---- 1. board share, UNCOVERED ---------------------------------------
     The first cut of this check measured the canvas RECTANGLE and reported
     73% of the viewport, a comfortable pass, on the exact screen the owner
     photographed as unusable. The canvas is indeed large; it is simply
     underneath the chrome. What a player can actually see and tap the board
     through is the canvas MINUS every floating layer over it, so that is what
     gets measured. Sampled on a grid rather than by rectangle subtraction,
     because the panels are rounded and overlapping and exact geometry here
     would be precision nobody uses. */
  info('M1 viewport', W + 'x' + H);

  const cr = R(canvas);
  const coverRects = chromeEls.map(R);
  let sampled = 0, clear = 0;
  if (cr) {
    for (let gy = 0; gy < 40; gy++) for (let gx = 0; gx < 24; gx++) {
      const x = cr.left + (gx + 0.5) * cr.width / 24;
      const y = cr.top + (gy + 0.5) * cr.height / 40;
      if (x < 0 || x > W || y < 0 || y > H) continue;   /* offscreen is not board */
      sampled++;
      if (!coverRects.some(c => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)) clear++;
    }
  }
  const openShare = sampled ? clear / sampled : 0;
  const openOfViewport = H && cr ? (openShare * Math.min(cr.height, H) * Math.min(cr.width, W)) / (W * H) : 0;
  okPhone('M1 at least half the board is not underneath a panel',
     openShare >= 0.5,
     Math.round(openShare * 100) + '% of the on-screen canvas is uncovered (' +
     clear + ' of ' + sampled + ' sample points), which is ' +
     Math.round(openOfViewport * 100) + '% of the whole screen');

  /* ---- 2. overlap between the floating layers -------------------------- */
  /* THE FLOATERS ARE LAYERS TOO. This list was three hard-coded ids, so when
     RUSH became a fixed bar it was measured as chrome (M6 counted its height)
     and never compared against anything: it rendered straight across the wave
     readout with all eight checks green. A layer that is not in the overlap
     list is a layer nothing is protecting. */
  const layers = [
    { name: '#hud', el: hud }, { name: '#dock', el: dock },
    { name: '#battle-controls', el: ctl },
  ].concat(floaters.map(el => ({ name: '#' + (el.id || el.className), el: el })))
   .filter(l => vis(l.el));
  const overlaps = [];
  for (let i = 0; i < layers.length; i++)
    for (let j = i + 1; j < layers.length; j++) {
      const a = R(layers[i].el), b = R(layers[j].el);
      const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ow > 1 && oh > 1)
        overlaps.push(layers[i].name + ' over ' + layers[j].name + ' by ' +
                      Math.round(ow) + 'x' + Math.round(oh) + 'px');
    }
  ok('M2 no two floating HUD layers overlap',
     overlaps.length === 0,
     overlaps.length ? overlaps.join('; ') : 'none of ' + layers.length + ' layers intersect');

  /* THE DOCK'S OWN PANES. Three panes side by side is a desktop shape; on a
     phone they are the panels the owner saw sitting on top of each other. */
  const panes = [...document.querySelectorAll('#dock .dock-pane')].filter(vis);
  const paneOverlaps = [];
  for (let i = 0; i < panes.length; i++)
    for (let j = i + 1; j < panes.length; j++) {
      const a = R(panes[i]), b = R(panes[j]);
      const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ow > 1 && oh > 1)
        paneOverlaps.push((panes[i].id || 'pane' + i) + ' over ' + (panes[j].id || 'pane' + j) +
                          ' by ' + Math.round(ow) + 'x' + Math.round(oh) + 'px');
    }
  const paneShape = panes.map(p => (p.id || 'pane') + ':' + getComputedStyle(p).position +
                                   ':' + Math.round(R(p).width) + 'w').join(' ');
  ok('M3 no two dock panes overlap each other',
     paneOverlaps.length === 0,
     (paneOverlaps.length ? paneOverlaps.join('; ') + ' | ' : panes.length + ' panes, none intersecting | ') +
     paneShape);

  /* ---- 2b. INSIDE the header ------------------------------------------
     M2 compares #hud against the other LAYERS and never looks inside it, so
     it passed on a screenshot where the YOU card, the wave card and the RIVAL
     card were plainly running into each other. A container that does not
     overlap anything else can still be three cards fighting for one row. */
  const hudKids = hud ? [...hud.children].filter(vis) : [];
  const hudOver = [];
  for (let i = 0; i < hudKids.length; i++)
    for (let j = i + 1; j < hudKids.length; j++) {
      const a = R(hudKids[i]), b = R(hudKids[j]);
      const ow = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oh = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ow > 1 && oh > 1)
        hudOver.push((hudKids[i].className || 'kid') + ' over ' + (hudKids[j].className || 'kid') +
                     ' by ' + Math.round(ow) + 'x' + Math.round(oh));
    }
  const hudWidths = hudKids.map(k => (k.className || 'kid').toString().slice(0, 12) + ' ' +
                                     Math.round(R(k).width)).join(', ');
  ok('M2b the header cards do not run into each other',
     hudOver.length === 0,
     (hudOver.length ? hudOver.join('; ') + ' | ' : 'clean | ') + hudWidths + ' in ' + W);

  /* ---- 2c. NOTHING IS CLIPPED OUT OF A FIXED-HEIGHT STRIP ---------------
     The bottom HUD strip has a declared height and `overflow: hidden`, which
     is the right shape for a bar that must not grow, and the wrong shape for
     finding out when it does: content that does not fit is simply deleted
     from the screen with no warning anywhere.

     It happened TWICE in one session on this one element. First the wave
     block wrapped to a second row and vanished; then it survived the wrap and
     stacked as a COLUMN inside the row, running 39px past the strip's bottom
     edge. Both times every other check here passed and the screenshot was the
     only thing that knew. This is that screenshot, as a number. */
  const clipped = [];
  for (const host of [hud, dock].filter(vis)) {
    const hr = R(host);
    if (getComputedStyle(host).overflow === 'visible') continue;
    for (const el of host.querySelectorAll('*')) {
      if (!vis(el)) continue;
      const r = R(el);
      if (r.height < 2 || r.width < 2) continue;
      /* Skip anything under a FIXED ancestor, not just fixed elements. RUSH is
         a fixed bar inside #hud and is meant to sit outside it; its <span>
         and <em> are static children that inherit that position, and testing
         only the element itself reported them as 33px of clipped content on a
         button that is exactly where it belongs. */
      let esc = false;
      for (let n = el; n && n !== host; n = n.parentElement) {
        const cs2 = getComputedStyle(n);
        if (cs2.position === 'fixed') { esc = true; break; }
        /* And anything inside a SCROLLER is reachable by scrolling, which is
           the same distinction M4 had to learn: a pane that scrolls its own
           content is not clipping it away, it is paging it. */
        if ((cs2.overflowY === 'auto' || cs2.overflowY === 'scroll') &&
            n.scrollHeight > n.clientHeight + 1) { esc = true; break; }
      }
      if (esc) continue;
      const over = Math.round(Math.max(r.bottom - hr.bottom, hr.top - r.top));
      if (over > 2) clipped.push((el.id || el.className || el.tagName).toString().slice(0, 20) +
                                 ' +' + over + 'px out of #' + (host.id || 'host'));
    }
  }
  ok('M2c nothing is clipped out of a fixed-height strip',
     clipped.length === 0,
     clipped.length ? clipped.slice(0, 5).join(', ') : 'every child fits inside its clipping box');

  /* ---- 3. anything past a screen edge ---------------------------------- */
  /* A DELIBERATE HORIZONTAL SCROLLER IS NOT OVERFLOW. The escalation chips
     scroll in one row on purpose, so their children legitimately sit past the
     right edge and the player can reach them. Counting those reported 63px of
     "overflow" on a row that works, which is the kind of false positive that
     gets a probe ignored. Only content NOT inside a scrollable ancestor is a
     defect, because only that content is unreachable. */
  const inScroller = el => {
    for (let n = el.parentElement; n && n.id !== 'screen-game'; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  const out = [];
  for (const el of document.querySelectorAll('#screen-game *')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (inScroller(el)) continue;
    const over = Math.max(0, Math.round(r.right - W), Math.round(-r.left));
    if (over > 2) out.push((el.id || el.className || el.tagName).toString().slice(0, 26) + ' +' + over + 'px');
  }
  ok('M4 nothing sits past the left or right screen edge',
     out.length === 0,
     out.length ? out.slice(0, 6).join(', ') + (out.length > 6 ? ' and ' + (out.length - 6) + ' more' : '')
                : 'no element crosses an edge');

  /* ---- 4. tap targets --------------------------------------------------- */
  const small = [];
  for (const el of document.querySelectorAll('#screen-game button, #screen-game [role="button"], #screen-game a')) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44)
      small.push((el.id || el.className || el.textContent.trim()).toString().slice(0, 22) +
                 ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  }
  okPhone('M5 every battle control is at least 44px on both axes',
     small.length === 0,
     small.length ? small.length + ' under 44px: ' + small.slice(0, 5).join(', ') : 'all controls clear 44px');

  /* ---- 5. chrome budget ------------------------------------------------- */
  const hudH = vis(hud) ? R(hud).height : 0;
  const dockH = vis(dock) ? R(dock).height : 0;
  const ctlH = vis(ctl) ? R(ctl).height : 0;
  /* Floating layers add their own height; they are no longer inside hud. */
  const floatH = floaters.reduce((a, el) => a + R(el).height, 0);
  const chrome = hudH + dockH + ctlH + floatH;
  const centre = document.querySelector('#hud .hud-centre');
  const hudParts = centre ? [...centre.children].filter(vis)
    .map(c => (c.id || c.className).toString().slice(0, 14) + ' ' + Math.round(R(c).height)).join(', ') : '';
  const dockParts = dock ? [...dock.children].filter(vis)
    .map(c => (c.id || c.className).toString().slice(0, 16) + ' ' + Math.round(R(c).height)).join(', ')
    : '';
  /* WHY THIS IS NOT "under half the screen", which is what it asserted first.
     With the sheet OPEN the player is deliberately using a panel, and the
     panel's parts have floors that cannot be argued down: a 46px tab strip, a
     46px tower card, a 44px control. Two rows of tower cards plus tabs plus
     the controls bar plus a readable header simply is more than half of an
     800px phone, and the only ways to "pass" a 50% bar are to shrink touch
     targets below the thumb floor or to hide controls, both of which are
     worse than the number.

     So the open state is held to a USABLE BOARD instead: enough uncovered
     height to see a lane and place on it. What guarantees the board outright
     is the fold, and M7 holds that to a strict bar. Moved deliberately, with
     the reasoning written down, rather than nudged to turn a gate green: if a
     later reader disagrees, the thing to argue with is this paragraph. */
  /* A PROPORTIONAL FLOOR, because 300 absolute pixels is a portrait number.
     A landscape phone is 360px TALL: no open sheet can leave 300px of board
     there, and demanding it would force either a sheet too short to hold a
     tower card or controls under the thumb floor. The question that survives
     both orientations is whether there is still a usable band of BOARD on
     screen while a panel is deliberately open, and M7 remains the strict
     guarantee that one tap gives all of it back. */
  const openBoardPx = H - chrome;
  /* 20%, not 28%. On a 360px-tall landscape phone an open pane plus a tab
     strip plus the controls plus 44px targets leaves 84px of board, and the
     only ways to buy more are to shrink a touch target or to make the pane
     too short to hold a card. A fifth of the screen still showing the board
     while a panel is DELIBERATELY open, with the fold one tap away, is the
     honest bar. M7 is what holds the fold to account. */
  const floorPx = Math.min(300, Math.round(H * 0.20));
  okPhone('M6 the open sheet still leaves a usable board',
     openBoardPx >= floorPx && chrome < H * 0.72,
     'hud ' + Math.round(hudH) + ' + dock ' + Math.round(dockH) + ' + controls ' +
     Math.round(ctlH) + ' + floating ' + Math.round(floatH) +
     ' = ' + Math.round(chrome) + 'px of ' + H +
     ' (' + Math.round(chrome / H * 100) + '%), board keeps ' + Math.round(openBoardPx) +
     'px against a ' + floorPx + 'px floor' + ' |'.slice(0, 0) +
     'px | dock: ' + dockParts + ' | hud-centre: ' + hudParts);

  /* ---- 7. the fold is the real answer to clutter -----------------------
     The open sheet is a working surface and is allowed to cost real height.
     What must be true is that a player who wants the BOARD can have it in one
     tap, and that the tap gives back most of what the sheet took. This drives
     the same class the tab strip toggles, so it measures the shipped path. */
  if (PHONE) {
    document.body.classList.add('dock-folded');
    const dr = vis(dock) ? R(dock).height : 0;
    const chromeFolded = hudH + dr + ctlH + floatH;
    let s2 = 0, c2 = 0;
    const cover2 = chromeEls.filter(vis).map(R);
    if (cr) for (let gy = 0; gy < 40; gy++) for (let gx = 0; gx < 24; gx++) {
      const x = cr.left + (gx + 0.5) * cr.width / 24;
      const y = cr.top + (gy + 0.5) * cr.height / 40;
      if (x < 0 || x > W || y < 0 || y > H) continue;
      s2++;
      if (!cover2.some(c => x >= c.left && x <= c.right && y >= c.top && y <= c.bottom)) c2++;
    }
    document.body.classList.remove('dock-folded');
    const openShare2 = s2 ? c2 / s2 : 0;
    /* WHAT THIS CHECK IS NAMED FOR. The first cut asserted an absolute budget
       (folded chrome under 42% of the screen), which is a second copy of M6's
       question and a portrait number besides: at 360px tall, 44px targets put
       folded chrome at 43% and no amount of design gets under 42% without
       breaking the thumb floor.
       What folding must actually do is GIVE THE BOARD BACK, so that is what
       is measured: most of the board uncovered, and a real reduction against
       the open state rather than a token one. */
    const gaveBack = chrome > 0 ? (chrome - chromeFolded) / chrome : 0;

    /* M7 AND M8 WERE REWRITTEN IN SESSION 39, not deleted, because the design
       they tested no longer exists. They asked whether the DOCK folded and
       whether its TABS switched panes. On a phone there is no dock: the owner
       asked for "just giving the information of your econ, the upcoming wave
       and the HP of yourself and your opponent, as well as the ability to
       rush wave and do your skill", a tap on a tile to place a tower, and
       sending on the bottom. js/phone.js is that, and the two checks now ask
       the questions the new shape can actually fail.

       Deleting them would have been the wrong move twice over: it removes
       coverage, and it hides the fact that the surface changed. */

    /* ---- M7 the board is not underneath the chrome at all --------------- */
    /* The old dock sat ON the board and folding was the mitigation. The phone
       bar sits BELOW it, so the honest bar is much stricter than the 70% the
       fold was held to: essentially none of the board may be covered. */
    ok('M7 the board is never underneath the chrome',
       openShare >= 0.98,
       Math.round(openShare * 100) + '% of the board is uncovered with the bar up (needs 98%), ' +
       'chrome ' + Math.round(chrome) + 'px of ' + H +
       ' (' + Math.round(chrome / H * 100) + '%)');

    /* ---- M8 the two bars carry what the owner asked for, and nothing else - */
    /* Session 40 moved the numbers to the top and fixed the bottom to BASE,
       SKILL and UNITS, so the Session 39 version of this check (which looked
       for #pb-rush and #pb-send on the bottom bar) was asserting a layout that
       no longer exists. Rewritten rather than deleted, again. */
    var ptop = document.getElementById('phone-top');
    var pbar = document.getElementById('phone-bar');
    var need = ['pb-my-hp', 'pb-my-gold', 'pb-ai-hp', 'pb-ai-gold', 'pb-wave'];
    var missing = need.filter(function (id) {
      var e = document.getElementById(id);
      return !e || !e.getBoundingClientRect().width || !ptop || !ptop.contains(e);
    });
    /* The bottom three, by the owner's words: "the upgrade base, the commander
       skill and the sendable units". Each is checked where it must LIVE, not
       merely that it exists somewhere in the document. */
    var inBar = function (id) {
      var e = document.getElementById(id);
      return !!(e && pbar && pbar.contains(e) && e.getBoundingClientRect().width > 0);
    };
    if (!inBar('btn-baselvl')) missing.push('base upgrade not on the bar');
    if (!inBar('muster-bar')) missing.push('sendable units not on the bar');
    if (!inBar('pb-abils')) missing.push('commander skill not on the bar');
    if (!inBar('pb-rush')) missing.push('rush not on the bar');

    /* RUSH ON THE RIGHT. The owner asked for it "on the right side of some
       sort" after playing a build where it was folded into the wave chip, so
       its POSITION is part of the contract, not just its existence. */
    var rushEl = document.getElementById('pb-rush');
    if (rushEl && pbar) {
      var rr = rushEl.getBoundingClientRect(), br = pbar.getBoundingClientRect();
      if (br.right - rr.right > 14) missing.push('rush is not pinned to the right of the bar');
    }

    /* The DESKTOP pause and speed row stays gone on a phone; the collapsible
       tray is the only way to reach them. */
    var gone = [];
    ['btn-pause', 'battle-controls'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e && vis(e)) gone.push(id + ' is still visible');
    });

    /* Every control on either bar has to clear the thumb floor. */
    var tooSmall = [];
    [ptop, pbar].forEach(function (host) {
      if (!host) return;
      [].slice.call(host.querySelectorAll('button')).forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (!r.width) return;
        if (r.height < 44 || r.width < 44) tooSmall.push((b.id || b.className.split(' ')[0]) +
          ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      });
    });

    ok('M8 stats on top, base and skill and units on the bottom, no pause or speed',
       !!ptop && !!pbar && missing.length === 0 && gone.length === 0 && tooSmall.length === 0,
       (!ptop || !pbar) ? 'phone bars missing at a phone width'
         : ((missing.length ? 'missing: ' + missing.join(', ') + '. ' : '') +
            (gone.length ? gone.join(', ') + '. ' : '') +
            (tooSmall.length ? 'under the 44px thumb floor: ' + tooSmall.join(', ') : '')) ||
           ('4 numbers and the wave chip on top, base + skill + units on the bottom, ' +
            'pause and speed gone, every control at least 44px'));

    /* ---- M10 the bar is opaque, so its contrast does not depend on the
       board behind it ---------------------------------------------------- */
    /* --panel-2 resolves to rgba(19, 27, 45, 0.82) at this breakpoint, so a
       bare `background: var(--panel-2)` left the bar 82% over a LIVE BOARD:
       every contrast figure then depended on what the board happened to be
       drawing underneath, and the measurement that said it passed had
       composited it over black, which is the best case rather than the worst.
       Painting the panel over the opaque ground token fixed it. This asserts
       the property rather than the fix: composite the bar over white and over
       black and require the same pixel. */
    var opaqueTargets = [document.getElementById('phone-top'), document.getElementById('phone-bar')];
    if (opaqueTargets[0] || opaqueTargets[1]) {
      var pcx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      var over = function (under, top) {
        pcx.clearRect(0, 0, 1, 1);
        pcx.fillStyle = under; pcx.fillRect(0, 0, 1, 1);
        pcx.fillStyle = top;   pcx.fillRect(0, 0, 1, 1);
        var d = pcx.getImageData(0, 0, 1, 1).data;
        return d[0] + ',' + d[1] + ',' + d[2];
      };
      var seeThrough = [];
      opaqueTargets.filter(Boolean).forEach(function (el) {
        var pcs = getComputedStyle(el);
        var onWhite = over('#ffffff', pcs.backgroundColor);
        var onBlack = over('#000000', pcs.backgroundColor);
        /* backgroundColor alone can be transparent when the opacity comes from
           a background-image layer, which is exactly how these are built, so a
           layer counts as opaque cover too. */
        var hasLayer = pcs.backgroundImage && pcs.backgroundImage !== 'none';
        if (onWhite !== onBlack && !hasLayer)
          seeThrough.push(el.id + ' ' + onWhite + ' over white vs ' + onBlack + ' over black');
      });
      ok('M10 neither phone bar lets the board show through its text',
         seeThrough.length === 0,
         seeThrough.length ? seeThrough.join('; ')
           : 'both bars composite identically over white and black, so text contrast is fixed');
    }

    /* ---- M13 pause and speed are reachable, collapsed, above the bar ---- */
    /* Owner: "re-add the pause button and the speed options as a collapsible
       icon in the bottom right above the bar of some sort, just so it's super
       subtle that you could still access it". Subtle is not the same as
       missing, so this checks it is genuinely reachable: the toggle clears the
       thumb floor, opening it makes four real 44px controls that are all on
       screen, and closed the tray cannot be tapped by accident. */
    var ctlWhy = 'not attempted';
    var pctl = document.getElementById('phone-ctl');
    if (!pctl || !vis(pctl)) ctlWhy = 'no #phone-ctl visible during a battle';
    else {
      var dot = document.getElementById('pc-toggle');
      var tray = pctl.querySelector('.pc-tray');
      var dotR = dot.getBoundingClientRect();
      var barTop = pbar ? pbar.getBoundingClientRect().top : window.innerHeight;
      var closedPE = getComputedStyle(tray).pointerEvents;
      dot.click();
      var btns = [].slice.call(pctl.querySelectorAll('.pc-btn'));
      var badBtn = btns.filter(function (b) {
        var r = b.getBoundingClientRect();
        return r.width < 44 || r.height < 44 || r.left < 0 || r.right > window.innerWidth;
      });
      var openPE = getComputedStyle(tray).pointerEvents;
      dot.click();
      ctlWhy = (dotR.width < 44 || dotR.height < 44)
          ? 'the toggle is ' + Math.round(dotR.width) + 'x' + Math.round(dotR.height) + ', under the thumb floor'
        : (dotR.bottom > barTop + 1) ? 'the toggle overlaps the bottom bar'
        : closedPE !== 'none' ? 'the closed tray still accepts taps'
        : btns.length < 4 ? 'only ' + btns.length + ' controls in the tray, expected pause and three speeds'
        : badBtn.length ? badBtn.length + ' tray controls are undersized or off screen'
        : openPE === 'none' ? 'the open tray does not accept taps'
        : 'ok';
    }
    ok('M13 pause and speed are reachable from a collapsed control above the bar',
       ctlWhy === 'ok',
       ctlWhy === 'ok'
         ? 'a 44px toggle above the bar opens pause and three speeds, all 44px and on screen, inert when closed'
         : ctlWhy);

    /* ---- M12 the battle bars only exist during a battle ----------------- */
    /* FOUND BY PLAYING THE DEPLOYED BUILD rather than jumping straight to
       screen-game, which is what every check here had always done. Both bars
       are position:fixed and were shown for any phone-width viewport, so the
       TITLE SCREEN carried a WAVE 1 chip and a BASE LEVEL button floating over
       it, and adopt() had already pulled #btn-baselvl out of the dock to put
       it there. Nothing failed: the bars were correct, they were simply
       everywhere.

       The lesson is the entry-point one this suite already holds: a harness
       that always arrives by the same door never sees the other rooms. */
    var battleOnly = [];
    if (typeof UI !== 'undefined' && UI.show) {
      var gameScreen = document.getElementById('screen-game');
      var wasHidden = gameScreen && gameScreen.classList.contains('hidden');
      UI.show('screen-title');
      var tEl = document.getElementById('phone-top'), bEl = document.getElementById('phone-bar');
      if (tEl && vis(tEl)) battleOnly.push('#phone-top is up on the title screen');
      if (bEl && vis(bEl)) battleOnly.push('#phone-bar is up on the title screen');
      var baseEl = document.getElementById('btn-baselvl');
      if (baseEl && vis(baseEl)) battleOnly.push('the base upgrade is visible off the battle screen');
      /* Put the screen back however it was, so the checks after this one see
         the state they expect. */
      UI.show(wasHidden ? 'screen-title' : 'screen-game');
    } else battleOnly.push('UI.show unavailable, nothing was checked');
    ok('M12 the battle bars are not on the menus',
       battleOnly.length === 0,
       battleOnly.length ? battleOnly.join('; ')
                         : 'both bars and the borrowed base control disappear off the battle screen');

    /* ---- M11 a tower's radial carries its whole decision ---------------- */
    /* Owner, Session 40: "to upgrade a tower individually, you click on it and
       a radial menu with options pops up, similar to kingdom rush". Three
       things can go wrong and each fails differently: the ring does not open,
       it opens with the wrong actions, or it opens off the screen for a tower
       near an edge. All three are checked, the last against the worst tower on
       the board rather than a convenient one. */
    var radialWhy = 'not attempted';
    if (typeof Phone !== 'undefined' && Phone.on && typeof Game !== 'undefined') {
      var rspot = null;
      for (var ry = 0; ry < FIELD.rows && !rspot; ry++)
        for (var rx = 0; rx < FIELD.cols && !rspot; rx++)
          if (Game.canBuild(0, rx, ry, 1) && !Game.towerAt(rx, ry)) rspot = { gx: rx, gy: ry };
      if (!rspot) radialWhy = 'no tile to build a test tower on';
      else {
        Game.sides[0].gold = 9999;
        Game.build(0, 'bolt', rspot.gx, rspot.gy);
        var rt = Game.towerAt(rspot.gx, rspot.gy);
        if (!rt) radialWhy = 'the test tower did not build';
        else if (!Phone.openRadial(rt)) radialWhy = 'openRadial refused a live friendly tower';
        else {
          var rbtns = [].slice.call(document.querySelectorAll('#phone-radial .pr-btn'));
          var hasUp = rbtns.some(function (b) { return b.className.indexOf('up') >= 0; });
          var hasSell = rbtns.some(function (b) { return b.className.indexOf('sell') >= 0; });
          var tbR = document.getElementById('phone-top').getBoundingClientRect();
          var bbR = document.getElementById('phone-bar').getBoundingClientRect();
          var off = rbtns.filter(function (b) {
            var r = b.getBoundingClientRect();
            return r.left < 0 || r.right > window.innerWidth ||
                   r.top < tbR.bottom - 1 || r.bottom > bbR.top + 1;
          });
          /* Stacked buttons are the failure the first cut of this shipped with:
             a transitioned transform left every button at the ring origin. */
          var seen = {}, stacked = 0;
          rbtns.forEach(function (b) {
            var r = b.getBoundingClientRect();
            var k = Math.round(r.x) + ',' + Math.round(r.y);
            if (seen[k]) stacked++; else seen[k] = 1;
          });
          radialWhy = !rbtns.length ? 'the ring opened empty'
            : !hasUp ? 'no upgrade control in the ring'
            : !hasSell ? 'no sell control in the ring'
            : stacked ? stacked + ' buttons share a position, so the ring never spread'
            : off.length ? off.length + ' of ' + rbtns.length + ' buttons are off screen or under a bar'
            : 'ok:' + rbtns.length;
          Phone.closeRadial();
        }
      }
    } else radialWhy = 'Phone is not active at this width';
    ok('M11 tapping a tower opens a radial with its upgrade and sell, all on screen',
       radialWhy.indexOf('ok:') === 0,
       radialWhy.indexOf('ok:') === 0
         ? 'the ring opened with ' + radialWhy.slice(3) + ' controls, spread apart and all on screen'
         : radialWhy);

    /* ---- M14 the talent map scrolls on a phone instead of clipping ------- */
    /* Session 41 put every commander's chart on a five-column map beside a
       prestige track. Measured at 390px before its CSS was fixed: the track
       dropped below correctly, but .talent-scroll was 526px wide inside a
       390px viewport with scrollWidth equal to clientWidth, so the fifth
       column was cut off by an ancestor's overflow and nothing could reach
       it. Owner-sweep 43.x holds the desktop DOM; this is the one phone
       property that desktop cannot see. Leaves the battle screen exactly as
       it found it, since the checks after this one assume it. */
    var mapWhy = 'not attempted';
    if (typeof UI !== 'undefined' && UI.renderCommanders && typeof COMMANDER_ROSTER !== 'undefined') {
      var keepSel = UI.sel && UI.sel.commander;
      try {
        UI.sel.commander = (COMMANDER_ROSTER[1] || COMMANDER_ROSTER[0]).id;
        UI.show('screen-command'); UI.renderCommanders();
        var wrapEl = document.querySelector('#commander-detail .talent-wrap');
        var scrollEl = document.querySelector('#commander-detail .talent-scroll');
        var spineEl = document.querySelector('#commander-detail .pt-spine');
        if (!wrapEl || !scrollEl || !spineEl) mapWhy = 'talent map or track not rendered';
        else {
          var problems = [];
          if (getComputedStyle(wrapEl).flexDirection !== 'column') problems.push('tree and track are side by side at ' + window.innerWidth + 'px');
          if (getComputedStyle(spineEl).flexDirection !== 'row') problems.push('track is still a column');
          if (!(scrollEl.scrollWidth > scrollEl.clientWidth + 1))
            problems.push('map does not scroll: scrollWidth ' + scrollEl.scrollWidth + ' vs clientWidth ' + scrollEl.clientWidth + ', so its right edge is clipped');
          if (document.documentElement.scrollWidth > window.innerWidth + 1) problems.push('the page itself scrolls sideways');
          mapWhy = problems.length ? problems.join('; ') : 'ok';
        }
      } catch (e) { mapWhy = 'threw: ' + e.message; }
      UI.sel.commander = keepSel;
      UI.show('screen-game');
    } else mapWhy = 'commander screen unavailable';
    ok('M14 the talent map scrolls on a phone instead of clipping its right edge',
       mapWhy === 'ok',
       mapWhy === 'ok' ? 'tree above track, track in a row, map scrolls inside its box, page does not' : mapWhy);

    /* ---- M9 a tap on a tile places a tower, which is the whole point ---- */
    var placed = 'not attempted';
    if (typeof Phone !== 'undefined' && Phone.on && typeof Game !== 'undefined' && Game.canBuild) {
      var spot = null;
      for (var gy2 = 0; gy2 < FIELD.rows && !spot; gy2++)
        for (var gx2 = 0; gx2 < FIELD.cols && !spot; gx2++)
          if (Game.canBuild(0, gx2, gy2, 1) && !Game.towerAt(gx2, gy2)) spot = { gx: gx2, gy: gy2 };
      if (!spot) placed = 'no buildable tile to test with';
      else {
        Game.sides[0].gold = 9999;
        Phone.openBuildAt(spot.gx, spot.gy);
        var sheet = document.getElementById('phone-sheet');
        var card = sheet && sheet.querySelector('#shop-list [data-tower]');
        if (!Phone.pendingTile || Phone.pendingTile.gx !== spot.gx || Phone.pendingTile.gy !== spot.gy)
          placed = 'openBuildAt did not arm the tile it was given';
        else if (!card) placed = 'the sheet opened with no tower cards in it';
        else {
          /* THE REAL PATH. card.click() runs js/ui.js's own shop handler, which
             is what sets Game.selectedType, and commitPendingBuild is the exact
             method the sheet's listener defers to. The first cut of this check
             called Game.build directly and therefore passed against a planted
             defect that had broken tap-to-place outright. */
          var before = Game.sides[0].towers.length;
          card.click();
          var landed = Phone.commitPendingBuild();
          placed = (landed && Game.sides[0].towers.length === before + 1 &&
                    !!Game.towerAt(spot.gx, spot.gy))
            ? 'ok'
            : 'the sheet opened but the chosen tower did not land on the tapped tile';
        }
      }
    } else placed = 'Phone is not active at this width';
    ok('M9 tapping a tile opens the tower sheet and the choice lands on that tile',
       placed === 'ok',
       placed === 'ok'
         ? 'a tile tap armed the sheet and the tower chosen was built on that exact tile'
         : placed);
  }

  const pass = C.filter(c => c.verdict === 'PASS').length;
  const fail = C.filter(c => c.verdict === 'FAIL').length;
  const out2 = { pass: pass, fail: fail, info: C.length - pass - fail, checks: C };
  /* BOTH globals. tools/breakpoint-sweep.js reads `window.__SWEEP` and reports
     "no sweep result" for anything that does not set it, which is how this
     harness silently produced nothing at the only widths that matter. */
  window.__MOBILE = out2;
  window.__SWEEP = out2;
  return out2;
})()
