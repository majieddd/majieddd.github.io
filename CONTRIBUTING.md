# Contributing to Cosmic Conquest

This project has no build step to run the game, no package manager, and no
dependencies. Clone it, serve the folder, play. Everything below exists so that
several people can work on it at the same time without standing on each other.

---

## 1. Run it

You need **git**, any **Python 3** (used only as a static file server, the game
never executes Python), and **Node 20 or newer** (used only by `node build.js`).
There is no `package.json`, no lockfile and nothing to install.

```bash
git clone https://github.com/majieddd/majieddd.github.io.git
cd majieddd.github.io
python -m http.server 8471 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8471/index.html>.

Port **8471** is not arbitrary: `.claude/launch.json` declares the same server
under the name `cosmic-conquest`, so an agent session starts it by name and lands
on the same URL a human would.

`file://` will *not* work, the browser blocks the module loads. Use the server.

**Cache-busting: `index.html?v=2` DOES NOT WORK.** The query is on the document,
not on the `<script src="js/game.js">` tags inside it, so every module is still
served from cache and you are testing the previous build while believing you are
testing this one. It reads as your change having no effect.

To test a change, verify against the **bundle**, `node build.js`, then
`aegis-protocol.html?v=N`, which inlines all seventeen modules into the document
the query actually busts. Use `index.html` for hand-play, the bundle for proof.

To produce the single-file build:

```bash
node build.js
```

That inlines `css/*` and the sixteen JS modules into `aegis-protocol.html`
(standalone, openable from disk) and `aegis-artifact.html` (body-only, for an
embedding host). **The bundles are outputs, never edit them.** Any change you
make there is erased by the next build, and the reviewer will see a 6MB diff
instead of your three lines.

---

## 2. Pick your lane, the module map

Four of these files run past 3,500 lines and `ui.js` is past 6,000. If two people
edit `ui.js` in the same week without coordinating, the merge will be genuinely
painful. So the first rule of working here is: **say which module you are in
before you start.**

Line counts are `wc -l js/*.js` at the last doc pass; they are a rough sense of
weight, not a contract, and they only ever grow.

| Module | Lines | What lives there |
|---|---:|---|
| `js/ui.js` | 6272 | Every screen and overlay. Title, galaxy, loadout, battle HUD, dossiers, end screen. |
| `js/entities.js` | 3822 | Towers and enemies: movement, targeting, damage, status. |
| `js/game.js` | 3769 | Core state and the simulation step. Board, economy, waves, N-side seat logic, relocation, the radial. |
| `js/net.js` | 1415 | The duel relay: BroadcastChannel lobby, deterministic lockstep, the seat lens, the agreement fingerprint. |
| `js/config.js` | 3697 | Tunables, tower/enemy/wave data, maps, talent trees. **Every magic number belongs here**, named, with a comment saying what it protects against. |
| `js/commanders.js` | 1200 | `Meta`, the save file, profiles, progression, the soul vault. |
| `js/ai.js` | 1118 | The rival commander. Loadout drafting, build/upgrade scoring, musters. |
| `js/entities2.js` | 1048 | The expansion behaviours, siren, saboteur, reanimation, marks. |
| `js/towers2.js` | 996 | Elements, the combo table, the expansion towers, arena modifiers, the twenty boons. |
| `js/audio.js` | 801 | Procedural Web Audio. No sample files anywhere. |
| `js/factions.js` | 670 | The four powers, their bonuses, and the twenty faction units with their doctrines. |
| `js/galaxy.js` | 646 | Galaxy generation, systems, worlds, contested slots. |
| `js/roster.js` | 473 | Commander roster and their traits. |
| `js/abilities.js` | 193 | Commander abilities. |
| `js/dialogue.js` | 192 | Portraits, the `art()` lookup, pre-battle dialogue. |
| `js/main.js` | 176 | Bootstrap and keyboard. |
| `js/artpack.js` | *generated* | 188 base64 images on four lines. Never hand-edit; see §6. |

`css/style.css` is structure, `css/polish.css` is everything added since. New
rules go in `polish.css`.

**Module order matters.** `build.js` concatenates in dependency order; if you add
a module, add it to that list in the right position or the bundle breaks while
the served version still works.

---

## 3. Working at the same time as other people

**Cross-repo protocol, signatures, code-comment conventions and the tooling
setup live in one place: `CONTRIBUTING.md` at the root of the
`claude-plugins-custom` repo, checked out as a sibling of this one.** That repo
is private, so the path is deliberately not a link: if you have commit access
here but not there, ask and you will be added. Read it first if you are new;
this section is the game-repo specifics.

- **Branch per change** for anything you want reviewed before it is live:
  `git checkout -b fix/siren-nside`. `main` is what
  <https://majieddd.github.io> serves, so a push to `main` IS a deploy.

  Being honest about current practice: the maintainers do commit small, gated
  changes straight to `main`, and the history shows it. That is workable only
  because `node tools/gate.js` runs green before every one of those pushes. If
  you are not running the full gate, branch. If you are, keep the commits small
  and one item each, because there is no review between you and the live site.
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
and let the others land their work, it is cheaper than the merge.

### What CI will fail you on

`.github/workflows/verify.yml` runs on every PR and every push to `main`. It is
cheap, and it is strict:

- `node --check` on every `js/*.js`, every `tools/*.js`, and `build.js`.
- `node build.js` must succeed, `aegis-protocol.html` must contain no
  `<script src=`, and `aegis-artifact.html` must still open with its
  `charset="utf-8"` prefix.
- **Every module in `js/` must be listed in `build.js`.** A module added to the
  folder but not the list works served and breaks bundled, the worst shape.
- **No CRLF.** `.gitattributes` pins the whole tree to `* text=auto eol=lf`, and
  CI fails on any file the index reports as `i/crlf` or `i/mixed`. This is the
  one that catches Windows contributors, and a patch script that rewrites a file
  with the wrong newline setting is how it happens.
- `js/artpack.js` must exist and carry at least 100 keys. It currently carries
  **281** (28 cmd, 106 world, 54 foe, 50 cut, 12 planet, 12 abil, 11 twr, 5 fac,
  plus title, nebula and blackhole). Count it, do not trust this line:
  `node -e "const s=require('fs').readFileSync('js/artpack.js','utf8');console.log(Object.keys(new Function(s+';return ARTPACK;')()).length)"`

Run the whole gate locally before you open the PR:

```bash
for f in js/*.js tools/*.js build.js; do node --check "$f" || echo "SYNTAX $f"; done
node build.js
git ls-files --eol | grep -E 'i/crlf|i/mixed'    # must print nothing
```

`.github/workflows/pages.yml` deploys `main` to <https://majieddd.github.io> on
its own, you never publish the site by hand. The **Artifact** surface named
above is the one that still needs a human; its permanent URL is at the top of
[`docs/ROADMAP.md`](docs/ROADMAP.md).

### Multiplayer

Merged and live since Session 21, `js/net.js`, a BroadcastChannel duel relay
with deterministic lockstep, protocol version `NET_PROTOCOL`. It merged only
after an adversarial audit found seven blocking defects the green suite could
not see; [`docs/MULTIPLAYER-HANDOFF.md`](docs/MULTIPLAYER-HANDOFF.md) carries
the audit story and keeps the original (wrong) diagnosis as history. If you
touch `js/net.js`, `js/game.js` or `js/ui.js`, run the duel harness as well as
the owner sweep:

```js
// paste tools/multiplayer_test.js, then:
MPT.all()        // must pass clean; the wire suite is async, pass a callback
```

Changing the command set or the fingerprint formula means bumping
`NET_PROTOCOL`, so an old window refuses to link rather than desyncing.

### Where the rest of the paper is

[`docs/ROADMAP.md`](docs/ROADMAP.md) is the resume-here document: every session's
decisions and what each item actually turned out to be. Its "REMAINING WORK"
block near the top is a Session-12 artifact and is marked superseded, plan from
[`docs/BACKLOG.md`](docs/BACKLOG.md), which is the live list.
[`docs/BRAND.md`](docs/BRAND.md) is binding before any art work,
[`docs/TOWER-AUDIT.md`](docs/TOWER-AUDIT.md) is why no two towers share an
identity, and [`docs/MECHANICS-OPTIONS.md`](docs/MECHANICS-OPTIONS.md) holds
fifteen designed-but-unbuilt mechanics awaiting an owner pick.

### The narrative spine, the canonical reference for everything on main

[`narrative/`](narrative/) (live at majieddd.github.io/narrative/) is the
generated reference for the whole game: every campaign in play order, every
tower, denizen, commander, boon, element, reaction, ability, wave modifier,
world, slide, story beat, timeline event and commander relationship, each with
a stable ref (`tower:flak`, `human/world/MARS`, `human/intro/slide7`) and a link
to the exact source line it was generated from. `narrative/spine.json` maps
every ref to its page anchor and source location, so an owner note quoted
against a ref resolves mechanically, for people and for the AI.

Three rules keep it canonical:

1. **It is generated, never hand-edited.** `node tools/storyboard.js` rebuilds
   it from the loaded game modules; a stat on those pages IS the stat in the
   game. Hand edits are overwritten by design. `narrative/assets/` is part of
   the derived output: the painted figures (commanders, denizens, abilities,
   banners, the few painted towers) are decoded out of `js/artpack.js` by the
   same run, orphans are deleted, and cards without painted art degrade to
   the entity's own colour and glyph rather than a placeholder. The tower and
   unit ICONS are the game's own procedural drawings, baked to files by
   `node tools/bake-icons.js <url>` (headless Chrome running the real
   painters); they are committed like the plates because the deploy
   regeneration is node-only, and `--check` fails naming the bake whenever a
   referenced icon is missing, so a new tower cannot ship iconless.
2. **It cannot go stale.** `tools/gate.js` runs `storyboard.js --check`, which
   regenerates in memory and fails on any diff, and
   `.github/workflows/pages.yml` regenerates it on every push to main, so the
   published document always describes exactly the commit being published.
3. **Coverage is asserted.** The generator throws if any tower, denizen,
   commander or boon fails to render, if a ref is duplicated, or if a source
   line cannot be located exactly once. A red gate beats a spine that lies.

If you add a table (a new entity class the game reads), add its cards and its
refs to `tools/storyboard.js` in the same change, or the new class is invisible
to every future review. `narrative/CHANGES.html` is separate: a point-in-time
session review written by `tools/storyboard_changes.js`, not regenerated.

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
- **`sendPaths` has exactly TWO entries** on the tri and radial builders, it is a
  legacy accessor. Indexing it by seat breaks at seat 2 and up, which froze the
  whole battle because `Game.loop` has no try/catch. Use `Game.rivalOf(side)` and
  `sendTriPaths[side][victim]`, the way `Game.muster` does.
- **Any number the UI prints must equal what the engine computes.** Seven separate
  desyncs have shipped: a preview that forgot the galaxy tier, a tooltip quoting
  the authored growth rate instead of the charged one, a panel promising 21 souls
  while paying 6. `Game.waveHpMul(n, rage)` is *the* definition, call it, never
  re-derive it.
- **`build.js` aborts** if the literal word `stylesheet` or `<script src=`
  survives into the bundle. That is a guard, not a bug.
- **A string is not a number.** `seed >>> 0` on a string is always `0`, so every
  galaxy was identical for weeks. Hash strings properly.
- **Seeds must be stable.** Python's `hash()` is salted per process; `artgen`
  uses FNV-1a so a re-render reproduces the same image.

---

## 5. Verify before you open the PR

### The one command

Most of the time you want this and nothing else:

```bash
python -m http.server 8601 --bind 127.0.0.1     # from the repo root
node tools/gate.js http://127.0.0.1:8601
```

That runs every node-side gate (parse, em dash, bytes, `build.js`'s module
list, the build itself) and then owner-sweep and MPT in real browsers, each on
its own fresh page so the ordering rule below is satisfied by construction
rather than by memory. It prints about eight lines, exits non-zero on any
failure, and takes roughly 25 seconds. Add `--quick` to skip MPT, or
`--static` for the node-side gates only.

It reports counts plus failing rows, never passing detail. A green owner-sweep
result object is 11,325 characters of which four numbers matter, and reading
the full dump six times in a session is how a verification pass gets
expensive for no added confidence.

### The harnesses on their own

When you need one harness in isolation, or the full detail of a specific
check, they live in `tools/`. Neither is a test runner: each is **loaded into
the browser console** of a page already open on a served, cache-busted build.
Nothing to install, nothing to import.

Prefer `fetch` over pasting. `(0, eval)(await (await fetch('/tools/owner-sweep.js')).text())`
runs the tracked file and costs a URL; pasting the same 69KB costs about
20,000 tokens and runs a copy you cannot diff against the repo.

```js
// 0. serve the repo (§1), open aegis-protocol.html?v=1, and FRONT the tab.

// 1. paste the entire contents of tools/owner-sweep.js
//    → 36 behaviour probes, 40 verdicts. Returns {pass, fail, info, checks}
//      and parks the same object on window.__SWEEP. Green is fail:0, last
//      run 40 pass / 0 fail.
//    → it MUTATES game state. Reload before you do anything else.
//    → run it from the LOADOUT screen: checks 19.12 and 19.15 read live DOM and
//      report INFO (a skip, not a failure) anywhere else, or in a hidden tab.

// ORDER MATTERS when sharing one page: run the OWNER SWEEP before the
//    multiplayer harness. MPT wraps UI methods for instrumentation, and three
//    sweep checks grep function SOURCE; run after MPT they read the wrappers
//    and fail with details that look like passes. Measured, Session 26.

// 2. paste the entire contents of tools/balance-pins.js → 'PINS ready'
PINS.fresh(6)          // fresh profile, six maps, one call
PINS.maxed(3, 0)       // maxed profile at galaxy TIER 0, three maps, one call

// ...or drive one long run by hand. A maxed run outlasts a single tool call,
// so the loop is deliberately resumable:
PINS.maxProfile(0); PINS.begin(0, 'contested');
PINS.tick(20000)       // repeat until {done: true}
// Read `.outcome` ('loss' | 'win' | 'capped'), never `.wave` alone, see below.
```

**The pins.** Mirror-AI on both seats, loadout pinned to
`bolt/cryo/mortar/flak/beacon`:

- fresh profile → **loss median wave 11** (seeds 1000-1005)
- maxed unlocks at **galaxy tier 0** → **loss median wave 31** (seeds 1000-1005)

Both were re-based in Session 22 for the summoning rites and the gentler early
ramp; the Session-21 figures were 8 and 22. Read
[`docs/BALANCE-BASELINE.md`](docs/BALANCE-BASELINE.md) before you treat a
movement as a regression, **this harness is only comparable inside one browser
session**, and a cross-session comparison has already produced one false alarm.

**Seed them, or the numbers mean nothing.** `PINS.begin(map, diff, seed)` takes
a seed and the run replays exactly; unseeded, one map has produced death waves
5, 6, 13, 19, 19, 20 and 21 on the same build. Use map index `i` with seed
`1000 + i` to reproduce the table in
[`docs/BALANCE-BASELINE.md`](docs/BALANCE-BASELINE.md), and run
`PINS.selfTest(0, 1234)` first, it must report `reproducible: true`. Load the
harness into a page that has **not yet run a match**, because the AI-prototype
snapshot it restores has to be pristine.

The old unseeded claim that *every loss is under wave 10* is **false** and was
never true: `coil` loses at 10 and `shattered` at 13, reproducibly. The
Session-20 maxed pin of *27* was the top of its range, not the median.

Two ways to measure these wrong, both of which have produced a false alarm:

1. **Passing a tower pool to `AI.pickLoadout` does not filter cores**, `pool`
   only sets a budget. An unpinned run silently re-bases the whole measurement.
2. **Measure the maxed pin at tier 0.** Galaxy tier feeds `waveScaled`, so a
   maxed profile stamped tier 4 dies around wave 12 and reads as a catastrophe
   when nothing changed.

Also note a run can end *either way*, a maxed `delta` run finishes at wave 7
having eliminated the rival. Compare losses with losses.

If you touched economy, AI, or anything in a talent tree, re-measure both pins
and put the numbers in the PR description.

**A third way to mis-measure the maxed pin:** unlocks are shelved per faction
banner since 19.6, so writing the retired flat `v.unlocked` list leaves the
"maxed" profile holding a single tower. `tools/balance-pins.js` already writes
every shelf; if you fork it, keep that.

**Anything animated must be verified in a FRONTED tab.** A backgrounded tab
throttles `requestAnimationFrame` to *zero* frames, measured: 0 frames in
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

**The `python` on your PATH is probably not the one that can render.** Only
`sdxl_all.py` needs torch, and it imports it at module scope, so on an
interpreter without torch the very first art command dies before rendering
anything:

```
$ python artgen/sdxl_all.py
  File "...\artgen\sdxl_all.py", line 15, in <module>
    import torch
ModuleNotFoundError: No module named 'torch'
```

That reads as "artgen is broken", and the misreading is reinforced by the other
three commands *succeeding* on that same interpreter: `derive_worlds.py` and
`derive_crests.py` import only Pillow, and `krea_gen.py` imports torch lazily
inside the render path, so `--pack` never touches it. A repack works, a render
fails, and nothing about it looks consistent. Check the interpreter before you
blame the code:

```bash
python -c "import sys, torch; print(sys.executable, torch.__version__, torch.cuda.is_available())"
```

On the machine this was built on, the interpreter that answers is
`%LOCALAPPDATA%\Programs\Python\Python312\python.exe`, Python 3.12.10, torch
2.5.1+cu121, CUDA `True`, with diffusers and transformers, while the bare
`python` first on PATH is a 3.11 virtualenv carrying Pillow and no torch. Call
that full path for anything that renders, or put it first on PATH for the
session. The Python that serves the game in §1 is unrelated: any Python 3 does.

```bash
python artgen/sdxl_all.py        # render anything missing (~1 min, needs CUDA)
python artgen/derive_worlds.py   # deterministic duotone variants (PIL)
python artgen/derive_crests.py   # crest hues, forced in code rather than prompted
python artgen/krea_gen.py --pack # assemble js/artpack.js
node build.js
```

The pipeline lives **inside this repository** at `artgen/`, along with its
`cache/`, `cache_krea/` and the `krea2-turbo/` model checkout (all three
gitignored, the model alone is 34GB, and `python artgen/dl_krea.py` is the only
thing that fetches it; nothing else in the pipeline will). It used to sit in a
sibling directory,
and that cost a whole session of art work: the Session 19 troop prefix was
edited there, rendered there, and never reached version control, so the pack
shipped correct while the source that produced it did not exist in the repo.
Run the scripts from the repository root and there is only one copy to edit.

`artgen/krea_jobs.py` is the single catalogue for both models. Read
[`docs/BRAND.md`](docs/BRAND.md) before generating anything, the visual identity
is locked, and two prompt rules are load-bearing:

- **CLIP truncates at 77 tokens.** Anything past that is silently discarded. All
  49 enemy dossiers shipped amber because the accent instruction sat at token
  ~114 and never reached the model. Put the important words *first*.
- **Guidance is 0, so the negative prompt is inert.** You cannot subtract; you can
  only lead with what you want.

Hue cannot be reliably prompted. Where an exact colour matters, the faction
crests, it is forced in code by `derive_crests.py`, which lands within 4.5°.

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
