# Game Repository Integration

This directory contains a non-applied patch for the separate game repository.

Apply only after the lore repository exists publicly:

```bash
cd path/to/majieddd.github.io
git switch -c docs/lore-repository-link
git apply path/to/cosmic-conquest-lore/integration/game-repo/lore-link.patch
git add README.md docs/LORE-CONTRACT.md
git commit -m "docs: link canonical lore repository"
```

Review the resulting links before pushing.

## Implementation checklist

See [`COPY-REWRITE-CHECKLIST.md`](COPY-REWRITE-CHECKLIST.md) for the exact presentation-only retrofit sequence and validation gate.
