# Exhaustive Tooling Sweep + Live Defects, Session 28

16 sources. **85,623 listings enumerated.** 64 candidates advanced, 61 unique after
dedupe, 22 adversarially vetted. 49 agents, 2,163 tool calls, 5.9M subagent tokens,
70 minutes.

Verdicts: 1 ADOPT, 2 RECOMMEND, 4 MARGINAL, 15 REJECT.

---

## Part A. Live defects found and verified

These are not tooling opinions. Each was measured against the running game.

### A1. The 0 FAIL invariant is broken. VERIFIED.

Measured via headless CDP at 1600x900, harness loaded by fetch:

```
pass 56 | fail 1 | info 2 | total 59
FAIL  25.3 every power is skewed differently
```

The suite is 59 checks now, not 58. Root cause isolated to one clause of three:

| Clause | Test | Result |
|---|---|---|
| defensive | `light.lives (25) > human.lives (30)` | **FALSE** |
| defensive | `light.leak (2) < human.leak (3)` | true |
| difficult | `xeno.gold (0.92) < human.gold (1)` and `brood 1.14 > 1` | true |
| scrappy | `pirate.dmg (1.14) > human.dmg (1.1)`, `range 0.93 < 1.1` | true |

Full measured skew table:

| faction | cmd | lives | dmg | range | gold | leak | brood |
|---|---|---|---|---|---|---|---|
| human | vanta | 30 | 1.10 | 1.10 | 1.00 | 3 | 1.00 |
| light | seraph | 25 | 1.08 | 1.08 | 1.00 | 2 | 1.00 |
| xeno | sevra | 20 | 1.00 | 1.00 | 0.92 | 3 | 1.14 |
| pirate | rake | 20 | 1.14 | 0.93 | 1.30 | 3 | 1.00 |
| robot | axiom | 20 | 0.827 | 0.827 | 1.00 | 3 | 1.00 |

Cause: base lives are 20. `js/factions.js:25` gives **human +10 lives** plus +10% to
every tower statistic. `js/factions.js:45` gives **light +5 lives**. So the generalist
faction out-defends the defensive faction on the lives axis.

**This is an owner decision, not a bug I should pick.** Two coherent readings:

- **The check is wrong.** `js/factions.js:55` states Light's identity in its own words:
  their defence "is measured in lives rather than in damage: a leak costs them less."
  That is the leak clause, which passes. Asserting `L.lives > H.lives` tests something
  the design never claimed. Fix: drop the lives clause, keep leak.
- **The data is wrong.** If Light is meant to be the defensive faction outright, it
  should hold more lives than the generalist. Fix: raise light, or lower human's +10.

Secondary defect either way: the failure message prints light and xeno and pirate values
but never the human baseline it compares against, so the check cannot be diagnosed from
its own output. Print both sides of every comparison.

### A2. Eight towers can never be drafted by the AI. VERIFIED.

`AI.pickLoadout` (js/ai.js:94) holds 20 core arrays, every one **5 entries long**.
`LOADOUT_SIZE = 4` (js/config.js:2235) and `Game.start` truncates with
`.slice(0, LOADOUT_SIZE)` (js/game.js:619). Slot 5 is discarded every time.

Eight ids appear in a core **only** in a discarded fifth slot:

```
beacon, vault, siphon, reckoning, siren, canister, quartermaster, custodian
```

The opponent commander can never build any of them. Same root cause reaches the
harnesses: `tools/multiplayer_test.js:42` sets
`PIN_LOADOUT = ['bolt','cryo','mortar','flak','beacon']`, 5 long, so beacon is silently
dropped there, while `tools/balance-pins.js` reassigns
`Game.sides[0].loadout = PIN.slice()` **after** start, bypassing truncation. The two
harnesses therefore disagree about whether beacon is in the loadout.

### A3. Ten escaped em dashes survived the cleanup. VERIFIED.

The Session 26 pass grepped for the literal character and `&mdash;`. It never checked
`—`, so ten escaped ones remain in player-facing strings:

```
js/factions.js:209,234,279,306   desc:'AURA — ...'
js/ui.js:461                     'ABANDON — FORFEIT GALAXY'
js/ui.js:1114, 6454, 6462, 6857, 6865
```

Plus 13 literal em dashes inside string literals. Inconsistency underneath it:
`js/config.js:2432` writes `'AURA: machines within 3 tiles...'` with a colon while
`js/factions.js:209` writes `'AURA — ...'`. Same construct, two forms.

Total across the repo including comments: 285.

### A4. Motion law violations. VERIFIED.

21 `transition: all` rules (15 in `css/style.css`, 6 in `css/polish.css`).
2 rules animate `width` (`css/style.css:419`, `:429`), which forces layout every frame.
19 `prefers-reduced-motion` blocks exist, so coverage is real.

### A5. Error buffer nobody reads. VERIFIED.

`Game.loopErrors` is written at js/game.js:3716-3718 and the comment at :3695 says it is
parked "for the sweep to read". Grep across all three harnesses returns 0, 0, 0.
A `catch (e) {}` at `tools/owner-sweep.js:487` sits inside 22.10, the only check that
runs render code. Measured this session: `Game.loopErrors` was empty, so nothing is
currently hidden, but the reader does not exist.

### Passing cleanly

No horizontal overflow at 375, 768, 1280, 1600. Zero pure black or white surfaces.
Zero contrast failures on visible text. Zero button labels wrapping across 56 buttons.
Zero console errors. `Net.lockstepAudit()` clean, NET_PROTOCOL 6.

---

## Part B. Tooling verdicts

### ADOPT: puppeteer-core

The one unambiguous adopt. Install **outside** the repo so gate 1 holds:

```bash
mkdir -p "/c/Users/Majied LaFleur/.claude/tools/pptr" && cd "$_"
npm init -y && npm install puppeteer-core --no-audit --no-fund
```

Measured: full harness run emits 1,211 bytes of stdout (~300 tokens) against 153,449
bytes of harness source that would otherwise page into context. Wall clock: launch 0.5s,
load 0.2s, sweep 5.2s, MPT 9.1s.

Footprint is larger than its listing claimed: 23.1MB, 2,225 files, 23 packages.

**Critical measured caveat:** bare `chrome.exe --headless` (old mode) produced **fail=44
against a true fail=1** on this codebase. Old headless breaks layout-dependent checks.
Use `--headless=new` via CDP, or puppeteer. My CDP driver used `--headless=new` and
reproduced the correct fail=1 independently.

### RECOMMEND: abagames/agentic-gamedev-skills, narrowed to one skill

Install **only** `generating-semantic-game-mutants`. It fills a measured empty gap: zero
mutation or fault-injection machinery exists anywhere in the project, so the detection
rate of the 94 harness checks is unknown by construction. This is the instrument that
measures it. `node build.js` runs in 0.327s, so the per-mutant rebuild is cheap.

Skip `evaluating-gameplay-balance` (wrong branch for a seeded project). All six
descriptions cost 3,838 bytes resident. Known trigger collision with
`obra/superpowers` systematic-debugging, which the upstream README itself warns about.

### RECOMMEND: SawyerHood/dev-browser

Works, measured: sweep 4.96s warm. But it is **the same win agent-browser was already
recommended for** in Session 27. Pick one, not both. Given puppeteer-core is now ADOPT
and my CDP driver already works at zero install, this is likely redundant.

### MARGINAL (4)

| Tool | Condition |
|---|---|
| image-diff (pulsemcp) | **Do not install as pitched.** Three captures of the *unmodified* page differ by 411 to 523 pixels across 34 to 41 clusters. It emits `identical: false` with confident bounding boxes on builds where nothing changed, which manufactures exactly the top failure mode. Needs a determinism harness first. A 165-line zero-dependency `tools/pixdiff.js` was written during vetting and is the better path. |
| planning-with-files | Stop hook is real enforcement. But it writes `.planning/`, `task_plan.md`, `findings.md` into a **public repo**. Requires .gitignore entries first. 300 to 390ms per hook fire. |
| context-hogs | Zero hot-path cost. But its auto-generated advice says verbatim do not read `js/ui.js` in full, which is actively wrong for this project. Install only with that output ignored. |

### REJECT (15)

`maintain-verification-skill` (Cursor paths, no Claude Code manifest, and the repo has no
target so it stops at step 0), `obra/superpowers-chrome`, `BlockWatch`, `node:test`
snapshots, `browse` (gstack), `rtk`, `Hookify`, `Clear-Sights/Makoto`,
`gamedev-skills/awesome-gamedev-agent-skills`, `fast-check 4.9.0`, `codebase-memory-mcp`,
`tasks-axi`, `dead-rules-audit`, `no-vibes`, and `dev-browser` under its duplicate entry.

---

## Part C. What shipped

`aegis-gamedev` skill, installed at `~/.claude/skills/aegis-gamedev` as a junction to
`claude-plugins-custom/aegis-gamedev`. Six files, 90,000 characters, zero em dashes,
53 of 53 `file:line` citations verified in range and 7 of 7 spot-checked for content
accuracy.

Router repaired: the parallel authoring agents invented four reference filenames that
were never written (`gates.md`, `ui-quality.md`, `balance-probes.md`, `process.md`) and
omitted the five that were. Table now resolves, and UI work routes to `design-forge`.

## Open decisions

1. Check 25.3: fix the check, or fix the data? (A1)
2. Fix the 8 undraftable towers by extending `LOADOUT_SIZE` to 5, or trimming the cores
   to 4? (A2)
3. Fix the 10 escaped em dashes and 21 `transition: all` rules? (A3, A4)
4. Install puppeteer-core, and `generating-semantic-game-mutants`?
