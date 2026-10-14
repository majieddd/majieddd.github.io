"""Audit Hermes agent output against the binding lore contract and the format
each batch was asked for.

Why this exists: the drafting agents run outside this repo, on a small fast
model, and cannot be trusted to have obeyed the contract just because the
contract was in their prompt. The suite's standing law is measure, do not
assert, and a batch of 107 files is exactly the size where eyeballing it
silently degrades into skimming the first three.

Output scales with what went WRONG, not with what went right: a clean run
prints one line. That is the same law that took the owner-sweep result object
from 11,325 characters to 95.

Exit 1 on any violation, so this can sit in front of anything that consumes
the drafts.

Verify the gate itself with tools/hermes_audit_mutants.py. A gate that has
only ever passed has demonstrated nothing.
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DIRS = [os.path.join(REPO, '_hermes', 'out'),
        os.path.join(REPO, '_hermes', 'draft')]

# Required labelled parts per batch, keyed by filename prefix.
FORMAT = {
    'scen_':   ['SCENARIO:', 'VISUAL:', 'TACTICAL:'],
    'beat5_':  ['IMAGE:', 'LINE:'],
    'moral_':  ['BELIEF:', 'COST:', 'MORAL:', 'BLIND SPOT:'],
}

# A hermes call that failed still writes a file. Those must never be counted as
# content, which is the same class of defect as a probe whose failure and pass
# share a channel.
ERRORS = re.compile(
    r'API call failed|HTTP \d{3}|Billing or credits|Rate limit exceeded|'
    r'No usable credentials|agent failed:', re.I)

VIOLATIONS = [
    # Written as an escape, not the literal character. tools/emdash.js scans
    # SOURCES, so a detector that spells out what it detects trips the very
    # gate it serves. Same reason the VENDORED exemption exists, solved without
    # needing an exemption.
    ('em-dash',
     re.compile('[' + chr(0x2014) + chr(0x2015) + ']'),
     'contains an em dash, which is absolute in this project'),
    ('vigil',
     re.compile(r'\bvigil\b', re.I),
     'mentions the Vigil, which is a separate body from the Vigil'),
    ('xeno-as-species',
     re.compile(r'\ba\s+xeno\b|\bxenos\b|\bxeno\s+(?:species|race|biology|creature)', re.I),
     'writes the Xeno as a species; it is the Extraction Compact, a business'),
    ('free-will-surrender',
     re.compile(r'surrender(?:ing)?\s+(?:their\s+|your\s+)?free\s+will|renounce\s+free\s+will', re.I),
     'has the Federation demand an explicit surrender of free will, which the contract forbids'),
]


def audit():
    fails = []
    checked = 0
    for d in DIRS:
        if not os.path.isdir(d):
            continue
        for fn in sorted(os.listdir(d)):
            if not fn.endswith('.md'):
                continue
            path = os.path.join(d, fn)
            with open(path, encoding='utf-8', errors='replace') as fh:
                text = fh.read()
            checked += 1
            rel = os.path.join(os.path.basename(d), fn)

            if not text.strip():
                fails.append((rel, 'empty', 'produced no output at all'))
                continue
            if ERRORS.search(text):
                first = ERRORS.search(text).group(0)
                fails.append((rel, 'call-failed',
                              'is an error transcript, not content (%s)' % first))
                continue

            for name, rx, why in VIOLATIONS:
                if rx.search(text):
                    fails.append((rel, name, why))

            for prefix, parts in FORMAT.items():
                if fn.startswith(prefix):
                    missing = [p for p in parts if p not in text]
                    if missing:
                        fails.append((rel, 'format',
                                      'missing required part(s): ' + ', '.join(missing)))
                    break
    return checked, fails


if __name__ == '__main__':
    # An expected count may be passed so a SHORT batch cannot pass as a clean
    # one: python tools/hermes_audit.py 107
    expected = int(sys.argv[1]) if len(sys.argv) > 1 else 0

    checked, fails = audit()

    # Zero files audited must never read as success. Observed live: the audit
    # printed "PASS: 0 files" against an output directory that was still empty,
    # which is the same defect class as a probe whose pass and fail share a
    # channel. An empty run is a failed run.
    if checked == 0:
        print('hermes-audit FAIL: audited 0 files. '
              'Nothing was checked, so nothing passed.')
        sys.exit(1)
    if expected and checked < expected:
        print('hermes-audit FAIL: audited %d files, expected %d. '
              '%d task(s) produced nothing.' % (checked, expected, expected - checked))
        sys.exit(1)

    if not fails:
        print('hermes-audit PASS: %d files, 0 violations' % checked)
        sys.exit(0)
    print('hermes-audit FAIL: %d files, %d violation(s)' % (checked, len(fails)))
    for rel, kind, why in fails:
        print('  [%s] %s %s' % (kind, rel, why))
    sys.exit(1)
