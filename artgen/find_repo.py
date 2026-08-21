import json, struct, urllib.request

def api(u):
    try: return json.loads(urllib.request.urlopen(u, timeout=40).read())
    except Exception as e: return {'ERR': str(e)}

def head_keys(repo, rel, nbytes=3_000_000):
    url = f'https://huggingface.co/{repo}/resolve/main/{rel}'
    r = urllib.request.Request(url, headers={'Range': 'bytes=0-%d' % nbytes})
    b = urllib.request.urlopen(r, timeout=60).read()
    n = struct.unpack('<Q', b[:8])[0]
    return set(json.loads(b[8:8+n]).keys())

print('=== unsloth models ===')
for m in api('https://huggingface.co/api/models?author=unsloth&search=Krea&limit=30'):
    if isinstance(m, dict): print(' ', m.get('id'), 'gated=', m.get('gated'))

cands = ['unsloth/Krea-2-Raw', 'unsloth/Krea-2-Turbo', 'WaveCut/Krea-2-Turbo-OrbitQuant-W4A4']
for repo in cands:
    d = api(f'https://huggingface.co/api/models/{repo}?blobs=true')
    if 'ERR' in d or 'siblings' not in d:
        print(f'\n{repo}: UNAVAILABLE'); continue
    sib = d['siblings']
    tot = sum(s.get('size') or 0 for s in sib)
    tf = [s for s in sib if s['rfilename'].startswith('transformer/') and s['rfilename'].endswith('.safetensors')]
    print(f'\n{repo}  gated={d.get("gated")}  total={tot/1e9:.1f}GB')
    need = sum(s.get('size') or 0 for s in sib
               if s['rfilename'].startswith(('transformer/','text_encoder/','vae/','tokenizer','scheduler'))
               or s['rfilename'].endswith('.json'))
    print(f'   needed subset (transformer+te+vae+cfg) = {need/1e9:.1f}GB   shards={len(tf)}')
    if tf:
        try:
            k = head_keys(repo, sorted(x['rfilename'] for x in tf)[0])
            print(f'   first shard tensors={len(k)}  diffusers-style={"img_in.weight" in k or any(x.startswith("final_layer") for x in k)}')
        except Exception as e:
            print('   header ERR', str(e)[:80])
