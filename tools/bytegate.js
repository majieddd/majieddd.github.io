#!/usr/bin/env node
/**
 * The byte gate: nothing that ships may contain a byte no human typed.
 *
 * WHY THIS EXISTS. css/polish.css shipped to production carrying three literal
 * NUL bytes. A CSS escape for the middot, `\0b7`, had its BACKSLASH replaced by
 * a NUL, so the immersive stage hint computed to
 *     "drag or arrows to pan <U+FFFD>b7 scroll to zoom <U+FFFD>b7 0 recentres ..."
 * and rendered that on screen. It survived a full session of gates because not
 * one of them looks at bytes: the em dash gate scans for two specific
 * characters, the page gates measure computed styles, and the harnesses drive
 * behaviour. Nothing asked whether the file was well-formed text at all.
 *
 * It also hid in plain sight. `grep` classifies a file with a NUL as binary and
 * prints "Binary file ... matches" instead of the matching lines, so every
 * search of that stylesheet silently returned nothing useful for a whole
 * session and the file simply looked empty of what was being searched for.
 *
 * WHAT IT REFUSES, and why each one is always a defect in a text file:
 *   NUL and C0 controls   nobody types them; they mean an escape was eaten or
 *                         a buffer was written short (both have happened here)
 *   U+FFFD                the replacement character: something already decoded
 *                         this file with the wrong encoding and lost data
 *   lone surrogates       a broken UTF-16 round trip
 *   a UTF-8 BOM           breaks a leading `#!` and a CSS charset rule
 *   invalid UTF-8         the file is not the encoding index.html declares
 * Tab, LF and CR are legal and left alone.
 *
 * Usage:  node bytegate.js [dir-or-file ...]     default: the current tree
 * Exit 0 clean, 1 on any hit. Prints file, byte offset, line, and context.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const EXTS = ['.js', '.css', '.html', '.md', '.json', '.svg', '.txt', '.yml', '.yaml'];
const SKIP_DIR = new Set(['node_modules', '.git', 'dist', 'build']);
/* Vendored trees are third-party text carried verbatim; the em dash gate
   exempts them by the same reasoning and for the same reason. */
const VENDORED = ['skills/huashu-design'];

const args = process.argv.slice(2).filter(a => !a.startsWith('-'));
const roots = args.length ? args : ['.'];

function isVendored(p) {
  const n = p.split(path.sep).join('/');
  return VENDORED.some(v => n.indexOf(v) >= 0);
}

function collect(target, out) {
  let st;
  try { st = fs.statSync(target); } catch (e) { return out; }
  if (st.isFile()) { out.push(target); return out; }
  let entries;
  try { entries = fs.readdirSync(target, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of entries) {
    const f = path.join(target, e.name);
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) collect(f, out); continue; }
    if (!EXTS.some(x => e.name.endsWith(x))) continue;
    if (isVendored(f)) continue;
    out.push(f);
  }
  return out;
}

const files = [];
for (const r of roots) collect(r, files);

let hits = 0;
let bad = 0;

function lineOf(buf, off) {
  let n = 1;
  for (let i = 0; i < off && i < buf.length; i++) if (buf[i] === 0x0a) n++;
  return n;
}
function context(buf, off) {
  const a = Math.max(0, off - 40), b = Math.min(buf.length, off + 40);
  return buf.slice(a, b).toString('latin1').replace(/[\x00-\x1f\x7f]/g, ch =>
    '<' + ch.charCodeAt(0).toString(16).padStart(2, '0') + '>');
}

for (const f of files) {
  let buf;
  try { buf = fs.readFileSync(f); } catch (e) { continue; }
  const found = [];

  /* BOM first: it is legal UTF-8 but breaks shebangs and @charset. */
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
    found.push({ off: 0, what: 'UTF-8 BOM' });

  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x09 || b === 0x0a || b === 0x0d) continue;
    if (b < 0x20 || b === 0x7f)
      found.push({ off: i, what: 'control byte 0x' + b.toString(16).padStart(2, '0') });
    /* C1 CONTROLS TOO, U+0080 to U+009F, which arrive as the two bytes
       0xC2 0x80..0x9F and so slipped straight past the C0 scan above.

       This is not hypothetical, and this comment deliberately NAMES the
       character rather than containing one: Session 40 shipped U+0098
       followed by the digit 2 into a `content:` rule in css/polish.css,
       because a Python one-liner read a backslash-230 sequence as an
       OCTAL escape instead of as the CSS hex escape for U+2302, and this
       gate called the file clean. It reached the owner's phone as a tofu box
       in the base upgrade button, which is exactly the class of defect the
       header of this file says it exists to prevent: "nobody types them; they
       mean an escape was eaten". An eaten escape that lands in the C1 range is
       still an eaten escape. */
    if (b === 0xc2 && i + 1 < buf.length && buf[i + 1] >= 0x80 && buf[i + 1] <= 0x9f)
      found.push({ off: i, what: 'C1 control U+00' + buf[i + 1].toString(16).toUpperCase() +
                                 ' (bytes c2 ' + buf[i + 1].toString(16) + ')' });
  }

  /* Decode strictly: Buffer.toString is lossy and would hide the very thing
     this gate is for, so compare a round trip instead. */
  const text = buf.toString('utf8');
  if (Buffer.compare(Buffer.from(text, 'utf8'), buf) !== 0)
    found.push({ off: 0, what: 'invalid UTF-8 (byte sequence does not round trip)' });

  /* Built from its code point, never written literally: a gate that embeds the
     character it hunts for reports itself as a defect, which this one did on
     its first run against the suite. */
  let idx = -1;
  while ((idx = text.indexOf(String.fromCharCode(0xfffd), idx + 1)) >= 0)
    found.push({ off: Buffer.byteLength(text.slice(0, idx), 'utf8'),
                 what: 'U+FFFD replacement character (data already lost)' });

  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdfff) {
      const hi = c <= 0xdbff, next = text.charCodeAt(i + 1);
      const paired = hi && next >= 0xdc00 && next <= 0xdfff;
      if (!paired) found.push({ off: i, what: 'lone surrogate U+' + c.toString(16) });
      else i++;
    }
  }

  if (found.length) {
    bad++;
    hits += found.length;
    console.log(f);
    for (const h of found.slice(0, 6))
      console.log('  byte ' + h.off + ' (line ' + lineOf(buf, h.off) + ')  ' + h.what +
                  '\n    ' + context(buf, h.off));
    if (found.length > 6) console.log('  ...and ' + (found.length - 6) + ' more');
  }
}

console.log((hits ? 'FAIL: ' : 'clean: ') + hits + ' bad byte' + (hits === 1 ? '' : 's') +
            ' across ' + bad + ' of ' + files.length + ' files scanned');
process.exit(hits ? 1 : 0);
