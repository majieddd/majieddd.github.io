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
| Commander portraits | `cmd_<id>` | Painted bust, 320px. THE ILLUSTRATIVE REGISTER, section 10. One silhouette and one prop nobody else owns. Species per section 3. Regenerate ONLY wholesale. |
| Faction crests | `fac_<id>` | Strict monochrome, one hue on void black, rose-window geometry. |
| Enemy dossiers | `foe_<id>` | Greyscale plus ONE accent by allegiance. |
| World plates | `world_<mapId>` | Wide establishing scene, no foreground figures. |
| Holder variants | `world_<mapId>_<factionId>` | DERIVED in code (PIL duotone), never generated. |
| Planet cutscenes | `pcut_<si><wi>_<faction>_<beat>` | 1920x1080, 875 of them: five beats for each of 35 worlds for each of 5 powers. Catalogue in `artgen/planet_jobs.py`, copy in `js/planetcuts.js`. NEVER inlined into the bundle (build.js drops the class). Section 11. |
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

## 10. The illustrative register for figures (owner direction, Session 39)

The owner's note: the commander portraits read "too much on the side of
realism textures", and should carry "that art illustrative feel that we
reclaimed in the intro cutscenes."

**Diagnosed against the shipped art, not guessed.** Put a cutscene plate and a
commander bust side by side and the difference is construction, not subject.
The plates are built from flat interlocking shapes with heavy black shadow
masses doing the drawing. The busts came back with modelled skin, specular
highlights on the cheekbones, and soft airbrushed volume. Three causes, all of
them in the prompt:

1. the non-robot commander tail asked for **`shallow depth of field`**, which
   is a photographic lens term. It was requesting the exact thing the note
   objects to, on twenty-three of the twenty-eight;
2. the non-robot commanders were the **only figure class in the catalogue with
   no inking register**. `TROOP_REGISTER` gives the troops and the five machine
   commanders "inked cel shading, halftone screen-print, heavy black shadows";
   the other twenty-three received none of it, and the machine portraits were
   visibly the most illustrative of the class for precisely that reason;
3. `{STYLE}` says "bold flat expressive brushwork" and nothing else about
   construction, which does not survive contact with a human FACE. A face is
   the subject a diffusion model pulls hardest toward photography, so the
   counter-pressure has to be explicit and it has to be in front.

**The register now leads.** `CMD_REGISTER` in `artgen/krea_jobs.py` names the
construction rather than a mood, and `CMD_ANTIPHOTO` closes the prompt.

**AND THE PALETTE STILL OUTRANKS IT.** The first pass of this restyle led with
the register and left colour to the `{STYLE}` tail, which names a vaporwave
neon palette of magenta, cyan, violet and chrome. The register worked and
section 2 broke: a human commander came back magenta and teal, and the
Federation's supreme commander came back framed in violet. That is a rainbow
where a faction owns the frame, which section 1 lists as a Never.

The fix was to copy the composition the 50 cutscene plates already prove:
SUBJECT, then the faction palette clause, then the `{STYLE}` tail. Those plates
carry the same tail and still read blue for humanity and gold for the
Federation, because a NAMED palette sitting directly behind the subject
outranks a generic one sitting behind that. **A register change is not a licence
to move colour.** If a restyle costs faction identity, the restyle is wrong,
however good the linework got.

### 10.1 ASHTAR has an outside reference

He is the one commander whose likeness is answerable to something outside this
repository: he must read as the **Ashtar Sheran of the 1950s contactee record**,
because that is what a player finds when they search the name. That record is
consistent on the particulars: young and athletic rather than aged, light
silver-blond hair a little past the shoulders, deep blue eyes, tall, and an
elegantly tailored high-collared uniform, white and ivory dominant, carrying
decorations. The portrait that shipped before Session 39 was an elderly grey
figure in ornate gold plate: wrong on age, hair and dress at once.

Ivory and white with gold decoration is ALSO the Federation's own palette
(section 3.2), so the outside reference and the faction identity ask for the
same picture and nothing is traded away.

## 11. The planet cutscenes (owner direction, Session 39)

Deploying to a world used to open on three beats whose middle beat was the
world plate **with a hue applied in code**, the `world_<map>_<faction>` PIL
duotone. The owner's note names it exactly: "I don't want just one picture and
then you change the hue. I really want to make sure that each and every single
cutscene that is generated and made is truly unique."

So there are now 875 separately generated plates: five beats, for each of 35
worlds, for each of 5 powers.

| Beat | Key suffix | Subject | Shown |
|---|---|---|---|
| APPROACH | `_1` | your fleet arriving over this world | on deploy |
| THE GROUND | `_2` | your force making landfall at this world's site | on deploy |
| THE ASSAULT | `_3` | your force against this world's own defence works | on deploy |
| AFTERMATH | `_4` | that same site once you have taken it | on a win, 1+ star |
| NEW ORDER | `_5` | what your banner turns this world into | on a win, 1+ star |

**The defender is never drawn.** The obvious composition for beat 3 is your
force against the HOLDER's force, and it is wrong here: a world's `owner` is
the system holder for a seat and a 20% per-seed raider squat otherwise
(js/galaxy.js), so at render time the defending faction is a PRNG roll this
catalogue cannot see. Drawing a Compact defender onto a world a pirate squat
happens to hold would be the art promising a battle the engine refuses. Every
world instead carries its own DEFENCE WORKS, which are a property of the place
and true whoever is standing on them. The live holder is named in the TEXT,
which is read off the world at play time and is therefore always right.

**Keys are the universe coordinate `<si><wi>`, never the map id.** `map` is
drawn from `rnd()` and re-rolls per seed; `(si, wi)` is fixed for the one
universe. `artgen/planet_jobs.py` and `js/planetcuts.js` key the same way, and
`tools/probe-s39.js` asserts the authored names against `GX_HOME_SYSTEMS`.

**The class is dropped from the single-file bundle, not inlined.** At roughly
200KB a plate the class is about 175MB, which base64 inflates by a further
third, against a bundle that is 22MB. `build.js` strips it and
`js/cutscenes.js` falls back through a slide's `alt` key to the world plate,
which is a picture of the same world rather than a faction crest. The live
site fetches all 875 from `art/` on demand.

**The writing.** Beats 2 and 3 describe the PLACE and are authored once per
world, because a mirror farm is a mirror farm from every side and five versions
of that sentence would be five chances to contradict ourselves. Beats 1, 4 and
5 are authored per world per faction, in that faction's own register, because
they are the only beats about the reader rather than the ground. 525 faction
lines, and the probe asserts no two of them are the same string.

**The commander interaction on the outro** is the exchange the result screen
already carries (`victoryExchangeHtml`, seeded from the pair's own canon in
js/dialogue.js). The outro adds the two pictures and does not grow a second
commander surface, for the same reason the deploy sequence hands beat four to
the existing VS screen: a second opinion about what two commanders say to each
other is a bug waiting to be found.

## 12. What the tooling can and cannot do (measured, Session 39)

**Adobe Firefly is not reachable from the Claude connector.** Checked
exhaustively rather than assumed, because the owner had enabled the connector
specifically to generate art faster. The Adobe MCP surface exposes
Photoshop-style EDITING only: masks, exposure, HSL, grain, crop, plus
`image_generative_expand` (outpainting an image that already exists) and
Firefly *Boards* (which assembles a board from assets that already exist).
Several of the tool descriptions say it outright, that generative editing is
not currently available and the tools must not be used for generative
requests. There is no text-to-image and no text-to-video endpoint. Unlimited
Firefly generation in the web app does not translate into an API this pipeline
can call. **Do not re-investigate this without first re-reading the tool list;
if a Firefly image-generation tool ever appears there, that is the signal, not
a hunch.**

The Adobe tools that ARE worth reaching for, all of them operating on art this
pipeline has already produced: `image_remove_background`, `image_vectorize`
(crest and emblem work), `image_generative_expand` (widening a plate to a new
aspect without a re-roll), and the font tools.

**Local render throughput, this machine (RTX 5090 Laptop, 24GB).** Measured by
file mtimes across a full class, not quoted from a previous session:

| Class | Size | Measured |
|---|---|---|
| `cmd` portrait | 1024 gen, 320 out, square | **26.5s each**, 28 in the class |
| `pcut` plate | 1024 gen, 1920 out, wide | **47.5s each**, 875 in the class, about 11.5h |

Of that 47.5s, **4.50s is the CPU text encode** (bf16; fp32 measures 5.03s, so
bf16 is already right) and the rest is 8 denoise steps plus a tiled VAE decode
on the card.

**THE CARD IS ALREADY SATURATED. Do not go looking for a batching win.** Under
load it reports **174.23W of a 175.00W limit, 2392MHz, 100% utilisation, 80C,
and "SW Power Cap: Active"**. It is compute-bound against a hard power ceiling,
so a larger batch buys nothing, and the 10GiB of unused VRAM is not headroom
that can be spent on speed. The only saving left is overlapping the 4.5s encode
of plate N+1 with the denoise of plate N, worth about 9%.

**And a measurement trap worth more than the measurement.** Six consecutive
`nvidia-smi` calls during that same run returned 33% utilisation at 20.6W and
1005MHz, which reads exactly like a starved GPU and sent this investigation
down a wrong path for twenty minutes. All six landed inside the same 4.5s
CPU-encode window between plates: the calls are fast, the phase is periodic,
and they aliased onto it. **Sample a periodic workload over more than one
phase, and read `power.draw` and `pstate` before concluding a GPU is idle.**
`utilization.gpu` alone lies about any pipeline that alternates devices.

Model load is roughly two to three minutes before the first image, which is why
a class of 28 takes about fifteen minutes rather than twelve. **Time ONE image
before any batch.** A per-image figure inferred from a whole run INCLUDING load
reads about twice the true cost: that happened once in Session 39 and briefly
made an eleven-hour job look like a twenty-nine-hour one.
