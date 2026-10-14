# Start here (written 2026-08-27)

A fresh session has none of the context that produced this file. This is the
short version.

## Do this first

The Higgsfield MCP is authorised and connected. Run the **provider style test**
and report the verdict:

1. Generate `cut_human_sys1` and `cut_xeno_sys1` through the Higgsfield MCP.
   Prompts and target sizes are in `docs/API-STYLE-TEST.txt`.
2. Put each beside its local sibling: `art/cut_human_sys1.webp`,
   `art/cut_xeno_sys1.webp`.
3. Judge one thing only: **does it hold the house style** (ART-BIBLE section 1:
   flat expressive brushwork, hard-edged graphic shapes, gothic engraved
   linework, chromatic fringing, limited cyan/magenta/chrome palette).

Do **not** write trial output into `artgen/cache_krea/`. It is evidence, not
art. `docs/api-trial/` is the place.

**Also record what the tools say about credits.** If generation is metered per
image, "unlimited" does not reach the MCP and the Plus tier is not worth
buying. That is an open question, not a settled one.

## State of the world

- **Local Krea tier works and is the baseline.** RTX 5090, ~46s per 1920x1080
  plate, correct house style. A long re-paint of the `pcut_` class under the
  section 3 content law was running on 2026-08-27. Check whether it finished.
- **Adobe is a dead end, twice over.** Firefly Services API needs an Enterprise
  entitlement this account lacks; the Adobe connector is editing-only with no
  text-to-image. ART-BIBLE sections 12 and 13.
- **Artlist cannot be added from the CLI, and this is measured, not guessed.**
  Its Auth0 tenant answers `dynamic client registration is disabled`;
  `claude mcp login` holds no pre-issued client_id, so it must register
  dynamically and never can. Higgsfield allows DCR and returns a client_id
  instantly, that is the control that isolates the cause. The CLI entry was
  removed rather than left permanently unauthenticated. **The only way in is
  claude.ai → Settings → Connectors → Add custom connector**, URL
  `https://mcp.artlist.io/mcp`. Whether an account connector's tools then
  reach a Claude Code CLI session is UNCONFIRMED, the Adobe one connects but
  its tools have never loaded here.
  Artlist is still the more interesting candidate: reportedly usable on the
  free plan, and the only one covering music, SFX and voiceover. `js/audio.js`
  is pure Web Audio synthesis today, no recorded music, no SFX, no voice for
  cutscene dialogue. That is the real gap; images already work locally.
- **MCP tools load only at session start.** Authorising mid-session does
  nothing until a genuine restart (resuming a session is not enough).

## Owed work

- `pcut_00_robot_1` needs `python artgen/krea_gen.py --force pcut_00_robot_1`.
  Reason and the lesson behind it are in `docs/BACKLOG.md`.
- The three-panel planet cutscenes, commander portrait refresh and living
  portraiture loops are tracked in `docs/OWNER-DIRECTIVE-S38.md`.

## Tools worth knowing about

| File | What it does |
|---|---|
| `artgen/ingest_art.py` | Brings externally generated plates into the cache by key, at the right size and quality. Refuses to upscale. `--todo <prefix>` prints filename + prompt per uncached key |
| `artgen/api_trial.py` | Trials Leonardo or ModelsLab against the catalogue, writes to `docs/api-trial/`, never the cache. Network leg unexercised |
| `tools/attach.js` | Drives a Chrome you launched and are logged into. Needs a dedicated `--user-data-dir`; Chrome 136+ silently refuses the debug port on the default profile |
| `tools/mcp-setup.cmd` | Double-click menu to authorise Artlist / Higgsfield. Exists because `claude mcp login` needs a TTY and an agent shell has none |

## The rule this project keeps relearning

Measure the binding site before tuning it, and write the check's mutant before
trusting the check. Three separate defects this month were invisible because
the harness was structurally blind to them rather than because the code was
subtle.
