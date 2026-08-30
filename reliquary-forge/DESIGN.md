# Reliquary Forge Design Contract

## North star

The interface is a compact command instrument bolted to the edge of an oil-painted celestial diorama. The world carries the spectacle. Controls feel machined, quiet, and immediate. Wet pigment, sculpted silhouettes, and luminous impact color provide the drama.

## Direction study

1. Orbital Diorama: a low-chrome isometric battlefield with the HUD pushed to the perimeter. Avenir Next Condensed with solar vermilion. Best for direct play and visual spectacle, weaker for dense metagame information.
2. War Table: a slower overhead camera with carved miniature forms and parchment-like tactical markings. Copperplate with oxidized teal. Best for strategic legibility, weaker for kinetic action.
3. Cathedral of Machines: low camera angles, monumental tower silhouettes, and strong vertical light shafts. Avenir Next Condensed with ember orange. Best for spectacle, weaker for placement precision.

Selected direction: Orbital Diorama with the Cathedral direction reserved for boss framing and tower silhouettes. It protects playability while giving the new assets a much more authored sense of scale.

## Dials

DESIGN_VARIANCE: 7/10
MOTION_INTENSITY: 7/10
VISUAL_DENSITY: 5/10

## Color tokens

| Token | Value | Role |
|---|---|---|
| --ground | oklch(0.11 0.025 255) | Page background |
| --surface | oklch(0.17 0.03 250 / 0.88) | Tactical overlays |
| --surface-raised | oklch(0.23 0.035 247 / 0.96) | Raised controls |
| --text | oklch(0.93 0.025 82) | Primary text |
| --text-muted | oklch(0.73 0.035 232) | Metadata |
| --text-faint | oklch(0.54 0.03 240) | Disabled state |
| --accent | oklch(0.76 0.16 58) | Solar vermilion, player agency and firepower |
| --accent-hover | oklch(0.82 0.15 67) | Primary hover |
| --semantic-2 | oklch(0.77 0.13 194) | Shielding, slow effects, and allied energy |
| --hairline | oklch(0.43 0.055 240 / 0.55) | Dividers and control outlines |
| --danger | oklch(0.67 0.2 25) | Damage and errors only |
| --success | oklch(0.74 0.14 150) | Confirmed construction |

No pure black or white. Solar vermilion is the only general accent. Cyan is semantic and only signals allied energy or slow state.

## Type

| Role | Family | Size | Weight | Tracking | Line height |
|---|---|---|---|---|---|
| Display | Avenir Next Condensed | 42px | 700 | -0.02em | 1.0 |
| Headline | Avenir Next Condensed | 24px | 650 | -0.01em | 1.12 |
| Title | Avenir Next Condensed | 16px | 650 | 0.02em | 1.2 |
| Body | Avenir Next | 14px | 500 | 0 | 1.6 |
| Caption | Avenir Next | 11px | 650 | 0.12em | 1.35 |
| Mono | SFMono-Regular | 12px | 650 | 0.04em | 1.2 |

Scale steps: 11, 12, 14, 16, 20, 24, 32, 42.

## Space and radius

Spacing steps: 4, 8, 12, 16, 24, 32, 48.
Radius steps: 2, 4, 8, 12.
Maximum content radius: 12px.

## Motion

UI easing: cubic-bezier(0.23, 1, 0.32, 1).
State motion: cubic-bezier(0.77, 0, 0.175, 1).
Interface duration budget: 220ms.
Frame-loop effects use clamped delta time. Cosmetic state is never read by the simulation. Reduced motion disables shake, parallax, travel, and dense particles while retaining opacity and color feedback.

## Primitives

| Primitive | Variants |
|---|---|
| .btn | primary, ghost, disabled |
| .objective | persistent mission chip |
| .status-strip | compact battle telemetry |
| .command-rail | build selection and wave control |
| .tower-button | selected, affordable, unavailable |
| .meter | boss health and progress |
| .codex | on-demand doctrine drawer |

## Elevation

Persistent surfaces use hairlines and a single dark occlusion shadow. Only the codex drawer receives raised elevation. Text and buttons never receive glow.

## Do not

- Do not frame all four corners with equal cards.
- Do not use purple gradients, glass decoration, or generic sci-fi grids.
- Do not animate keyboard commands or rapid build selection.
- Do not place lore over the central playfield.
- Do not add an accent without a semantic role.
- Do not hand-type style values outside the token file.
