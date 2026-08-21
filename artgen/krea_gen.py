"""
Cosmic Conquest — art generation on Krea 2 Turbo.

Krea 2 Turbo is a 12.9B-parameter single-stream DiT distilled for 8-step
sampling with guidance disabled. In bf16 the transformer alone is ~26GB, which
does not fit the 12GB card, so both the transformer and the Qwen3-VL text
encoder are loaded as 4-bit NF4 with bf16 compute. That lands around 7.5GB and
2.7GB respectively, leaving comfortable headroom for activations at 1024px.

Every image is cached to cache_krea/<key>.webp, so an interrupted run resumes
for free and a single key can be re-rolled without touching the rest.

Usage:
    python krea_gen.py                 # everything not already cached
    python krea_gen.py --only cmd_     # just the keys with this prefix
    python krea_gen.py --force cmd_nyx # re-roll one key
    python krea_gen.py --pack          # write artpack.js from cache, no model
"""
import argparse, base64, glob, io as _io, json, os, sys, time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# The generator has to work from two layouts: vendored inside the game repo
# (artgen/ beside js/), and as a sibling working directory next to it. Resolve
# rather than assume, or a repack silently writes an artpack nothing loads.
def _artpack_out():
    here_up = os.path.dirname(HERE)
    for cand in (os.path.join(here_up, 'js'),
                 os.path.join(here_up, 'TowerDefense', 'js')):
        if os.path.isdir(cand):
            return os.path.join(cand, 'artpack.js')
    raise SystemExit('cannot locate the game js/ directory from ' + HERE)


OUT = _artpack_out()
CACHE = os.path.join(HERE, 'cache_krea')
FALLBACK_CACHE = os.path.join(HERE, 'cache')      # the SDXL baseline
# The weights live in a plain directory rather than the hub cache: on Windows
# the cache keeps a second full copy under blobs/ (no symlink support), which
# for a 36GB model is 36GB wasted. `unsloth/Krea-2-Turbo` is the mirror to use
# -- the `CalamitousFelicitousness/*-Diffusers` repos are mislabelled and carry
# the ORIGINAL Krea tensor names (blocks.N.attn.wq), of which diffusers'
# Krea2Transformer2DModel matches exactly zero, so it silently initialises an
# empty model and then dies moving meta tensors.
REPO = os.path.join(HERE, 'krea2-turbo')

sys.path.insert(0, HERE)
from krea_jobs import build_jobs, derived_jobs, NEG   # noqa: E402

# Krea 2 Turbo's distillation schedule. Guidance is disabled by the config.
STEPS = 8

# WebP quality per asset class. Portraits and key art carry the look, so they
# get the bits; icons and dossier cards are small on screen and compress hard.
QUALITY = {'cmd': 88, 'title': 88, 'nebula': 86, 'world': 86,
           'fac': 90, 'foe': 84, 'abil': 88}


def quality_for(key):
    return QUALITY.get(key.split('_')[0], 86)


def load_pipe():
    import torch
    from diffusers import Krea2Pipeline, Krea2Transformer2DModel
    from diffusers import BitsAndBytesConfig as DiffBnB
    from transformers import BitsAndBytesConfig as TfBnB
    from transformers import Qwen3VLModel

    if not torch.cuda.is_available():
        raise SystemExit('Krea 2 needs CUDA; run generate.py for the CPU-capable fallback.')

    print('loading transformer (4-bit nf4) ...', flush=True)
    q = dict(load_in_4bit=True, bnb_4bit_quant_type='nf4',
             bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    # bitsandbytes modules are built directly on the target device. Without an
    # explicit device_map accelerate dispatches afterwards and tries to .to()
    # params that are still meta tensors, which raises. Pinning both quantised
    # models to cuda:0 skips that dispatch entirely.
    transformer = Krea2Transformer2DModel.from_pretrained(
        REPO, subfolder='transformer', torch_dtype=torch.bfloat16,
        quantization_config=DiffBnB(**q), device_map='cuda:0')

    # The text encoder runs ONCE per prompt and then idles, so it lives on the
    # CPU in plain bf16 (bitsandbytes is CUDA-only anyway). That returns ~3GB
    # of VRAM to the transformer, whose 8 denoising steps are the actual work
    # -- at 11.8/12 GiB the first smoke test sat at 100% for 15 minutes on one
    # image; headroom is the difference between computing and thrashing.
    print('loading text encoder (bf16, cpu) ...', flush=True)
    text_encoder = Qwen3VLModel.from_pretrained(
        REPO, subfolder='text_encoder', dtype=torch.bfloat16, device_map='cpu')

    print('assembling pipeline ...', flush=True)
    pipe = Krea2Pipeline.from_pretrained(
        REPO, transformer=transformer, text_encoder=text_encoder,
        torch_dtype=torch.bfloat16)
    pipe.set_progress_bar_config(disable=True)
    # Mixed placement: with the encoder on CPU the pipeline's _execution_device
    # resolves to cpu and prepare_latents then refuses a cuda generator. The
    # denoise/decode stage genuinely runs on the card, so pin the property on a
    # per-instance subclass. Prompts never hit this path -- encode_prompt is
    # called explicitly with device='cpu' before the pipeline ever runs.
    pinned = type(pipe.__class__.__name__ + 'Pinned', (pipe.__class__,),
                  {'_execution_device': property(lambda self: torch.device('cuda:0'))})
    pipe.__class__ = pinned
    # The two big models already sit on the card as 4-bit; only the VAE is
    # still free to move. Tiling keeps its peak activation small at 1024px.
    pipe.vae.to('cuda:0')
    pipe.vae.enable_tiling()
    if torch.cuda.is_available():
        free, tot = torch.cuda.mem_get_info()
        print(f'VRAM after load: {(tot-free)/2**30:.1f} / {tot/2**30:.1f} GiB used', flush=True)
    return pipe, torch


def render(pipe, torch, prompt, gen_px, aspect, seed):
    w, h = (gen_px, gen_px)
    if aspect == 'wide':
        w, h = 1280, 720
    # The encoder lives on the CPU, so the prompt is embedded there explicitly
    # and only the (small) embedding tensor crosses to the card. Turbo is
    # distilled with guidance off, so there is no negative branch to embed.
    with torch.no_grad():
        emb, mask = pipe.encode_prompt(prompt, device='cpu')
    g = torch.Generator(device='cuda').manual_seed(seed)
    # guidance_scale=0: Turbo is distilled for guidance-free sampling, but the
    # unsloth conversion's config omits is_distilled, so the pipeline would
    # otherwise run full CFG -- doubling every denoise step and encoding an
    # unwanted negative prompt on the wrong device.
    return pipe(prompt_embeds=emb.to('cuda', torch.bfloat16),
                prompt_embeds_mask=mask.to('cuda'),
                guidance_scale=0.0,
                num_inference_steps=STEPS,
                height=h, width=w, generator=g).images[0]


def fit(img, out_px, aspect):
    """Cover-crop to the target box, then resample down."""
    tw, th = (out_px, out_px) if aspect != 'wide' else (out_px, round(out_px * 9 / 16))
    sc = max(tw / img.width, th / img.height)
    img = img.resize((max(1, round(img.width * sc)), max(1, round(img.height * sc))),
                     Image.LANCZOS)
    l, t = (img.width - tw) // 2, (img.height - th) // 2
    return img.crop((l, t, l + tw, t + th))


def write_pack(jobs, source_note):
    pack, missing, from_fallback = {}, [], 0
    for key, _prompt, _gen, out_px, aspect in jobs:
        p = os.path.join(CACHE, key + '.webp')
        if not os.path.exists(p):
            p = os.path.join(FALLBACK_CACHE, key + '.webp')
            if os.path.exists(p):
                from_fallback += 1
            else:
                missing.append(key)
                continue
        img = Image.open(p).convert('RGB')
        buf = _io.BytesIO()
        img.save(buf, 'WEBP', quality=quality_for(key), method=6)
        pack[key] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()

    total = sum(len(v) for v in pack.values())
    body = (f'/* Generated illustrative art — {source_note}.\n'
            f'   Regenerate with artgen/krea_gen.py. Keys: cmd_<id>, fac_<id>, world_<id>,\n'
            f'   foe_<id>, abil_<id>, title, nebula. */\n'
            'const ARTPACK = ' + json.dumps(pack) + ';\n')
    # newline='' pins LF on Windows too. The repo is uniformly LF
    # (.gitattributes) and CI fails on any CRLF reaching the index, so a
    # default text-mode write here would make every repack fight the
    # checkout and show up as a whole-file diff.
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(body)
    print(f'WROTE {OUT}  {total//1024}KB across {len(pack)} images '
          f'({from_fallback} from the SDXL fallback)', flush=True)
    if missing:
        print(f'  still missing ({len(missing)}): {", ".join(missing[:12])}'
              f'{" ..." if len(missing) > 12 else ""}', flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--force', default='')
    ap.add_argument('--pack', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()

    os.makedirs(CACHE, exist_ok=True)
    jobs = build_jobs()

    if a.pack:
        write_pack(jobs + derived_jobs(), 'Krea 2 Turbo, local RTX 4080')
        return

    todo = [j for j in jobs if j[1] is not None and j[0].startswith(a.only)]
    if a.force:
        todo = [j for j in jobs if j[0].startswith(a.force)]
        for j in todo:
            p = os.path.join(CACHE, j[0] + '.webp')
            if os.path.exists(p):
                os.remove(p)
    todo = [j for j in todo if not os.path.exists(os.path.join(CACHE, j[0] + '.webp'))]
    if a.limit:
        todo = todo[:a.limit]

    print(f'{len(todo)} to render (of {len(jobs)} in the catalogue)', flush=True)
    if not todo:
        write_pack(jobs, 'Krea 2 Turbo, local RTX 4080')
        return

    pipe, torch = load_pipe()
    t0 = time.time()
    for i, (key, prompt, gen_px, out_px, aspect) in enumerate(todo):
        t1 = time.time()
        # Deterministic per key, so a re-run reproduces and a re-roll differs.
        seed = abs(hash(key)) % (2 ** 31)
        img = render(pipe, torch, prompt, gen_px, aspect, seed)
        fit(img, out_px, aspect).save(os.path.join(CACHE, key + '.webp'),
                                      'WEBP', quality=quality_for(key), method=6)
        print(f'[{i+1}/{len(todo)}] {key:18s} {time.time()-t1:5.1f}s '
              f'(total {time.time()-t0:6.0f}s)', flush=True)

    write_pack(jobs + derived_jobs(), 'Krea 2 Turbo, local RTX 4080')


if __name__ == '__main__':
    main()
