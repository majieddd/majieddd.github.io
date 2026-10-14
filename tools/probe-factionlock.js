/* Prove the Earth-System faction lock actually locks, and actually unlocks.
 *
 * A gate that has only ever passed has demonstrated nothing, so this drives the
 * real Meta object against a stub localStorage and asserts the predicate at
 * each state, INCLUDING the grandfather clause for accounts that finished the
 * game before the lock shipped.
 *
 * Failure is a THROW. A returned string is always pass detail.
 * Run: node tools/probe-factionlock.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

function freshContext() {
  const store = {};
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
  const ctx = {
    console, localStorage: ls, document: undefined,
    setTimeout: (f) => f, clearTimeout: () => {},
    requestAnimationFrame: () => 0,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['config', 'lore', 'factions', 'towers2', 'roster', 'story',
                   'galaxy', 'commanders'])
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), ctx,
                    { filename: f + '.js' });
  return ctx;
}

const checks = [];
function T(id, fn) {
  let detail;
  try { detail = fn(); }
  catch (e) { checks.push({ id, verdict: 'FAIL', detail: e.message }); return; }
  checks.push({ id, verdict: 'PASS', detail: String(detail) });
}
function must(cond, msg) { if (!cond) throw new Error(msg); }

/* The lock predicate exactly as ui.js computes it, kept in one place so the
   probe cannot drift from the screen it is asserting about. */
const FACS = ['human', 'light', 'xeno', 'pirate', 'robot'];
const lockedSet = earthDone => FACS.filter(id => !earthDone && id !== 'human');

T('FL.1 fresh account locks the other four', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  must(typeof Meta.earthCleared === 'function', 'Meta.earthCleared is missing');
  const done = Meta.earthCleared();
  must(done === false, 'a fresh account reports earthCleared ' + done);
  const locked = lockedSet(done);
  must(locked.length === 4, 'expected 4 locked banners, got ' + locked.length);
  must(locked.indexOf('human') < 0, 'Humanity must never be locked');
  return 'locked: ' + locked.join(', ');
});

T('FL.2 clearing the Earth System unlocks them', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  const gx = Meta.galaxy();
  must(gx && gx.systems && gx.systems.length, 'no galaxy after campaignStart');
  const home = gx.systems[0];
  must(home.worlds.length === 7, 'home system has ' + home.worlds.length + ' worlds, expected 7');
  must(Meta.earthCleared() === false, 'unlocked before any world was cleared');
  home.worlds.forEach((wd, i) => {
    Meta.recordWorld(wd.id, 1);
    if (i < home.worlds.length - 1)
      must(Meta.earthCleared() === false,
           'unlocked early, after only ' + (i + 1) + ' of 7 worlds');
  });
  must(Meta.earthCleared() === true, 'still locked after clearing all seven worlds');
  must(lockedSet(Meta.earthCleared()).length === 0, 'banners still locked after the unlock');
  return 'unlocked only on the 7th world, not before';
});

T('FL.3 one star is enough, three are not required', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  const home = Meta.galaxy().systems[0];
  home.worlds.forEach(wd => Meta.recordWorld(wd.id, 1));
  must(Meta.earthCleared() === true,
       'a one-star clear of every world did not unlock; the gate is demanding mastery');
  return 'cleared at 1 star per world, as intended';
});

T('FL.4 a finished galaxy grandfathers the unlock', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  must(Meta.earthCleared() === false, 'fresh account already unlocked');
  Meta.vault().victories = 1;
  must(Meta.earthCleared() === true,
       'an account that has already conquered a galaxy is locked out of factions it earned');
  return 'prior victory keeps the choice';
});

T('FL.5 the unlock survives abandoning the campaign', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  Meta.galaxy().systems[0].worlds.forEach(wd => Meta.recordWorld(wd.id, 1));
  must(Meta.earthCleared() === true, 'did not unlock');
  /* Start over. The flag lives in the vault precisely so this cannot revoke it. */
  Meta.campaignStart('human', null);
  must(Meta.earthCleared() === true,
       'the unlock was revoked by starting a new campaign; the flag is on the wrong object');
  return 'vault-scoped, survives a restart';
});

T('FL.6 a non-human campaign does not unlock the banners', () => {
  /* This check exists because a mutation run caught the probe, not the code:
     removing the "faction is human" condition from the setter left all five
     original checks passing. The lock is specifically about carrying EARTH as
     HUMANITY, so clearing somebody else's home system must not satisfy it. */
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('xeno', null);
  const home = Meta.galaxy().systems[0];
  home.worlds.forEach(wd => Meta.recordWorld(wd.id, 3));
  must(Meta.earthCleared() === false,
       'clearing the Compact home system unlocked the human-only gate');
  return 'Zeta Reticuli cleared at 3 stars, banners correctly still locked';
});

const fails = checks.filter(c => c.verdict === 'FAIL');
checks.forEach(c => console.log('  [' + c.verdict + '] ' + c.id + ' :: ' + c.detail));
console.log(fails.length ? '\nFACTION LOCK: ' + fails.length + ' FAILURE(S)'
                         : '\nFACTION LOCK: ' + checks.length + ' checks, all pass');
process.exit(fails.length ? 1 : 0);
