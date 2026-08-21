# Contributing to Cosmic Conquest

This project has no build step to run the game, no package manager, and no
dependencies. Clone it, serve the folder, play. Everything below exists so that
several people can work on it at the same time without standing on each other.

---

## 1. Run it

```bash
python -m http.server 8471 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8471/index.html>.

`file://` will *not* work — the browser blocks the module loads. Use the server.

**Always cache-bust when testing a change:** `index.html?v=2`. The raw `js/*.js`
files cache hard and you will otherwise spend an hour debugging code that is not
running.

To produce the single-file build:

```bash
node build.js
```

That inlines `css/*` and the sixteen JS modules into `aegis-protocol.html`
(standalone, openable from disk) and `aegis-artifact.html` (body-only, for an
embedding host). **The bundles are outputs — never edit them.** Any change you
make there is erased by the next build, and the reviewer will see a 6MB diff
instead of your three lines.

---

## 2. Pick your lane — the module map

Two of these files are very large. If two people edit `ui.js` in the same week
without coordinating, the merge will be genuinely painful. So the first rule of
working here is: **say which module you are in before you start.**

| Module | Lines | What lives there |
|---|---:|---|
| `js/config.js` | 2811 | Tunables, tower/enemy/wave data, maps, talent trees. **Every magic number belongs here**, named, with a comment saying what it protects against. |
| `js/game.js` | 3462 | Core state and the simulation step. Board, economy, waves, N-side seat logic, relocation, the radial. |
| `js/ui.js` | 3981 | Every screen and overlay. Title, galaxy, loadout, battle HUD, dossiers, end screen. |
| `js/entities.js` | 2225 | Towers and enemies: movement, targeting, damage, status. |
| `js/entities2.js` | 843 | The expansion behaviours — siren, saboteur, reanimation, marks. |
| `js/ai.js` | 1102 | The rival commander. Loadout drafting, build/upgrade scoring, musters. |
| `js/commanders.js` | 904 | `Meta` — the save file, profiles, progression, the soul vault. |
| `js/audio.js` | 801 | Procedural Web Audio. No sample files anywhere. |
| `js/towers2.js` | 536 | Expansion tower definitions. |
| `js/roster.js` | 473 | Commander roster and their traits. |
| `js/factions.js` | 406 | The four powers and their bonuses. |
| `js/galaxy.js` | 324 | Galaxy generation — systems, worlds, contested slots. |
| `js/dialogue.js` | 192 | Portraits and pre-battle dialogue. |
| `js/abilities.js` | 193 | Commander abilities. |
| `js/main.js` | 165 | Bootstrap and keyboard. |
| `js/artpack.js` | *generated* | 178 base64 images. Never hand-edit; see §6. |

`css/style.css` is structure, `css/polish.css` is everything added since. New
rules go in `polish.css`.

**Module order matters.** `build.js` concatenates in dependency order; if you add
a module, add it to that list in the right position or the bundle breaks while
the served version still works.

---

## 3. Working at the same time as other people

- **Branch per change.** `git checkout -b fix/siren-nside`. Never commit to
  `main` directly — `main` is what <https://majieddd.github.io> serves.
- **Every change ships to all three surfaces.** A change is not done when it
  works locally: push to `main` (which deploys the site), and republish the
  Artifact. Landing on one surface and not the others is how the live game
  quietly falls behind the repository.
- **Announce the module.** Open a draft PR or an issue the moment you start, with
  the module in the title. That single habit prevents almost every conflict this
  layout can produce.
- **Small PRs.** A 40-line diff in one module reviews in ten minutes. A 900-line
  diff across `game.js` and `ui.js` reviews in a day and merges badly.
- **Rebase, do not merge, before you push.** `git pull --rebase origin main`.
  Merge commits across two 3000-line files make the history unreadable.
- **Never reformat a file you are editing.** A whitespace pass turns a reviewable
  diff into an unreviewable one, and it will collide with everyone else.

If you genuinely must make a sweeping change across a big module, say so first
and let the others land their work — it is cheaper than the merge.

---

## 4. Traps that have each cost someone a day

These are not style preferences. Each one shipped a real bug.

- **`Tower.jammed` is a getter** over `jamTimer`. Assigning to it is a silent
  no-op. Write `jamTimer`.
- **Nothing ever sets `dead` on a Tower.** Guards that test it are vestigial and
  always false. Test `S.towers.indexOf(t)` instead. A pair of these let sell and
  relocate both fire and burn 54,000 gold.
- **`FIELD.terrain` is a `Set`.** `.includes()` throws. Use `.has()`.
- **Path length is `path.total`**, not `path.length`.
- **`sendPaths` has exactly TWO entries** on the tri and radial builders — it is a
  legacy accessor. Indexing it by seat breaks at seat 2 and up, which froze the
  whole battle because `Game.loop` has no try/catch. Use `Game.rivalOf(side)` and
  `sendTriPaths[side][victim]`, the way `Game.muster` does.
- **Any number the UI prints must equal what the engine computes.** Seven separate
  desyncs have shipped: a preview that forgot the galaxy tier, a tooltip quoting
  the authored growth rate instead of the charged one, a panel promising 21 souls
  while paying 6. `Game.waveHpMul(n, rage)` is *the* definition — call it, never
  re-derive it.
- **`build.js` aborts** if the literal word `stylesheet` or `<script src=`
  survives into the bundle. That is a guard, not a bug.
- **A string is not a number.** `seed >>> 0` on a string is always `0`, so every
  galaxy was identical for weeks. Hash strings properly.
- **Seeds must be stable.** Python's `hash()` is salted per process; `artgen`
  uses FNV-1a so a re-render reproduces the same image.

---

## 5. Verify before you open the PR

Two harnesses live in `tools/`. Both run in the browser console (or via a
`javascript_tool` call) against a served, cache-busted build.

```js
// paste tools/owner-sweep.js  — 17 behaviour checks across the whole feature set
// paste tools/balance-pins.js — then:
PINS.fresh(6)          // fresh profile, six maps
PINS.maxProfile(0); PINS.begin(0, 'contested');
PINS.tick(20000)       // repeat until {done: true}
```

**The pins.** Mirror-AI on both seats, loadout pinned to
`bolt/cryo/mortar/flak/beacon`:

- fresh profile → **median LOSS at wave 6-7**, every loss under wave 10
- maxed unlocks at **galaxy tier 0** → `spine` resolves around **wave 27**

Two ways to measure these wrong, both of which have produced a false alarm:

1. **Passing a tower pool to `AI.pickLoadout` does not filter cores** — `pool`
   only sets a budget. An unpinned run silently re-bases the whole measurement.
2. **Measure the maxed pin at tier 0.** Galaxy tier feeds `waveScaled`, so a
   maxed profile stamped tier 4 dies around wave 12 and reads as a catastrophe
   when nothing changed.

Also note a run can end *either way* — a maxed `delta` run finishes at wave 7
having eliminated the rival. Compare losses with losses.

If you touched economy, AI, or anything in a talent tree, re-measure both pins
and put the numbers in the PR description.

**A third way to mis-measure the maxed pin:** unlocks are shelved per faction
banner since 19.6, so writing the retired flat `v.unlocked` list leaves the
"maxed" profile holding a single tower. `tools/balance-pins.js` already writes
every shelf; if you fork it, keep that.

**Anything animated must be verified in a FRONTED tab.** A backgrounded tab
throttles `requestAnimationFrame` to *zero* frames — measured: 0 frames in
400ms hidden, 59 visible. Every rAF-dependent assertion then fails, and it
fails with entirely plausible messages ("0 frames in 400ms", "got 80 want 0")
that read exactly like a real animation bug. That cost five spurious failures
in the 19.8 hover-preview suite before the tab was fronted and all 77 passed.
Check `document.hidden` first, and treat any all-animation failure cluster as a
harness question until you have.

---

## 6. Art

No art is committed as loose files. `js/artpack.js` is generated, and the game
reads every image through the `art(key)` helper so a missing key degrades to the
shipped fallback rather than a broken image.

```bash
python artgen/sdxl_all.py        # render anything missing (~1 min, needs CUDA)
python artgen/derive_worlds.py   # deterministic duotone variants (PIL)
python artgen/derive_crests.py   # crest hues, forced in code rather than prompted
python artgen/krea_gen.py --pack # assemble js/artpack.js
node build.js
```

The pipeline lives **inside this repository** at `artgen/`, along with its
`cache/`, `cache_krea/` and the `krea2-turbo/` model checkout (all three
gitignored — the model alone is 34GB). It used to sit in a sibling directory,
and that cost a whole session of art work: the Session 19 troop prefix was
edited there, rendered there, and never reached version control, so the pack
shipped correct while the source that produced it did not exist in the repo.
Run the scripts from the repository root and there is only one copy to edit.

`artgen/krea_jobs.py` is the single catalogue for both models. Read
[`docs/BRAND.md`](docs/BRAND.md) before generating anything — the visual identity
is locked, and two prompt rules are load-bearing:

- **CLIP truncates at 77 tokens.** Anything past that is silently discarded. All
  49 enemy dossiers shipped amber because the accent instruction sat at token
  ~114 and never reached the model. Put the important words *first*.
- **Guidance is 0, so the negative prompt is inert.** You cannot subtract; you can
  only lead with what you want.

Hue cannot be reliably prompted. Where an exact colour matters — the faction
crests — it is forced in code by `derive_crests.py`, which lands within 4.5°.

---

## 7. House style

- Comments explain **why**, never what. A comment that restates the code is
  deleted in review; a comment naming the bug a line prevents is kept forever.
- Two-space indent, single quotes, semicolons.
- Every tunable is a named `const` in `config.js` with a comment saying what it
  guards against.
- **Rival parity is mandatory.** Anything the player can do, the rival can do,
  under the same rules and the same unlock law. An asymmetry the player cannot
  answer is a bug, not a difficulty setting.
- Player-facing copy: no hype, no exclamation marks, say what happens.

---

## 8. Changing the game with a script

Larger edits here are often applied by a patch script rather than by hand. If you
write one, it **must** be two-phase: stage every file in memory, verify every
anchor matches exactly once, and only then write. A per-file writer can
half-apply and still pass `node --check` and `node build.js`, shipping half a
feature silently. That has happened twice.

Give it a `--check` flag that verifies without writing, and a re-run guard so
applying it twice is harmless.
