"""Trial a hosted image API against this catalogue, WITHOUT touching the cache.

WHY THIS IS NOT A PAINTER. `firefly_gen.py` and `krea_gen.py` write into
`cache_krea/` because their output is meant to ship. This does not: it answers
one question -- CAN THIS PROVIDER PAINT THE HOUSE STYLE -- and the honest way
to answer it is to put a candidate beside the local plate for the same key and
look. So output lands in `docs/api-trial/`, never in the cache, and a key that
already has shipped art is the POINT rather than a collision.

Adopt a provider only after that comparison. Then, and only then, is it worth
writing a real painter on the `fit()` / `quality_for()` / atomic-rename spine.

    export LEONARDO_API_KEY=...          # or MODELSLAB_API_KEY
    python api_trial.py --check
    python api_trial.py --provider leonardo --keys cut_human_sys1,cut_xeno_sys1
    python api_trial.py --provider leonardo --texture rock,hull_plating

CREDENTIALS. Leonardo: app.leonardo.ai/api-access, create a key, $5 free credit
that does not expire. ModelsLab: modelslab.com dashboard after signup. Neither
is stored by this script; both come from the environment.
"""
import argparse, json, os, sys, time
import urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

OUT = os.path.join(os.path.dirname(HERE), 'docs', 'api-trial')

# The style spine from ART-BIBLE section 1, appended to every trial prompt.
# A provider judged on a bare subject prompt is not being judged on this
# project's terms, and would flatter itself.
STYLE = ('stylised painted game cutscene illustration, bold flat expressive '
         'brushwork, hard-edged graphic shapes, strong silhouette, gothic '
         'engraved linework, ornamental filigree, screen-print texture, '
         'limited palette, cyberpunk science fiction, vaporwave neon palette '
         'of magenta cyan violet and chrome, holographic glow, retrofuturist '
         'technology, no text, no watermark, no signature')

# Textures are a DIFFERENT problem from illustration and are prompted
# differently: no composition, no silhouette, no staging -- a flat orthographic
# swatch that tiles. Judging a provider's texture ability on a cutscene prompt
# would tell us nothing.
TEXTURE = ('seamless tileable {subject} texture, flat orthographic top-down '
           'material swatch, even lighting, no shadows, no perspective, no '
           'vignette, repeating pattern, game PBR base color map, '
           'limited palette of steel blue cyan magenta and chrome')


def _req(url, data=None, headers=None, timeout=120, method=None):
    body = json.dumps(data).encode() if data is not None else None
    r = urllib.request.Request(url, data=body, headers=headers or {},
                               method=method or ('POST' if body else 'GET'))
    try:
        with urllib.request.urlopen(r, timeout=timeout) as f:
            return f.status, json.loads(f.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode(errors='replace')
        try:
            return e.code, json.loads(raw)
        except ValueError:
            return e.code, {'message': raw[:300]}


# --------------------------------------------------------------------------
# Leonardo. Asynchronous: POST returns a generation id, then poll until the
# images appear. The poll is the part that bites -- a generation that is still
# queued returns 200 with an empty image list, which reads exactly like
# success, so this waits for a non-empty list rather than for a 200.
# --------------------------------------------------------------------------
LEO_BASE = 'https://cloud.leonardo.ai/api/rest/v1'
# Phoenix 1.0. Chosen because it honours prompt structure better than the
# older SD-based model ids and supports the tiling flag textures need.
LEO_MODEL = 'de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3'


def leonardo_key():
    k = os.environ.get('LEONARDO_API_KEY')
    if not k:
        raise SystemExit('set LEONARDO_API_KEY (app.leonardo.ai/api-access)')
    return k


def leonardo_check():
    code, body = _req(LEO_BASE + '/me', headers=_leo_headers(leonardo_key()))
    if code != 200:
        return False, 'http %s: %s' % (code, str(body)[:200])
    d = (body.get('user_details') or [{}])[0]
    return True, ('user=%s  paid_tokens=%s  subscription_tokens=%s'
                  % (d.get('user', {}).get('username', '?'),
                     d.get('paidTokens'), d.get('subscriptionTokens')))


def _leo_headers(key):
    return {'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
            'Accept': 'application/json'}


def leonardo_gen(prompt, w, h, tiling):
    key = leonardo_key()
    payload = {'prompt': prompt[:1490], 'modelId': LEO_MODEL,
               'width': w, 'height': h, 'num_images': 1}
    if tiling:
        payload['tiling'] = True
    code, body = _req(LEO_BASE + '/generations', payload, _leo_headers(key))
    if code not in (200, 201):
        return None, 'submit http %s: %s' % (code, str(body)[:220])
    gid = ((body.get('sdGenerationJob') or {}).get('generationId'))
    if not gid:
        return None, 'no generationId: ' + str(body)[:200]
    # Poll. Leonardo is typically 10-30s; 90s is generous and still bounded.
    for _ in range(45):
        time.sleep(2)
        code, body = _req(LEO_BASE + '/generations/' + gid, headers=_leo_headers(key))
        if code != 200:
            continue
        g = body.get('generations_by_pk') or {}
        imgs = g.get('generated_images') or []
        if imgs and imgs[0].get('url'):
            return imgs[0]['url'], 'ok'
        if g.get('status') == 'FAILED':
            return None, 'generation FAILED'
    return None, 'timed out after 90s'


# --------------------------------------------------------------------------
# ModelsLab. Synchronous-ish: may return the image immediately, or "processing"
# with a fetch URL and an ETA.
# --------------------------------------------------------------------------
ML_URL = 'https://modelslab.com/api/v6/images/text2img'


def modelslab_key():
    k = os.environ.get('MODELSLAB_API_KEY')
    if not k:
        raise SystemExit('set MODELSLAB_API_KEY (modelslab.com dashboard)')
    return k


def modelslab_check():
    # No cheap whoami, so submit the smallest legal job and read the verdict.
    code, body = _req(ML_URL, {'key': modelslab_key(), 'prompt': 'a grey square',
                               'width': '512', 'height': '512', 'samples': '1',
                               'num_inference_steps': '20'},
                      {'Content-Type': 'application/json'})
    st = str(body.get('status'))
    if st in ('success', 'processing'):
        return True, 'accepted a job (status=%s)' % st
    return False, 'http %s: %s' % (code, str(body.get('message') or body)[:200])


def modelslab_gen(prompt, w, h, tiling):
    payload = {'key': modelslab_key(), 'prompt': prompt[:1490],
               'width': str(w), 'height': str(h), 'samples': '1',
               'num_inference_steps': '31', 'safety_checker': 'no'}
    if tiling:
        payload['tiling'] = 'yes'
    code, body = _req(ML_URL, payload, {'Content-Type': 'application/json'})
    st = str(body.get('status'))
    if st == 'success' and body.get('output'):
        return body['output'][0], 'ok'
    if st == 'processing':
        fetch = body.get('fetch_result')
        eta = float(body.get('eta') or 8)
        for _ in range(30):
            time.sleep(max(2, min(eta, 10)))
            c2, b2 = _req(fetch, {'key': modelslab_key()},
                          {'Content-Type': 'application/json'})
            if str(b2.get('status')) == 'success' and b2.get('output'):
                return b2['output'][0], 'ok'
        return None, 'still processing after the fetch window'
    return None, 'http %s: %s' % (code, str(body.get('message') or body)[:220])


PROVIDERS = {
    'leonardo':  (leonardo_check,  leonardo_gen),
    'modelslab': (modelslab_check, modelslab_gen),
}


def fetch_image(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--provider', default='leonardo', choices=sorted(PROVIDERS))
    ap.add_argument('--keys', default='cut_human_sys1,cut_xeno_sys1',
                    help='catalogue keys to trial, comma separated')
    ap.add_argument('--texture', default='',
                    help='comma separated texture subjects instead of catalogue keys')
    ap.add_argument('--check', action='store_true', help='authenticate only')
    a = ap.parse_args()

    check, gen = PROVIDERS[a.provider]

    if a.check:
        ok, why = check()
        print(('AUTH OK   ' if ok else 'AUTH FAIL ') + a.provider + ': ' + why)
        raise SystemExit(0 if ok else 1)

    os.makedirs(OUT, exist_ok=True)

    if a.texture:
        # Textures are square and tiled. 1024 is the honest trial size: big
        # enough to judge grain, small enough that a $5 credit survives it.
        jobs = [('tex_' + s.strip(), TEXTURE.format(subject=s.strip()), 1024, 1024, True)
                for s in a.texture.split(',') if s.strip()]
    else:
        from krea_jobs import build_jobs
        cat = {k: (p, out_px, aspect) for k, p, _g, out_px, aspect in build_jobs() if p}
        jobs = []
        for k in [x.strip() for x in a.keys.split(',') if x.strip()]:
            if k not in cat:
                print('not a catalogue key, skipping: ' + k)
                continue
            prompt, out_px, aspect = cat[k]
            # 1024x576 rather than the delivery 1920x1080: this is a style
            # judgement, and style is legible at any size. Trialling at full
            # delivery size spends real money to learn the same thing.
            wh = (1024, 576) if aspect == 'wide' else (1024, 1024)
            jobs.append((k, prompt, wh[0], wh[1], False))

    if not jobs:
        raise SystemExit('nothing to trial')

    print('%s: %d trial image(s) -> docs/api-trial/' % (a.provider, len(jobs)), flush=True)
    ok = 0
    for key, prompt, w, h, tiling in jobs:
        t0 = time.time()
        # The style spine is appended for catalogue keys only; a texture prompt
        # carries its own and would fight this one.
        full = prompt if tiling else (prompt if STYLE in prompt else prompt + ', ' + STYLE)
        url, why = gen(full, w, h, tiling)
        if not url:
            print('  %-22s FAIL  %s' % (key, why), flush=True)
            continue
        dest = os.path.join(OUT, '%s__%s.png' % (a.provider, key))
        with open(dest, 'wb') as f:
            f.write(fetch_image(url))
        ok += 1
        print('  %-22s %5.1fs  %s' % (key, time.time() - t0, os.path.basename(dest)),
              flush=True)

    print('\n%d/%d succeeded.' % (ok, len(jobs)))
    if ok:
        print('Compare each against its local sibling in art/ before adopting '
              'this provider. Nothing was written to the cache.')


if __name__ == '__main__':
    main()
