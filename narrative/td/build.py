#!/usr/bin/env python3
"""Bake td_lowpoly.html: a single self-contained artifact.

Order:
  1. Vendor three.module.js at top as a classic script, with its trailing
     `export{...};` converted to `window.THREE = { ... };` so the rest of the
     page (classic scripts) can see it as a global.
  2. Concatenate 00_head.html + numbered src modules in order.
  3. node --check every JS module first.
"""
import os, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
VENDOR = ROOT / "vendor" / "three.module.js"
OUT = ROOT / "td_lowpoly.html"          # served copy, lives beside the source
PUBLIC = ROOT.parent / "td_lowpoly.html"  # the public artifact name on the site

def main():
    if not VENDOR.exists():
        sys.exit("missing vendor/three.module.js")
    # syntax-check each module
    for p in sorted(SRC.glob("*.js")):
        r = subprocess.run(["node", "--check", str(p)], capture_output=True)
        if r.returncode != 0:
            sys.exit("node --check FAILED for %s\n%s" % (p, r.stderr.decode("utf-8", "replace")))
    # convert three ESM -> classic that assigns window.THREE
    three = VENDOR.read_text(encoding="utf-8")
    # The module ends with a single `export{ a as A, b as B, ... };`
    import re
    m = re.search(r"export\s*\{(.*)\}\s*;?\s*$", three, re.S)
    if not m:
        sys.exit("could not find export block in three.module.js")
    spec = m.group(1)
    # each entry is "internal as Public"  ->  "Public: internal"
    pairs = []
    for entry in spec.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if " as " in entry:
            internal, public = entry.split(" as ", 1)
            pairs.append("%s: %s" % (public.strip(), internal.strip()))
        else:
            pairs.append("%s: %s" % (entry.strip(), entry.strip()))
    three_classic = three[:m.start()] + "\nwindow.THREE = { " + ", ".join(pairs) + " };\n"
    # strip any other stray top-level `export ` defensively (none expected in r160 min)
    three_classic = re.sub(r"^\s*export\s+(?=const|let|var|function|class)", "//export ", three_classic, flags=re.M)

    head = (SRC / "00_head.html").read_text(encoding="utf-8")
    # ensure <script> tags wrap each module; head already has <body> + structure, close with scripts
    parts = [head]
    parts.append("\n<script>\n" + three_classic + "\n</script>\n")
    for p in sorted(SRC.glob("*.js")):
        parts.append("\n<script>\n" + p.read_text(encoding="utf-8") + "\n</script>\n")
    parts.append("\n</body>\n</html>\n")
    OUT.write_text("".join(parts), encoding="utf-8")
    PUBLIC.write_text("".join(parts), encoding="utf-8")
    print("WROTE", OUT, "size", OUT.stat().st_size)
    print("WROTE", PUBLIC, "size", PUBLIC.stat().st_size)

if __name__ == "__main__":
    main()
