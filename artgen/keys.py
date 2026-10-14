import json, os, sys, struct, urllib.request, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def local_keys(path):
    with open(path, 'rb') as f:
        n = struct.unpack('<Q', f.read(8))[0]
        return list(json.loads(f.read(n)).keys())

def remote_keys(repo, rel, nbytes=3_000_000):
    url = f'https://huggingface.co/{repo}/resolve/main/{rel}'
    r = urllib.request.Request(url, headers={'Range': 'bytes=0-%d' % nbytes})
    with urllib.request.urlopen(r, timeout=60) as resp:
        b = resp.read()
    n = struct.unpack('<Q', b[:8])[0]
    return list(json.loads(b[8:8+n]).keys())

# what diffusers actually wants
import torch
from diffusers import Krea2Transformer2DModel
from krea_gen import REPO
cfg = Krea2Transformer2DModel.load_config(REPO, subfolder='transformer')
with torch.device('meta'):
    m = Krea2Transformer2DModel.from_config(cfg)
want = set(m.state_dict().keys())
print('diffusers EXPECTS %d tensors, e.g.:' % len(want))
for k in sorted(want)[:6]: print('   ', k)
print()

shard = sorted(glob.glob(os.path.join(REPO, 'transformer', '*-00001-of-*.safetensors')))[0]
have = set(local_keys(shard))
print('LOCAL mirror shard has %d tensors, e.g.:' % len(have))
for k in sorted(have)[:6]: print('   ', k)
print()
print('OVERLAP with expected:', len(want & have))
print()
for repo, rel in [('unsloth/Krea-2-Raw', 'transformer/diffusion_pytorch_model-00001-of-00003.safetensors'),
                  ('CalamitousFelicitousness/Krea-2-Base-Diffusers', 'transformer/diffusion_pytorch_model-00001-of-00006.safetensors')]:
    try:
        rk = set(remote_keys(repo, rel))
        print(f'{repo}: {len(rk)} tensors, overlap with diffusers-expected = {len(want & rk)}')
        for k in sorted(rk)[:4]: print('    ', k)
    except Exception as e:
        print(repo, 'ERR', type(e).__name__, str(e)[:100])
