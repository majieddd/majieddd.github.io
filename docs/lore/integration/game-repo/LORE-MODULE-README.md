
# Generated Lore Module

`js/lore.generated.js` is an implementation-ready payload generated from the lore repository's stable-ID JSON. It intentionally contains no simulation logic.

Integration steps:

1. Copy it to the game repository as `js/lore.js`.
2. Add `js/lore.js` to `build.js` after faction/config definitions are available but before UI/dialogue code consumes it.
3. Read only optional lore fields in UI, codex, art-generation, and dialogue surfaces.
4. Do not use lore text or relationship state in the deterministic simulation fingerprint.
5. Regenerate from source JSON after canonical changes; never hand-edit the generated file.
