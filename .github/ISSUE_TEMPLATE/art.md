---
name: Art request
about: A missing, wrong, or off-brand image
labels: art
---

**Which key** — e.g. `foe_crawler`, `world_spine`, `cmd_vanta`

**What is wrong with it** — subject, palette, composition?

**Read first:** [docs/BRAND.md](../../docs/BRAND.md). The visual identity is
locked. Two rules decide most art bugs:

- CLIP truncates at **77 tokens** — anything later is silently discarded. All 49
  enemy dossiers once shipped amber because the accent instruction sat at token
  ~114 and never reached the model. Lead with what matters.
- Guidance is 0, so the **negative prompt is inert**. You cannot subtract, only
  lead with what you want.

Hue cannot be reliably prompted. Where an exact colour is required it is forced
in code — see `artgen/derive_crests.py`.
