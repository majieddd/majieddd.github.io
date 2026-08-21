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
