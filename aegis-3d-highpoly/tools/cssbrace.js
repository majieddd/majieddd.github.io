/* RELIQUARY :: tools/cssbrace
   Gate G13: every CSS block must close.

   WHY THIS IS COUNTED AND NOT CAUGHT. An unmatched brace is LEGAL CSS. The
   browser auto-closes it at end of file, so the stylesheet parses, every rule
   appears in document.styleSheets, and every rule after the stray brace is
   silently scoped to whatever block swallowed them. Nothing throws, nothing
   logs, and no test goes red. The only way to find it is to count.

   It also catches the reverse, which is the more insidious one: appending to a
   stylesheet whose last block is still open nests the new rules inside it, so
   a block of perfectly correct new CSS quietly ends up inside a media query it
   was never meant to be in.

   Run: node tools/cssbrace.js      (exit 1 on any imbalance) */
'use strict';

const fs = require('fs');
const path = require('path');

const BACKSLASH = String.fromCharCode(92);
let bad = 0;
const dir = path.join(__dirname, '..', 'css');

for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.css'))) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  let depth = 0, line = 1, minDepth = 0;
  let inComment = false, inStr = null;
  const openLines = [];

  for (let i = 0; i < src.length; i++) {
    const ch = src[i], nx = src[i + 1];
    if (ch === '\n') line++;

    /* Braces inside comments and strings are not structure. A checker that
       counts them reports phantom failures on any stylesheet with a brace in
       a content: rule or in a commented-out block. */
    if (inComment) {
      if (ch === '*' && nx === '/') { inComment = false; i++; }
      continue;
    }
    if (inStr) {
      if (ch === BACKSLASH) { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '/' && nx === '*') { inComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inStr = ch; continue; }

    if (ch === '{') { depth++; openLines.push(line); }
    else if (ch === '}') {
      depth--;
      openLines.pop();
      if (depth < minDepth) minDepth = depth;
    }
  }

  if (depth !== 0 || minDepth < 0) {
    let msg = '  FAIL ' + f + ': depth ends at ' + depth;
    if (openLines.length) msg += ', unclosed block opened at line ' + openLines[0];
    if (minDepth < 0) msg += ', extra closing brace';
    console.log(msg);
    bad++;
  } else {
    console.log('  ok   ' + f + ' (balanced)');
  }
}

console.log(bad ? bad + ' stylesheet(s) unbalanced' : 'all stylesheets balanced');
process.exit(bad ? 1 : 0);
