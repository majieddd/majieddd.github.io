---
id: publishing
title: Publishing and Collaboration
type: maintenance
status: core
evidence: A/F
last_reviewed: 2026-08-25
---

# Publishing and Collaboration

## First publication

From the full-history bundle on another machine:

```bash
git clone cosmic-conquest-lore-v0.2.0.bundle cosmic-conquest-lore
cd cosmic-conquest-lore
bash scripts/publish_repo.sh
```

The helper preserves the bundle as a `source-bundle` remote, creates the public
GitHub repository as `origin`, pushes `main` and tags, and sets the description,
homepage, and topics.

From the prepared repository folder:

```bash
gh auth login
gh repo create majieddd/cosmic-conquest-lore --public --source=. --remote=origin --push
```

The helper scripts wrap the same process:

```bash
bash scripts/publish_repo.sh
```

```powershell
.\scripts\publish_repo.ps1
```

## Enable the wiki site

After the first push:

1. Open the repository’s **Settings → Pages**.
2. Select **GitHub Actions** as the source.
3. Run or re-run the `Deploy lore wiki` workflow if needed.

The workflow validates the repository, builds MkDocs, uploads the Pages artifact, and deploys it.

## Daily collaboration

```bash
git switch main
git pull --rebase
git switch -c lore/short-description
# edit
python scripts/validate_lore.py
mkdocs build --strict
git add -A
git commit -m "lore: describe change"
git push -u origin HEAD
```

Open a pull request. Do not push unfinished canon directly to `main`.

## Other machines

A clone contains the complete human-readable and AI-readable source. The generated `site/` directory is disposable and ignored by Git.

## Releases

- Update `CHANGELOG.md`.
- Update version in `CITATION.cff`.
- Tag stable canon milestones such as `v0.2.0`.
- Archive major research snapshots rather than overwriting their original wording.
