"""Rebase the lore timeline from a 2099 campaign to a 2029 campaign.

Owner set the campaign in 2029. Lore 0.5.0 carries 26 fictional events from 2036
to 2099 ending at the Five-Way War, which IS this game, so those seventy years
have nowhere to go.

They are not deleted. They are moved behind the curtain: the same events, rebased
linearly into 1947 to 2029, become the HIDDEN history instead of the future. The
first lands on 1947, where the modern public anomaly record already starts, and
the last lands on 2029, the year of the intercept.

Touches two files, in lockstep:
  docs/lore/data/timeline.json   the vendored lore source
  js/lore.js                     the generated artifact the game reads

No generator script ships with the vendored lore tree (searched: only a NARA
download shell script exists), so the artifact cannot be regenerated from source
here and both are written directly. That is recorded rather than hidden.

Also sorts the timeline, which currently places 2094 to 2099 immediately before
December 1960 and so cannot be read in order at all.

Run: python tools/rebase_timeline.py [--check]
"""

import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'lore', 'data', 'timeline.json')
ART = os.path.join(ROOT, 'js', 'lore.js')

OLD_LO, OLD_HI = 2030, 2099
NEW_LO, NEW_HI = 1947, 2029


def year_of(date):
    """Return an integer year for a date string, or None if it is deep time."""
    s = str(date)
    if re.search(r'BCE', s, re.I):
        return None
    m = re.search(r'\b(1[5-9]\d\d|20\d\d|21\d\d)\b', s)
    return int(m.group(1)) if m else None


def rebase(y):
    """Linear map of the fictional future onto the hidden past."""
    frac = (y - OLD_LO) / float(OLD_HI - OLD_LO)
    return int(round(NEW_LO + frac * (NEW_HI - NEW_LO)))


def sort_key(ev):
    """Deep time first, then by year. Stable for equal years."""
    s = str(ev.get('date', ''))
    m = re.search(r'([\d.,]+)\s*million', s, re.I)
    if m:
        return (-1, -float(m.group(1).replace(',', '')) * 1e6)
    if re.search(r'BCE', s, re.I):
        m2 = re.search(r'([\d,]+)', s)
        return (-1, -float(m2.group(1).replace(',', '')) if m2 else -1e5)
    y = year_of(s)
    return (0, y if y is not None else 0)


APOPHIS_NEW = (
    'Apophis is intercepted and broken. The rock is hollow and crewed: a '
    'delivery vehicle of Extraction Compact stock and maker-format units, '
    'which the intercept scatters intact across half a planet instead of '
    'burning on entry. The Federation of Light had ruled the object a natural '
    'event and declined to divert it, and so never looked inside it.')


def transform(events):
    changed = []
    # The 2029 entry is the campaign's inciting event and the owner has
    # redefined it. Its old text said the rock "safely passes Earth", which
    # directly contradicts the campaign opening on the intercept.
    for ev in events:
        if year_of(ev.get('date')) == 2029 and 'Apophis' in str(ev.get('event', '')):
            ev.setdefault('superseded_text', ev['event'])
            ev['event'] = APOPHIS_NEW
            ev['layer'] = 'F'
            ev['cause'] = ('The public record of a safe pass is preserved as the cover story; '
                           'the timing residual is the tell.')
    for ev in events:
        y = year_of(ev.get('date'))
        if y is None or not (OLD_LO <= y <= OLD_HI):
            continue
        ny = rebase(y)
        old_date = str(ev['date'])
        ev['date'] = re.sub(r'\b%d\b' % y, str(ny), old_date)
        ev.setdefault('rebased_from', old_date)
        changed.append((old_date, ev['date'], ev.get('event', '')[:56]))
    events.sort(key=sort_key)
    return changed


def main():
    check = '--check' in sys.argv

    data = json.load(io.open(SRC, encoding='utf-8'))
    changed = transform(data['events'])

    # Assertions, because a silent no-op rebase looks exactly like success.
    years = [year_of(e['date']) for e in data['events']]
    years = [y for y in years if y is not None]
    left = [y for y in years if OLD_LO < y <= OLD_HI]
    if left:
        print('FAIL: %d event(s) still in the 2036-2099 band: %s' % (len(left), sorted(set(left))))
        return 1
    if not changed:
        print('FAIL: rebased nothing, which looks identical to success')
        return 1
    if max(years) != NEW_HI:
        print('FAIL: latest event is %d, expected %d' % (max(years), NEW_HI))
        return 1

    # Ordering must now be monotonic across the dated events.
    inversions = sum(1 for a, b in zip(years, years[1:]) if b < a)
    if inversions:
        print('FAIL: timeline still has %d out-of-order transitions' % inversions)
        return 1

    print('rebased %d events, %d..%d -> %d..%d, 0 out-of-order transitions'
          % (len(changed), OLD_LO, OLD_HI, NEW_LO, NEW_HI))
    for a, b, t in changed[-8:]:
        print('   %s -> %-6s %s' % (a, b, t))

    if check:
        print('(check only, nothing written)')
        return 0

    with io.open(SRC, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
        fh.write('\n')

    # The artifact is one frozen JSON literal between a known prefix and suffix.
    art = io.open(ART, encoding='utf-8').read()
    m = re.search(r'const LORE = Object\.freeze\((\{.*?\})\);', art, re.S)
    if not m:
        print('FAIL: could not locate the LORE literal in js/lore.js')
        return 1
    lore = json.loads(m.group(1))
    lore['timeline']['events'] = data['events']
    art2 = art[:m.start(1)] + json.dumps(lore, ensure_ascii=False) + art[m.end(1):]
    io.open(ART, 'w', encoding='utf-8').write(art2)
    print('wrote %s and %s' % (os.path.relpath(SRC, ROOT), os.path.relpath(ART, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
