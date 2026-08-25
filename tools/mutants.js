/* MUTATION HARNESS. Measures the DETECTION POWER of owner-sweep by planting
   known semantic defects and checking the suite catches each one.

   Run it the way any other harness runs:
     python -m http.server 8471 --bind 127.0.0.1
     node tools/headless.js http://127.0.0.1:8471/index.html <outdir> tools/mutants.js

   WHY THIS EXISTS: before Session 29 the suite reported 59 passing checks and
   nobody could say what fraction of real defects those checks would actually
   catch. A pass count is not a detection rate. This turns it into one.

   RESULT AT THE TIME OF WRITING: 7 of 7 planted defects caught, every one by
   the check predicted for it up front, and the clean control stayed green.
   Re-verified after the Session 30 survive-board work: still 7 of 7.

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
module.exports = [{ size: [1600, 900] }, { wait: 3000 }, { eval: RUN }];
