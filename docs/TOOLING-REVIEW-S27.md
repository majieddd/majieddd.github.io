# Tooling Review, Session 27

Four databases surveyed (buildwithclaude.com, claudemarketplaces.com,
majieddd.github.io/tool-scout, pluginmarketplace.ai). 33 candidates found, 10 taken to
adversarial vetting, 14 agents, 372 tool calls.

Every verdict below was reached by measurement against this repo, not by reading the
tool's README.

---

## Verdicts

| Tool | Verdict | Status |
|---|---|---|
| Headless Chrome screenshot (no install) | **ADOPT NOW** | Verified working, see below |
| agent-browser (vercel-labs) | RECOMMEND | Awaiting owner decision |
| chrome-devtools-mcp (Google) | RECOMMEND | Awaiting owner decision |
| Serena (oraios) MCP symbol server | RECOMMEND, with conditions | Awaiting owner decision |
| bravos-game-design | MARGINAL, extract 1 file only | Awaiting owner decision |
| ast-grep + agent-skill | REJECT | Closed |
| ast-grep MCP | REJECT | Closed |
| ast-outline | REJECT | Closed |
| vp-astgrep | REJECT | Closed |
| Claude Code LSPs (Piebald-AI) | REJECT | Closed |
| verify-claims skill | REJECT | Closed |

---

## 0. Zero-install screenshot path (VERIFIED 2026-08-25)

The Browser pane cannot composite, so `computer{action:'screenshot'}` has always timed
out here. A separately launched Chrome composites fine. Verified this session: produced
a 1MB PNG of the title screen, starfield canvas and all, with `--disable-gpu`
(SwiftShader CPU raster handles Canvas 2D).

```bash
# terminal 1
python -m http.server 8471 --bind 127.0.0.1

# terminal 2
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --virtual-time-budget=10000 --window-size=1600,900 \
  --screenshot="<abs-path>.png" "http://127.0.0.1:8471/index.html"
```

Costs nothing, installs nothing, works today. Use this before considering any browser
tool below. It gives one-shot capture only; the tools below add *stateful* capture
(drive to wave 12, then look).

Also verified: `claude-in-chrome` **cannot reach 127.0.0.1:8471 at all**. Navigation
returns `chrome-error://chromewebdata/` and the server access log records zero requests.
Not a substitute.

## 1. agent-browser, RECOMMEND, biggest token win

Rust CDP CLI, Apache-2.0, 41.3k stars. Spawns its own Chrome, so it is not a wrapper
over the pane.

The win: `owner-sweep.js` is 69,103 bytes and `multiplayer_test.js` is 72,322 bytes.
Today every run puts that text in the transcript, roughly 42k tokens per full pass,
repeated after every fix. Piping instead costs about 60 tokens and the harness body
never enters context.

```bash
cat tools/owner-sweep.js | agent-browser eval --stdin --json \
  | jq '{pass, fail, failures: [.checks[] | select(.verdict=="FAIL")]}'
```

Three corrections the candidate got wrong, caught by vetting:
- `cargo install` fails, cargo is not on this machine. Use `npm install -g agent-browser`.
- `--allow-file-access` is required to open the 7.6MB built artifact.
- The claim that it replaces polling loops is fabricated. owner-sweep.js has zero
  `await` and steps the sim synchronously. No wait to replace.

Operational: re-open the page before every run. The sweep mutates game state and the
daemon holds the browser for 1 hour, so a stale page silently poisons the next sweep.
Prefer the CLI over `agent-browser mcp`, which loads tool schemas into every session.

## 2. chrome-devtools-mcp, RECOMMEND, stateful verification

Google-maintained, Apache-2.0, npm 1.7.0. Adds what the bare screenshot cannot:
`performance_start_trace` (the only surveyed instrument that can answer "did this change
cost frame time", which balance-pins structurally cannot), multi-page control for
lockstep duels, and `filePath` output so sweep results become greppable artifacts rather
than summarized claims.

Two traps the candidate missed:
- `evaluate_script` takes code as a string argument, so pasting the harnesses inline
  costs ~20k tokens per run, worse than today. Load by fetch instead:
  `async () => (0,eval)(await (await fetch('/tools/owner-sweep.js')).text())`
- `MPT` is a top-level const with no `window.MPT` assignment, so it needs
  `globalThis.MPT = (0,eval)(t + ';MPT')` to survive between calls.

Install local scope only, never a committed `.mcp.json`, because majieddd.github.io is
public and the config would ship to the live repo. Pin 1.7.0, six releases in three
months.

## 3. Serena, RECOMMEND with hard conditions

MIT, 28.5k stars, active. Symbol-level navigation for ui.js (7,695 lines) and game.js.

Three conditions, all mandatory:
- **Install from git main, not PyPI.** PyPI 1.7.0 predates the fix for issue #1814, where
  `find_referencing_symbols` silently returns `{}` after tsserver OOMs and reports
  success. The issue calls it "the worst possible failure shape: fast, confident, and
  wrong." That is exactly this project's #1 failure mode.
- **Exclude `js/artpack.js`.** It is 5,691,186 characters on a single line and is
  git-tracked, so the gitignore default will not catch it. Needs both `.serena/project.yml`
  `ignored_paths` and a root `jsconfig.json`. Also exclude the two 7.6MB built HTMLs.
- **Use `find_symbol("UI", depth=1)`, not `get_symbols_overview`.** Overview defaults to
  depth 0 and returns three opaque object literals. depth=1 yields the 197 members.

Operating rule to encode in CLAUDE.md at install time: a NON-EMPTY reference result is
evidence; an EMPTY result is UNPROVEN, never "this modifier is inert." Loose config
fields like `pierce` are read through six untyped receivers that tsserver cannot resolve
in plain JS, so resolution degrades to smart-grep there. The clean wins are `UI.x` and
`Game.x`.

Realistic gain: 40 to 60% on locate-and-read, plus one eliminated round-trip, recurring
many times per batch. Not the "422KB to one body" that was pitched.

## 4. bravos-game-design, MARGINAL, take one file

21 markdown files, of which 1 carries the value: `diagnostic-patterns.md`, a 30-row
symptom / competing-cause / discriminating-probe / repair table. Rows that bite on a
121-tower roster: "Dominant route", "Progress without transformation", "Content
treadmill", "Many buttons one decision", "Metric substitution".

Why it matters: balance-pins measures how deep a run gets. It cannot tell you that four
of five cores collapse to one correct answer, or that an upgrade raises numbers without
changing any decision. Those are option-space questions, and pins are structurally blind
to them.

Do not install the plugin. It registers a 52-pack marketplace onto the trigger surface,
and its 3.4k-token router fires on every balance item. CC-BY-SA-4.0 permits copying the
one file with attribution.

Note: the pack does NOT add evidence discipline, contrary to its pitch. `balance-pins.js`
already scopes its own claims more carefully than the plugin's prose does.

## 5. The whole AST/structural-search family, REJECT (5 tools)

All five rejected for the same measured reason, which is worth recording because it will
come up again.

The bundled JS extractor in ast-grep descends into `class_declaration` only. There is no
rule for object-literal properties or method shorthand. This codebase is object literals:

- `js/ui.js` is 7,695 lines, of which 7,031 sit inside one `const UI = {`.
- `grep -rn '^\s*export\b' js/` returns **0**. Zero exports across all 32,414 lines.

So `ast-grep outline js/ui.js` emits about 20 entries and cannot locate `UI.renderSidebar`.
Directory mode defaults to exports and returns nothing at all. Meanwhile native Grep
already produces the 213-entry table of contents these tools promised:

```
Grep pattern '^  [A-Za-z_$][A-Za-z0-9_$]*\s*[:(]' path js/ui.js output_mode content -n true
   -> 213 entries: "79: init()", "117: renderTitle()", "164: show(id)" ...

Grep pattern '^(class |  [A-Za-z_$][A-Za-z0-9_$]*\s*\()' path js/entities.js -n true
   -> 212 entries covering all 7 classes and their methods
```

Worse, on the canonical inert-modifier bug (`critMult`), `grep -rn 'critMult' js/`
returns a complete 17-hit answer in ~400 tokens, while `$A.critMult` misses the
config.js definition sites `{ critMult: 3.0 }` (pair nodes, not member expressions) and
cannot separate read from write. It converts a complete slightly-noisy result into a
clean-looking incomplete one. That is the wrong direction for this project.

The LSP plugin additionally requires patching the Claude Code binary via
`npx tweakcc --apply`, and its headline features (goToDefinition, findReferences,
workspaceSymbol) are inert on 17 script tags with zero exports.

**Action taken instead:** put the two Grep one-liners above into CONTRIBUTING.md. Zero
install, zero third-party surface, strictly better output.

## 6. verify-claims, REJECT

Legitimate, honest, dependency-free work aimed at this project's most expensive defect
class, which is why it got a serious look. It fails on specifics: its method table
prescribes "grep the codebase" for exactly the State claims this project has repeatedly
proven grep cannot settle. The in-house discipline is already sharper.

---

## Open decisions for the owner

1. Install agent-browser? Largest token saving available, ~42k per full verification pass.
2. Install chrome-devtools-mcp? Only if stateful capture and frame-time traces are wanted;
   the free path in section 0 covers one-shot screenshots.
3. Install Serena from git main with the three conditions?
4. Extract `diagnostic-patterns.md` with attribution?

Sections 0 and 5 need no decision and are already actionable.
