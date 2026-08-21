# Cosmic Conquest — Commander Portrait Lookbook

**Scope:** the `cmd_<id>` class — the twenty-one commander portraits. This is
the working reference for that class: where the style comes from, what the
model is actually shown, what has already gone wrong, and how to check a new
batch. [`BRAND.md`](BRAND.md) remains the identity for the whole game;
this refines the commander row of it and contradicts none of the others.

**Written to be usable cold.** Somebody who has never opened this repository
should be able to produce an on-style commander portrait from this page alone.

> **Nothing on this page is a claim about how an image looks.** Every number
> here is a measurement of *what the model was shown* — token positions from
> SDXL-Turbo's own CLIP tokenizer. Render counts (the 18/18s and 6/6s quoted
> from Session 18) are the one exception and are labelled as such.

---

## 1. The style in one paragraph

**Neon Reliquary, commander cut.** A painted game-cutscene bust in the
construction language of *Tyranny* — flat expressive brushwork over
hard-edged graphic shapes, the drawing carried by heavy black shadow shapes
rather than by rendering — inked and printed like a **cyberpunk comic**: cel
edges, halftone screen-print grain, spot blacks. Colour is **two hues at most**:
a duotone where the faction is a technology, a true monochrome where the faction
is an absolute. Ground is always void black. No third colour enters the frame.

Never: photorealism; airbrushed soft rendering; medieval or fantasy materials
(plate, mail, swords, robes, crowns, thrones); a busy background; a rainbow.

---

## 2. Reference media, and exactly what is taken from each

| Reference | What is taken | What is explicitly **not** taken |
|---|---|---|
| **Tyranny** (Obsidian, 2016) — conversation and cutscene illustrations | Construction: figures built from flat interlocking shapes; heavy black shadow masses doing the drawing; a palette limited to a couple of hues per image; the subject readable as silhouette before it is readable as detail. This is the lineage the owner named. | Its **material vocabulary**. Tyranny is bronze-age/fantasy — mail, spears, tabards, leather. Borrowing the rendering while borrowing the props is precisely how this class drifted medieval. Take the *how*, never the *what*. |
| **Vaporwave duotone print** (a design idiom, not a work) | Two-channel mapping onto black: darks to one hue, lights to the other; hot rim against cold body; halftone dot as texture rather than as noise. | Its retro furniture — busts of classical statuary, grid horizons, Japanese lettering, 80s chrome typography. None of that belongs on a commander. |
| **Cyberpunk comic inking** (the ligne-claire-plus-spot-black register) | Spot blacks, hard cel terminators, mechanical hatching, ink weight varying to carry depth without gradients. | Panels, gutters, speech balloons, sound effects, **any lettering at all**. See failure mode F5. |
| **Hades** (Supergiant, 2018) — character portraits | Identity per character: one prop, one posture, one dominant hue, held consistently so the cast reads as a set of individuals rather than a set of costumes. Our subject lines are written to this rule — one silhouette and one prop nobody else in the catalogue owns. | Its warm painterly rendering and its palette. |
| **Into the Breach** (Subset, 2018) | Legibility under size. A commander portrait ships at **320px** and is drawn on cards far smaller. If two portraits share a silhouette, the class has failed regardless of how the pixels look. | Its isometric flat-vector rendering. |
| **StarCraft II** | Faction asymmetry as a visual promise: you can tell whose unit it is with the colour removed. Our test of this is that shape and material differ per faction, not only hue. | Nothing else. |

---

## 3. Per-faction palettes

Duotone where the power is a **technology**; monochrome where the power is an
**absolute** and a second hue would dilute it. Ground is `#0a0e17` (Void black,
`BRAND.md`) in every case.

### Humanity — **duotone**, neon cyan + hot magenta

| Role | Hex | Note |
|---|---|---|
| Ground | `#0a0e17` | Void black |
| Shadow | `#164e63` | Cyan crushed to near-black; keeps the shadow *hued*, which is what makes a duotone read as a duotone rather than as a tinted greyscale |
| Light | `#38e8ff` | Brand `Neon cyan` — humanity's identity token |
| Spark | `#ff2fd6` | Brand `Neon magenta`, used only as rim and screen glow |

*Reasoning.* Humanity is the screen-and-HUD faction; cyan is already its
identity in the game's CSS. Cyan-plus-magenta is also the canonical vaporwave
pair, so this is the one faction where the owner's two words — vaporwave and
duotone — resolve to the same thing.

### Federation of Light — **monochrome**, radiant gold

| Role | Hex | Note |
|---|---|---|
| Ground | `#0a0e17` | |
| Shadow | `#78350f` | Gold crushed; never a neutral grey, or the monochrome breaks |
| Light | `#fbbf24` | Brand `Radiant gold` |
| Spark | `#fff7e0` | Blown highlight, gold at the top of the ramp |

*Reasoning.* A religion of light does not admit a second light. This also puts
the commanders in the same register as the faction crests, which BRAND.md
already locks to strict monochrome — the crest and the commander now agree.

### The Xeno — **duotone**, glowing purple + hot magenta

| Role | Hex | Note |
|---|---|---|
| Ground | `#0a0e17` | |
| Shadow | `#3b0764` | Deep violet |
| Light | `#a855f7` | A step brighter than brand `Xeno violet` `#7c3aed`, because the ramp needs headroom above the shadow |
| Spark | `#ff2fd6` | Neon magenta at the wet edges |

*Reasoning.* The Xeno is lit **from inside**. This is the one faction where the
second hue is load-bearing rather than decorative: purple measurably dies on
organic subjects (see F3), and a hot second hue at the highlights is what keeps
it alive on wet carapace and bone.

### The Pirates — **monochrome**, bright red

| Role | Hex | Note |
|---|---|---|
| Ground | `#0a0e17` | |
| Shadow | `#7f1d1d` | |
| Light | `#ef4444` | Brand `Raider crimson` |
| Spark | `#ff6b6b` | |

*Reasoning.* Salvage has no colour scheme; the only thing consistent about a
pirate is what they do to you. One hue, no negotiation. Monochrome also keeps
them apart from the Xeno duotone, which is the confusion risk at card size.

### Unaligned (`cadre`) — **greyscale**

| Role | Hex |
|---|---|
| Ground | `#0a0e17` |
| Shadow | `#1e293b` |
| Light | `#94a3b8` |
| Spark | `#e2e8f0` |

*Reasoning.* Cadre answers to nobody, so it carries nobody's hue — the same
logic that already keeps the Vigil machines greyscale. It is also the only
portrait in the class that must read as *unaligned at a glance*, and absence of
colour is the only way to say that in a class where colour means allegiance.

> **Hue cannot be pinned by prompting.** These hexes are the target and the
> reference for authored, derived or CSS work. If an exact hue is ever required
> on a portrait, force it in code the way `derive_crests.py` does for the
> crests (which lands within 4.5°).

---

## 4. Prompt anatomy

The composed prompt is `sdxl_all.prefix_for(key) + prompt`. For the commander
class `prefix_for` returns `''` **deliberately**, so both models receive the
identical string and the positions below are the positions the renderer uses.

```
{COMMANDER_DUOTONE[fac]}. {COMMANDER_REGISTER}. {desc}, {FACTION_LOOK[fac]}. {CMD_FRAME} {CMD_STYLE}
```

### Measured close positions (SDXL-Turbo CLIP tokenizer, 1-based, 75 usable slots)

| Clause | What it does | Opens | **Closes** | Budget |
|---|---|---:|---:|---|
| `COMMANDER_DUOTONE[fac]` | the whole colour direction | 1 | **3–11** | must close ≤ 12 |
| `COMMANDER_REGISTER` | comic register + `never medieval` | 5–13 | **25–34** | must close ≤ 40 |
| `desc` | the character: one silhouette, one prop | 27–36 | **36–49** | must close ≤ 60 |
| `FACTION_LOOK[fac]` | what the power is built from | 38–51 | **47–62** | must close ≤ 70 |
| `CMD_FRAME` | bust framing, black ground | 49–64 | **56–71** | must close ≤ **75** |
| `CMD_STYLE` | Tyranny spine, for the Krea encoder | 57–72 | 123–138 | *expected to truncate* |

Worst commander is 71 (`vanta`, `nyx`, `sevra`, `mawlord`); best is 56
(`lumen`). **Four tokens of headroom on the worst case** — that is the budget
any future edit is spending from.

### The five rules that produced that shape

1. **Palette first.** Guidance is 0 and the negative prompt is inert, so the
   only lever that exists is leading with what you want. The colour direction
   is the owner's brief, so it goes at token 1.
2. **The counter-medieval clause lives inside the window.** `never medieval`
   closes by token 34. The `foe` class has carried this phrase inside its window
   since Session 18 and stopped regressing to knights; the commander class
   carried it nowhere, which is most of why this round exists.
3. **Subject before material.** If something has to be cut it should be the
   power's material, not the character — but as measured, neither is.
4. **The material clause never says "armour".** With no material qualifier
   inside the window, `armour` resolves to plate. Three of the five old
   `FACTION_LOOK` entries led with it. None of the new ones contain it.
5. **The tail is for the other encoder.** `CMD_STYLE` is expected to truncate on
   SDXL and is there because `krea_gen.py` runs the same catalogue through a
   Qwen3-VL encoder with no 77-token window. It must therefore never contradict
   the head — which is why the commander class has its own `CMD_STYLE` with the
   three-hue `vaporwave neon palette` clause removed. On the Krea path the
   shared `STYLE` would have overwritten the duotone.

### Worked example — what the model is shown for `cmd_rake`

```
Monochrome bright red. cyberpunk comic portrait, inked cel shading, halftone
screen-print, heavy black shadows, never medieval. a corsair with a plasma
cutter and an insolent grin, long coat, salvage plating, aftermarket
cybernetics, neon trim. Facing viewer, centred bust, flat black.
```
…closing at token 62, with `CMD_STYLE` following and truncating. Before this
round the same commander was shown 32 tokens of *"neon magenta cyan violet
palette"*, then *"plasma **cutlass** … scavenged **breastplate**"*, then a
faction clause cut in half at *"aftermarket cyberne|tics"*, and nothing else at
all — the words *cyberpunk science fiction* sat at token 142.

---

## 5. Failure modes already catalogued

Each of these cost a round. Re-introducing one is the fastest way to lose this
class again.

**F1 — Medieval drift by omission.** *Symptom:* knights, plate, swords.
*Cause:* the phrase `cyberpunk science fiction` sitting past token 77, or absent
from the class prefix entirely. It killed the enemy dossiers in Session 18 (the
`foe` prefix had dropped the words) and it killed the commanders through
Session 20 (`{STYLE}` opened at token 92–113 on all 21). *Fix:* the setting and
`never medieval` belong in the first forty tokens, not in the tail.

**F2 — Everything shipped amber.** *Symptom:* 49 dossiers, one colour, none of
them the assigned one. *Cause:* the accent clause sat at token ~114–163; the
only surviving colour direction was an unnamed *"one restrained accent
colour"*, which SDXL reads as amber. *Fix:* colour leads the prompt. This is
why `COMMANDER_DUOTONE` is at token 1.

**F3 — Dead colour words.** *Rendered result, Session 18 sweep:* `xeno violet`
lost 12 of 15 and `raider crimson` lost 4 of 6 — the images came back with **no
colour at all** — while `radiant gold` and `spectral cyan` landed 18 of 18.
*Cause:* invented brand names are low-frequency tokens. *Fix:* plain,
high-frequency colour words. `bright red` took crimson from 2/6 to 6/6.
Purple additionally dies on organic nouns (`bone`, `wet carapace`, `dark
filament` all pull to greyscale) unless it is named as **emitted light** —
hence `glowing purple bioluminescence`, which is worth its two extra tokens.

**F4 — `restrained` reads as "desaturate".** Dropping that single word is what
moved crimson from 2/6 to 6/6. It is not in any commander clause and must not
return. Same family: `subtle`, `muted`, `tasteful`, `hint of`.

**F5 — `comic book` prints lettering.** The long form pulls panel borders,
gutters and speech balloons; `no text, no watermark` lives in `CMD_STYLE`, past
the cliff, where it cannot help, and `NEG` cannot help either (F6). The class
uses `cyberpunk comic portrait`. *If lettering appears anyway, the fix is to
drop the word `comic` and keep `inked cel shading, halftone screen-print, heavy
black shadows`* — that carries the register without naming the medium.

**F6 — The negative prompt does nothing, on either path.** `sdxl_all.py` runs at
`guidance_scale=0.0`, where the negative branch is not sampled at all; and
`krea_gen.py` imports `NEG` and never passes it to the pipeline. `NEG` lists
*medieval, fantasy armour, sword, castle* and has never once had an effect. Do
not "fix" a drift by adding to `NEG`.

**F7 — A stale second copy of the direction.** `artgen/generate.py` still holds
its own `STYLE` / `FACTION_LOOK` / `COMMANDERS`, all of it the rejected
pre-Session-15 fantasy direction, and writes to a sibling path that no longer
exists. It is marked SUPERSEDED. The live catalogue is `krea_jobs.py` and only
`krea_jobs.py`. This family of bug already cost a session once: the Session 19
troop prefix was edited in a copy nothing read.

**F8 — The prefix silently changes the prompt.** `sdxl_all.prefix_for()`
dispatches on the first `_`-segment of the key, so a class with no entry falls
through to `SDXL_PREFIX` and receives 32 tokens naming three hues. That is what
was happening to the commanders and what had happened to the tower plates. Any
new class needs an explicit entry — including an explicitly empty one.

---

## 6. Acceptance test

`tools/`-style harness for this class. Two halves, both re-runnable:

### A. Automated — `portraits_test.js` (node, zero dependencies)

```
node portraits_test.js --root <repo> [--verbose] [--tokenizer <dir>]
```

Reads `artgen/krea_jobs.py` and `artgen/sdxl_all.py`, composes each of the 21
commander prompts exactly as the renderer does, and tokenizes them with a
from-scratch CLIP BPE built on SDXL-Turbo's own `vocab.json` / `merges.txt` —
the same vocabulary and merge ranks the renderer uses. **218 checks:**

1. every clause closes inside its budget from §4, on all 21;
2. `never medieval` closes inside the window on all 21;
3. the duotone clause is the **first** sentence on all 21;
4. no medieval-coded lemma (`armour`, `breastplate`, `cutlass`, `sword`,
   `robe`, `crown`, `enthroned`, `halo`, `trophy`, `bones`, `mail`, `castle`,
   `helm`, `marshal`, `warden`, `shield`, …) appears unbound to a
   science-fiction qualifier — the bound forms are listed explicitly, so
   *interlocking light plates* passes and a bare *plate* does not;
5. `PREFIX_BY_CLASS` has an explicit **empty** `cmd` entry, and `prefix_for`
   still falls back to `SDXL_PREFIX` for unlisted classes (F8);
6. `CMD_STYLE` names no hue of its own (it would beat the duotone on the Krea
   encoder, which reads the whole prompt);
7. no desaturating word in a colour clause (F4), the register says `comic` and
   not `comic book` (F5), and the prompt text is ASCII;
8. `build_jobs` still composes the prompt in the order the test assumes — so a
   template drift makes the harness fail rather than measure a string the
   renderer no longer uses.

**Two things make these numbers trustworthy rather than decorative.**

*The tokenizer was checked against a reference.* Over 2,970 tokens — all 21
prompts, both style spines, `NEG`, and adversarial ASCII cases — it produces
**identical token ids** to `transformers` `CLIPTokenizer`. It diverges on a lone
multi-byte character, which is why check 7 asserts the catalogue is ASCII.

*The suite was mutation-tested, 8 for 8.* Every assertion was confirmed to fail
when the thing it guards is reintroduced: a `cutlass` put back in a subject, a
subject lengthened past budget, the `cmd` prefix entry deleted, a third hue
added to `CMD_STYLE`, `restrained` put back in a palette, the duotone moved out
of first position, `comic book` restored, and a smart quote pasted into a
subject line. An assertion nobody has watched fail is an assertion nobody reads.

Checks 3–8 need no tokenizer and always run. Checks 1–2 need the CLIP vocab and
**fail loudly** if it is missing — they never skip, because a budget check that
skips is this project's signature bug in a new costume.

### B. By eye — the six questions, on the rendered batch

Ask them of the 320px asset, not of a zoom.

1. **Two hues, or three?** Count the distinct hues in the frame. Three is a
   failure even if all three are pretty.
2. **Is the shadow hued?** A duotone whose darks are neutral grey is a tinted
   greyscale, not a duotone.
3. **Is there any lettering?** Any glyph at all is F5. Note it and apply the F5
   fix.
4. **Silhouette test.** Fill the portrait black at 64px. Can you still name the
   commander? If two commanders collapse to the same blob, the subject line has
   stopped carrying a unique prop.
5. **Faction test with the colour removed.** Desaturate. Can you still tell the
   Federation portrait from the Pirate one by material and shape alone? If not,
   `FACTION_LOOK` is doing no work and the class has regressed to hue-only
   identity — which is the art-side version of a tower whose identity is a
   percentage.
6. **Armoury test.** Point at every hard surface and name what it is made of.
   If the answer is "metal plate" and nothing more specific, F1 is back.

Record the count in `docs/NOTE-LEDGER.md` the way the Session 18 dossier sweep
was recorded — *n of 21* per check, not an impression.

---

## 7. If you are adding a commander

1. Write the subject in **twelve to eighteen tokens**: one silhouette, one prop
   nobody else owns, one posture. No adjective that could equally describe
   another commander.
2. Grep your line against the F-list lemmas before you commit it.
3. Run `portraits_test.js`. If the frame clause closes past 75 you have four
   tokens of slack on the worst existing commander and none to spare — shorten
   your subject rather than the shared clauses, because the shared clauses are
   all measured.
4. Do not touch `COMMANDER_DUOTONE`, `COMMANDER_REGISTER` or `CMD_FRAME` to make
   room. Every word in them is load-bearing and several were bought with a
   rendered sweep.
