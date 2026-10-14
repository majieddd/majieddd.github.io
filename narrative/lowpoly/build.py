#!/usr/bin/env python3
"""Build the low-poly Tower Defense demo.

For every module in src/, copy to a temp file, run `node --check` to confirm
syntax, then concatenate head + modules + closing tags into one HTML at
narrative/td_lowpoly.html. The artifact is self-contained: zero external
requests, no images, no build step on the client.

Usage: python build.py [src] [out]
"""
import os, subprocess, sys, tempfile, pathlib

ROOT=pathlib.Path(__file__).resolve().parent
SRC=ROOT/"src"
OUT_DEFAULT=ROOT.parent/"td_lowpoly.html"

def main():
    src=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else SRC
    out=pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else OUT_DEFAULT
    files=sorted(src.iterdir(), key=lambda p: p.name)
    # 00_head.html is the head, others are JS modules
    head=src/"00_head.html"
    if not head.exists():
        sys.exit("missing 00_head.html")
    modules=[p for p in files if p.suffix==".js"]
    # Syntax check every module with node --check
    for m in modules:
        with tempfile.TemporaryDirectory() as td:
            tmp=pathlib.Path(td)/m.name
            tmp.write_text(m.read_text(encoding="utf-8"), encoding="utf-8")
            r=subprocess.run(["node","--check",str(tmp)], capture_output=True)
            if r.returncode!=0:
                sys.exit("node --check FAILED for "+str(m)+"\n"+r.stderr.decode("utf-8","replace"))
    # Fuse
    parts=[head.read_text(encoding="utf-8")]
    for m in modules:
        body=m.read_text(encoding="utf-8")
        # Strip any leading "use strict" / "/* ... */" headers (we add our own)
        parts.append("\n<script>\n"+body+"\n</script>\n")
    parts.append("\n</body></html>\n")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(parts), encoding="utf-8")
    print("WROTE", out, "size", out.stat().st_size, "modules", len(modules))

if __name__=="__main__":
    main()
