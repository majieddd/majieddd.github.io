/* Print each intro slide's CAPTION beside the ART PROMPT it will play under,
   so a mismatch is read rather than assumed. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.dirname(__dirname);
const ctx = { console, window: {}, document: undefined };
vm.createContext(ctx);
for (const m of ['config', 'lore', 'factions', 'towers2', 'roster', 'story', 'cutscenes'])
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', m + '.js'), 'utf8'), ctx, { filename: m }); }
  catch (e) {}

const C = vm.runInContext('CUTSCENES', ctx);
const src = fs.readFileSync(path.join(ROOT, 'artgen', 'krea_jobs.py'), 'utf8');
const ENTRY = new RegExp("\\(\\s*'(cut_[a-z0-9_]+)'\\s*,\\s*'[a-z]+'\\s*,\\s*'((?:[^'\\\\]|\\\\.)*)'\\s*\\)", 'g');
const P = {};
let m;
while ((m = ENTRY.exec(src))) P[m[1]] = m[2];

const only = process.argv.slice(2);
const facs = only.length ? only : ['human', 'light', 'xeno', 'pirate', 'robot'];
for (const f of facs) {
  console.log('######## ' + f.toUpperCase() + ' ########');
  (C[f].intro || []).forEach((s, i) => {
    console.log((i + 1) + '. TEXT: ' + (s.text ? s.text.slice(0, 92) : '[SILENT]'));
    console.log('   ART : ' + (P[s.key] || '(no prompt)').slice(0, 92));
  });
  console.log();
}
