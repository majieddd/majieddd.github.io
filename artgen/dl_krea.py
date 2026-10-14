"""Fetch the Krea 2 Turbo weights into a plain directory.

`local_dir` writes files straight to disk. The default hub cache would keep a
second full copy under blobs/ because Windows has no symlink support here,
which for a 36GB model is 36GB of pure waste.
"""
import os
from huggingface_hub import snapshot_download

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'krea2-turbo')
p = snapshot_download(
    'unsloth/Krea-2-Turbo',
    local_dir=DEST,
    allow_patterns=['model_index.json', 'scheduler/*', 'tokenizer/*',
                    'text_encoder/*', 'transformer/*', 'vae/*'],
    max_workers=8)
print('SNAPSHOT', p, flush=True)
