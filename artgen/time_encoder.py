"""Time the CPU text-encode step against the whole per-plate budget.

WHY THIS EXISTS, AND WHAT IT MEASURED (Session 39).

`krea_gen.load_pipe` puts the Qwen3-VL text encoder on the CPU in bfloat16 and
embeds every prompt there, so only the small embedding tensor crosses to the
card. The comment justifying that cites a smoke test "at 11.8/12 GiB", i.e. it
was tuned for a 12 GiB card. This machine has 24 GiB, so the hypothesis was
that the CPU encode had become the bottleneck and the encoder should move back
onto the card.

THE HYPOTHESIS WAS WRONG, and the way it was wrong is worth keeping.

  * Measured here: the CPU encode is 4.50s per prompt at bf16 (5.03s at fp32,
    so bf16 is already the right dtype), on a 189-token planet-plate prompt.
    Against a 47.5s per-plate budget that is 9%, not the bottleneck.

  * The reading that suggested otherwise was a SAMPLING ARTEFACT. Six
    consecutive nvidia-smi calls returned 33% utilisation at 20.6W and
    1005MHz, which reads exactly like a starved GPU. It is not. Those six
    calls are fast and they all landed inside the same 4.5s CPU-encode window
    between plates. Queried again under load the same card reports 174.23W of
    a 175.00W limit, 2392MHz, 100% utilisation, 80C, and "SW Power Cap:
    Active".

THE CONCLUSION: the card is compute-bound AND power-capped at its 175W
ceiling, so batching buys nothing, and 47.5s per 1920x1080 plate is the honest
floor for this configuration. The only real saving left is overlapping the
4.5s CPU encode of plate N+1 with the GPU denoise of plate N, which is worth
about 9% and is NOT worth restarting a running eleven-hour class for.

REPEAT THE LESSON, NOT THE MEASUREMENT: sample a periodic workload more times
than you think you need, over a longer window than one phase, and check
power.draw and pstate before concluding a GPU is idle. utilization.gpu alone
lies about a pipeline that alternates devices.

Loads the text encoder ONLY, on the CPU, so it costs RAM and not VRAM and can
be run safely alongside a render already using the GPU.

    python artgen/time_encoder.py
"""
import os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.join(HERE, 'krea2-turbo')

import torch                                                      # noqa: E402
from transformers import AutoTokenizer, Qwen3VLModel               # noqa: E402
from krea_jobs import build_jobs                                  # noqa: E402

# A real prompt from the class being rendered, not a toy string: encode cost
# scales with token count and the planet plates are long.
JOBS = [j for j in build_jobs() if j[0].startswith('pcut_')]
PROMPT = JOBS[0][1] if JOBS else 'a wide cinematic science fiction plate'
print('prompt is %d characters' % len(PROMPT), flush=True)

t0 = time.time()
tok = AutoTokenizer.from_pretrained(REPO, subfolder='tokenizer')
enc = Qwen3VLModel.from_pretrained(
    REPO, subfolder='text_encoder', dtype=torch.bfloat16, device_map='cpu')
print('encoder loaded on cpu in %.1fs' % (time.time() - t0), flush=True)

ids = tok(PROMPT, return_tensors='pt')
print('%d tokens' % ids.input_ids.shape[1], flush=True)

for label, dt in (('bfloat16', torch.bfloat16), ('float32', torch.float32)):
    m = enc.to(dt)
    with torch.no_grad():
        m(**ids, output_hidden_states=True)                 # warm
        t = time.time()
        for _ in range(3):
            m(**ids, output_hidden_states=True)
        per = (time.time() - t) / 3
    print('CPU encode, %s: %.2fs per prompt' % (label, per), flush=True)
