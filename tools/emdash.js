/* EM DASH GATE. The owner's standing rule: the character never ships, in code,
   copy, comments, or commit bodies. TWO forms count, and missing the second is
   exactly how the Session 26 pass left ten of them in player-facing strings:

     1. the literal U+2014 character
     2. the six-character escape sequence, backslash-u-2-0-1-4, which is what
        js/factions.js used and which a grep for the literal never sees

   This file writes neither form literally, so it passes its own check.

   Usage:  node tools/emdash.js           dry run, prints what it would change
           node tools/emdash.js --fix     rewrite in place, then re-verify

   TWO MISTAKES THIS TOOL IS BUILT NOT TO REPEAT.

   1. Session 26: a naive scanner that did not know regex literals read the
      quote inside a regex as opening a string, desynced, and began editing
      CODE, turning `skirmish: true` into `skirmish true`. The fix here is that
      the replacement is punctuation only. It never inserts a quote, slash,
      backtick, or brace, so it cannot change how any file tokenises, which is
      what makes a lexer unnecessary.

   2. Session 29, first attempt: the whitespace cleanup ran as a global regex
      over the entire file, so it collapsed every indentation run in all 22
      files. 35,130 insertions for 340 real edits. The fix here is that ALL
      cleanup is local to the replacement site, and newlines are never consumed,
      so line structure and indentation are untouched. */
'use strict';
const fs = require('fs');
const path = require('path');

const EM = String.fromCharCode(0x2014);
const ESC = '\\' + 'u2014';

const FIX = process.argv.includes('--fix');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));

function defaultTargets() {
  const out = [];
  const add = (dir, filt) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) if (filt(f)) out.push(path.posix.join(dir, f));
  };
  add('js', f => f.endsWith('.js') && f !== 'artpack.js');
  add('css', f => f.endsWith('.css'));
  add('tools', f => f.endsWith('.js') && f !== 'emdash.js');
  if (fs.existsSync('index.html')) out.push('index.html');
  return out;
}
const targets = args.length ? args : defaultTargets();

function countIn(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0x2014) n++;
  return n + (s.split(ESC).length - 1);
}

/* Replace every dash, doing all whitespace tidying LOCALLY. Spaces and tabs
   adjacent to the dash are absorbed; a newline on either side is never touched,
   so indentation and line structure survive exactly as authored. */
function stripDashes(text) {
  let out = '';
  let i = 0;
  for (;;) {
    const j = text.indexOf(EM, i);
    if (j < 0) { out += text.slice(i); break; }

    out += text.slice(i, j);

    /* Absorb spaces and tabs immediately left of the dash, but stop at a
       newline so a hanging-indent comment keeps its shape. */
    let cut = out.length;
    while (cut > 0 && (out[cut - 1] === ' ' || out[cut - 1] === '\t')) cut--;
    const leftChar = cut > 0 ? out[cut - 1] : '';
    const hadLeftSpace = cut < out.length;
    out = out.slice(0, cut);

    /* Absorb spaces and tabs immediately right of the dash, same newline rule. */
    let k = j + 1;
    while (k < text.length && (text[k] === ' ' || text[k] === '\t')) k++;
    const rightChar = k < text.length ? text[k] : '';

    if (rightChar === '' ) {
      /* dash at end of input */
    } else if (rightChar === '\n' || rightChar === '\r') {
      /* Dash ends a line. Drop it and any space it sat on; the newline stays
         where it is and the next line is untouched. */
    } else if (leftChar === '' || leftChar === '\n' || leftChar === '\r') {
      /* Dash opens a line, e.g. a wrapped comment. Leave no punctuation, and
         restore a single space only if the author had one. */
      if (hadLeftSpace) out += ' ';
    } else if (/[.!?:,;]/.test(leftChar)) {
      out += ' ';
    } else if (/[A-Z0-9]/.test(rightChar) && /[a-z0-9)\]"']/.test(leftChar)) {
      out += '. ';
    } else {
      out += ', ';
    }
    i = k;
  }
  return out;
}

let total = 0;
const changed = [];

for (const p of targets) {
  if (!fs.existsSync(p)) continue;
  const before = fs.readFileSync(p, 'utf8');
  const n = countIn(before);
  if (!n) continue;
  const after = stripDashes(before.split(ESC).join(EM));
  total += n;

  /* SAFETY ASSERTION. A dash replacement changes at most a few characters per
     line and never adds or removes a line. If the line count moved, or if more
     than the dash-bearing lines changed, something is wrong and we refuse. */
  const bl = before.split('\n'), al = after.split('\n');
  if (bl.length !== al.length) {
    console.error('REFUSED ' + p + ': line count moved ' + bl.length + ' to ' + al.length);
    process.exit(2);
  }
  let touched = 0;
  for (let x = 0; x < bl.length; x++) if (bl[x] !== al[x]) touched++;
  if (touched > n) {
    console.error('REFUSED ' + p + ': ' + touched + ' lines changed for only ' + n + ' dashes');
    process.exit(2);
  }

  changed.push(p + ': ' + n + ' dashes on ' + touched + ' lines');
  if (FIX && after !== before) fs.writeFileSync(p, after);
}

console.log((FIX ? 'fixed ' : 'would fix ') + total + ' occurrences across ' + changed.length + ' files');
changed.forEach(c => console.log('  ' + c));

if (FIX) {
  let left = 0;
  for (const p of targets) {
    if (!fs.existsSync(p)) continue;
    const n = countIn(fs.readFileSync(p, 'utf8'));
    if (n) { left += n; console.log('  REMAINING ' + p + ': ' + n); }
  }
  console.log(left ? 'REMAINING after fix: ' + left : 'VERIFIED: zero remaining');
  process.exit(left ? 1 : 0);
}
process.exit(0);
