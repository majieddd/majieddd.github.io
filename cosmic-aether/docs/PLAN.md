# COSMIC CONQUEST: AETHER

A high-definition cinematic remaster lane derived from the live
`cosmic-reliquary-v1.3.html` build. Same universe law, same faction identity,
same zero-dependency single-file guarantee. The picture is rebuilt around a
physically grounded render path while the painterly path stays available as
Classic mode.

## What this lane adds (over v1.3)

**Engine**
- MSAA 4x/8x via multisampled renderbuffers + `blitFramebuffer` resolve
  (per-attachment, single-buffer draw FBO per blit, measured on D3D11 ANGLE).
- Shadow maps up to 4096 with a 16-tap rotated Poisson PCF.
- SSAO-lite (half-res, 8 taps over the packed normal+depth attachment).
- Log-average auto-exposure with history blend (8x8 ping-pong; no readPixels).
- Anamorphic streak pass over bloom.
- HD composite: ACES, lift/gain grade, hued vignette, grain, subtle halftone.

**Shaders (HD path)**
- Soft-quantised 10-step ramp (gentler gradients, no hard cel steps).
- GGX microfacet specular + Schlick fresnel + Smith visibility.
- Material classes (metal / hull / stone / organic / energy / ground) with a
  procedural 1024 detail atlas: height (normal perturbation), roughness,
  albedo micro, ridge mask.
- Backlit translucency (SSS) for energy and organic materials.
- Cinematic sky: 3-scale warped nebula, galactic band, twinkling starfield
  with flare stars, cloud-swirled ringed planet with atmosphere rim, sun
  halo + glare.

**Contents**
- Every mesh carries a material class per part (terrain = ground, plinths =
  stone, turrets = hull, barrels = metal, denizen cores = energy).

## Rounds ledger (see docs/ROUNDS.md) and the 5-round discipline

Each portion gets five passes: implement, measure/refine, adversarial review,
polish, regression. The ledger records what each round did and the evidence.

## Verification

```bash
python -m http.server 8741 --bind 127.0.0.1   # from repo root
node cosmic-aether/tools/gate.js http://127.0.0.1:8741
# Real GPU (MSAA path):
AEGIS_GPU=1 node cosmic-aether/tools/headless.js http://127.0.0.1:8741/cosmic-aether/index.html \
  cosmic-aether/tools/out cosmic-aether/tools/shots-gpu.steps.cjs
```

## Notes
- "Classic" style keeps the v1.3 painterly pipeline intact (`R.setStyle`).
- Every shader compiles against both paths; style switching is a program
  selection, not a rebuild.

## Handover

New collaborator? Start at HANDOVER.md at the lane root: what the game is,
where it lives, run/build/verify runbook, architecture map, conventions,
gotchas, and the current verified state.
