#!/usr/bin/env node
/* DOES EVERY CSS BLOCK ACTUALLY CLOSE?
 *
 * WHY THIS EXISTS. css/polish.css shipped with `@media (max-width: 860px) {`
 * opened at line 4097 and never closed, dropped by a merge that landed two
 * phone passes on the same surface on the same day. CSS auto-closes an
 * unterminated block at end of file, so:
 *
 *   - the file parses,
 *   - every rule after it exists in document.styleSheets,
 *   - and every one of them is silently scoped to phones.
 *
 * MEASURED at 1280px before the fix: the field manual figure layout computed
 * to `display: block` with `.ce-fig` at `display: inline`, 0x0 pixels. The
 * portraits the owner asked for worked on a phone and were invisible on every
 * desktop. The debug bar was unstyled the same way. Nothing failed, nothing
 * logged, and no gate went red, because there is no error to catch: an
 * unmatched brace in CSS is legal.
 *
 * That is the whole argument for this file. A defect that cannot throw needs
 * a checker that counts.
 *
 * Also catches the reverse: appending to a stylesheet whose last block is
 * still open silently nests the new rules inside it, which is exactly how the
 * commander-signature block landed inside a media query in the same session.
 *
 *   node tools/cssbrace.js            checks css/
 *   node tools/cssbrace.js path ...   checks the given files or directories
 *
 * Exit 1 on any imbalance, and names the line the unclosed block opened on.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function files(targets) {
  const out = [];
  const walk = p => {
    const st = fs.statSync(p);
    if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(p, n));
    else if (p.endsWith('.css')) out.push(p);
  };
  for (const t of targets) {
    const p = path.isAbsolute(t) ? t : path.join(ROOT, t);
    if (fs.existsSync(p)) walk(p);
  }
  return out;
}

/* Comments and strings both hide braces, and both have bitten a scanner in
   this repo before (the dead-field detector counted a COMMENT describing a
   fix as an instance of the defect). So strip them properly rather than
   regexing, and keep line numbers by consuming character by character. */
function scan(src) {
  let line = 1, depth = 0;
  const opens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '\n') { line++; i++; continue; }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      i += 2; continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; if (src[i] === '\n') line++; i++; }
      i++; continue;
    }
    if (ch === '{') { depth++; opens.push(line); i++; continue; }
    if (ch === '}') {
      depth--;
      if (opens.length) opens.pop();
      if (depth < 0) return { extraClose: line };
      i++; continue;
    }
    i++;
  }
  return { depth, opens };
}

const targets = process.argv.slice(2);
const list = files(targets.length ? targets : ['css']);
let bad = 0;
for (const f of list) {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  const r = scan(fs.readFileSync(f, 'utf8'));
  if (r.extraClose) {
    console.error(rel + ': a closing brace at line ' + r.extraClose + ' has nothing open to close');
    bad++;
  } else if (r.depth !== 0) {
    console.error(rel + ': ' + r.depth + ' block' + (r.depth > 1 ? 's' : '') +
                  ' never closed, opened at line' + (r.opens.length > 1 ? 's' : '') + ' ' +
                  r.opens.join(', ') + '. CSS auto-closes these at EOF, so every rule after ' +
                  'that point is silently scoped to it.');
    bad++;
  }
}
if (bad) process.exit(1);
console.log('css braces: balanced across ' + list.length + ' file' + (list.length === 1 ? '' : 's'));
