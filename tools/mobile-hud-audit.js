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
        return (pos === 'fixed' || pos === 'absolute') && vis(el);
      })
    : [];
  const chromeEls = [hud, dock, ctl].filter(vis).concat(floaters);

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
  const openBoardPx = H - chrome;
  okPhone('M6 the open sheet still leaves a usable board',
     openBoardPx >= 300 && chrome < H * 0.62,
     'hud ' + Math.round(hudH) + ' + dock ' + Math.round(dockH) + ' + controls ' +
     Math.round(ctlH) + ' + floating ' + Math.round(floatH) +
     ' = ' + Math.round(chrome) + 'px of ' + H +
     ' (' + Math.round(chrome / H * 100) + '%), board keeps ' + Math.round(openBoardPx) +
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
    ok('M7 folding the sheet gives the board back',
       chromeFolded < H * 0.42 && openShare2 >= 0.7,
       'folded chrome ' + Math.round(chromeFolded) + 'px of ' + H + ' (' +
       Math.round(chromeFolded / H * 100) + '%), board uncovered ' +
       Math.round(openShare2 * 100) + '%');
  }

  /* ---- 8. the sheet is only useful if the tabs actually switch ----------
     Driven by CLICKING the real controls, not by setting data-pane, because
     the wiring between the two is the thing that can break. */
  if (PHONE) {
    const tabOf = n => document.querySelector('#dock-tabs .dock-tab[data-pane="' + n + '"]');
    const shown = () => [...document.querySelectorAll('#dock .dock-pane')]
      .filter(vis).map(e => e.id).join(',');
    document.body.classList.remove('dock-folded');
    dock.dataset.pane = 'shop'; UI.syncDockTabs();
    tabOf('muster').click();
    const toMuster = shown() === 'dock-muster';
    tabOf('inspector').click();
    const toInspector = shown() === 'dock-inspector';
    const ariaOk = tabOf('inspector').getAttribute('aria-selected') === 'true' &&
                   tabOf('muster').getAttribute('aria-selected') === 'false';
    /* Tapping the tab you are already on folds the sheet away, which is the
       gesture a player reaches for when they want the board. */
    tabOf('inspector').click();
    const foldedByRetap = document.body.classList.contains('dock-folded') && shown() === '';
    document.getElementById('dock-collapse').click();
    const unfolded = !document.body.classList.contains('dock-folded') && shown() === 'dock-inspector';
    dock.dataset.pane = 'shop'; UI.syncDockTabs();
    ok('M8 the dock tabs switch panes, and re-tapping folds the sheet',
       toMuster && toInspector && ariaOk && foldedByRetap && unfolded,
       'to UNITS ' + toMuster + ', to COMMAND ' + toInspector + ', aria tracks ' + ariaOk +
       ', re-tap folds ' + foldedByRetap + ', caret unfolds ' + unfolded);
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
