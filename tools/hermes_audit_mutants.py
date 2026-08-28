"""Mutation proof for tools/hermes_audit.py.

A gate that has only ever passed has demonstrated nothing. This plants one
deliberate defect of each class into a throwaway directory, runs the audit
against it, and requires that EVERY planted defect is caught and that the
clean control is NOT flagged.

Run: python tools/hermes_audit_mutants.py
"""

import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hermes_audit as ha  # noqa: E402

CLEAN_SCEN = ('SCENARIO: The lane is swept by rocks on a five hour cycle.\n'
              'VISUAL: Gun platforms strung on cables between tumbling boulders.\n'
              'TACTICAL: Firing lanes close and reopen on a timer.\n')

MUTANTS = [
    ('m1_emdash', 'scen_99.md',
     CLEAN_SCEN.replace('cycle.', 'cycle — without warning.'),
     'em-dash'),
    ('m2_vigil', 'scen_98.md',
     CLEAN_SCEN + 'The Vigil patrols this lane.\n',
     'vigil'),
    ('m3_species', 'scen_97.md',
     CLEAN_SCEN + 'A Xeno stands watch on the far platform.\n',
     'xeno-as-species'),
    ('m4_freewill', 'scen_96.md',
     CLEAN_SCEN + 'They must surrender their free will to be protected.\n',
     'free-will-surrender'),
    ('m5_format', 'scen_95.md',
     'SCENARIO: Something happens here.\nVISUAL: A picture of it.\n',
     'format'),
    ('m6_empty', 'scen_94.md',
     '   \n',
     'empty'),
    ('m7_errortranscript', 'scen_93.md',
     'API call failed after 3 retries: HTTP 429: Rate limit exceeded\n',
     'call-failed'),
    ('m8_beat5_format', 'beat5_human_0.md',
     'The commander watches from the ridge and says nothing.\n',
     'format'),
    ('m9_moral_format', 'moral_xeno_2.md',
     'BELIEF: The stock is ours.\nCOST: They lose everything.\n',
     'format'),
]

CONTROL = ('scen_00.md', CLEAN_SCEN)


def run_against(tmp):
    """Point the audit at tmp and return its failure list."""
    ha.DIRS = [tmp]
    return ha.audit()


def main():
    tmp = tempfile.mkdtemp(prefix='hermes_mut_')
    try:
        # An EMPTY directory must not audit as clean. This one was observed
        # live before it was fixed: the audit printed "PASS: 0 files" against a
        # batch that had not produced anything yet.
        empty = tempfile.mkdtemp(prefix='hermes_mut_empty_')
        try:
            checked, fails = run_against(empty)
            if checked != 0 or fails:
                print('EMPTY-DIR SETUP WRONG: checked=%d fails=%r' % (checked, fails))
                return 1
            print('empty-dir      audits 0 files, caller must treat as FAIL  OK')
        finally:
            shutil.rmtree(empty, ignore_errors=True)

        # Control first: a clean file must NOT be flagged.
        with open(os.path.join(tmp, CONTROL[0]), 'w', encoding='utf-8') as fh:
            fh.write(CONTROL[1])
        _, fails = run_against(tmp)
        if fails:
            print('CONTROL FAILED: clean file was flagged: %r' % (fails,))
            return 1
        print('control        clean file not flagged  OK')

        caught, missed = 0, []
        for label, fn, body, expect in MUTANTS:
            mdir = tempfile.mkdtemp(prefix='hermes_mut_one_')
            try:
                with open(os.path.join(mdir, fn), 'w', encoding='utf-8') as fh:
                    fh.write(body)
                _, fails = run_against(mdir)
                kinds = {k for _, k, _ in fails}
                if expect in kinds:
                    caught += 1
                    print('%-18s planted %-20s caught  OK' % (label, expect))
                else:
                    missed.append((label, expect, sorted(kinds)))
                    print('%-18s planted %-20s MISSED  (got %s)'
                          % (label, expect, sorted(kinds) or 'nothing'))
            finally:
                shutil.rmtree(mdir, ignore_errors=True)

        print('\n%d/%d mutants caught' % (caught, len(MUTANTS)))
        if missed:
            print('The audit does NOT detect: %s'
                  % ', '.join('%s (%s)' % (m[0], m[1]) for m in missed))
            return 1
        print('hermes-audit mutation proof PASS')
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
