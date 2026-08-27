# COSMIC CONQUEST ART BIBLE

The one document a collaborator reads before making art for this game. It
consolidates the style law (BRAND.md), the portrait anatomy (LOOKBOOK.md), the
content law (the owner's direction of 2026-08-27), and the pipeline that turns
a prompt into a shipped, verified asset. Where this file and an older doc
disagree, this file wins and the older doc has a bug: report it.

*The style is locked. The content is directed. The pipeline is measured.*

---

## 1. The style, in one paragraph (LOCKED)

**Neon Reliquary.** A painted game-cutscene illustration in the construction
language of *Tyranny* (Obsidian, 2016): figures and scenes built from flat
interlocking shapes, the drawing carried by heavy black shadow masses rather
than by rendering, subjects readable as silhouette before they are readable as
detail. Inked and printed like a **cyberpunk comic**: hard cel edges, spot
blacks, screen-print grain, engraved gothic linework used as TEXTURE (filigree,
rose-window geometry), never as period costume. Colour is faction identity
first and everything else second.

Never: photorealism, airbrushed soft rendering, a busy background that eats the
silhouette, lettering of any kind in the art, a rainbow where a faction owns
the frame.

The owner has approved this style in shipped work. Do not reinterpret it. The
rest of this file is about WHAT gets drawn inside it.

## 2. Colour is identity (LOCKED)

| Token | Hex | Owner |
|---|---|---|
| Void black | `#0a0e17` | every background ground |
| Neon cyan | `#38e8ff` | HUMANITY |
| Steel blue | with cyan | human scenes, cold competent industry |
| Radiant gold | `#fbbf24` | FEDERATION OF LIGHT |
| Xeno violet | `#7c3aed` | THE XENO |
| Raider crimson | `#ef4444` | THE PIRATES |
| Chrome + pale teal | `#94a3b8` range | THE PARALLEL (machines) |
| Neon magenta | `#ff2fd6` | vaporwave key light, skies, accents |

Faction colour dominates to the point of monochrome in anything a faction
owns. Rival colours never share a frame. A scene must read as its faction in
the first half second, before the text is read. This rule has already beaten
resolution in a measured trade (BRAND.md, the cutscene section): when a
supersample bought linework but let magenta displace the human steel blue, the
supersample lost.

## 3. THE CONTENT LAW (owner direction, 2026-08-27)

The style above says HOW to draw. This section says WHAT. The reference
universe for technological restraint is **DUNE**: familiar, functional,
grounded hardware and dress, adapted through our illustration language. Not
chrome-and-hologram futurism.

### 3.1 Humanity: the modern look

- **People:** contemporary and near-contemporary. Flight suits, launch-and-
  entry suits, EVA hardware, tactical gear, engineer workwear, weathered
  officers. Armor is practical plate over fabric, load-bearing rigs, sealed
  suits: what a person in a grounded sci-fi production would actually wear.
  PULL BACK from anything reading medieval: no gothic plate, no pauldrons for
  their own sake, no robes-as-armour.
- **Ships and hardware:** "spaceships that humans today use." Capsules,
  boosters, station modules, solar arrays, launch gantries, mission-patch
  culture. A human fleet reads like a crewed space program scaled up in a
  hurry, not like a navy from 3000 AD. Weld seams, thermal blankets, reaction
  thrusters, antennas.
- **The register:** cold competent industry. Blue-dominant, warm highlights.

### 3.2 The Federation of Light: the contact species

The Federation is a multi-species alliance (the lore bible's Species and
Ontologies section is canon). Its people are the benevolent contact archetypes
from the research record:

| Archetype | Reads as | Use for |
|---|---|---|
| **Pleiadians** | luminous near-human, serene, radiant | commanders, envoys |
| **Nordics** | tall, ageless, calm contact bodies | diplomats, ASHTAR's office |
| **Arcturians** | slender blue-toned beings of poise and light | choral, mystic roles |
| Tall Greys | fragile, large-eyed, gentle | archivists, observers |
| Federation Mantids | eusocial, precise, coordinated | wardens, planners |
| Federation Reptiloids | armoured citizens (morphology is not politics) | bulwarks, soldiers |
| Avian lineages | crested heralds | voices, criers |

Gold and ivory dominant, warm holy light. Vestments and hard-light regalia are
fine: the Federation is a cathedral culture. It is the one faction where
ceremony in dress is CORRECT, and even there it is ceremonial hard-light, not
medieval steel.

### 3.3 The Xeno: scarier

The Compact powers read predatory, wet, and wrong. Chitin, membrane, too many
joints, eyes where they should not be, biomechanical growth that was never
designed, only accumulated. Beauty is allowed (iridescence on the carapace)
but it is the beauty of a wasp. Violet dominant with magenta as emitted light
from inside the body. When in doubt, make it read like the audience should not
turn their back on it.

### 3.4 The Pirates: a mixed fleet and a mixed crew

- **Ships:** the space-galleon idea is approved and stays, AND it is one kind
  among several. Show variety: patchwork galleons, gutted freighters flying
  rigging, asteroid-hopper skiffs, converted tankers, ramshackle carriers
  strung with lights. A pirate armada should look like no two ships came from
  the same yard, because they did not.
- **Crews:** never all human. Humanoid and non-humanoid together: reptiloid
  reavers, Grey scrappers, mantid gunners, amorphous things in pressure rigs,
  and humans among them. Crimson and rust dominant, scavenged material
  everywhere.

### 3.5 The Parallel: unchanged

Chrome and pale teal, cold white light, machines tending a garden for a maker
who is not coming back. The redraft language (a machine restatement of an
organic silhouette, minus the thing that made it alive) is approved and stays.

## 4. Treatment by asset class

| Class | Keys | Treatment |
|---|---|---|
| Commander portraits | `cmd_<id>` | Painted bust, 320px, duotone or monochrome per LOOKBOOK.md. One silhouette and one prop nobody else owns. Species per section 3. Regenerate ONLY wholesale. |
| Faction crests | `fac_<id>` | Strict monochrome, one hue on void black, rose-window geometry. |
| Enemy dossiers | `foe_<id>` | Greyscale plus ONE accent by allegiance. |
| World plates | `world_<mapId>` | Wide establishing scene, no foreground figures. |
| Holder variants | `world_<mapId>_<factionId>` | DERIVED in code (PIL duotone), never generated. |
| Cutscene plates | `cut_<faction>_...` | 1920x1080 wide story beat, faction palette dominant, figures allowed, no text ever. WebP q82. Render in band: no supersampling this class (measured, BRAND.md). |
| Animated plates | `art/<key>.mp4` beside the still | LIVING PORTRAITURE, section 7. |
| Key art | `title`, `nebula` | Full-palette cinematic. |

## 5. Prompt anatomy

Clause order is load-bearing: **PALETTE, REGISTER, SUBJECT, MATERIAL, FRAME.**
On the SDXL fallback path CLIP truncates at 77 tokens and the negative prompt
is inert at guidance 0, so what must survive goes first. The Krea path has no
77-token cliff but shares the same catalogue, so the order holds everywhere.

Rules bought with measured failures (BRAND.md has the receipts):

1. Palette words are MEASURED, not chosen. `radiant gold` works. `xeno violet`
   and invented brand names are dead tokens: use plain high-frequency words.
2. `comic` not `comic book` (the long form pulls panel borders and lettering).
3. Where an exact hue is REQUIRED, stop prompting and tint in code.
4. Seeds are FNV-1a of the asset key. Same key, same image, every run. A
   re-roll is `--force <key>`, never a prompt edit on approved art.
5. Editing a prompt re-rolls the owner's approved art. Prompt content changes
   happen only under an owner directive (like the section 3 law) and re-render
   the class WHOLESALE.

## 6. The pipeline runbook

Two renderers, one catalogue, one pack. `artgen/krea_jobs.py` `build_jobs()`
is the single source of truth: `(key, prompt, gen_px, out_px, aspect)`.

| Step | Command | Notes |
|---|---|---|
| Baseline render (fast, CPU-poor cards) | `python artgen/sdxl_all.py` | SDXL-Turbo into `artgen/cache/`, ~seconds per image |
| Quality render | `python artgen/krea_gen.py --only <prefix>` | Krea 2 Turbo into `artgen/cache_krea/`, preferred per key. 48s per 1920x1080 wide plate, 24s per portrait on the 5090 |
| Restore caches on a fresh clone | `python artgen/unpack.py` | Rebuilds `cache/` from the shipped pack, byte-lossless |
| Pack | `python artgen/krea_gen.py --pack` | Writes `js/artpack.js` (inline) + `art/` (on-demand `cut` class) + `ARTVID` map for clips found beside stills |
| Bundle | `node build.js` | Inlines on-demand art back into the single-file download |
| Verify | `node tools/gate.js <url>` | GATE CLEAN or it does not ship |

Hardware law lives in the aegis plugin (`aegis-gamedev/references/
media-image.md` sections 12 and 13): 85% VRAM headroom, time ONE image before
any batch, supersample only where art direction allows (never the `cut`
class), never upscale in the packer.

Environment on Hermes (RTX 5090): `D:\ClaudeProjects\RemoteWorkspace\
artgen-env` (torch cu128), weights at `TowerDefense/artgen/krea2-turbo`
(33GB, already downloaded, do not re-fetch).

## 7. Motion: living portraiture (owner direction, 2026-08-27)

Animated plates exist to make a painting feel ALIVE, not to make a movie.

- **Subtle.** Glow that breathes, lines that shimmer as if lit from within,
  dust and light drifting. The ILLUSION of movement: nothing travels, nothing
  changes position, nothing is trippy. "A living portraiture."
- **Perfect loops.** The viewer must not be able to tell where the loop
  closes. Build loops by CROSSFADING the tail into the head. NEVER reverse
  playback: the ping-pong rewind shipped once and the owner rejected it.
- **Small.** Clips ship at 1280x704 h264 crf 26, hundreds of KB each, and are
  refused automatically under reduced-motion and data-saver. The still plate
  is always the poster and always the fallback.
- Generator: `tools/plate_to_video.py` (Wan 2.2 TI2V-5B through local
  ComfyUI), with `--loop-fade 24` for the seamless close. Prompt the MOTION
  only; the image already carries the scene. The negative prompt is LIVE on
  this path (guidance is not zero).
- **Prompt the stillness as hard as the motion.** Measured on the first
  living-portraiture pass: asked for breathing glow, the model still swirled
  a nebula (drift 35.95 RMS) and made background figures change pose
  (16.50). The accepted takes carry explicit clauses like "completely static
  and never changes shape", "never changes pose", "no swirling", and landed
  at 4 to 17 drift with all motion in brightness. The model would rather
  animate the scene than the light; do not let it.

## 8. Verification, always

- Decode in a browser, never by reading the pack. `naturalWidth` on the live
  element, zero console errors.
- `node tools/gate.js` must print GATE CLEAN before any push.
- No em dash anywhere, `node tools/emdash.js` enforces.
- Every video artifact ships with its ffprobe line.
- The pack passthrough must report 0 re-encoded for untouched classes.

## 9. The direction board

`docs/brand-board/` holds rendered examples of the section 3 content law in
the locked style: modern human spacecraft, pirate fleet variety, Dune-grounded
armor, Federation species, scarier xeno. They are REFERENCE, not shipped
assets: they exist so "what to draw" is shown, not argued about. Regenerate
with `python artgen/board.py` (seeded, reproducible).
