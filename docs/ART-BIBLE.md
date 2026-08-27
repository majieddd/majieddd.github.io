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
| Ingest art painted elsewhere | `python artgen/ingest_art.py --todo <prefix>` then `--from <folder>` | Web-app or hand-made plates into `cache_krea/`, same `fit()`+quality as any painter. Refuses to upscale. Section 14 |
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

### 11.1 A beat that must show ACTION needs action nouns, not an action verb

Measured once SOL had rendered, by building `tools/review_sheet.py` and looking
at beat 3 across six world/faction pairs. **Only one of the six showed combat.**
The rest showed troopers WALKING past solar arrays, a Federation PROCESSION
down a canyon, automata MARCHING in formation, and a xeno walker STANDING on a
beach. The beat whose entire job is the moment of the attack was delivering a
second establishing shot, and on VENUS beats 2 and 3 came back as nearly the
same picture, which is the uniqueness failure this feature exists to prevent.

The template was `{force} assaulting {works}, at {site}. Wide cinematic
composition, the moment of the attack`. Three faults, and they compound:

1. **`assaulting` is one weak participle between two long noun phrases**, and
   the noun phrases win. This is the same law as the lettering fix in BRAND.md
   section 5 of the Session 39 amendment: the model weighs NOUNS. A verb asking
   for violence loses to forty tokens of scenery describing calm.
2. **It repeated the full `{site}` clause that beat 2 already carries**, giving
   the model a strong establishing-shot prior and two near-identical prompts.
3. **`Wide cinematic composition` asks for the static wide shot it produced.**
   The words fighting for action were outnumbered and outweighted.

The rewrite leads with the action, names combat with CONCRETE NOUNS (muzzle
flashes, blasts, smoke, debris thrown through the air, figures in violent
motion), moves the location AFTER the fight, and asks for a close dynamic low
angle instead of a wide one. Re-rendered and confirmed on both a human and a
Federation plate: charging troopers with weapons firing, and wardens in close
melee, both still legibly on their own world and in their own palette.

**The general rule.** If a beat must depict an EVENT rather than a PLACE, the
prompt has to be built out of the event's nouns and has to ask for a camera
that implies motion. Naming the event once as a verb and then describing the
scenery is a request for the scenery.

**And the instrument matters as much as the fix.** This was invisible on a bare
contact sheet, where every plate looks like competent art. It only became
obvious with `tools/review_sheet.py`, which puts the plate, the prompt subject
it was ASKED for, and the sentence the player READS side by side. Three failure
modes that need three different responses: the render missed the prompt (a
re-roll), the prompt missed the writing (a catalogue edit), or the writing is
wrong for the beat (a rewrite). Tell them apart before acting.

### 11.2 The colour law is measured now, and beat 1 is scored differently

`tools/brand_audit.py` reads every plate and reports its saturation-weighted
dominant hue, the share of coloured pixels inside the band its power owns, mean
saturation and mean luminance, then flags anything outside the section 2 bands.
The Parallel is judged on a saturation CEILING rather than a hue band, because
its identity is that it owns no hue and a hue test on it would mean nothing.

It exists because eye does not scale to 875 plates, and because
`artgen/firefly_gen.py` now writes into the same cache as `krea_gen.py`: a
hosted model drifting from the locked look would be invisible by filename. Run
it before any repack of the `pcut` class.

**BEAT 1 PASSES ON PRESENCE, NOT DOMINANCE, AND THAT IS NOT LENIENCY.** The
first version applied hue dominance to all five beats and reported APPROACH at
64.2% against 91 to 94% everywhere else. The prompt was rewritten to bring the
fleet close and give it its own running lights, which helped a great deal, and
some plates still measured off band. Looking at one rather than at its number
settled it: VENUS/pirate scores hue 50 at 0.05 purity while showing enormous
crimson-lit galleons filling the foreground, and it reads as a pirate armada
instantly. The pixel-count winner is the sulphur-yellow cloud deck, because
that is what Venus IS.

The threshold was wrong, not the plate. Beats 2 to 5 are ON the ground, where
the faction's forces, marks and lighting fill the frame and hue dominance is
the right test. Beat 1 is an ORBITAL shot where the planet legitimately owns
most of the frame, and section 1 already says subjects are readable as
SILHOUETTE before they are readable as detail. A pirate galleon is a pirate
galleon against any sky.

**The worlds where this trade always bites** are the ones with a strong colour
of their own: VENUS (sulphur yellow), TITAN (orange haze), ELECTRA and the
Pleiades generally (blue nebulosity). On those, a power whose hue fights the
world will not win the pixel count and is not meant to. Forcing it would mean
repainting Venus, which trades a real identity for a measured one. **Do not
"fix" these by re-rolling; check the silhouette instead.**

**THE METRIC WAS RE-CALIBRATED THREE TIMES AND THE SCORE ROSE EVERY TIME**, from
86.9% to 92.6% to 97.8% to 98.2%. That is exactly what tuning a number to
flatter yourself looks like from outside, so here is the full account and the
proof.

Each change was made after LOOKING at a plate and finding the metric wrong, not
the art:

1. **beat 1 scores on presence, not dominance**, because VENUS/pirate reads as
   a pirate armada instantly while the sulphur-yellow cloud deck wins the pixel
   count;
2. **concentration replaced the dominant hue bin**, because 16 of 19 xeno
   failures sat ONE 10-degree bin below a floor drawn exactly on the brand
   token (`#7c3aed` is hue 262), while carrying 47 to 70 per cent of their
   colour inside the band. They were violet plates being misreported;
3. **the Parallel moved from a saturation ceiling to CHROME MASS**, because
   TITAN/robot and MARS/robot were flagged for standing on an orange sky and a
   red regolith while the automata themselves were correctly colourless. A
   whole-frame ceiling punishes the one power with no colour for campaigning
   across coloured worlds, which it must do.

Concentration is `share of colour inside the band / (band width / 360)`, so it
self-corrects for band width: the Federation owns 30 degrees and the pirates
45, and the same raw purity means very different things to them. The gate is
twice chance.

**And the loosened gates are PROVEN to still bite.**
`tools/brand_audit_mutants.py` takes four plates that pass, breaks each one
deliberately, and requires the audit to reject all four. Federation gold
rotated to blue goes 11.21 to 0.13, human cyan rotated to red 5.05 to 0.99,
pirate crimson rotated to teal 2.49 to 0.03, Parallel chrome saturated into
colour 0.32 to 0.00. **4 caught, 0 missed.** Run it whenever a threshold in
brand_audit.py moves; a gate that only ever passes has demonstrated nothing.

Note what was NOT solved by moving a threshold: the two real faults this audit
found, the assault beat not showing assaults and the approach beat losing the
faction to the world, were both fixed IN THE ART and re-rendered.

Standing at the last full run, 455 plates: **98.2% read as their own power**,
human and Federation at 100%, all at 1920x1080 with no dimension drift across
painters. The eight remaining outliers are three world-colour trades (Venus,
Titan), three sitting just under the gate at 1.59 to 1.69, one magenta drift
and one marginal chrome mass. None is a gross violation and none should be
re-rolled without looking first.

## 12. What the tooling can and cannot do (measured, Session 39)

**Adobe Firefly Services IS reachable, through its REST API, and is now the
FIRST tier to try.** See section 13. What follows is about the MCP CONNECTOR,
which is a different mechanism and remains editing-only.

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

**And re-reading the tool list needs the connector AUTHENTICATED, which a
non-interactive session cannot do.** Checked again on owner request, Session
39. The Adobe connector is real and has connected before: it is listed under
`claudeAiMcpEverConnected` in `~/.claude.json` as "claude.ai Adobe for
creativity". But it is a claude.ai ACCOUNT connector, not a local MCP server
entry, and in a non-interactive session it arrives unauthenticated: the
session reports that it needs authorization, no OAuth flow can run, and its
tools therefore never load at all. A tool search for adobe, firefly, image
generation and photoshop returns nothing.

So this session could not confirm OR refute the editing-only finding above,
and said so rather than repeating it as though it had been re-checked. To
actually re-read the list: authorize the connector in an INTERACTIVE session
(claude.ai connector settings, or `/mcp`), then search the tool list there.

**Even authorized, the connector is the wrong shape for this pipeline.** A
chat connector returns an image into a conversation. This pipeline needs a
1920x1080 RGB WEBP written into `artgen/cache_krea/<key>.webp` at a specific
quality, seeded by key, 875 of them for the planet class alone. Hand-saving
attachments does not scale to a class and cannot be reproduced from a seed.
That is what section 13's REST API path is for, and it is why the connector
would be a convenience even in the best case, never the pipeline.

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

### 12.1 The complete generation inventory on this machine

Asked directly by the owner: is anything being missed that would generate art
faster or more on-brand? Surveyed rather than guessed, and the answer is no.

| Capability | What runs it | Where | Cost |
|---|---|---|---|
| Images, shipping tier | Krea 2 Turbo, 4-bit NF4 | `artgen/krea2-turbo` (34GB) | 47.5s per 1920x1080, 26.5s per 320px |
| Images, draft tier | SDXL-Turbo | `artgen/` | about 4.5s each |
| Video from image | Wan 2.2 TI2V-5B via local ComfyUI | `comfy-models/split_files` | the five living-portraiture clips |
| Speech | kokoro-onnx | the isolated `voicegen` env | 2.9s for 7.5s of 24kHz |
| Gameplay capture | `tools/capture.js` into `tools/headless.js` | deterministic, ffmpeg encode |

Adobe adds editing only (section 12 above). The only other MCP server
configured on this machine is unrelated to media. There is no unused
generation capability sitting here.

**And a hosted image API would COST us something the local path gives free.**
The brand consistency in this project does not come from the model. It comes
from `build_jobs()` being a single catalogue, from the shared `{STYLE}` spine,
and above all from the FNV-1a seed over the asset key, which is what makes
"same key, same image, every run" true and makes a re-render a RESTORE rather
than a re-roll. That property is what let the commander class be re-rendered
wholesale twice in one session without losing the twenty-eight approved
pictures. A hosted endpoint that does not accept a seed, or that changes its
model under you, breaks it silently.

**If more speed is genuinely wanted, the honest levers are two, and neither is
batching:** a desktop card without this laptop's 175W ceiling, or fewer denoise
steps than the distillation schedule's 8, which is a quality trade and an
art-direction call rather than an optimisation.

## 13. Firefly Services: the cloud tier (licence-blocked)

> **STATUS, 2026-08-27: LICENCE-BLOCKED, NOT BROKEN.** Everything in this
> section is built and its plumbing is verified, but the owner's Adobe plan
> does not include Firefly **Services** API access: that is an Enterprise
> entitlement, separate from a Firefly subscription, and the credentials
> cannot be created without it. `firefly_gen.py` therefore cannot run today.
> It is kept, not deleted, because the day the entitlement exists it is one
> `--check` away from working. **The unlimited generation the owner DOES have
> is in the Firefly web app, which has no API at all**, section 14 is the
> bridge that makes those generations usable by this pipeline.


ONE CATALOGUE, THREE PAINTERS. `krea_jobs.build_jobs()` is still the single
source of truth for every key, prompt and size. `artgen/firefly_gen.py` is a
third renderer consuming it, beside `sdxl_all.py` and `krea_gen.py`, writing
the SAME cache in the SAME shape: `krea_gen.py --pack` cannot tell which
painter produced a plate, and does not need to.

**Why it goes first.** The local Krea tier measures ~48s per 1920x1080 plate
and is GPU-bound. Firefly is network-bound. They contend for nothing, so they
run AT THE SAME TIME and a class can be split between them: give Firefly the
prefix, give the card the rest, and both write into `cache_krea/` by key.
Each skips a key that already exists and writes through a temp file plus an
atomic rename, so running both at once is safe by construction rather than by
scheduling.

**This is not the connector.** Section 12 records the Adobe MCP surface as
editing-only, with no text-to-image, and that finding stands. This is the
Firefly Services REST API with OAuth server-to-server credentials, a different
mechanism with a different premise. Do not collapse the two.

### Credentials, once

The script stores nothing. Create them at <https://developer.adobe.com/console>:
new project, **Add API**, **Firefly - Firefly Services**, **OAuth
Server-to-Server**, choose the product profiles, save. Then copy the Client ID
and the Client Secret and put them in the environment:

```bash
export FIREFLY_CLIENT_ID=...
export FIREFLY_CLIENT_SECRET=...
python artgen/firefly_gen.py --check      # authenticates, generates nothing
```

Tokens last 24 hours and are cached in `artgen/.firefly_token.json`
(gitignored), so a batch authenticates once rather than once per plate.

### The runbook

```bash
python artgen/firefly_gen.py --only cut_ --limit 2    # trial, ALWAYS first
python artgen/firefly_gen.py --only cut_              # the class
python artgen/firefly_gen.py --force cut_light_sys3 --variant 1   # re-roll one
python artgen/krea_gen.py --pack                      # same pack step as ever
```

### Two things that are NOT negotiable here

**Supersample down, never up.** Firefly v3 renders a fixed set of sizes; the
widest landscape is **2688x1536**, and every wide plate delivers at 1920x1080.
So generation is a 1.4x supersample that `fit()` LANCZOS-resamples down, which
is the same direction section 13 of the plugin's image law requires and the
same `fit()` the local painters use. No wide plate is generated at its
delivery size.

**The seed is still FNV-1a of the key.** `_seed_v(key, variant)` is shared with
`krea_gen.py`, so a key is reproducible on this painter too and a re-roll is
deliberate. Variant 0 is the shipped seed on every painter.

### What will refuse, and what to do about it

Firefly enforces a content policy, and this catalogue is full of devouring
maws, burning fields and predators. A refusal is DATA: the script names the key
and carries on, then prints the refused list at the end. **Those keys go to the
local tier**, which has no such policy. That is the division of labour, not a
failure: cloud for volume, local for whatever the cloud will not paint.

### What is UNPROVEN, and must be measured before trusting

Everything above is the plumbing, and the plumbing is verified: both endpoints
answer from this machine, the auth path surfaces Adobe's own refusal rather
than crashing, and a synthetic 2688x1536 response lands in the cache as a
1920x1080 RGB WEBP that `--pack` passes through untouched.

**Not verified: whether Firefly can paint THIS house style.** Nobody has run a
plate through it. Firefly has a strong look of its own and the style spine in
section 1 is specific. Before adopting it for a class, render two plates, put
them beside their local siblings, and judge. If the style does not hold, this
tier is for classes where it does not matter, or it is not for this project.

## 14. Ingesting art this pipeline did not generate

**The gap this closes.** Section 13's REST API needs an entitlement the owner
does not have. The unlimited generation the owner *does* have lives in the
Firefly **web app**, which offers no API, so those generations were
unreachable from here, not because of a technical limit but because a
downloaded PNG is not a cache entry. The cache wants a specific size, a
specific quality per class, and a specific filename.

`artgen/ingest_art.py` is that last mile and nothing more. It runs the same
three steps every painter in this project runs, `fit()`, then
`quality_for()`, then `cache_krea/<key>.webp`, against images produced
elsewhere, so `krea_gen.py --pack` cannot tell the difference and does not
need to. It is deliberately **generator-agnostic**: Firefly today, anything
tomorrow, including a phone photo if a plate ever wants one.

```bash
# 1. What still needs painting, and the exact prompt for each
python artgen/ingest_art.py --todo pcut_ > prompts.txt

# 2. Generate in the web app. Download. Name each file <key>.png
#    into one folder. .png .jpg .jpeg .webp all accepted.

# 3. Bring them in
python artgen/ingest_art.py --from ~/Downloads/plates --dry-run   # report only
python artgen/ingest_art.py --from ~/Downloads/plates
python artgen/krea_gen.py --pack                                  # as ever
```

`--todo PREFIX` prints one block per uncached key: the filename to save as,
the target pixel size, and the full catalogue prompt to paste. It is written
to be piped to a file and worked through, not read on screen.

### The three rules it enforces

**It refuses to upscale.** `fit()` will happily enlarge a small source, and
the result costs full bytes for detail that was never there. A source smaller
than its target is REFUSED and named, not silently inflated. This is the same
law the render tiers follow (plugin image law, section 13); the only
difference is that here the source came from somebody else. **Generate wider
than the target wherever the generator allows it**, downsampling is free
antialiasing.

**A filename is a key, not a label.** A file whose stem is not in
`build_jobs()` is reported as unknown rather than guessed at. There is no
fuzzy matching, because a plate silently landing on the wrong key is a defect
that surfaces months later in a cutscene nobody was looking at.

**A cached key is left alone** unless `--overwrite` says otherwise, and every
write goes through a temp file plus an atomic rename, the same discipline the
other painters use, because a local render may be working the same cache at
the same time and a half-written file is indistinguishable from a finished one
to whoever looks next.

### What is unproven here

The same caveat section 13 ends on applies, and for the same reason: **nobody
has yet put a Firefly-painted plate beside its local sibling and judged
whether the house style holds.** The mechanism is verified end to end, a
2688x1536 source lands as a 1920x1080 RGB WEBP that `--pack` passes through
untouched, a 1280x720 source is refused, a non-key filename is reported. The
*art* is not verified. Render two, compare, then decide.

## 15. Hosted painters: what "unlimited" actually means (researched 2026-08-27)

The owner asked for a hosted API with unlimited monthly generation, having
seen Higgsfield advertise it. The word is doing a lot of work in this market,
and it fails in three distinct ways. **The failure mode matters more than the
price**, because two of the three are the same trap Firefly sprang.

| Provider | Price | Unlimited? | Reachable from a script? |
|---|---|---|---|
| **ModelsLab** | $149/mo | **Yes, genuinely.** No per-image charge, no daily cap, all models | **Yes.** Key-auth REST, same shape as our painters |
| **Leonardo** | $30 Artisan / $48 Maestro | Only "relaxed" generation, **and not through the API** | Yes, but **pay-as-you-go, billed separately from the subscription** |
| **Scenario** | $15 / $45 / $75 | No. Credit allowance, resets monthly | Yes, API-first, built for game pipelines |
| **Higgsfield** | $39 Plus | 365-day unlimited **image** models (not 7-day, and not video) | **Unconfirmed, likely app-only** |
| **Segmind** | $39-$599 | No. Credits, despite the marketing word | Unlimited only via hourly GPU rental |

### The trap, stated once

**Unlimited generation in a web app is not unlimited generation in an API.**
Firefly taught this the expensive way (section 13), Higgsfield looks identical
in shape, and Leonardo is a subtler version: the unlimited tier and the API
tier are the same company selling two different products, and the generous one
is not the scriptable one. **Before adopting any provider, confirm the
unlimited claim and the API claim refer to the same product.**

### Where each one actually fits

**ModelsLab** is the only true flat-rate scriptable option found, and $149/mo
against 875 planet plates plus textures is cheap next to per-image billing.
Trustpilot sits at 2.5/5 with reports of undocumented error responses, so it
is a trial-first candidate, not a commitment.

**Leonardo** gives every new API account **$5 of non-expiring free credit**,
which is the cheapest honest way to answer the style question. Use the free
credit for the trial regardless of who wins.

**Scenario is the one to take seriously for gameplay assets**, and for a
reason none of the others address: it trains a **custom model on your own
art**, 10-30 images for a style. This project's whole problem is holding one
locked house style across hundreds of assets, and a fine-tune is the only
mechanism here that solves that structurally rather than by prompt-stuffing.
It also emits PBR-textured meshes and is built API-first for Unity/Unreal.
Its credit ceiling is the cost of that.

### Textures are a different problem, and general painters are bad at it

A game texture must be **seamless, tileable, and PBR-complete** (base colour,
normal, roughness, metallic, height). Providers that achieve real seamlessness
train on tileable datasets so the result is continuous by construction; the
rest blend edges afterwards and it shows under repetition. Tools named as
current: 3D AI Studio, Prodia, Scenario, Polycam. **This catalogue has no
texture class at all today** -- `build_jobs()` is cmd/fac/world/foe/planet/
abil/twr/cut/pcut -- so adding one is new work, not a re-render.

### The trial harness

`artgen/api_trial.py` answers the only question that matters before adopting
anyone: **can this provider paint the house style.**

```bash
export LEONARDO_API_KEY=...        # or MODELSLAB_API_KEY
python artgen/api_trial.py --check
python artgen/api_trial.py --provider leonardo --keys cut_human_sys1,cut_xeno_sys1
python artgen/api_trial.py --provider leonardo --texture rock,hull_plating
```

**It writes to `docs/api-trial/`, never to the cache.** Its output is evidence,
not art, and trialling a key that already has shipped art is the point: the
local plate is the thing to hold the candidate against. It appends the section
1 style spine to catalogue prompts so a provider is judged on this project's
terms, uses a separate flat-swatch prompt plus the tiling flag for textures
because a cutscene prompt would prove nothing about tiling, and trials at
1024x576 rather than the 1920x1080 delivery size because style is legible at
any size and the larger render spends money to learn the same thing.
