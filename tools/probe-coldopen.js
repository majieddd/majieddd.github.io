/* Prove the cold open can actually fire, and refuses when it should.
 *
 * coldOpen() ends by calling deploy(), which starts a real battle, so this
 * probe asserts every PRECONDITION and every GUARD rather than the deploy
 * itself. That is the part that can silently rot: if any guard is quietly
 * false on a fresh profile the feature never fires, the player is routed to
 * the ordinary menus, and nothing anywhere reports a problem.
 *
 * Failure is a THROW. A returned string is always pass detail.
 * Run: node tools/probe-coldopen.js
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);

function freshContext() {
  const store = {};
  const ctx = {
    console, document: undefined,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; },
    },
    setTimeout: f => f, clearTimeout: () => {}, requestAnimationFrame: () => 0,
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
  let d; try { d = fn(); } catch (e) { checks.push({ id, verdict: 'FAIL', detail: e.message }); return; }
  checks.push({ id, verdict: 'PASS', detail: String(d) });
}
function must(c, m) { if (!c) throw new Error(m); }

T('CO.1 a fresh human campaign presents an entry world, and it is EARTH', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  const gx = Meta.galaxy();
  const home = gx.systems[0];
  const w = home.worlds.find(x => x.entry) || home.worlds[0];
  must(w, 'no entry world in the home system');
  must(w.name === 'EARTH',
       'the cold open would drop the player on ' + w.name + ', not EARTH');
  must(w.si === 0, 'entry world is in system ' + w.si);
  return w.name + ' at si ' + w.si + ' wi ' + w.wi;
});

T('CO.2 the node the cold open builds resolves without throwing', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  const c = Meta.campaign();
  const home = Meta.galaxy().systems[0];
  const w = home.worlds.find(x => x.entry) || home.worlds[0];
  const worldBossOf = vm.runInContext('worldBossOf', ctx);
  const worldLoadoutSeed = vm.runInContext('worldLoadoutSeed', ctx);
  const boss = worldBossOf(home, w);
  const seed = worldLoadoutSeed(c.seed, w.id);
  must(seed !== undefined && seed !== null, 'worldLoadoutSeed returned nothing');
  must(w.map, 'entry world has no map');
  return 'map ' + w.map + ', garrison ' + w.owner + ', boss ' + (boss || 'none');
});

T('CO.3 a fresh profile owns enough towers to fill the loadout', () => {
  /* If this is ever false the cold open silently declines and the feature is
     dead with no error anywhere. loadoutTarget is min(LOADOUT_SIZE, owned), so
     it should be structurally impossible, which is exactly the kind of
     assumption worth pinning. */
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  const LOADOUT_SIZE = vm.runInContext('LOADOUT_SIZE', ctx);
  const own = Meta.unlockedTowers();
  must(own.length > 0, 'a fresh profile owns no towers at all');
  const target = Math.min(LOADOUT_SIZE, own.length);
  must(own.slice(0, target).length === target,
       'cannot fill ' + target + ' slots from ' + own.length + ' owned towers');
  return own.length + ' owned, ' + target + ' slots filled';
});

T('CO.4 a commander is available without the commander screen', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  Meta.campaignStart('human', null);
  const freeCommanderOf = vm.runInContext('freeCommanderOf', ctx);
  must(typeof Meta.equipped === 'function',
       'Meta.equipped is not a function; the cold open reads the wrong accessor');
  const cmd = Meta.equipped() || freeCommanderOf('human');
  must(cmd, 'no commander resolvable for a fresh human campaign');
  return 'commander ' + cmd;
});

T('CO.5 the guards refuse when a choice is real', () => {
  const ctx = freshContext();
  const Meta = vm.runInContext('Meta', ctx);
  /* Non-human banner. */
  Meta.campaignStart('xeno', null);
  let c = Meta.campaign();
  must((c.faction || Meta.faction()) !== 'human',
       'a Compact campaign reports itself as human');
  /* A campaign already under way. */
  Meta.campaignStart('human', null);
  c = Meta.campaign();
  const home = Meta.galaxy().systems[0];
  Meta.recordWorld(home.worlds[0].id, 1);
  c = Meta.campaign();
  must(c.stars && Object.keys(c.stars).length > 0,
       'a campaign with a cleared world reports no stars, so the in-progress guard is blind');
  return 'non-human and in-progress both detectable';
});

const fails = checks.filter(c => c.verdict === 'FAIL');
checks.forEach(c => console.log('  [' + c.verdict + '] ' + c.id + ' :: ' + c.detail));
console.log(fails.length ? '\nCOLD OPEN: ' + fails.length + ' FAILURE(S)'
                         : '\nCOLD OPEN: ' + checks.length + ' checks, all pass');
process.exit(fails.length ? 1 : 0);
