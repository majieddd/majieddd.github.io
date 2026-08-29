#!/usr/bin/env node
/* DOES THE GAME MODULE CHAIN THROW ON LOAD, ANSWERED BY LOADING IT.
 *
 * WHY THIS EXISTS. js/game.js:229 calls assertBoonKeysAreLive() at module
 * top level: a boon whose apply() writes a key BOON_FOLD does not know is a
 * talent that does nothing, and this throws rather than shipping one quietly.
 * It is a real, already-written safety net, and nothing in the static gate
 * ever pulled the trigger on it. tools/facts.js stops loading deliberately
 * at DATA_END ('commanders'), before anything that wants document or canvas,
 * so five new robot boons (this session) were verified against BOON_FOLD by
 * hand, once, in a one-off shell command, instead of by a gate that runs
 * every time. Found the same way the boons gap itself was found: doing by
 * hand the exact thing that should have been a permanent check.
 *
 * Stops at 'game', one module past facts.js's DATA_END, because that is
 * where the assertion lives and net/ui/phone/debug/main are the modules
 * most likely to actually need a live document. If a later module gains its
 * own load-time assertion worth covering, move the stop point out to it and
 * re-verify the shim still loads clean rather than assuming it will.
 *
 *   node tools/probe-liveload.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

/* Read from build.js, never hand-copied here: the project's own standing
   law is "never hand-write a number a command can print", and a copied
   module list is that same defect on a longer fuse. */
function moduleOrder() {
  const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  const m = src.match(/const js\s*=\s*\[([^\]]*)\]/);
  if (!m) throw new Error('build.js no longer declares `const js = [...]`, so the module order is unknown.');
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

const STOP_AFTER = 'game';

function run() {
  const order = moduleOrder();
  const stop = order.indexOf(STOP_AFTER);
  if (stop < 0) {
    console.log('FAIL build.js no longer builds `' + STOP_AFTER + '`. Update STOP_AFTER in this file.');
    return 1;
  }
  const names = order.slice(0, stop + 1);

  const ctx = { console, window: {}, document: undefined };
  vm.createContext(ctx);
  for (const n of names) {
    const f = path.join(ROOT, 'js', n + '.js');
    if (!fs.existsSync(f)) continue;   // artpack.js is generated; absent in a fresh checkout is not a defect here
    try {
      vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: n + '.js' });
    } catch (e) {
      console.log('FAIL ' + n + '.js threw on load: ' + e.message);
      return 1;
    }
  }
  console.log(names.length + ' modules load clean through ' + STOP_AFTER + '.js, no module-level assertion threw');
  return 0;
}

process.exit(run());
