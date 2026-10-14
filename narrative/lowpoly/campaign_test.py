"""Drive a full 12-wave campaign and report per-wave state."""
import os, sys, time, json, subprocess, urllib.request, threading, http.server, socketserver, tempfile, pathlib
ROOT=pathlib.Path(__file__).resolve().parent
NARR=ROOT.parent
TD=NARR/"td_lowpoly.html"
PORT=8468
CHROME=r"C:\Program Files\Google\Chrome\Application\chrome.exe"
def main():
    os.chdir(str(NARR))
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*a,**k): pass
    srv=socketserver.TCPServer(("127.0.0.1",PORT), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(0.5)
    profile=tempfile.mkdtemp(prefix="camp-")
    args=[CHROME,"--headless=new",f"--user-data-dir={profile}",
          "--no-first-run","--disable-gpu","--remote-debugging-port=9444","--remote-allow-origins=*",
          f"http://127.0.0.1:{PORT}/td_lowpoly.html"]
    p=subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)
    import websocket
    pages=json.loads(urllib.request.urlopen("http://127.0.0.1:9444/json", timeout=3).read().decode())
    pg=[x for x in pages if x.get("type")=="page"][0]
    ws=websocket.create_connection(pg["webSocketDebuggerUrl"], timeout=5)
    def E(expr):
        ws.send(json.dumps({"id":1,"method":"Runtime.evaluate","params":{"expression":expr,"returnByValue":True}}))
        return json.loads(ws.recv())["result"]["result"].get("value")
    time.sleep(0.4)
    # dismiss intro
    E("document.getElementById('introStart').click()")
    time.sleep(0.4)
    E("LP.G.gold=9999")  # give ourselves a bank
    # Build a solid defense: every 4th tile, all tower kinds, then upgrade everyone
    plan=[]
    towers=[(2,1),(4,1),(6,1),(8,1),(10,1),(12,1),
            (1,3),(3,3),(5,3),(7,3),(9,3),(11,3),
            (1,5),(3,5),(5,5),(7,5),(9,5),(11,5),
            (1,7),(3,7),(5,7),(7,7),(9,7),(11,7),
            (2,3),(4,3),(6,3),(8,3),(10,3)]
    kinds=["pulse","prism","thorn","mortar","gauss","cryo","spore","tesla"]
    for i,(x,z) in enumerate(towers):
        k=kinds[i % len(kinds)]
        E(f"window.__LP.select('{k}')")
        E(f"window.__LP.place({x},{z})")
    # Get state
    s=E("({towers:LP.G.towers.length, gold:LP.G.gold, status:LP.G.status})")
    print("BUILT:",s)
    # Now step the full campaign: each step = 1/60s. 12 waves * ~30s = 360s = 21600 steps.
    # Step in 30s chunks and report every chunk.
    history=[]
    for chunk in range(20):
        E("window.__LP.step(1800)")  # 30s
        s=E("({wave:LP.G.wave, status:LP.G.status, lives:LP.G.lives, gold:LP.G.gold, score:LP.G.score, kills:LP.G.kills, enemies:LP.G.enemies.length, towers:LP.G.towers.length})")
        history.append((chunk*30, s))
        print(f"t={chunk*30:4d}s  {s}")
        if s.get("status") in ("win","lose"):
            break
    final=history[-1][1]
    print("FINAL:",final)
    # If still playing after 10 minutes of sim, declare it a "no-end reached"
    p.terminate()
if __name__=="__main__":
    main()
