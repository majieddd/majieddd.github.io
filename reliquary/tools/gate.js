/* RELIQUARY :: tools/gate
   One command that runs every check, in the order the invariants require.

   WHY ONE COMMAND. Six checks run by hand are five checks run by hand and one
   forgotten. The value of a gate is that it is cheaper to run than to skip.

   ORDER MATTERS:
     1  parse      no point loading a page whose scripts do not parse
     2  em dash    a source-level rule, checked against SOURCES not output
     3  winding    a mesh-level invariant that silently darkens the whole scene
     4  css brace  an unmatched brace is legal CSS and scopes everything after it
     5  build      the single-file bundle must actually assemble
     6  verify     does the game work, on a fresh page load
     7  adversarial  what did verify fail to look at, on its own fresh load

   Steps 6 and 7 each get their OWN page load. The adversarial harness restarts
   the game a dozen times and deliberately corrupts state; running verify after
   it in the same page would be measuring the wreckage rather than the game.

   Usage: node tools/gate.js [http://127.0.0.1:8741] */
'use strict';

const { execFileSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8741';
const URL_ = BASE.replace(/\/$/, '') + '/reliquary/index.html';

let failed = 0;
function step(name, fn) {
  process.stdout.write('  ' + name.padEnd(30, ' '));
  try {
    const msg = fn();
    console.log('ok   ' + (msg || ''));
  } catch (e) {
    failed++;
    console.log('FAIL');
    const out = (e.stdout ? e.stdout.toString() : '') + (e.message || '');
    console.log(out.split('\n').slice(0, 14).map(l => '       ' + l).join('\n'));
  }
}

function node(script, args) {
  return execFileSync(process.execPath, [path.join(__dirname, script)].concat(args || []),
    { cwd: ROOT, encoding: 'utf8' });
}

console.log('RELIQUARY gate  ' + URL_);

step('1 parse', () => {
  const files = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'));
  for (const f of files) {
    execFileSync(process.execPath, ['--check', path.join(ROOT, 'js', f)], { encoding: 'utf8' });
  }
  return files.length + ' modules';
});

step('2 no em dash', () => {
  /* Checked against SOURCES, not the bundle: fixing the output leaves the
     next build to reintroduce it.

     EVERY NEEDLE IS BUILT FROM PARTS, never written literally. Its first run
     failed on this very file, because the HTML entity spelled out in the
     search expression is itself an instance of what the search is looking for.
     A pattern scan that matches its own source is the same failure as one that
     counts the comment describing a fix as an instance of the defect. */
  const DASH = String.fromCharCode(8212);
  const NDASH = String.fromCharCode(8211);
  const ENTITY = '&' + 'mdash' + ';';
  const dirs = ['js', 'css', 'tools', '.'];
  const hits = [];
  for (const d of dirs) {
    const dir = path.join(ROOT, d);
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (!fs.statSync(full).isFile()) continue;
      if (!/\.(js|css|html|md|cjs)$/.test(f)) continue;
      if (/^(cosmic-reliquary|_)/.test(f)) continue;
      const src = fs.readFileSync(full, 'utf8');
      const lines = src.split('\n');
      lines.forEach((l, i) => {
        if (l.indexOf(DASH) >= 0 || l.indexOf(NDASH) >= 0 || l.indexOf(ENTITY) >= 0) {
          hits.push(d + '/' + f + ':' + (i + 1));
        }
      });
    }
  }
  if (hits.length) throw new Error('em dash at ' + hits.slice(0, 8).join(', '));
  return 'clean';
});

step('3 mesh winding', () => {
  const out = node('winding.js');
  if (!/0 failed/.test(out)) throw new Error(out);
  return out.trim().split('\n').pop();
});

step('4 css braces', () => {
  const out = node('cssbrace.js');
  if (!/all stylesheets balanced/.test(out)) throw new Error(out);
  return 'balanced';
});

step('5 build bundle', () => {
  const out = node('../build.js');
  return out.trim().split('\n').pop();
});

function runHarness(label, stepsFile) {
  const outDir = path.join(ROOT, 'tools', 'out');
  const raw = execFileSync(process.execPath,
    [path.join(__dirname, 'headless.js'), URL_, outDir, path.join(__dirname, stepsFile)],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const m = raw.match(/"value": ("(?:[^"\\]|\\.)*")/);
  if (!m) throw new Error('no harness result\n' + raw.slice(0, 1200));
  const d = JSON.parse(JSON.parse(m[1]));
  if (d.fail > 0) {
    throw new Error(label + ' ' + d.pass + '/' + d.total + '\n' + d.failures.join('\n'));
  }
  return d.pass + '/' + d.total;
}

step('6 verify (fresh page)', () => runHarness('verify', 'full.steps.cjs'));
step('7 adversarial (fresh page)', () => runHarness('adversarial', 'adv.steps.cjs'));

console.log(failed ? '\nGATE FAILED (' + failed + ' step(s))' : '\nGATE PASSED');
process.exit(failed ? 1 : 0);
