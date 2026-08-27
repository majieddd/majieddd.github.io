"""Cosmic Conquest: art generation on Adobe Firefly Services.

ONE CATALOGUE, THREE PAINTERS. `krea_jobs.build_jobs()` stays the single source
of truth for every key, prompt and size; this is a third renderer consuming it,
beside `sdxl_all.py` (fast local baseline) and `krea_gen.py` (local quality
tier). It writes the SAME cache in the SAME shape, so `krea_gen.py --pack` does
not know or care which painter produced a plate.

WHY IT EXISTS. The local Krea tier measures ~48s per 1920x1080 plate and is
GPU-bound; Firefly is network-bound. They contend for nothing, so the two can
run at once and a class can be split between them. Owner has a Firefly
subscription with generation the local card cannot match on wall clock.

NOT TO BE CONFUSED with the Adobe MCP connector, which ART-BIBLE section 12
records as editing-only (masks, expand, vectorize) with no text-to-image. That
finding is about the CONNECTOR. This is the Firefly Services REST API with
OAuth server-to-server credentials, which is a different mechanism entirely.

CREDENTIALS, which this script never stores. Create them once at
https://developer.adobe.com/console: new project, Add API, Firefly Services,
OAuth Server-to-Server. Then:

    export FIREFLY_CLIENT_ID=...
    export FIREFLY_CLIENT_SECRET=...

Usage:
    python firefly_gen.py --check                 # auth only, generates nothing
    python firefly_gen.py --only cut_ --limit 2   # a trial batch
    python firefly_gen.py --only cut_             # a class
    python firefly_gen.py --force cut_light_sys3  # re-roll one key
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request, urllib.error
import io as _io

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from krea_gen import CACHE, fit, quality_for, _seed_v          # noqa: E402
from krea_jobs import build_jobs                                # noqa: E402

IMS = 'https://ims-na1.adobelogin.com/ims/token/v3'
GENERATE = 'https://firefly-api.adobe.io/v3/images/generate'
TOKEN_CACHE = os.path.join(HERE, '.firefly_token.json')

# Firefly v3 renders a fixed set of sizes. 2688x1536 is the widest landscape
# one, and every wide plate in this catalogue delivers at 1920x1080, so the
# generation is a 1.4x SUPERSAMPLE that fit() then LANCZOS-resamples down.
# That is the same direction the image law requires (media-image section 13:
# downsample for free antialiasing, never upscale), and it is why no wide
# plate is generated at its delivery size.
WIDE = {'width': 2688, 'height': 1536}
SQUARE = {'width': 2048, 'height': 2048}

# Firefly refuses some prompts on content policy, and this catalogue is full of
# devouring maws and burning fields. A refusal is DATA, not a crash: it names
# the key so the plate can go to the local tier instead.
POLICY_CODES = {'400002', '400003', '400010'}


def _post(url, data, headers, timeout=120):
    body = (urllib.parse.urlencode(data) if isinstance(data, dict) and
            headers.get('Content-Type', '').startswith('application/x-www-form')
            else json.dumps(data)).encode()
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {'message': raw[:300]}


def token():
    """A cached access token. Adobe's are valid 24h, so re-authenticating per
    image would be one wasted round trip per plate for no benefit."""
    cid = os.environ.get('FIREFLY_CLIENT_ID')
    sec = os.environ.get('FIREFLY_CLIENT_SECRET')
    if not cid or not sec:
        raise SystemExit('set FIREFLY_CLIENT_ID and FIREFLY_CLIENT_SECRET first; '
                         'see the module docstring for where they come from')
    if os.path.exists(TOKEN_CACHE):
        try:
            c = json.load(open(TOKEN_CACHE))
            # A minute of slack: a token that expires mid-batch is a failure
            # halfway through a class, which is the expensive place to find it.
            if c.get('client') == cid[:8] and c.get('expires', 0) > time.time() + 60:
                return c['token'], cid
        except Exception:
            pass
    code, body = _post(IMS,
                       {'grant_type': 'client_credentials', 'client_id': cid,
                        'client_secret': sec, 'scope': 'openid,AdobeID,firefly_api'},
                       {'Content-Type': 'application/x-www-form-urlencoded'})
    if code != 200 or 'access_token' not in body:
        raise SystemExit('Adobe IMS refused the credentials (%s): %s'
                         % (code, body.get('error_description') or body))
    tok = body['access_token']
    json.dump({'token': tok, 'client': cid[:8],
               'expires': time.time() + int(body.get('expires_in', 86400))},
              open(TOKEN_CACHE, 'w'))
    return tok, cid


def generate(tok, cid, prompt, aspect, seed, tries=3):
    """One plate. Returns (bytes, note) or (None, why)."""
    payload = {'prompt': prompt[:1024],
               'numVariations': 1,
               'size': WIDE if aspect == 'wide' else SQUARE,
               # The same FNV-per-key seed the local tiers use, so a key is
               # reproducible on this painter too and a re-roll is deliberate.
               'seeds': [seed % 10000000],
               # `art` rather than `photo`: this catalogue is painted
               # illustration and the photo class fights the house style.
               'contentClass': 'art'}
    headers = {'X-Api-Key': cid, 'Authorization': 'Bearer ' + tok,
               'Content-Type': 'application/json', 'Accept': 'application/json'}
    for attempt in range(tries):
        code, body = _post(GENERATE, payload, headers)
        if code == 200:
            outs = body.get('outputs') or []
            if not outs:
                return None, 'no outputs in a 200 response'
            url = (outs[0].get('image') or {}).get('url') or outs[0].get('url')
            if not url:
                return None, 'no url in output'
            with urllib.request.urlopen(url, timeout=180) as r:
                return r.read(), 'ok'
        ec = str(body.get('error_code') or body.get('code') or code)
        if ec in POLICY_CODES:
            return None, 'refused on content policy (%s)' % ec
        if code in (429, 500, 502, 503, 504) and attempt < tries - 1:
            # Backoff, because a rate limit answered immediately is a rate
            # limit hit twice.
            time.sleep(2 ** attempt * 3)
            continue
        return None, 'http %s: %s' % (code, str(body)[:160])
    return None, 'exhausted retries'


def save(raw, key, out_px, aspect):
    """Through fit() and quality_for(), exactly as the local painters do, so a
    Firefly plate is byte-shaped like a Krea one and --pack passes it through
    untouched rather than re-encoding it."""
    img = Image.open(_io.BytesIO(raw)).convert('RGB')
    tmp = os.path.join(CACHE, '.' + key + '.part')
    fit(img, out_px, aspect).save(tmp, 'WEBP', quality=quality_for(key), method=6)
    # Atomic rename: a local painter may be working the same cache at the same
    # time, which is the whole point of having two, and a half-written file is
    # indistinguishable from a finished one to whoever looks next.
    os.replace(tmp, os.path.join(CACHE, key + '.webp'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--force', default='')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--variant', type=int, default=0)
    ap.add_argument('--check', action='store_true',
                    help='authenticate and exit; generates nothing')
    a = ap.parse_args()

    tok, cid = token()
    if a.check:
        print('AUTH OK. token acquired, %d chars, cached at %s'
              % (len(tok), os.path.basename(TOKEN_CACHE)))
        return

    os.makedirs(CACHE, exist_ok=True)
    jobs = build_jobs()
    if a.force:
        jobs = [j for j in jobs if j[0] == a.force]
        for j in jobs:
            p = os.path.join(CACHE, j[0] + '.webp')
            if os.path.exists(p):
                os.remove(p)
    elif a.only:
        jobs = [j for j in jobs if j[0].startswith(a.only)]
    todo = [j for j in jobs
            if j[1] and not os.path.exists(os.path.join(CACHE, j[0] + '.webp'))]
    if a.limit:
        todo = todo[:a.limit]
    if not todo:
        print('nothing to render (every matching key is already cached)')
        return

    print('firefly: %d plates' % len(todo), flush=True)
    t0, done, refused, failed = time.time(), 0, [], []
    for i, (key, prompt, _gen, out_px, aspect) in enumerate(todo):
        # Re-check immediately before working: a local painter running in
        # parallel may have taken this key since the list was built.
        if os.path.exists(os.path.join(CACHE, key + '.webp')):
            continue
        s = time.time()
        raw, why = generate(tok, cid, prompt, aspect, _seed_v(key, a.variant))
        if raw is None:
            (refused if 'policy' in why else failed).append(key + ': ' + why)
            print('[%d/%d] %-26s SKIP  %s' % (i + 1, len(todo), key, why), flush=True)
            continue
        save(raw, key, out_px, aspect)
        done += 1
        print('[%d/%d] %-26s %5.1fs' % (i + 1, len(todo), key, time.time() - s), flush=True)

    print('\n%d rendered in %.0fs (%.1fs each)'
          % (done, time.time() - t0, (time.time() - t0) / max(1, done)), flush=True)
    if refused:
        print('CONTENT POLICY REFUSED %d, send these to the local tier:' % len(refused))
        for r in refused:
            print('  ' + r)
    if failed:
        print('FAILED %d:' % len(failed))
        for f in failed[:10]:
            print('  ' + f)


if __name__ == '__main__':
    main()
