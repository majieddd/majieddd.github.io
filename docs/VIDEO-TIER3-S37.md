# Video, Session 37: both tiers proven on this machine

Two things were stood up and measured. Neither ships anything into the game yet,
and the second one should not until the owner decides it should.

*The only camera this project trusts is the sim itself. The other one is for
everything that was never gameplay.*

## Tier 1: deterministic gameplay capture. Works, zero installs

`tools/capture.js` plus `tools/headless.js` plus ffmpeg, exactly as
`references/media-video.md` section 1 describes. Ran clean first time.

    node tools/capture.js spine 4242 150 15 > steps.js
    node tools/headless.js http://127.0.0.1:8623/index.html <out> steps.js
    ffmpeg -y -framerate 15 -i <out>/f%04d.png -c:v libx264 -pix_fmt yuv420p \
           -crf 20 -movflags +faststart gameplay-spine-4242.mp4

Plan, pasted next to the artifact as rule 2 requires: **150 frames, 15fps
output, 10.0s of video, 10.0s of game time on spine seed 4242.** State at frame
one was `playing`, wave 0, 3 towers, and zero console errors across the run.

    width=1280 height=720 pix_fmt=yuv420p r_frame_rate=15/1
    duration=10.000000 size=719878

A 4.04MB GIF was produced alongside it with the two-pass palette filter. Both
live OUTSIDE the repo, at `../media/`, per rule 5.

Caveat that has not changed: capture steps at 1/30 where the live loop steps at
1/60, so a captured battle reproduces run to run but is **not** the battle a
live client plays from that seed. Never quote it as balance evidence.

## Tier 3: generative motion on the cutscene plates. Proven, not adopted

The plugin rejected this for a 24GB floor against a 12GB card. This card has
24GB, so the premise changed and it was re-tested rather than re-litigated.

**The official Wan repo was not used.** It pins `flash_attn`, which has no
Windows wheel. ComfyUI 0.27.0 carries Wan 2.2 natively and needs none, so it is
the backend, driven headless over its HTTP API by `tools/plate_to_video.py`.
The ComfyUI install, its venv and the 16.90GB of weights all sit outside the
repo; only the driver script is in `tools/`.

**Measured across three faction palettes:**

| Number | Value |
|---|---|
| Per clip, 49 frames, 24fps, 1280x704 | **117 to 120s** |
| VRAM peak | **7.7 / 23.9 GiB**, 32% of the card |
| Output | 2.04s h264, 845KB to 1.15MB |
| Extrapolated, all 50 plates | about **100 minutes** |

**The art style survived, which was the real question.** A flat painted
illustration is exactly the input that generative video tends to melt into
photoreal mush. It did not. Human, Light and xeno plates all kept their flat
shapes, hard cel edges and faction palette, and the motion arrived as slow
camera drift plus light and dust. Frame RMS on the human plate ran 31.3
first-to-mid and 43.9 first-to-last, so the clip genuinely moved rather than
returning a frozen video, which is the other classic failure.

Seeds are FNV-1a per plate key, the same discipline as the image tier, so a
clip reproduces and a re-roll is deliberate.

## The decision this creates, and it is the owner's

The plates already move: `.cs-art.zoom` runs `csZoom` for 14s, scaling 1 to
1.07. So the question is not "motion versus none", it is **"a slow scale versus
real scene motion, at 4.5x the bytes per slide"**.

| Option | Per slide | All 50 | Costs |
|---|---|---|---|
| Today: still plate plus CSS Ken Burns | ~200KB | 9.83MB | nothing, it is shipped |
| Animated plate, 2s h264 | ~900KB | ~45MB | 100 min of GPU, and the weight |

Three ways to take it, in the order I would consider them:

1. **A few hero plates only.** The five `intro_1` slides are the first thing a
   player sees on a campaign. Five clips is ~4.5MB and 10 minutes of GPU, and
   it buys most of the impression for a tenth of the cost.
2. **All fifty, behind a quality setting.** Fetch video when the setting allows
   and the still otherwise. The on-demand loader already makes this cheap: both
   are just a URL in the same pack slot.
3. **Not at all.** The Ken Burns is not bad, and 45MB is a real cost on a phone.

`[ ]` **Owner decision. Nothing is shipped and nothing needs re-rendering
either way.** Three sample clips are at `../videogen/` for a look.
