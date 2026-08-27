/* MUTATION HARNESS. Measures the DETECTION POWER of owner-sweep by planting
   known semantic defects and checking the suite catches each one.

   Run it the way any other harness runs:
     python -m http.server 8471 --bind 127.0.0.1
     node tools/headless.js http://127.0.0.1:8471/index.html <outdir> tools/mutants.js

   WHY THIS EXISTS: before Session 29 the suite reported 59 passing checks and
   nobody could say what fraction of real defects those checks would actually
   catch. A pass count is not a detection rate. This turns it into one.

   RESULT AT THE TIME OF WRITING: 8 of 8 planted defects caught, every one by
   the check predicted for it up front, and the clean control stayed green.
   Re-verified after the Session 30 survive-board work: still 7 of 7. Session
   32 added the 8th, a layout mutant, which is why the shared viewport below
   moved from 1600x900 to 1024x900: the check it targets (28.1, the mobile
   fold regression) can only fail at a width the old viewport never reached,
   and the other seven were confirmed viewport-independent by this same run.
   Session 37 added the two campaign mutants (Game.start is a patchable
   method, so both of that session's shipped defects replant at runtime) and
   measured 10 of 10, all by predicted check, control green.

   TWO EQUIVALENT MUTANTS were found on the way, and they are the reason the
   `plant` functions look the way they do:
     1. assigning globalThis.LIGHT_LEAK_SHIELD does nothing, because it is a
        top-level const and the reader keeps the original binding.
     2. patching FACTIONS.light.apply does nothing, because Meta.applyTo resets
        side.traits afterwards. applyLate is the reachable path.
   A mutant that does not change observable behaviour proves nothing about the
   suite. When one is not caught, check that it APPLIED before calling it a
   hole in the harness.

   Every mutant states the check that SHOULD catch it. Predicting the catcher
   up front is what separates evidence from a coincidence: a defect caught by
   an unrelated check means the suite is failing for the wrong reason. */
const RUN = `
(async () => {
  const srcText = await (await fetch('/tools/owner-sweep.js')).text();
  const runSweep = () => {
    const o = (0, eval)(srcText);
    const f = (o.checks || []).filter(c => /FAIL/i.test(c.verdict || c.v || ''));
    return { fail: o.fail, ids: f.map(c => c.id) };
  };

  const MUTANTS = [
    { id: 'econ-souls-base',
      why: 'scoring/economy: the flat base reverts to the old flat-2-per-star',
      expect: '16.5',
      plant: () => { const o = Meta.SOULS_BASE; Meta.SOULS_BASE = 0;
                     return () => { Meta.SOULS_BASE = o; }; } },

    { id: 'econ-per-star',
      why: 'scoring/economy: per-star payout doubled',
      expect: '16.5',
      plant: () => { const o = Meta.soulsForStar; Meta.soulsForStar = function () { return 2; };
                     return () => { Meta.soulsForStar = o; }; } },

    { id: 'territory-renegade-orphan',
      why: 'identity: renegade worlds counted by nobody, the Session 29 regression',
      expect: '16.6',
      plant: () => { const o = window.galaxyHoldings || galaxyHoldings;
                     globalThis.galaxyHoldings = function (g, p) {
                       const out = o(g, p);
                       out[g.playerFaction] -= (out.renegade || 0);   /* orphan them again */
                       return out; };
                     return () => { globalThis.galaxyHoldings = o; }; } },

    { id: 'lockstep-table-insert',
      why: 'determinism: an index-coupled table gets an entry inserted at the front',
      expect: '23',
      plant: () => { const o = TARGET_MODES[0];
                     TARGET_MODES.unshift({ id: 'planted', name: 'PLANTED' });
                     return () => { TARGET_MODES.shift(); }; } },

    { id: 'render-throw',
      why: 'lifecycle: a tower draw function throws',
      expect: '22.10',
      plant: () => { const id = TOWER_ORDER[0];
                     const o = Tower.prototype['draw_' + id];
                     Tower.prototype['draw_' + id] = function () { throw new Error('planted'); };
                     return () => { if (o) Tower.prototype['draw_' + id] = o;
                                    else delete Tower.prototype['draw_' + id]; }; } },

    { id: 'loop-error-buffer',
      why: 'lifecycle: a frame threw and parked a message nothing used to read',
      expect: '22.12',
      plant: () => { Game.loopErrors = { 'planted frame error': 3 };
                     return () => { Game.loopErrors = {}; }; } },

    { id: 'faction-skew-flatten',
      why: 'content: the defensive power loses its cheaper leak',
      expect: '25.3',
      /* applyLate, NOT apply, and NOT the const. Two earlier versions of this
         mutant were EQUIVALENT: assigning globalThis.LIGHT_LEAK_SHIELD cannot
         rebind a top-level const, and patching FACTIONS.light.apply writes a
         trait that Meta.applyTo then resets. Neither changed observable
         behaviour, so neither proved anything about the suite. This one is on
         the path Game.leakCostOf actually reads. */
      plant: () => { const L = FACTIONS.light, o = L.applyLate;
                     L.applyLate = function (side) {
                       const r = o.apply(this, arguments);
                       if (side && side.traits) side.traits.leakReduction = 0;
                       return r;
                     };
                     return () => { L.applyLate = o; }; } },

    { id: 'layout-fold-cap-removed',
      why: 'layout: the mobile plate/map height caps are removed, reproducing the ' +
           'Session 32 regression that put the commander bar 259.8px below the fold',
      expect: '28.1',
      /* Runs at 1024x900 (see module.exports below), the width this whole
         file's viewport was moved to specifically so this mutant means
         something: at the old 1600x900, 28.1 reports INFO for every input
         and this would be an equivalent mutant, proving nothing, exactly the
         trap this file's own header warns about. An injected stylesheet, not
         an edit to the checked-in CSS: the plant/restore pair must be able to
         remove itself cleanly, and a <style> node is trivial to add and take
         back out again. */
      plant: () => {
        const el = document.createElement('style');
        el.id = 'planted-fold-regression';
        el.textContent = '.brief.inline.has-art .br-plate { max-height: none !important; ' +
          'aspect-ratio: 16/5 !important; } .brief.inline .br-pv { height: 170px !important; ' +
          'min-height: 128px !important; }';
        document.head.appendChild(el);
        return () => { const e2 = document.getElementById('planted-fold-regression');
                        if (e2) e2.remove(); };
      } },

    { id: 'campaign-start-throws',
      why: 'lifecycle: Game.start throws on the campaign path only, the Session 37 ' +
           'const-reassignment. A runtime TypeError, so node --check is blind to it, ' +
           'and every skirmish-path check stays green while the campaign is unstartable',
      expect: '29.1',
      /* Game.start is a plain method on the Game object, so unlike the
         top-level consts that made two earlier mutants equivalent (see the
         header), wrapping it genuinely changes the path 29.1 drives. Scoped
         to opts.world so only campaign-shaped calls throw, exactly as the
         original defect was: every other check passes map: and never
         reaches the campaign branch, which is the hole 29.1 exists to close. */
      plant: () => { const o = Game.start;
                     Game.start = function (opts) {
                       if (opts && opts.world) throw new TypeError('Assignment to constant variable.');
                       return o.call(this, opts); };
                     return () => { Game.start = o; }; } },

    { id: 'campaign-seed-collapse',
      why: 'determinism: every campaign battle builds from the seed "default", the ' +
           'Session 37 world-id-on-a-string defect. Measured then: 16 of 16 ' +
           'same-family worlds byte-identical, a galaxy of one map wearing many names',
      expect: '29.1',
      /* worldId wins the seed fallback chain (worldId || world || 'default'),
         so forcing it collapses the seed while opts.world still resolves the
         scenario: battles START normally and only the geometry repeats, which
         is precisely the shape that made the original invisible to every
         does-it-run check. 29.1's same-family fingerprint arm is the catcher. */
      plant: () => { const o = Game.start;
                     Game.start = function (opts) {
                       if (opts && opts.world) opts = Object.assign({}, opts, { worldId: 'default' });
                       return o.call(this, opts); };
                     return () => { Game.start = o; }; } },

    { id: 'universe-splits-by-faction',
      why: 'the one universe: each faction gets a different galaxy again, which is ' +
           'the exact defect the owner reported in Session 38 ("completely different ' +
           'solar systems"). Salting the v2 seed with the player faction is the ' +
           'smallest change that reintroduces it',
      expect: '38.1',
      /* generateGalaxy is a top-level FUNCTION DECLARATION, so the binding is
         reassignable and every caller resolves it at call time. (Contrast the
         equivalent-mutant trap in the header: a top-level const cannot be
         patched this way.) Salting only the v2 path leaves every v1 caller
         alone, so this mutant targets 38.1 and cannot make 38.2 fail for a
         reason that has nothing to do with the save contract. */
      plant: () => { const o = generateGalaxy;
                     generateGalaxy = function (seed, fac, mapPool, kindsW, gxv) {
                       if (gxv >= 2) seed = String(seed) + ':' + fac;
                       return o.call(this, seed, fac, mapPool, kindsW, gxv); };
                     return () => { generateGalaxy = o; }; } },

    { id: 'v1-galaxy-unfrozen',
      why: 'the save contract: an absent gxv silently generates the v2 galaxy, so ' +
           'every in-flight campaign regenerates onto different boards, arenas and ' +
           'boons mid-run. A campaign stores only its seed, so this is the shape ' +
           'that moves a saved galaxy underneath its owner',
      expect: '38.2',
      plant: () => { const o = generateGalaxy;
                     generateGalaxy = function (seed, fac, mapPool, kindsW, gxv) {
                       return o.call(this, seed, fac, mapPool, kindsW,
                                     gxv === undefined ? 2 : gxv); };
                     return () => { generateGalaxy = o; }; } },

    { id: 'setup-footer-unsticks',
      why: 'the owner-reported defect: the setup footers stop being sticky, so the ' +
           'button that advances the game falls below the fold. Measured before the ' +
           'fix: command 209px under at 1600x900, 463px at the reporter 1000x670',
      expect: '38.3',
      /* A stylesheet rule, because that is what the defect WAS. Planting it
         through CSS rather than by moving an element means the mutant exercises
         the same path the regression would take if someone edited polish.css. */
      plant: () => { const s = document.createElement('style');
                     s.id = 'mutant-unstick';
                     s.textContent = '#screen-faction .setup-foot,' +
                                     '#screen-command .setup-foot,' +
                                     '#screen-loadout .setup-foot' +
                                     '{ position: static !important; }';
                     document.head.appendChild(s);
                     return () => { const n = document.getElementById('mutant-unstick');
                                    if (n) n.remove(); }; } },

    { id: 'CONTROL-clean',
      why: 'the clean control: nothing is planted, the suite must stay green',
      expect: 'none',
      plant: () => () => {} }
  ];

  const out = [];
  for (const m of MUTANTS) {
    let restore = () => {};
    let r;
    try {
      restore = m.plant() || (() => {});
      r = runSweep();
    } catch (e) {
      r = { fail: -1, ids: ['THREW: ' + (e && e.message)] };
    }
    try { restore(); } catch (e) {}
    const caught = m.expect === 'none' ? r.fail === 0 : r.fail > 0;
    const byExpected = m.expect === 'none'
      ? r.fail === 0
      : r.ids.some(id => String(id).indexOf(m.expect) === 0);
    out.push({ id: m.id, why: m.why, expected: m.expect,
               fail: r.fail, caughtBy: r.ids.slice(0, 3),
               CAUGHT: caught, CAUGHT_BY_PREDICTED_CHECK: byExpected });
  }
  const planted = out.filter(o => o.expected !== 'none');
  return {
    mutants: out,
    detectionRate: planted.filter(o => o.CAUGHT).length + '/' + planted.length,
    predictedCatcherRate: planted.filter(o => o.CAUGHT_BY_PREDICTED_CHECK).length + '/' + planted.length,
    controlStayedGreen: out.find(o => o.expected === 'none').CAUGHT
  };
})()`;
/* 1024x900, not 1600x900: this is <= the 1050px breakpoint check 28.1 needs to
   be a real check rather than a permanent INFO, and none of the other seven
   mutants are viewport-sensitive, so moving the one shared size does not risk
   the track record above. Re-verify that claim, do not just trust it, if a
   future mutant here ever IS viewport-sensitive in the other direction. */
module.exports = [{ size: [1024, 900] }, { wait: 3000 }, { eval: RUN }];
