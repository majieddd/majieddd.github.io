/* HOW MUCH OF THE BOARD CAN A PHONE ACTUALLY SEE, AND CAN IT REACH THE REST?
 *
 * The owner, on the shipped mobile build: "I still can't really scroll around
 * the map properly to see all the tiles. it feels as if I only see a section
 * of the board and I can't really do much."
 *
 * tools/mobile-hud-audit.js measures the board as a RECTANGLE OF SCREEN: how
 * much canvas is not underneath a panel. That is a different question from
 * how much of the GAME WORLD that canvas is showing. A canvas can occupy the
 * whole screen, pass every layout check, and still be a keyhole onto one
 * corner of the field, which is what the screenshot shows.
 *
 * So this measures the world, not the screen: what fraction of the board's
 * tiles are inside the view at rest, whether the camera can be pulled back to
 * see all of it, and whether a touch drag actually moves it.
 */
(function boardView() {
  const C = [];
  const ok = (id, cond, detail) =>
    C.push({ id: id, verdict: cond ? 'PASS' : 'FAIL', pass: !!cond, detail: String(detail).slice(0, 260) });
  const info = (id, detail) =>
    C.push({ id: id, verdict: 'INFO', pass: true, detail: String(detail).slice(0, 260) });

  const PIN = ['bolt', 'cryo', 'mortar', 'flak', 'beacon'];
  Game.start({ map: 'spine', difficulty: 'contested', loadout: PIN.slice() });
  UI.show('screen-game');
  UI.buildShop(); UI.buildAbilityBar(); UI.syncAll();
  Game.resize();

  const W = window.innerWidth, H = window.innerHeight;
  info('B0 viewport', W + 'x' + H + ', immersive=' + document.body.classList.contains('immersive'));

  /* The world span the camera is showing, in board pixels. */
  function visibleSpan() {
    const z = Game.camZoom();
    const vw = (Game.viewW || Game.width * Game.viewScale) / (Game.viewScale * z);
    const vh = (Game.viewH || Game.height * Game.viewScale) / (Game.viewScale * z);
    return { vw: vw, vh: vh, z: z };
  }
  function shareVisible() {
    const s = visibleSpan();
    return Math.min(1, (Math.min(s.vw, Game.width) * Math.min(s.vh, Game.height)) /
                       (Game.width * Game.height));
  }

  info('B0 scales', 'fitScale=' + (Game.fitScale || 0).toFixed(3) +
       ' viewScale=' + (Game.viewScale || 0).toFixed(3) +
       ' camMinZoom=' + Game.camMinZoom().toFixed(3) +
       ' camZoom=' + Game.camZoom().toFixed(3) +
       ' board=' + Game.width + 'x' + Game.height +
       ' canvasCss=' + Math.round(Game.viewW || 0) + 'x' + Math.round(Game.viewH || 0));

  /* ---- B1 at rest, most of the board should be on screen --------------- */
  const atRest = shareVisible();
  ok('B1 a fresh battle shows most of the board',
     atRest >= 0.8,
     Math.round(atRest * 100) + '% of the board area is inside the view at rest ' +
     '(zoom ' + Game.camZoom().toFixed(2) + ', floor ' + Game.camMinZoom().toFixed(2) + ')');

  /* ---- B2 the camera can be pulled back to the whole board ------------- */
  Game.cam.z = Game.camMinZoom();
  const pulled = shareVisible();
  ok('B2 pulling fully back shows the whole board',
     pulled >= 0.98,
     Math.round(pulled * 100) + '% visible at the zoom floor');

  /* ---- B3 a drag actually pans, and reaches the far corner ------------- */
  const cv = document.getElementById('game');
  const r = cv.getBoundingClientRect();
  Game.cam.z = Math.min(1.6, BATTLE_ZOOM_MAX);      /* zoomed in, so panning matters */
  Game.cam.x = 0; Game.cam.y = 0;
  const before = { x: Game.camClamped().x, y: Game.camClamped().y };
  /* POINTER EVENTS, not touch. js/game.js binds pointerdown/pointermove/
     pointerup on the canvas and listens for no touch event at all, so a probe
     dispatching TouchEvents measures nothing and reports the pan dead. It did:
     "camera moved 0px" against a pan that works. pointerType 'touch' so any
     coarse-pointer branch takes the path a phone takes. */
  const ptr = (type, x, y) => {
    cv.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch',
      isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1
    }));
  };
  let threw = '';
  try {
    ptr('pointerdown', r.left + r.width * 0.72, r.top + r.height * 0.72);
    for (let i = 1; i <= 6; i++)
      ptr('pointermove', r.left + r.width * 0.72 - i * 22, r.top + r.height * 0.72 - i * 18);
    ptr('pointerup', r.left + r.width * 0.72 - 132, r.top + r.height * 0.72 - 108);
  } catch (e) { threw = e.message; }
  const after = { x: Game.camClamped().x, y: Game.camClamped().y };
  const moved = Math.abs(after.x - before.x) + Math.abs(after.y - before.y);
  ok('B3 a one-finger drag pans the board',
     !threw && moved > 20,
     threw ? ('touch dispatch threw: ' + threw)
           : ('camera moved ' + Math.round(moved) + 'px in world units (' +
              Math.round(before.x) + ',' + Math.round(before.y) + ' to ' +
              Math.round(after.x) + ',' + Math.round(after.y) + ')'));

  /* ---- B4 every lane tile is reachable by panning ---------------------- */
  /* The corners are what a player needs to build on and what a keyhole view
     hides. Reachable means the clamp lets the camera get there. */
  Game.cam.z = Math.min(1.6, BATTLE_ZOOM_MAX);
  Game.cam.x = -99999; Game.cam.y = -99999;
  const tl = Game.camClamped();
  Game.cam.x = 99999; Game.cam.y = 99999;
  const br = Game.camClamped();
  const s = visibleSpan();
  const reachX = (br.x + s.vw) - tl.x, reachY = (br.y + s.vh) - tl.y;
  ok('B4 panning reaches the whole board at working zoom',
     reachX >= Game.width - 2 && reachY >= Game.height - 2,
     'reachable span ' + Math.round(reachX) + 'x' + Math.round(reachY) +
     ' of a ' + Game.width + 'x' + Game.height + ' board');

  /* ---- B5 pinch changes the zoom, both ways ---------------------------- */
  const ptr2 = (type, id, x, y) => {
    cv.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch',
      isPrimary: id === 1, clientX: x, clientY: y, button: 0,
      buttons: type === 'pointerup' ? 0 : 1
    }));
  };
  function pinchBy(factor) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const start = 60, end = start * factor;
    ptr2('pointerdown', 1, cx - start, cy);
    ptr2('pointerdown', 2, cx + start, cy);
    for (let i = 1; i <= 8; i++) {
      const d = start + (end - start) * (i / 8);
      ptr2('pointermove', 1, cx - d, cy);
      ptr2('pointermove', 2, cx + d, cy);
    }
    ptr2('pointerup', 1, cx - end, cy);
    ptr2('pointerup', 2, cx + end, cy);
  }
  Game.resetCam();
  const zFit = Game.camZoom();
  pinchBy(2.4);                       /* fingers apart: zoom IN */
  const zIn = Game.camZoom();
  pinchBy(1 / 2.4);                   /* fingers together: zoom OUT */
  const zOut = Game.camZoom();
  ok('B5 a pinch zooms in, and a reverse pinch zooms back out',
     zIn > zFit * 1.3 && zOut < zIn * 0.8,
     'fit ' + zFit.toFixed(2) + ' -> pinched in ' + zIn.toFixed(2) +
     ' -> pinched out ' + zOut.toFixed(2) + ' (floor ' + Game.camMinZoom().toFixed(2) +
     ', ceiling ' + BATTLE_ZOOM_MAX + ')');

  /* ---- B6 double tap toggles the fit ----------------------------------- */
  Game.resetCam();
  const dbl = (x, y) => {
    ptr2('pointerdown', 3, x, y); ptr2('pointerup', 3, x, y);
    ptr2('pointerdown', 3, x, y); ptr2('pointerup', 3, x, y);
  };
  const zBefore = Game.camZoom();
  dbl(r.left + r.width / 2, r.top + r.height / 2);
  const zAfter = Game.camZoom();
  dbl(r.left + r.width / 2, r.top + r.height / 2);
  const zBack = Game.camZoom();
  ok('B6 a double tap zooms in, and again returns to the fit',
     zAfter > zBefore * 1.5 && Math.abs(zBack - zBefore) < zBefore * 0.3,
     'fit ' + zBefore.toFixed(2) + ' -> ' + zAfter.toFixed(2) + ' -> ' + zBack.toFixed(2));

  /* ---- B7 a tile is tappable at the working zoom ----------------------- */
  /* THE ERGONOMIC POINT OF ALL OF THE ABOVE. A board fitted whole to a 390px
     phone puts a 38px tile on screen at about 16px, which no thumb can place
     accurately. What has to be reachable is a zoom where a tile clears the
     44px floor, and the double tap has to land on it. */
  Game.resetCam();
  dbl(r.left + r.width / 2, r.top + r.height / 2);
  const tilePx = TILE * Game.viewScale * Game.camZoom();
  const fitTilePx = TILE * Game.viewScale * Game.camMinZoom();
  ok('B7 one double tap reaches a thumb-sized tile',
     tilePx >= 40,
     'tile is ' + tilePx.toFixed(1) + 'px after a double tap, from ' +
     fitTilePx.toFixed(1) + 'px at the whole-board fit (44px is the thumb floor)');

  Game.resetCam();
  const pass = C.filter(c => c.verdict === 'PASS').length;
  const fail = C.filter(c => c.verdict === 'FAIL').length;
  const out = { pass: pass, fail: fail, info: C.length - pass - fail, checks: C };
  window.__SWEEP = out;
  return out;
})()
