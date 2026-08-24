# Cosmic Conquest — Brand & Art Kit

The single source of truth for every generated or authored visual. Locked by the owner
in Session 15. Any future generation, regeneration, or new asset class starts here.

## The style, named

**Neon Reliquary** — the painted-cutscene language of *Tyranny* (bold flat brushwork,
hard graphic shapes, strong silhouettes) crossed with **gothic engraved linework**
(cathedral rose-window geometry, ornamental filigree, woodcut hatching) and set in a
**cyberpunk sci-fi vaporwave** world (neon magenta/cyan/violet, chrome, holograms).

Never: photorealism, medieval/fantasy materials (plate armour, swords, castles),
soft airbrushed rendering, busy backgrounds behind emblems.

## Palette

| Token | Hex | Use |
|---|---|---|
| Void black | `#0a0e17` | every background ground |
| Chrome greys | `#94a3b8 → #1e293b` | machines, armour, neutral mobs |
| Neon magenta | `#ff2fd6` | vaporwave key light, skies |
| Neon cyan | `#38e8ff` | HUMANITY. Tech glow, spectral mobs |
| Radiant gold | `#fbbf24` | FEDERATION OF LIGHT |
| Xeno violet | `#7c3aed` | THE XENO |
| Raider crimson | `#ef4444` | THE PIRATES |

Faction colour is identity. Where a faction owns an asset, its colour dominates to the
point of monochrome; rival colours never share the frame.

## Treatment by asset class

| Class | Keys | Treatment |
|---|---|---|
| Commander portraits | `cmd_<id>` | Full vaporwave palette, painted bust, faction armour language. THE APPROVED LOOK — regenerate only wholesale, never partially. |
| Faction crests | `fac_<id>` | **Strict monochrome**: one faction hue on void black, engraved gothic emblem, rose-window/reliquary geometry, no second colour anywhere. |
| Enemy dossiers | `foe_<id>` | **Greyscale** (black/white/chrome) with ONE restrained accent splash by allegiance — violet for xeno-flesh, gold for radiant constructs, crimson for raider warbands, cyan for spectral/energy things, and **no accent at all** for pure machines and stone. |
| World plates | `world_<mapId>` | Vaporwave establishing scene, wide 16:9, no foreground figures. |
| Holder variants | `world_<mapId>_<factionId>` | **Derived, never generated**: the base plate converted to a duotone in the holder's colour (PIL pipeline, deterministic). |
| Planets | `planet_<kind>` | Engraved-line planet portraits on void black: `standard`, `fortress`, `forge`, `nest`. |
| Galaxy backdrop | `galaxy_bg` | Deep vaporwave starfield, dim enough that owner rings stay readable on top. |
| Ability emblems | `abil_<id>` | Single bold glowing emblem, minimal, high contrast, no background detail. |
| Key art | `title`, `nebula` | Full-palette cinematic. |

## Prompt recipes

The prompt spine lives in `artgen/krea_jobs.py` (`STYLE`, `NEG`, `FACTION_LOOK`,
per-class prompt builders). Rules that must survive any edit:

1. **Style first.** SDXL's CLIP truncates at 77 tokens and `guidance_scale 0` makes the
   negative prompt inert — the style must be the FIRST tokens or long subjects lose it
   (this shipped a medieval Rake once). `sdxl_all.py` carries per-class prefixes.
2. **One seed per key.** Seeds derive from the asset key, so re-runs reproduce and
   re-rolls are deliberate (`--force <key>`).
3. **Same catalogue, both models.** `krea_jobs.build_jobs()` is the single catalogue;
   SDXL-Turbo renders it in ~1 minute as the shipping baseline, Krea-2-Turbo
   (`artgen/krea2-turbo/`, ~83 min/image on this GPU) upgrades keys underneath via
   `cache_krea/` precedence. Upgrade whole classes at once, never partially.
4. **Derived assets are code, not prompts.** Duotones, crops, and tints run in
   `artgen/derive_worlds.py` so they are exactly reproducible.

## Rebuild pipeline

```
python artgen/sdxl_all.py            # render anything missing from the catalogue
python artgen/derive_worlds.py      # duotone holder variants from the base plates
python artgen/krea_gen.py --pack    # assemble js/artpack.js (cache_krea > cache)
node TowerDefense/build.js          # inline into the two shipping bundles
```

## In-game colour language (CSS, not generation)

The UI reads faction colour from `--fc`/`--cc` custom properties; monochrome asset
classes must NOT fight them. Motion uses the three named curves (`--e-enter`,
`--e-pop`, `--e-tap`) in `css/polish.css`. Audio identity: deep vaporwave register —
`SFX_DEPTH 0.62`, tempo 84 (do not brighten).

---

## The 77-token rule (measured, Session 18)

SDXL's CLIP encoder truncates at **77 tokens**. Everything past that is silently
discarded — no warning that changes the image, just a different picture than the
one you asked for.

All 49 enemy dossiers shipped **amber** for several sessions because of it. The
per-enemy accent instruction sat at CLIP token ~114–163, well past the cliff, so
the only colour direction that survived was the class prefix's unnamed *"at most
one restrained accent colour"* — and SDXL's default reading of that is amber.

Two fixes, both now in `artgen/`:

1. **The prefix went from 79 words to 19.** A class prefix that alone overruns
   the window leaves no budget for the subject, let alone its accent.
2. **The accent leads the prompt**, before the subject. Worst case is now token
   ~37, less than half the budget, across all 49.

### Colour words are not equally strong

Measured against each dossier's assigned accent, in the shipping pack:

| Accent | Prompt phrase | Correct |
|---|---|---:|
| greyscale | `no colour at all, pure blacks whites and chrome greys` | 10/10 |
| gold | `ONE restrained splash of radiant gold` | 10/10 |
| cyan | `ONE restrained splash of spectral cyan` | 8/8 |
| crimson | `ONE bright red accent glow` | 6/6 |
| violet | `glowing purple bioluminescence` | 10/15 |

**44 of 49 (90%)**, up from 0.

Three findings worth keeping:

- **`xeno violet` and `raider crimson` were dead tokens.** Twelve of fifteen
  violet dossiers and four of six crimson came back with no colour at all, while
  `spectral cyan` and `radiant gold` landed 18 of 18. Plainer, higher-frequency
  colour words work; invented brand names do not.
- **`restrained` reads as an instruction to desaturate.** Dropping it is what
  moved crimson from 2/6 to 6/6.
- **Purple dies on organic subjects.** The five remaining misses are all
  undead or insectile — `bone`, `wet carapace`, `dark filament` pull hard toward
  greyscale. Naming the accent as emitted *light* rather than pigment recovered
  most of them; the rest would need the deterministic treatment below.

**Where an exact hue is required, force it in code.** Prompting cannot pin a hue.
`derive_crests.py` tints each crest onto the faction's exact ramp and lands
within 4.5° — see the crest row in `docs/NOTE-LEDGER.md`.

**Seeds must be stable.** `sdxl_all.py` used Python's `hash()`, which is salted
per process, so no regeneration was reproducible. It now uses FNV-1a: re-render a
class and it comes back recognisably itself.

---

## Amendment (Session 19, owner): faction troops leave the greyscale rule

The original rule — *mobs are greyscale plus at most one allegiance accent* —
was applied to everything keyed `foe_*`. That turned out to cover two different
kinds of thing, and only one of them was served by it.

The owner's note:

> When looking through the artstyle of the army units, they don't quite match
> the same artstyle aesthetic as for example the profile pictures for the
> commanders. I really want them to look more similar to the commanders … but
> keep their model style, similar to the towers.

They were right, and the cause was mechanical. `prefix_for()` splits an art key
on `_` and dispatches on the first segment, so `foe_crawler` (a neutral machine)
and `foe_votary` (a Federation soldier) both received the **`foe`** prefix:

> *greyscale science-fiction creature specimen, one subject alone on flat black…*

That is a **lab exhibit**, and it is exactly right for a machine nobody owns.
Commanders, meanwhile, have no class prefix at all and fall through to
`SDXL_PREFIX` — painted, coloured, brushwork. So the two classes were never
going to match: one was a painting and the other a specimen card.

### The rule now

| Class | Treatment |
|---|---|
| **Commanders** (`cmd_*`) | Painted portrait, full palette. Unchanged. |
| **Faction troops** (`foe_*` in `FACTION_TROOPS`) | **Painted in their power's colours**, full-body framing like a tower plate. `TROOP_PREFIX` in `sdxl_all.py`, palette in `FACTION_PALETTE`. |
| **Neutral machines** (every other `foe_*`) | Greyscale plus at most one accent. **Unchanged** — they belong to nobody, and the clinical look is the point. |

`FACTION_PALETTE` and `FACTION_ACCENT` are deliberately separate constants:
one is the colour a troop is *painted in*, the other the single splash a
greyscale machine is *allowed*. Collapsing them is how this got confused before.

Keys are unchanged (`foe_<id>`), so no game-side art lookup had to move —
`prefix_for()` consults the troop roster instead, which is the only thing that
can tell a soldier from a specimen.


---

## Amendment (Session 20.4, owner) — SUPERSEDED, see the amendment below it

> **Read the next section before acting on any of this.** The owner reversed this
> mid-Session-20: the commanders were fine, it was the troops that were off. The
> troop half of this amendment shipped; the commander half did NOT. What follows
> is kept because the token measurements in it are correct and worth having, but
> its commander instruction is no longer the direction.

## Amendment (Session 20.4, owner): the commander class is duotone or monochrome

The owner's note:

> I noticed a lot of profile pictures look medieval armory/fantasy. It should be
> a Vaporwave Duotone or monochrome (depending on faction associations)
> Cyberpunk comic look inspired by Tyranny.

**Neon Reliquary is not replaced.** The commander row of the treatment table
above said *"Full vaporwave palette, painted bust, faction armour language —
THE APPROVED LOOK"*. That row is what changes, and only that row. The world
plates, key art and nebula keep the full three-hue vaporwave palette; the
crests keep strict monochrome; the dossiers keep greyscale-plus-one-accent;
the troops keep their power's paint. See [`LOOKBOOK.md`](LOOKBOOK.md) for the
full anatomy, the palettes as hex, and the acceptance test.

### What changed, and why it was mechanical rather than a matter of taste

Measured with SDXL-Turbo's own CLIP tokenizer, on the prompt as composed
(`sdxl_all.prefix_for` + `krea_jobs.build_jobs`):

| Measurement | Before | After |
|---|---:|---:|
| Prompt length (tokens) | 164–185 | 123–138 |
| Tokens discarded per prompt | 98–99 | 48–63 |
| `{STYLE}` / `cyberpunk science fiction` opens at | 92–113 | *(tail only)* |
| Faction material clause closes at | 74–95 (**cut on 20 of 21**) | 47–62 |
| Whole direction closes by | never | **71** |
| Medieval-coded nouns inside the window | 39 | 9, each bound to a sci-fi qualifier |

Three of those rows are the whole diagnosis:

1. **The style spine was never encoded on a single commander.** `{STYLE}` — the
   clause holding *cyberpunk science fiction* and *vaporwave neon palette* —
   opened at token 92 at best. The window closes at 77. Twenty-one for
   twenty-one, the model was never told the setting.
2. **`FACTION_LOOK` was cut mid-clause on 20 of 21.** Rake lost
   *"…cybernetics, jagged trophies, brutal improvised tech"*; Halder lost
   *"…circuitry halos, serene ceremonial bearing, glowing seams"*. The generic
   half survived and the sci-fi half did not.
3. **The negative prompt is inert on BOTH paths.** `guidance_scale=0` on SDXL
   makes it a no-op, and `krea_gen.py` imports `NEG` and never passes it to the
   pipeline. `NEG` lists *medieval, fantasy armour, sword, castle*. None of it
   has ever had any effect. **You cannot subtract; you can only lead.**

So thirty-nine medieval nouns — *shield, breastplate, cutlass, robes, crown,
enthroned, halo, trophy, bones, plate* — sat inside the window at full strength
with no counterweight of any kind. Nine survive the rewrite, and every one of
them is bound to a science-fiction qualifier in its own clause (*six **wings**
of projected hard light*, *interlocking light **plates***, *salvage **plating***). The `foe` class prefix already ends with
`never medieval,` inside its window and stopped regressing to knights. The
commander class carried that phrase nowhere.

### The commander palettes

Duotone where the power is a *technology*; monochrome where the power is an
*absolute* and a second hue would dilute it.

| Faction | Treatment | Prompt phrase | Ground | Shadow | Light | Spark |
|---|---|---|---|---|---|---|
| Humanity | **Duotone** | `Duotone neon cyan and hot magenta` | `#0a0e17` | `#164e63` | `#38e8ff` | `#ff2fd6` |
| Federation of Light | **Monochrome** | `Monochrome radiant gold` | `#0a0e17` | `#78350f` | `#fbbf24` | `#fff7e0` |
| The Xeno | **Duotone** | `Duotone glowing purple bioluminescence and hot magenta` | `#0a0e17` | `#3b0764` | `#a855f7` | `#ff2fd6` |
| The Pirates | **Monochrome** | `Monochrome bright red` | `#0a0e17` | `#7f1d1d` | `#ef4444` | `#ff6b6b` |
| Unaligned (`cadre`) | **Greyscale** | `No colour at all, pure blacks whites and chrome greys` | `#0a0e17` | `#1e293b` | `#94a3b8` | `#e2e8f0` |

The prompt phrases are not free choices — they are the words the Session 18
dossier sweep measured as *live*. `radiant gold` landed 18/18 and `bright red`
took crimson from 2/6 to 6/6, while `xeno violet` and `raider crimson` were dead
tokens, and purple only survives an organic subject when named as emitted light,
which is why the xeno line pays two tokens for `bioluminescence`.

**Hue still cannot be pinned by prompting.** The hexes above are the target and
the reference for any authored or derived asset. If an exact hue is ever
required on a portrait, force it in code the way `derive_crests.py` does.

---

## Amendment (Session 20, owner reversal): the commanders keep the approved look

Mid-round the owner clarified: *the commanders we have looked fine, it was the
troops that looked off.* The code followed, and **that is what ships**:

- **Commanders (`cmd_<id>`) — the full three-hue vaporwave palette, unchanged.**
  Restored in `4a2974b`, 21/21 prompts byte-identical to the pre-20.4 originals.
  The treatment table at the top of this file is therefore correct as written,
  and the duotone amendment above applies to the TROOPS only.
- **Troops (twenty of the forty-nine `foe_<id>` keys) — restyled and kept.**
  Measured at ~1.5 hue families each, i.e. duotone/monochrome by power.

### Constants: what the two amendments above name, and what actually exists

The prompt spine was renamed when the commander half was reverted. Grepped
against `artgen/`:

| Named in these docs | Exists in code? |
|---|---|
| `COMMANDER_DUOTONE` | **No.** Removed with the commander revert |
| `COMMANDER_REGISTER` | **No.** Renamed to `TROOP_REGISTER` in `4a2974b` |
| `TROOP_REGISTER` | Yes — `artgen/krea_jobs.py`, and it is the troop-only register |
| `TROOP_PREFIX`, `FACTION_LOOK`, `STYLE` | Yes |

So `LOOKBOOK.md`'s prompt anatomy (its lines 135, 142-143, 206 and 336) describes
a commander prompt that **no longer exists**. Read it as the history of the
troop restyle, not as a spec to build against.

### The standing question for the owner

`cmd_cadre` is a **Krea 2** plate; the other twenty commanders are SDXL. Proved
by decoding the shipped pack: 0.5/255 mean difference against `cache_krea`,
97/255 against `cache`. That is a partial class upgrade, which rule 3 above
forbids, and it is live on `main` right now in the 21-portrait grid.

Measured on this machine (RTX 4080, 12 GiB): Krea 2 Turbo loads in 93 s at
10.4 GiB and renders **one 512px plate in 34.6 minutes** — about **138 min per
image at 1024px**, not the 83 min recorded earlier in this file. Finishing the
commander class costs ~46 GPU-hours; the `foe_` class, which all render through
the same dossier modal at the same size, is 49 keys and ~113 GPU-hours.

Three ways out, all cheap except the last, and the choice is the owner's:
1. Re-render `cmd_cadre` on SDXL so the grid is uniform again (minutes).
2. Leave it and accept one sharper portrait among twenty-one.
3. Commit the GPU time and upgrade a whole class.
