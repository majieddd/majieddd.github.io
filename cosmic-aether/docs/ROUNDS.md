# AETHER ROUNDS LEDGER

Five rounds per portion, per the owner's requirement. Each entry: what the
round did, how it was measured, the verdict. Rounds are tracking here so the
discipline survives interruption.

Legend: R1 implement baseline, R2 measure and refine, R3 adversarial review
(fresh-eyes critique, fix), R4 polish/coherence, R5 regression + evidence.

## Portion P1 Engine core (MSAA, shadows, GL layer)
- R1: GL.targetMSAA + blitResolve + shadow size cap + tier plumbing. Done.
- R2: GPU probe exposed the resolve bug: second blit wrote nothing (D3D11
  ANGLE honours DRAW_BUFFER[0] only). Rewrote blitResolve to detach, attach
  one texture, blit, restore. Evidence: probeMain reads rt.main.textures[0]
  = [0.16, 0.12, 0.38, 1.0] (was [0.46, 0.99, 0.51, 94.25] = normal+depth).
- R3: adversarial note: MSAA path was never exercised by the software
  headless gate; added AEGIS_GPU (--use-angle=d3d11) to the harness so the
  gate variant can run on real hardware. Fixed: probeMain readback tool.
- R4: shadowSizeCapped against maxTexture; software tier keeps medium.
- R5: gate 78/78 and 45/45 still green after engine changes (re-run before
  ship; see bottom).

## Portion P2 Shaders HD
- R1: SoftQ + GGX + DETAIL + MESH_HD_FS + SKY_HD_FS + AO/LUM/STREAK/HD
  composite. 
- R2: first GPU frame washed out; probe exposed P1 resolve bug, not P2.
  Also found band math double-multiplied (softQuant(tq * bands)) - rewrote
  to wrap * bands once. Evidence: close-up screenshots before (quilted
  cells, dark) and after (smooth gradient, grounded AO).
- R3: adversarial review of own shader: nebula floor() contour lines
  softened (0.62/0.38 to 0.46/0.28); ground cell rebuilt as pure grit
  (was lattice "net"); facet jitter 0.10 -> 0.04.
- R4: exposure 1.12, ambient x1.42, vignette x0.72, halftone/canvas at
  HD-appropriate 0.10/0.06.
- R5: pending final regression run.

## Portion P3 Textures
- R1: 1024 atlas, six 256px cells, RGBA = height/roughness/albedo/ridge.
- R2: fixed per-cell buffers (generators shared one buffer bug); metal()
  sw reference fixed.
- R3: ground cell re-authored (lattice -> grit); hull rib amplitude cut;
  ridge amplitudes tuned; MATERIALS det values lowered for ground.
- R4: uDetailScale 0.22; default material stone (was hull, ribby).
- R5: pending.

## Portion P4 Sky
- R1: warped 3-scale nebula, galactic band, twinkle+flare stars, planet
  with clouds + atmosphere, sun halo/glare.
- R2: nebula contour stripes softened; horizon haze tuned.
- R3: sun dir now matches the lighting dir (uSunDir from sun.dir).
- R4: pending (looks good on GPU shot).
- R5: pending.

## Portion P5 Models - PENDING (P6 rigs pending, P7 FX pending, P8 audio
## pending, P9 gameplay/UI pending, P10 perf pending, P11 verify pending)

## Cross-cutting findings
- The 404 in console errors is favicon.ico, benign, matches v1.3 baseline.
- 144 fps measured on RTX 4080 laptop at 1600x900 with all towers + wave
  active (14 draws, 40 shadow draws); pipeline has headroom.
