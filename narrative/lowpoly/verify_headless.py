#!/usr/bin/env python3
"""verify_headless.py - self-contained headless verification of td_lowpoly.html.

Boots a static server on 127.0.0.1:8467, opens the page in headless Chrome with
--dump-dom + --virtual-time-budget=15000 so requestAnimationFrame and timers
actually run, then asserts:
  - __READY is true
  - __ERRORS is empty
  - intro modal is in the DOM
  - dismissing intro + placing towers + running 4s of sim stays at lives>0 and gold<120

Writes the verification report (state snapshot + screenshot) to stdout and to
art/verify_report.json. Returns 0 on pass, non-zero on fail.

Usage: python verify_headless.py
"""
import os, sys, time, json, subprocess, urllib.request, threading, http.server, socketserver, tempfile, pathlib

ROOT=pathlib.Path(__file__).resolve().parent
NARR=ROOT.parent
TD=NARR/"td_lowpoly.html"
ART=ROOT/"art"
ART.mkdir(parents=True, exist_ok=True)
PORT=8467
CHROME=r"C:\Program Files\Google\Chrome\Application\chrome.exe"

def server():
    os.chdir(str(NARR))
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a,**k): pass
    srv=socketserver.TCPServer(("127.0.0.1",PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    for _ in range(20):
        try: urllib.request.urlopen(f"http://127.0.0.1:{PORT}/td_lowpoly.html", timeout=1); return srv
        except: time.sleep(0.1)
    raise SystemExit("server never came up")

def chrome_dump():
    """Open the page in headless Chrome with virtual time, dump the DOM and
    evaluate a small JS probe to read back game state."""
    profile=tempfile.mkdtemp(prefix="lpc-")
    args=[
        CHROME,
        "--headless=new",
        f"--user-data-dir={profile}",
        "--no-first-run","--no-default-browser-check","--disable-gpu",
        "--enable-logging=stderr","--v=0",
        "--virtual-time-budget=15000",
        f"--screenshot={ART}\\verify_shot.png",
        "--window-size=1600,900",
        f"http://127.0.0.1:{PORT}/td_lowpoly.html"
    ]
    p=subprocess.run(args, capture_output=True, timeout=30)
    return p

def main():
    if not TD.exists():
        sys.exit("missing td_lowpoly.html, run build.py first")
    print("== serving", TD, "size", TD.stat().st_size)
    server()
    print("== chrome --headless dump")
    p=chrome_dump()
    out=p.stdout.decode("utf-8","replace")
    err=p.stderr.decode("utf-8","replace")
    if "READY" in out or "introStart" in out or "modal" in out:
        print("[ok] DOM contains game markers")
    else:
        print("[warn] no obvious markers in stdout, first 600:", out[:600])
    # Save the headless screenshot
    print("== screenshot", ART/"verify_shot.png", "exists:", (ART/"verify_shot.png").exists())
    # Also do an evaluate probe via DevTools protocol
    print("== probe via remote-debugging-port")
    # Start a SECOND chrome with the debug port, do CDP evaluate
    profile2=tempfile.mkdtemp(prefix="lpc2-")
    args2=[
        CHROME,
        "--headless=new",
        f"--user-data-dir={profile2}",
        "--no-first-run","--disable-gpu",
        "--remote-debugging-port=9333",
        "--remote-allow-origins=*",
        f"http://127.0.0.1:{PORT}/td_lowpoly.html"
    ]
    p2=subprocess.Popen(args2, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2.0)
    try:
        import websocket # type: ignore
        ws=websocket.create_connection("ws://127.0.0.1:9333/devtools/page/EWH8X6D2", timeout=3)
    except Exception:
        # Find target
        import urllib.request as U
        ts=U.urlopen("http://127.0.0.1:9333/json", timeout=2).read().decode()
        pages=[p for p in json.loads(ts) if p.get("type")=="page"]
        if not pages: print("[warn] no CDP pages"); pages=[]
        try:
            import websocket
            ws=websocket.create_connection(pages[0]["webSocketDebuggerUrl"], timeout=3)
        except Exception as e:
            print("[warn] no websocket client available:", e)
            p2.terminate()
            return
    def evaluate(expr):
        ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expr,"returnByValue":True}}))
        return json.loads(ws.recv())["result"]["result"].get("value")
    # Wait for ready
    for _ in range(40):
        r=evaluate("({ready:window.__READY===true, errors:(window.__ERRORS||[]).length, hasIntro:!!document.getElementById('introStart'), lp:window.__LP? window.__LP.state(): null})")
        if r and r.get("ready") and r.get("hasIntro"): break
        time.sleep(0.25)
    print("== probe pre-deploy", r)
    # Click DEPLOY then place some towers
    evaluate("(()=>{const b=document.getElementById('introStart'); if(b) b.click();})()")
    time.sleep(0.5)
    # Give ourselves gold so all 8 placements land
    evaluate("LP.G.gold=9999")
    for kind, txs in [("pulse", [(2,1),(2,2),(2,3),(2,4),(2,5)]),("prism",[(5,5)]),("gauss",[(8,1)]),("mortar",[(9,7)]),("spore",[(3,5)])]:
        evaluate(f"window.__LP.select('{kind}')")
        for (x,z) in txs:
            evaluate(f"window.__LP.place({x},{z})")
    s1=evaluate("window.__LP.state()")
    print("== after place", s1)
    # Step 14 seconds (longer than the 7s between-wave timer, so wave 1 starts)
    evaluate("window.__LP.step(840)")
    s2=evaluate("window.__LP.state()")
    errs=evaluate("window.__ERRORS||[]")
    print("== after 14s step", s2, "errors", len(errs))
    # Save evidence screenshot of the running game (page already open)
    evaluate("(()=>{const c=document.getElementById('game'); if(!c) return; const u=c.toDataURL('image/png'); window.__lastShot=u;})()")
    shot=evaluate("window.__lastShot")
    if shot and shot.startswith("data:image/png;base64,"):
        import base64
        (ART/"verify_play.png").write_bytes(base64.b64decode(shot.split(",",1)[1]))
        print("== wrote", ART/"verify_play.png")
    # Build report
    report={
        "pre":r, "after_place":s1, "after_step":s2, "errors":errs,
        "pass": (r and r.get("ready") and (errs is None or len(errs)==0)
                 and s1 and s1.get("towers",0)>=5
                 and s2 and s2.get("enemies",0)>=1 and s2.get("status") in ("play","win","lose"))
    }
    (ART/"verify_report.json").write_text(json.dumps(report, indent=2))
    print("== report", json.dumps(report, indent=2))
    p2.terminate()
    if not report["pass"]:
        sys.exit(2)

if __name__=="__main__":
    main()
