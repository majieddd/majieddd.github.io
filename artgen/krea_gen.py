"""
Cosmic Conquest: art generation on Krea 2 Turbo.

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
import argparse, base64, glob, hashlib, io as _io, json, os, sys, time

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
# Full-screen story plates are seen at ONE scripted moment each, so inlining
# them puts 13MB of base64 on the first-load path that most players never
# decode. Classes listed here ship as real files under art/ and are referenced
# by URL instead. art() hands whatever string it finds straight to an <img
# src>, and a URL works there exactly as a data URI does, so nothing
# downstream changes. build.js inlines them back for the single-file bundle.
# `pcut` (the 875 planet cutscene plates, artgen/planet_jobs.py) is on-demand
# for the same reason `cut` is, only harder: at ~200KB a plate the class is
# roughly 175MB, which is eight times the entire rest of the game. It is
# also the one class build.js DROPS rather than inlines; see the note there.
ONDEMAND_CLASSES = {'cut', 'pcut'}
ART_DIR = os.path.join(os.path.dirname(OUT), '..', 'art')
CACHE = os.path.join(HERE, 'cache_krea')
FALLBACK_CACHE = os.path.join(HERE, 'cache')      # the SDXL baseline

# THE PROMPT MANIFEST, and the whole class of defect it exists to catch.
#
# The cache is keyed by KEY and the seed is FNV-1a of the KEY, both on purpose:
# a resumed run reproduces, and a re-roll is explicit. The cost is that the
# PROMPT is nowhere in that identity, so editing a prompt leaves the old image
# cached under the same name and every later run skips it as "already done".
# It fails silently and it fails invisibly, because the plate that comes back
# is a perfectly good image of the wrong thing.
#
# Measured, twice, in one session:
#   * All five human opening plates were still illustrating the retired
#     five-slide script after the opening was rewritten to fifteen beats. Slide
#     one showed what the new script wants at slide five; slide two showed
#     slide four's content. The intro simply did not make sense, and nothing
#     reported it.
#   * 502 of 875 planet plates were rendering worlds that had been renamed
#     (Barnard to Proxima Centauri, Tabby to Sirius) and re-authored. The
#     storyboard had been carrying "350 panels still show outdated artwork" as
#     a hand-written TODO for days, because a person had to notice it.
#
# Recording sha1(prompt) beside the image turns both into a computed answer.
# A key is stale when the manifest disagrees with the prompt that is about to
# be rendered, and stale keys are re-rendered exactly like missing ones.
PROMPTS = os.path.join(CACHE, '.prompts.json')


def prompt_hash(prompt):
    return hashlib.sha1((prompt or '').encode('utf-8')).hexdigest()[:16]


def load_manifest():
    try:
        with open(PROMPTS, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        # No manifest, or a truncated one from a killed run. Either way the
        # honest answer is "nothing is known to be current", which makes every
        # cached key stale and costs a re-render rather than shipping a plate
        # nobody can vouch for.
        return {}


def save_manifest(man):
    tmp = PROMPTS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(man, f, indent=0, sort_keys=True)
    os.replace(tmp, PROMPTS)     # atomic, so a kill cannot truncate the real file


def is_stale(key, prompt, man):
    """True when a cached plate was not made from the prompt now on file."""
    return man.get(key) != prompt_hash(prompt)
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
           'fac': 90, 'foe': 84, 'abil': 88, 'cut': 82, 'pcut': 82}


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

    # Quantisation is chosen from the card, not hardcoded: the bf16 transformer
    # is ~26GB and fits neither card, but 8-bit lands near 13GB and is both
    # faster and better than NF4 wherever it has room. The 85% headroom law
    # (media-image section 12) is what sets the threshold: 8-bit plus the VAE
    # and 1080p activations needs a 24GB-class card, so a 12GB one keeps NF4.
    # bf16 is ~26GB and fits no card here, so the transformer is always
    # quantised. 8-bit would be the better tier on a 24GB card and it was
    # TRIED FIRST: bitsandbytes 0.50.2 int8 dies in its own outlier path,
    # `torch.argwhere(outliers.any(dim=0)).view(-1)` raising "view size is not
    # compatible with input tensor's size and stride" under torch 2.11.0+cu128.
    # A bare Linear8bitLt smoke test passes on this card, so the card and the
    # kernels are fine and the bug is in that one call. NF4 is the vetted tier
    # and it works, so the 24GB of headroom is spent on supersampling instead
    # (render(), and media-image section 13: downsampling is free antialiasing,
    # and it buys more than the 4-bit to 8-bit step would).
    tot_gib = torch.cuda.get_device_properties(0).total_memory / 2 ** 30
    q = dict(load_in_4bit=True, bnb_4bit_quant_type='nf4',
             bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
    print(f'loading transformer (4-bit nf4) on a {tot_gib:.1f} GiB card ...', flush=True)
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
    #
    # THAT FIGURE IS FROM A 12 GiB CARD and this one has 24, so the placement
    # was re-examined in Session 39 rather than inherited. It stays, and the
    # numbers are in artgen/time_encoder.py: the CPU encode costs 4.50s of a
    # 47.5s plate (9%), while under load the card already reports 174W of a
    # 175W limit at 100% utilisation with SW Power Cap active. Moving the
    # encoder onto a power-capped card buys back part of 9% and spends VRAM
    # and watts to do it. The saving that IS available is overlapping the
    # encode of plate N+1 with the denoise of plate N, which costs no VRAM;
    # it is not done here because it was measured mid-run and is not worth
    # restarting a class for.
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


def _seed(key):
    """FNV-1a over the key: identical every run, unlike the salted builtin.

    Byte-identical to sdxl_all._seed, so a key seeded on either path lands on
    the same number. Not imported from there because sdxl_all imports fit and
    quality_for FROM this module (the dependency runs that way round) and it
    pulls torch + diffusers in at module scope."""
    h = 2166136261
    for ch in key:
        h = ((h ^ ord(ch)) * 16777619) & 0xffffffff
    return h % (2 ** 31)


def _seed_v(key, variant):
    """The seed for a VARIANT of a key.

    WHY THIS EXISTS. The documented way to fix a plate that misses its scene is
    `--force <key>`, and it could not work: the seed is a pure function of the
    key, so deleting the cache and re-rendering reproduced the SAME image
    exactly. Found while reading all fifty cutscene plates against their slide
    text (docs/OWNER-NOTES-CAMPAIGN2.md section E): two plates miss, and the
    only tool for fixing them was a no-op that costs a minute of GPU to prove
    it.

    Variant 0 is `_seed(key)` unchanged and MUST stay that way: every approved
    plate in the catalogue is on variant 0, and moving it would re-roll art the
    owner has already accepted. A variant is still deterministic, so a plate
    stays reproducible; the number is simply part of what identifies it, and
    belongs in the commit message beside the key."""
    return _seed(key) if not variant else _seed(key + '#' + str(variant))


def render(pipe, torch, prompt, gen_px, aspect, seed):
    w, h = (gen_px, gen_px)
    if aspect == 'wide':
        # 1920x1080 native, NOT the 2304x1296 supersample. Both were rendered
        # and compared on cut_human_intro_1 (44.4s vs 65.6s, VRAM 7.8/23.9 GiB
        # either way, so this is an art-direction call and not a memory one).
        # 2304 is 3.24x Krea 2's default wide band and the drift shows up as
        # palette, not as duplication: the {STYLE} vaporwave tail took over and
        # hot magenta displaced the faction's steel blue across the whole frame.
        # These plates are full-bleed backdrops behind dialogue, so faction
        # legibility at a glance outranks linework that sits under a text
        # scrim. 1920 keeps the render in band and the faction colour dominant.
        w, h = 1920, 1080
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
    passed, recoded = 0, 0
    ondemand, ondemand_bytes = 0, 0
    for key, _prompt, _gen, out_px, aspect in jobs:
        p = os.path.join(CACHE, key + '.webp')
        if not os.path.exists(p):
            p = os.path.join(FALLBACK_CACHE, key + '.webp')
            if os.path.exists(p):
                from_fallback += 1
            else:
                missing.append(key)
                continue
        # Every cache entry was ALREADY written through fit() at this job's
        # out_px and at quality_for(key) -- by the render loop below, by
        # sdxl_all.py:143, and by derive_worlds/derive_crests. Decoding and
        # re-encoding it here therefore resizes nothing and re-quantises
        # everything: MEASURED across the 188 catalogue keys, one --pack costs
        # a mean RMSE of 2.55 and not one key round-trips byte-identical, so
        # the loss is cumulative for as long as the pack keeps being rebuilt.
        #
        # So ship the cached BYTES when they already are the target, and
        # re-encode only what is not. The guard is the whole point: a
        # passthrough that skipped a needed resize would ship wrong-sized art,
        # which is worse than the loss it saves. MEASURED today: 188/188 are
        # RGB / WEBP / exactly out_px, so the else branch is currently dead --
        # it is here for a stale or hand-dropped cache file.
        with open(p, 'rb') as fh:
            raw = fh.read()
        img = Image.open(_io.BytesIO(raw))
        tw, th = (out_px, out_px) if aspect != 'wide' else (out_px, round(out_px * 9 / 16))
        if img.format == 'WEBP' and img.mode == 'RGB' and img.size == (tw, th):
            blob = raw
            passed += 1
        else:
            buf = _io.BytesIO()
            fit(img.convert('RGB'), out_px, aspect).save(
                buf, 'WEBP', quality=quality_for(key), method=6)
            blob = buf.getvalue()
            recoded += 1
        if key.split('_')[0] in ONDEMAND_CLASSES:
            os.makedirs(ART_DIR, exist_ok=True)
            with open(os.path.join(ART_DIR, key + '.webp'), 'wb') as fh:
                fh.write(blob)
            pack[key] = 'art/' + key + '.webp'
            ondemand += 1
            ondemand_bytes += len(blob)
        else:
            pack[key] = 'data:image/webp;base64,' + base64.b64encode(blob).decode()

    total = sum(len(v) for v in pack.values())
    # ANIMATED PLATES: an optional second tier over the same keys. They are
    # produced OUTSIDE this pipeline by tools/plate_to_video.py (Wan 2.2 via a
    # local ComfyUI), so nothing here generates them; this only publishes
    # whichever ones happen to be on disk beside their still. A key with no
    # clip is simply absent from the map and its still is what plays, which is
    # the same degrade-quietly contract the art pack itself has.
    vids = {}
    if os.path.isdir(ART_DIR):
        for key in pack:
            if os.path.exists(os.path.join(ART_DIR, key + '.mp4')):
                vids[key] = 'art/' + key + '.mp4'
    body = (f'/* Generated illustrative art, {source_note}.\n'
            f'   Regenerate with artgen/krea_gen.py. Keys: cmd_<id>, fac_<id>, world_<id>,\n'
            f'   foe_<id>, abil_<id>, title, nebula. */\n'
            'const ARTPACK = ' + json.dumps(pack) + ';\n'
            'const ARTVID = ' + json.dumps(vids) + ';\n')
    # newline='' pins LF on Windows too. The repo is uniformly LF
    # (.gitattributes) and CI fails on any CRLF reaching the index, so a
    # default text-mode write here would make every repack fight the
    # checkout and show up as a whole-file diff.
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(body)
    print(f'WROTE {OUT}  {total//1024}KB across {len(pack)} images '
          f'({passed} passed through, {recoded} re-encoded, '
          f'{from_fallback} from the SDXL fallback)', flush=True)
    if ondemand:
        print(f'      {ondemand} on-demand plates written to art/ '
              f'({ondemand_bytes//1024}KB raw, off the first-load path)', flush=True)
    if vids:
        vb = sum(os.path.getsize(os.path.join(ART_DIR, k + '.mp4')) for k in vids)
        print(f'      {len(vids)} animated plates published ({vb//1024}KB, '
              f'fetched only when motion is wanted)', flush=True)
    if missing:
        print(f'  still missing ({len(missing)}): {", ".join(missing[:12])}'
              f'{" ..." if len(missing) > 12 else ""}', flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', default='')
    ap.add_argument('--force', default='')
    # A variant re-rolls a key to a DIFFERENT image without touching the
    # prompt, which the class law forbids. Variant 0 is the shipped seed.
    ap.add_argument('--variant', type=int, default=0)
    ap.add_argument('--pack', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    # Report which cached plates no longer match their prompt, and render
    # nothing. Cheap enough to run before any batch, and it is the question
    # "is what I am shipping actually what I wrote" asked as a command.
    ap.add_argument('--stale', action='store_true')
    a = ap.parse_args()

    os.makedirs(CACHE, exist_ok=True)
    jobs = build_jobs()

    if a.pack:
        write_pack(jobs + derived_jobs(), 'Krea 2 Turbo, local RTX 5090')
        return

    todo = [j for j in jobs if j[1] is not None and j[0].startswith(a.only)]
    if a.force:
        todo = [j for j in jobs if j[0].startswith(a.force)]
        for j in todo:
            p = os.path.join(CACHE, j[0] + '.webp')
            if os.path.exists(p):
                os.remove(p)
    # MISSING or STALE, not just missing. A cached plate whose prompt has moved
    # since it was rendered is worth exactly as much as no plate at all, and it
    # is worse than no plate, because nothing downstream can tell it is wrong.
    man = load_manifest()
    todo = [j for j in todo
            if not os.path.exists(os.path.join(CACHE, j[0] + '.webp'))
            or is_stale(j[0], j[1], man)]

    if a.stale:
        cached = [j for j in todo if os.path.exists(os.path.join(CACHE, j[0] + '.webp'))]
        gone = [j for j in todo if not os.path.exists(os.path.join(CACHE, j[0] + '.webp'))]
        print(f'{len(cached)} cached plates are STALE (prompt moved since render)')
        print(f'{len(gone)} plates are MISSING')
        for j in cached[:40]:
            print('   stale  ', j[0])
        if len(cached) > 40:
            print(f'   ... and {len(cached) - 40} more')
        return

    if a.limit:
        todo = todo[:a.limit]

    print(f'{len(todo)} to render (of {len(jobs)} in the catalogue)', flush=True)
    if not todo:
        # `jobs + derived_jobs()`, matching the --pack branch above and the
        # end-of-run call below. derived_jobs() is the 60 world_<map>_<faction>
        # holder duotones; omitting them here wrote an artpack missing 60 of
        # 188 keys, and it failed SILENTLY -- ui.js falls back from
        # world_<map>_<holder> to world_<map>, so every battle briefing just
        # quietly lost its holder tint. This branch is the NORMAL ending of an
        # overnight class run (everything requested already cached).
        write_pack(jobs + derived_jobs(), 'Krea 2 Turbo, local RTX 5090')
        return

    pipe, torch = load_pipe()
    t0 = time.time()
    for i, (key, prompt, gen_px, out_px, aspect) in enumerate(todo):
        t1 = time.time()
        # Deterministic per key, so a re-run reproduces and a re-roll differs.
        # FNV-1a, not the builtin: Python salts str.__hash__ PER PROCESS, so
        # hash() made a resumed run re-roll every remaining key and made
        # --force unreproducible. BRAND.md records this as fixed; only the SDXL
        # path was ever fixed. At ~83 min/image this is the path where an
        # unreproducible seed is most expensive. Note the GPU is not bit-
        # deterministic (see commit 4a2974b), so a stable seed buys "recognisably
        # itself", not byte-equality -- which is the whole of what --force needs.
        seed = _seed_v(key, a.variant)
        img = render(pipe, torch, prompt, gen_px, aspect, seed)
        fit(img, out_px, aspect).save(os.path.join(CACHE, key + '.webp'),
                                      'WEBP', quality=quality_for(key), method=6)
        # Record the prompt this plate was actually made from, immediately
        # after the plate exists. Flushed every time rather than once at the
        # end: an eleven hour class run that is killed at hour ten must not
        # lose the record of the plates it already got right.
        man[key] = prompt_hash(prompt)
        save_manifest(man)
        print(f'[{i+1}/{len(todo)}] {key:18s} {time.time()-t1:5.1f}s '
              f'(total {time.time()-t0:6.0f}s)', flush=True)

    write_pack(jobs + derived_jobs(), 'Krea 2 Turbo, local RTX 5090')


if __name__ == '__main__':
    main()
