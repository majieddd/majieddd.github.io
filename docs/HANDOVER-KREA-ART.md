# Handover: regenerate the cutscene and portrait art in HD

**Goal: 52 images at 1920x1080, crisp, with no wispy AI edges.**

Written to be run by any capable model on any machine with a CUDA GPU. The
generic instructions are the body of this document. Where a choice depends on
the hardware, the choice is stated as a measurement you take rather than a
number to copy, and **Hermes** (the RTX 5090 laptop, and the Claude Code
session running on it) gets a pinned profile in section 3.

The durable law behind all of this now lives in the plugin, not here:

- `aegis-gamedev/references/media-image.md` **section 12**: running a local
  image model on any card without overloading it. VRAM headroom, thrash
  signature, which knob to turn first.
- `aegis-gamedev/references/media-image.md` **section 13**: HD output. Why
  edges go wispy, the three routes to 1080p, the byte budget.
- Sections 0 to 11 of that same file: the catalogue contract, clause order,
  seeding, the pack, and the traps that have already been paid for.

Load those before starting. This document is the project-specific wrapper
around them.

---

## How to run this (read first)

**The section numbers are reference order, not execution order.** Execute in
this order:

1. **Section 1**, clone both repos and install the plugin.
2. **Section 2**, build the Python environment. **Section 3** if this is
   Hermes.
3. **Section 5**, make both HD edits. Do this BEFORE any render, including the
   timing run: `out_px` is applied at render time, so a render taken before the
   edit is saved at 576 and wasted, and a time taken at 1280x720 is not the
   time you are about to pay at 1920x1080.
4. **Section 4**, time exactly one image at the real target resolution and do
   the arithmetic before committing to a batch.
5. **Section 6**, render the 52 keys.
6. **Section 7**, repack, rebuild, verify, gate.
7. **Section 8**, ship.

Load the plugin skill before starting. In Claude Code, invoke `aegis-gamedev`
with the `Skill` tool, then read sections 12 and 13 of
`references/media-image.md`.

### Conventions this document assumes

- **Every `python` means the interpreter you verified in section 2**, not
  whatever is on PATH. On the 4080 the bare `python` has no torch at all.
  Resolve it once, then prefix every command with it.
- Commands that start `cd TowerDefense/artgen` are relative to the workspace
  directory holding both clones. Prefer absolute paths.
- `TowerDefense` is the game clone. Rename freely; the doc uses that name.

### Decide these yourself

You do not need to ask before: choosing the quantisation tier, moving the text
encoder, picking 1920x1080 versus 2304x1296 supersample, setting WebP quality
for the `cut` class, re-rolling a plate by key, or running the batch overnight.
All are reversible, all are measured, and the doc gives the criteria.

### Stop and ask the owner about these

- **The bundle weight, if it lands somewhere you would not choose.** At
  1920x1080 the 50 plates are estimated near 12MB of base64, which puts
  `js/artpack.js` around 19MB on the first-load path against 9.43MB today.
  Report the measured number and your recommendation. Do not silently accept
  it and do not silently compress it away.
- **Switching the plates to on-demand loading instead of inlining.** This is
  the right long-term answer to the weight and it is an architecture change: it
  breaks the single-file bundle promise, so it is the owner's call, not yours.
- **Adopting an upscaler.** None has been vetted in this suite. That is a gated
  decision.
- **Anything that would re-roll already-approved art**, including editing a
  prompt or rendering a non-`cut_` key.

### Long runs

A 52-image batch can be hours. Run it in the background rather than blocking,
and remember the run caches each image on completion, so an interrupted run
resumes for free by re-issuing the same command. Nothing is lost by stopping
one. If your session ends mid-batch, the state that matters is entirely on
disk in `artgen/cache_krea/`, and the count in section 6 tells the next session
exactly where it stands.

### Definition of done

All of the following, or it is not finished:

- [ ] `ls artgen/cache_krea/cut_*.webp | wc -l` returns **50**
- [ ] `cmd_ashtar` and `cmd_isa` exist in `cache_krea/`
- [ ] A repack reports **0 re-encoded** for `cut_` keys
- [ ] Browser probe: 52 decoded, 0 missing, 0 broken, `naturalWidth` 1920
- [ ] `node tools/gate.js <url>` prints **GATE CLEAN**, fail=0 on both harnesses
- [ ] Committed and pushed to `main`, with the measured numbers in the message
- [ ] Artifact republished at the existing URL
- [ ] `docs/OWNER-NOTES-CAMPAIGN2.md` C3 and section E updated with real numbers
- [ ] Owner told the final `artpack.js` size and per-image render time

---

## 0. What you are picking up

The game ships 281 illustrations inlined as base64 WebP in `js/artpack.js`.
Of those, **52 are new and rendered on the interim tier**:

| Keys | Count | What they are |
| --- | --- | --- |
| `cut_<faction>_intro_<1..5>` | 25 | Faction-select cutscene, THE OATH |
| `cut_<faction>_sys<1..5>` | 25 | Post-system cutscene, THE TURNING |
| `cmd_ashtar`, `cmd_isa` | 2 | The two new commander portraits |

Factions are `human`, `light`, `xeno`, `pirate`, `robot`.

They were rendered on **SDXL-Turbo at 576x324**, not Krea 2, for a measured
reason: Krea 2 Turbo cost about **83 minutes per image** on the 12GB 4080, so
52 images was three days of wall clock. SDXL-Turbo did the batch in **43
seconds** of GPU time, 0.7s each, and shipped a complete pack the same day.

That was always the interim tier. The pack is two-tier by design:

```
artgen/cache_krea/<key>.webp    <- preferred, per key
artgen/cache/<key>.webp         <- fallback, used only when the above is absent
```

`krea_gen.py --pack` checks `cache_krea/` first for **every key
independently**. So you can upgrade one plate, or ten, or all fifty, and the
rest keep working. There is no all-or-nothing switch and no branch to merge.

Your job: render those 52 keys on the best model the machine can run, at
1920x1080, then repack, verify and ship.

**Do not change the prompts.** Seeds are `FNV-1a(key)`, so a key renders the
same image every run, but the prompt is part of what the model sees: editing
one re-rolls art the owner has already approved. If a plate genuinely misses
its scene, re-roll that key by name (section 6), do not rewrite the catalogue.

---

## 1. Get the two repositories

The game is public, the plugin is private. Both are on the same account.

```bash
gh auth status
```

```bash
git clone https://github.com/majieddd/majieddd.github.io.git TowerDefense
```

```bash
git clone https://github.com/majieddd/claude-plugins-custom.git
```

Put them side by side under one workspace directory. The exact path does not
matter; being siblings keeps the plugin's own paths short.

Confirm the game repo carries the art catalogue:

```bash
git -C TowerDefense log --oneline -1
```

You want `eb78c3c Cutscene and portrait art: the interim SDXL tier` or a
descendant of it.

### Wire the Aegis Suite plugin

`claude-plugins-custom/aegis-suite` (v3.2.0) carries 4 skills, 5 agents, 2
commands, 4 verification tools and a zero-dependency stdio MCP server. The
supported install:

```bash
claude plugin marketplace add ./claude-plugins-custom/aegis-suite
```

```bash
claude plugin install aegis-suite@aegis
```

Verify in an interactive `claude` session with `/plugin`. The skills carry
`description` frontmatter written for automatic invocation, so saying what you
are doing loads the right one; to force it, use the `Skill` tool by name.

**Pick exactly one install path and never both.** The 4080 machine junctions
`~/.claude/skills/*` at the live source instead, because it edits the plugin
daily. Running both registers two MCP servers under the same name `aegis`, and
they collide **silently**: no error, the tools just never appear, and you fall
back to the expensive manual path believing the cheap one is broken. That cost
a full session once. Before concluding the MCP tools are unavailable:

```bash
find ~ -maxdepth 2 -iname "aegis-suite"
```

```bash
grep -i aegis ~/.claude/plugins/installed_plugins.json
```

A copy you did not install (the known offender was `~/aegis-suite/`, absent
from `installed_plugins.json`, so there was nothing to uninstall) should be
deleted directly. **The fix takes effect from the next session's MCP
connection, not the one that finds it.** Full writeup:
`aegis-suite/skills/aegis-gamedev/references/session-hygiene.md`.

### Recall before you re-derive

```bash
node tools/memory.js find "krea|artpack|cutscene|vram"
```

Run from the plugin root. Searching costs about 500 tokens; the sweeps that
produced those verdicts cost far more.

---

## 2. Python environment, model-agnostic

Whatever model you land on, the environment rules are the same.

- Use a **dedicated interpreter or venv** for image generation. Do not install
  TTS packages into it; the voice pipeline lives in its own environment at
  `ClaudeWorkspace/voicegen` precisely because mixing them broke torch once.
- **Match the torch build to the GPU architecture.** This is the single most
  common setup failure and it does not look like a setup failure. Print the
  arch and confirm torch supports it:

```bash
python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.get_device_name(0), torch.cuda.get_device_capability(0), torch.cuda.get_device_properties(0).total_memory/2**30)"
```

`no kernel image is available for execution on the device` means the wheel
predates your card. That is the whole problem, not a code bug.

Working set measured on the 4080 (Ada, sm_89):

| Package | Version |
| --- | --- |
| torch | 2.5.1+cu121 |
| diffusers | 0.39.0 |
| transformers | 5.15.0 |
| bitsandbytes | 0.50.1 |
| accelerate | 1.14.0 |
| Pillow | 12.1.1 |
| safetensors | 0.8.0 |

```bash
pip install diffusers transformers bitsandbytes accelerate pillow safetensors huggingface_hub
```

Note the interpreter path you used and prefix commands with it. On the 4080 the
bare `python` on PATH has no torch at all, and every command names the real one
explicitly.

### Weights

**Check before downloading. The machine may already have them.**

```bash
ls TowerDefense/artgen/krea2-turbo/
```

You want six entries: `model_index.json`, `scheduler`, `tokenizer`,
`text_encoder`, `transformer`, `vae`. If a copy exists elsewhere, symlink it in
or point `REPO` in `krea_gen.py` at it, one line near the top. Do not
re-download 34GB.

If genuinely absent:

```bash
cd TowerDefense/artgen && python dl_krea.py
```

Two deliberate choices in that script, both of which matter:

- `local_dir=` writes straight to disk. The default hub cache keeps a second
  full copy under `blobs/` because Windows has no symlink support there, which
  for a 36GB model wastes 36GB.
- The mirror is **`unsloth/Krea-2-Turbo`**. The
  `CalamitousFelicitousness/*-Diffusers` repos are mislabelled: they carry the
  ORIGINAL Krea tensor names (`blocks.N.attn.wq`), of which diffusers'
  `Krea2Transformer2DModel` matches exactly zero. It silently initialises an
  empty model and then dies moving meta tensors.

---

## 3. Hermes profile (RTX 5090 laptop)

Everything above is generic. These are the pinned choices for Hermes.

**Architecture.** The 5090 is Blackwell, `sm_120`. **cu121 wheels carry no
Blackwell kernels**, so the 4080's torch 2.5.1+cu121 will not work. Install a
CUDA 12.8 or newer build:

```bash
pip install --index-url https://download.pytorch.org/whl/cu128 torch
```

Confirm `get_device_capability(0)` prints `(12, 0)` with no warning.

**Memory.** The laptop 5090 carries 24GB, the desktop part 32GB. Print it
rather than assume; the number decides the next choice.

**Quantisation.** `krea_gen.py` currently loads the transformer as 4-bit NF4
and parks the Qwen3-VL text encoder on the **CPU**. Both exist to fit 12GB and
**neither is right on Hermes.**

- The bf16 transformer is about 26GB. That does not fit 24GB, so on a laptop
  5090 keep quantisation but try **8-bit** (`load_in_8bit=True`, lands near
  13GB): usually both faster and better than NF4 wherever it fits. On a 32GB
  desktop part, full bf16 becomes possible and is the best quality available.
- **Move the text encoder back to the GPU.** In `load_pipe()`, change the
  `Qwen3VLModel` `device_map='cpu'` to `'cuda:0'`. It runs once per prompt and
  is on the CPU only to return ~3GB to a 12GB card, which is a backwards trade
  when you have headroom. The `_execution_device` pin immediately below it
  exists solely because a CPU encoder made the pipeline resolve to cpu and
  refuse a cuda generator; with the encoder on the GPU it is no longer load
  bearing, though leaving it does no harm.

**Keep VAE tiling on** (`pipe.vae.enable_tiling()`, already there). At 1080p
and above it is what keeps the decode's peak activation small.

**Headroom law.** Keep peak VRAM at or under **85% of total**. Plugin section
12 carries the reasoning and the thrash signature; the short version is that
100% GPU with no progress is swapping, not working. Both measured cliffs on
this project happened above 96%.

---

## 4. Measure ONE image before you start a batch

Do not skip this. It is the step the 4080 session skipped and paid for.

**Make section 5's two edits first.** Timing an image at 1280x720 tells you
nothing about what you are about to pay at 1920x1080, and the render would be
saved at the old `out_px` anyway.

```bash
cd TowerDefense/artgen && python krea_gen.py --force cut_human_intro_1
```

Expect the file it writes to be **1920x1080**. If it is 576x324, edit 2 did not
take and everything after this is wasted:

```bash
python -c "from PIL import Image; print(Image.open('cache_krea/cut_human_intro_1.webp').size)"
```

The script prints VRAM after load and the per-image time. Write both down,
then do the arithmetic before committing to anything:

| Per image | 52 images |
| --- | --- |
| 83 min (measured, 4080 NF4 12GB) | 3 days, unacceptable |
| 10 min | 8.7 hours, an overnight run |
| 2 min | 1.7 hours, comfortable |
| 30 s | 26 min, trivial |

**Above roughly 15 minutes per image, stop and tune before batching.** Check
the printed VRAM line first: if it is near the ceiling you are thrashing, and
more patience will not help. Plugin section 12 has the knob order.

Then prove the pipeline end to end cheaply before committing a night to it:

```bash
python krea_gen.py --only cut_ --limit 3
```

Both of these runs call `write_pack()` when they finish, so they will leave
`js/artpack.js` holding mostly upscaled SDXL plates and a wildly inflated size.
That is expected and harmless. **Do not commit it**, and do not read anything
into the size until all 50 are rendered. See section 5's partial-pack trap.

**Laptops throttle.** A per-image time measured cold understates a sustained
run. Time image 1 and image 20 before trusting an extrapolation.

---

## 5. Set the HD target: 1920x1080

Two numbers control output size. **Both must move, and both must move BEFORE
you render anything.**

That ordering is not a style preference. The render loop saves through `fit()`
at `out_px`:

```python
fit(img, out_px, aspect).save(os.path.join(CACHE, key + '.webp'), ...)
```

So `out_px` is applied **at render time**, not at pack time. Render at
1920x1080 while `out_px` is still 576 and the cache file is written at 576x324,
throwing the HD render away the instant it is made. Raising `out_px` afterwards
then upscales that 576 file back to 1920 and you have paid full bytes for the
detail you already discarded.

**Edit 1, the render size.** `artgen/krea_gen.py:133`, inside `render()`.

Find:

```python
    if aspect == 'wide':
        w, h = 1280, 720
```

Replace the size with `1920, 1080` (or `2304, 1296` to supersample, see below).

**Edit 2, the pack size.** `artgen/krea_jobs.py:725-728`, the loop appended just
before `build_jobs()` returns. The fourth tuple element is `out_px`.

Find:

```python
    for key, fac, scene in CUTSCENE_PLATES:
        jobs.append((key, f'{scene}, {CUTSCENE_PALETTE.get(fac, "")}. '
                     f'Wide cinematic composition, dramatic staging, no text anywhere. {STYLE}',
                     1024, 576, 'wide'))
```

Change only the `576` on the last line to `1920`. Leave `1024` alone: `gen_px`
is ignored for wide aspect, which takes the `render()` branch above.

`fit()` cover-crops and LANCZOS-resamples the render down to `out_px`, deriving
height as `out_px * 9 / 16`. So `out_px = 1920` yields exactly 1920x1080.

### Which render size to pick

Per plugin section 13, **supersample down, never up.** Downsampling is free
antialiasing: it hardens edges and averages away exactly the wispiness that
reads as AI-generated. So:

| Render | Pack | Quality | Cost |
| --- | --- | --- | --- |
| 1920x1080 | 1920 | Good. The floor for an HD deliverable. | Baseline |
| 2304x1296 | 1920 | Better. 1.2x supersample, visibly crisper edges. | ~1.4x VRAM and time |
| 1280x720 | 1920 | **Never.** Upscaling costs bytes for zero detail. | Wrong |

Start at 1920x1080 native. If VRAM allows after measuring, move to 2304x1296
and pack down; that is the single cheapest quality win available.

**If you see duplication** (two horizons, a second moon, a subject with a
duplicate limb), you are above the model's trained band. Do not try to prompt
it away: at `guidance_scale=0` the negative prompt is **inert**. Drop back to
1920x1080, or render in band and upscale with a dedicated model (Real-ESRGAN or
SwinIR). **No upscaler has been vetted in this suite**, so that route is a
gated decision, not a default.

### Scope the render size change

Changing `render()` affects **every wide key**, not just cutscenes. `title` and
`nebula` are also wide and already approved at `out_px` 768. A different render
resolution produces a different latent and therefore a different image, so a
bare `krea_gen.py` run after this edit would re-roll them.

**Guard: always scope the run with `--only cut_`.** That is what keeps approved
art approved.

### The trap that comes with raising out_px: partial packs

`write_pack()` passes cached bytes through **only when the cached file already
matches the target size**, and re-encodes when it does not. That guard is
correct and load bearing. But once `out_px` is 1920:

> Any `cut_` key not yet rendered on Krea falls back to the SDXL `cache/` copy
> at 576px, and the pack **upscales it to 1920**. Full bytes, zero detail.

This is not a reason to delay the edit (section 5 explains why you cannot). It
is a reason to be careful about **when you pack and what you commit**, because
`krea_gen.py` calls `write_pack()` itself at the end of every run, including:

- the single-image timing run in section 4,
- a `--limit 3` trial batch,
- any partial run you interrupt and restart.

Each of those leaves `js/artpack.js` holding up to 49 upscaled SDXL plates and
a badly inflated file size. That is a harmless intermediate state and it
corrects itself the moment all 50 are rendered and you repack.

**The rule is therefore: never commit `js/artpack.js` until the count below
returns 50.** Verify immediately before committing:

```bash
ls TowerDefense/artgen/cache_krea/cut_*.webp | wc -l
```

If a repack reports a non-zero re-encode count for `cut_` keys after all 50
exist, something is genuinely wrong with a cache file; investigate rather than
committing it.

### Budget the bytes, then measure them

1920x1080 is 11.1x the pixels of the current 576x324. Current plates measure a
39.6KB median, 1.91MB total, 2.55MB once base64 inflates by 4/3. WebP scales
sublinearly, so estimate 4 to 5x per plate and **then measure**, because the
true ratio depends on the model's output.

| Scenario | Estimated pack cost |
| --- | --- |
| 576x324, quality 86 (today) | 2.55MB, measured |
| 1920x1080, quality 86 | ~12MB, estimate |
| 1920x1080, quality 80 | ~8MB, estimate |

Levers if the number lands too high, in order:

- **WebP quality per class.** The cutscene plates currently fall through to the
  default 86 because `QUALITY` in `krea_gen.py` has no `cut` entry. Backdrops
  sitting behind a dark gradient tolerate 78 to 82 where a portrait wants 88:

```python
QUALITY = {'cmd': 88, 'title': 88, 'nebula': 86, 'world': 86,
           'fac': 90, 'foe': 84, 'abil': 88, 'cut': 80}
```

- **AVIF instead of WebP**, typically 30 to 50% smaller at matched quality and
  decoded natively by every current browser. Untested here; the encoder call is
  the only change.
- **Stop inlining the plates.** Base64 costs 4/3 of raw, and every inlined
  image is on the first-load path whether the player sees it or not. Fifty
  full-screen plates seen only at specific story moments are the strongest
  candidate in the catalogue for on-demand loading. That is an architecture
  change, it breaks the single-file bundle promise, so **raise it with the
  owner rather than doing it.**

---

## 6. Render the 52 keys

`--only` takes a key prefix, so the plates are one scoped command:

```bash
cd TowerDefense/artgen && python krea_gen.py --only cut_
```

Every image caches to `cache_krea/<key>.webp` as it completes, so an
interrupted run resumes for free. Run it in the background and let it work.
Do not run a browser harness or a dev server against the same GPU while it
does.

Then the two portraits. `--only` is a prefix match, so a full key name selects
exactly one:

```bash
python krea_gen.py --only cmd_ashtar
```

```bash
python krea_gen.py --only cmd_isa
```

Note what the "already rendered" check looks at: **only `cache_krea/`**. The
SDXL copies in `cache/` never suppress a Krea render, so `--force` is not
needed here. Reserve `--force` for re-rolling a key already in `cache_krea/`,
which is what it deletes.

The portraits are square, not wide, so they take the `gen_px`/`out_px` path
rather than `render()`'s wide branch. They are already at the approved `cmd`
composition and `out_px` 320; leave that alone unless the owner asks, because
the other 26 portraits are 320 and a mismatched pair would break the class.

Confirm the count, which must be exactly 50:

```bash
ls TowerDefense/artgen/cache_krea/cut_*.webp | wc -l
```

Re-roll a single miss by key. Do not edit the prompt:

```bash
python krea_gen.py --force cut_light_sys3
```

A bare `python krea_gen.py` with no flags renders **everything** absent from
`cache_krea/`, which right now is 280 of 281 keys. That is a full-catalogue
re-render, not this task.

---

## 7. Repack, rebuild, verify

The run calls `write_pack()` itself when it finishes, so `js/artpack.js` is
already rebuilt after a completed batch. To repack manually:

```bash
cd TowerDefense/artgen && python krea_gen.py --pack
```

Read the line it prints: how many passed through unchanged, how many were
re-encoded, how many came from the SDXL fallback. **A re-encode count above
zero for `cut_` keys means a size mismatch**, which is either the section 5
trap or a stale cache file.

This matters more than it looks. A `--pack` that decodes and re-encodes an
already-correct file resizes nothing and re-quantises everything: measured
across the catalogue, one repack costs a mean RMSE of 2.55 with zero
byte-identical round-trips, and the loss compounds every rebuild. The
passthrough exists to stop that.

While you are in the file, the pack's provenance note is hardcoded to the old
card and will otherwise lie about where the art came from:

```python
write_pack(jobs + derived_jobs(), 'Krea 2 Turbo, local RTX 4080')
```

Then check the pack parses, rebuild, and measure the real size:

```bash
cd TowerDefense && node --check js/artpack.js && node build.js
```

```bash
node -e "console.log((require('fs').statSync('aegis-protocol.html').size/1048576).toFixed(2)+'MB')"
```

### Verify in a browser, not by reading the pack

A truncated data URI parses fine and paints nothing, and the cutscene falls
back to a faction crest without complaining. Check the decode, not the key.

```bash
python -m http.server 8623 --bind 127.0.0.1
```

```bash
node tools/gate.js http://127.0.0.1:8623
```

You need `GATE CLEAN`, with owner-sweep `pass=61 fail=0 info=2` and mpt
`pass=37 fail=0 info=2`. Those were the numbers at handover. If a count grew
because someone added checks that is fine, but **fail must be 0**.

For screenshots and ad-hoc probes, `tools/headless.js` drives headless Chrome
over CDP with zero dependencies:

```bash
node tools/headless.js <url> <outdir> <stepsfile>
```

Set `CHROME_PATH` if Chrome is not at the default Windows install path. Three
rules that apply here:

- Always assert `document.hidden` is `false` in a steps file. A backgrounded
  page throttles timers and quietly invalidates timing-sensitive checks.
- owner-sweep runs **before** MPT, each on a freshly reloaded page. MPT
  installs wrappers over `Net.step`, so owner-sweep's source-reading checks
  would otherwise grep the wrapper instead of the engine.
- `ARTPACK` is a top-level `const` in a classic script, so it is **never** a
  `window` property. A probe reading `window.ARTPACK` reports every key missing
  and contradicts itself. Read it lexically.

The HD check specifically: confirm `naturalWidth` is 1920 on the live element
and compare it against the element's rendered box for the true upscale factor.
The cutscene art is a full-bleed backdrop, so on a 1600px viewport a 1920 plate
is finally being **downscaled** rather than stretched, which is the whole point
of this exercise. Expected probe result: `decoded: 52, missing: 0, broken: 0`.

If a `headless.js` run is killed by a timeout it orphans a Chrome profile
directory. Reclaim them (measured 1.17GB from two timeout hits):

```bash
node tools/headless-reap.js
```

---

## 8. Ship

```bash
git add js/artpack.js && git commit && git push origin main
```

Pushing to `main` deploys to https://majieddd.github.io via
`.github/workflows/pages.yml`. That workflow checks exactly two things: that
both bundles were written, and that no `<script src=` survived inlining. It
runs **no parse check, no em dash scan, no owner-sweep and no MPT.** The gate
in section 7 is the only real thing between a bad pack and production.

Where the bytes land: the live site runs straight from `index.html` plus `js/`
and `css/` with no build step, so **players load `js/artpack.js` as its own
file** (9.43MB today). The single-file `aegis-protocol.html` bundle (11.48MB)
is a download, rebuilt by CI rather than trusted from the commit. Both grow
when you raise `out_px`, and the first-load path is the one that matters.

Commit message style, enforced by review and by a tool:

- **No em dash anywhere.** Not in code, copy, comments, or commit bodies.
  `node tools/emdash.js` is the gate, it exits 1 on any finding, and it is part
  of `gate.js`.
- Lead with what changed mechanically, then why, then the measurement that
  proves it. Numbers, not adjectives.

Then republish the Artifact so the shareable copy matches. The artifact build
is `aegis-artifact.html`, written by the same `node build.js`. Update this same
URL rather than publishing a new one, or the owner's existing link goes stale:

```
https://claude.ai/code/artifact/71e2140b-c473-412b-a53d-da4f53fce652
```

Finally, close the loop in `docs/OWNER-NOTES-CAMPAIGN2.md`. Section C3 records
the SDXL tier as shipped; update it with your measured numbers (model, per-image
time, render and pack resolutions, final artpack and bundle sizes). Section E
carries the open follow-up to verify each plate reads against its slide text.

---

## 9. Traps, collected

Every one of these was paid for once already.

| Trap | Symptom | Guard |
| --- | --- | --- |
| Batch started without timing one image | Three days of wall clock discovered on day one | Section 4 |
| Duplicate MCP install under one name | Tools silently absent, no error | `find ~ -maxdepth 2 -iname aegis-suite` |
| Wrong Krea mirror | Empty model, dies moving meta tensors | Use `unsloth/Krea-2-Turbo` |
| Torch wheel older than the GPU arch | No kernel image for device | cu128+ on Blackwell |
| VRAM above ~85% | 100% GPU, no progress, for many minutes | Watch the printed VRAM line |
| `render()` changed without `--only cut_` | Approved title and nebula art re-rolls | Scope every run |
| `out_px` raised AFTER rendering starts | Every HD render saved at 576, then upscaled back | Both edits before any render, section 5 |
| One image timed before the HD edits | The number measured is not the number you will pay | Edit first, then time |
| `js/artpack.js` committed from a partial run | Up to 49 SDXL plates upscaled to 1920, file wildly inflated | Commit only when the count returns 50 |
| Rendering far above the model's band | Two horizons, duplicated subjects | Drop to 1920x1080, or upscale separately |
| Trying to prompt artifacts away | Nothing changes | Negative prompt is inert at guidance 0 |
| Prompt edited to "improve" a plate | Approved art re-rolls, seed is FNV(key) | Re-roll by key with `--force` |
| Verified by reading the pack | Truncated URI parses, paints nothing, falls back silently | Decode in a browser |
| Probe reads `window.ARTPACK` | Every key reported missing | Top-level `const`, read lexically |
| MPT run before owner-sweep | Checks grep the wrapper, not the engine | Reload between harnesses |
| Repacking repeatedly | Cumulative re-quantisation, RMSE 2.55 per pass | Keep the passthrough guard intact |
| Em dash anywhere | Gate exits 1 | `node tools/emdash.js` |
| `headless.js` killed by timeout | Orphaned Chrome profiles, 1.17GB measured | `node tools/headless-reap.js` |

---

## 10. Do not touch

The art path is presentation only and must stay that way.

- **No new `Math.random`** in any presentation path. Cutscenes draw nothing.
- **The galaxy PRNG stream must not move.** `js/galaxy.js` draws every roll
  unconditionally, even when the result is discarded. Nothing in the art
  pipeline should go near it; if you end up in that file for any reason, read
  `aegis-gamedev/references/determinism.md` first.
- **Index-coupled tables are append-only.** Commander ids never move.
- `js/config.js`, `js/game.js` and `js/mapgen.js` may hold a **second
  contributor's uncommitted procedural map work**. Leave those unstaged. If you
  need to fix an em dash in one, fix the character in place and let their commit
  carry it.
