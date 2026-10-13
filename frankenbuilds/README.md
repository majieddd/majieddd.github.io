# Majied Frankenbuilds

A single-page site for budget multi-GPU builds, ranked by memory bandwidth per dollar.
Pick a build from the dropdown (or a tab, or a `#build-N` deep link) to see its specs,
live listing links, stock status, and throughput math.

## Files

| File | What it is |
|---|---|
| `index.html` | the site — data-driven, renders from `data/builds.json` |
| `data/builds.json` | the single source of truth: builds, components, prices, links, stock |
| `refresh.py` | re-verifies every listing over a real browser and rewrites the data file |
| `add_build.py` | validates and appends a new build (sum, gates, live stock check) |

## Keeping listings accurate

`python refresh.py` drives a real browser (Helium/Chromium over CDP, port 9224) to every
unique listing URL, reads the live price, quantity available, buyable, and ENDED state, and
rewrites `data/builds.json`. Any listing that is ENDED, unbuyable, out of stock, or whose
price moved is **flagged on its component line**, and the site shows the flag in red. Totals
are recomputed from verified prices, never trusted.

Exit code 0 = every listing verified in stock. Exit code 1 = at least one flagged.

```
python refresh.py            # verify + write
python refresh.py --dry-run   # verify, report, do not write
python refresh.py --port 9224
```

## Stock quantity (the gate that "in stock" does not satisfy)

A line the build buys **N** of is only purchasable when the listings can supply
**N**. "In stock" on a listing holding 2 units does not build a 19-GPU rig, so
the site enforces it in three places:

- `audit.py` rule **`stock-qty`** — a hard count below the need is a FAIL;
  `"More than N available"` is a FLOOR (proves N+1), so a need above it is a
  WARN (unproven), never a defect.
- `builder.py` — a candidate whose parts cannot supply the rig is rejected, so
  a dominance claim is never built on a rig you cannot assemble.
- `refresh.py` — re-reads every source's live count and flags a short line.

When one listing cannot supply the need, the line is **sourced across listings**
the way a rig is actually bought: `repair_qty_sources.py` allocates
cheapest-first across the primary listing plus the alternates the sweep
recorded, sets the line's price to the blended per-unit cost, and records
`sources` so the site shows where each unit comes from. A line no listings can
supply stays flagged — that is a real market limit and the site says so.

`python catalog_sweep.py --quantities` reads the availability line on every
item page. eBay search cards carry no quantity line, so without this pass the
catalog has `qty=None`, which means **unknown** — treating unknown as "1 in
stock" would flag live listings as short. A listing with no printed count has
no seller-set cap, so it is never counted as 1.

```
python catalog_sweep.py --quantities   # fill qty/qty_floor on every listing
python repair_qty_sources.py           # source short lines + relist flagged ones
python repair_qty_sources.py --dry-run
```

`repair_qty_sources.py` also **relists** a flagged line onto the catalog's
verified listing for the same spec key, recording `relisted` on the component.
A line with no catalog replacement keeps its flag.

## Adding a build

`python add_build.py new_build.json --max-cost 6000 --min-bw 3000`

A build is rejected if any component lacks a live URL, the component sum exceeds the cost
gate, throughput is below the bandwidth gate, or any listing fails the live stock check.
The total is always recomputed from the component lines — a stated total is never trusted.

## Throughput math

Total memory bandwidth = (GPU HBM bandwidth × GPU count) + system DDR bandwidth.

DDR = channels × 8 bytes (64-bit channel) × MT/s ÷ 1000. 8-channel DDR4-2400 = 153.6 GB/s;
16-channel DDR4-2666 = 341.1 GB/s. NVLink is GPU-to-GPU fabric and is counted separately.

## Serving

```
python -m http.server 8912 --bind 127.0.0.1
cloudflared tunnel --url http://127.0.0.1:8912   # prints a public trycloudflare.com URL
```

Canonical URL: https://majieddd.github.io/frankenbuilds/ (GitHub Pages, deployed by
`deploy_pages.py` through the contents API — the Cloudflare quick tunnel is ephemeral).

## Compatibility audit (rule engine, no LLM)

`specs.py` is the single source of hardware facts: every part carries the tags the
rules reason over — socket, supported CPU generations, TDP limit, DIMM slots, memory
type, M.2 interfaces, PCIe slot widths, power connectors, passive-cooling needs.
`audit.py` reads those tags off each build component and returns findings:

```
python audit.py            # every build; exit 1 if any build FAILS
python audit.py --json     # machine-readable
python audit.py --build build-7
python export_audit.py     # writes data/audit.json for the site's audit panel
python tag_components.py   # stamps (section, spec) tags onto build components
```

Rules cover: CPU socket, CPU generation (LGA1151 v1 vs v2 share a socket SHAPE and
are electrically incompatible), socket TDP, iGPU-required boards, SoC boards, CPU
socket count, headless-CPU display path, memory type/slots/max/speed, GPU count vs
PCIe slots, PCIe slot bandwidth, PCIe vs CPU/EPS connector counts (same shape,
different pinout — never interchangeable), wattage headroom, multi-PSU trigger
boards, mains input voltage, passive-card airflow, frame GPU capacity, riser count,
SXM2 baseboards, drive interface vs the board's M.2, and component sum == stated total.

`builder.py` runs the audit on its own candidate and REFUSES to append a rig that
cannot be assembled. A dominance claim on an unbuildable rig is worthless.

The first run of the engine found real defects in 5 of the 7 published builds — a
7th-gen Pentium in an 8th/9th-gen-only board, an NVMe drive in a SATA3-only M.2
slot (the drive is not detected, so the rig had no boot drive), 20 PCIe connectors
for 12 cards needing 24, and a second supply with no trigger board to start it.
All are repaired with verified listings; `repair_build7.py` and
`repair_psu_builds.py` record what changed and why.

## Price history (Prices page)

`history.py` appends one point per component per UTC day to `data/history.json`:
the asking price, the normalized unit price, stock, seller and listing URL.
Re-running the same day REPLACES that day's point, so the series stays one point
per day and nothing is ever deleted.

```
python history.py          # append today
python history.py --show   # series summary, writes nothing
```

Each component card plots two series: the raw asking price (the price-shift
dynamics) and the same series normalized to the unit you buy — $/GB VRAM for a
GPU, $/GB RAM for memory, $/W for a supply, $/GPU-slot for a board, frame, riser
or shroud — so a $75 card and a $22 board are comparable on what is getting more
expensive. The loop runs `history.py` every pass, so the charts fill in over time.

## Design notes

shadcn/ui conventions: CSS-variable theme tokens with background/foreground pairs, a derived
radius scale from a single `--radius`, `ring` for focus outlines, `secondary`/`chart` tokens,
dark mode toggled by overriding tokens under a theme selector, and a skeleton loading state.
Motion uses three cubic-bezier curves (enter, pop, tap) with a `prefers-reduced-motion`
override. Layout is verified to fit a 390px phone viewport (the comparison table scrolls
inside a wrapper; long tokens wrap).
