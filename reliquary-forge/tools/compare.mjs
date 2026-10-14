import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const originalUrl = process.argv[2] || "http://127.0.0.1:8742/reliquary/index.html";
const forgeUrl = process.argv[3] || "http://127.0.0.1:8752/";
const output = resolve(import.meta.dirname, "out", "comparison");
const profile = mkdtempSync(join(tmpdir(), "forge-compare-"));
const port = 10100 + Math.floor(Math.random() * 500);
mkdirSync(output, { recursive: true });

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--no-sandbox",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--mute-audio",
  "--autoplay-policy=no-user-gesture-required",
  "--disable-extensions",
  "--disable-background-networking",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1600,900",
  "about:blank",
], { stdio: "ignore" });

let socket;

async function cleanup() {
  if (socket) socket.close();
  chrome.kill();
  await Promise.race([new Promise((resolveExit) => chrome.once("exit", resolveExit)), delay(1800)]);
  rmSync(profile, { recursive: true, force: true });
}

async function main() {
  let version;
  for (let i = 0; i < 60; i += 1) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      break;
    } catch (error) {
      await delay(200);
    }
  }
  if (!version) throw new Error("Chrome debugger did not start");
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("Chrome page target missing");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolveOpen) => socket.addEventListener("open", resolveOpen, { once: true }));
  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.exceptionThrown") consoleErrors.push(message.params.exceptionDetails.text);
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") consoleErrors.push(message.params.entry.text);
  });
  const send = (method, params = {}) => new Promise((resolveSend, rejectSend) => {
    const messageId = ++id;
    pending.set(messageId, (message) => message.error ? rejectSend(new Error(`${method}: ${JSON.stringify(message.error)}`)) : resolveSend(message.result));
    socket.send(JSON.stringify({ id: messageId, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  };
  const navigate = async (url, wait = 3200) => {
    await send("Page.navigate", { url });
    await delay(wait);
  };
  const screenshot = async (name) => {
    const result = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(output, `${name}.png`), Buffer.from(result.data, "base64"));
  };
  const frameProbe = `(function(count){return new Promise(function(resolve){var a=new Float32Array(count),n=0,last=performance.now();function tick(now){a[n++]=now-last;last=now;if(n<count){requestAnimationFrame(tick);return;}var s=Array.from(a).sort(function(x,y){return x-y});resolve({samples:count,p50:+s[Math.floor(count*.5)].toFixed(2),p95:+s[Math.floor(count*.95)].toFixed(2),p99:+s[Math.min(count-1,Math.floor(count*.99))].toFixed(2),worst:+s[count-1].toFixed(2)});}requestAnimationFrame(tick);});})(75)`;

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

  await navigate(`${originalUrl}?compare=${Date.now()}`, 3500);
  await evaluate("window.__RQ.start({faction:'human',enemyFaction:'robotic',commander:'vanta',board:0,difficulty:1});var mid=GAME.state.board.path.length*.38;for(var i=0;i<27;i++){var d=SIM.spawnDenizen(['gnawling','tither','bloatpod','graft','stockman','hivelord'][i%6],{dist:mid+(i-13)*.82});if(d){d.hp=d.maxHp=80000;d.speed*=.28;}}GAME.state.gold=60000;window.__RQ.buildAll(60000);true");
  await delay(2200);
  await screenshot("original-load");
  const originalFrame = await evaluate(frameProbe);
  const originalRender = await evaluate("(function(){var r=R.stats();return {drawCalls:r.draws,shadowDraws:r.shadowDraws,particles:FX.count,units:GAME.state.denizens.length,scale:R.quality.scale,errors:window.__RQ.errorCount()};})()");

  await navigate(`${forgeUrl}?compare=${Date.now()}`, 2400);
  await evaluate("(async function(){await window.__FORGE.ready;window.__FORGE.start();window.__FORGE.buildAll();window.__FORGE.spawnStress(27);return true;})()");
  await delay(2600);
  await screenshot("forge-load");
  const forgeFrame = await evaluate("window.__FORGE.benchmark(75)");
  const forgeRender = await evaluate("window.__FORGE.stats()");

  const manifest = JSON.parse(readFileSync(resolve(import.meta.dirname, "../public/assets/models/asset-manifest.json"), "utf8"));
  const assetEntries = Object.values(manifest.assets);
  const report = {
    viewport: [1600, 900],
    browserProcess: "single",
    original: { ...originalFrame, ...originalRender },
    forge: { ...forgeFrame, renderStats: forgeRender },
    improvement: {
      p50Percent: Number(((1 - forgeFrame.p50 / originalFrame.p50) * 100).toFixed(1)),
      p95Percent: Number(((1 - forgeFrame.p95 / originalFrame.p95) * 100).toFixed(1)),
      drawCallPercent: Number(((1 - forgeFrame.drawCalls / originalRender.drawCalls) * 100).toFixed(1)),
    },
    assetFidelity: {
      authoredGlbAssets: assetEntries.length,
      totalTrianglesAcrossUniqueModels: assetEntries.reduce((sum, entry) => sum + entry.triangles, 0),
      maximumMeshNodesPerModel: Math.max(...assetEntries.map((entry) => entry.meshNodes)),
      semanticAnimationProbe: "verified by tools/verify.mjs",
    },
    consoleErrors,
  };
  writeFileSync(join(output, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`FORGE A/B p50 ${originalFrame.p50} -> ${forgeFrame.p50} ms (${report.improvement.p50Percent}% faster)`);
  console.log(`FORGE A/B p95 ${originalFrame.p95} -> ${forgeFrame.p95} ms (${report.improvement.p95Percent}% faster)`);
  console.log(`FORGE A/B draws ${originalRender.drawCalls} -> ${forgeFrame.drawCalls} (${report.improvement.drawCallPercent}% fewer)`);
  if (forgeFrame.p50 >= originalFrame.p50 || forgeFrame.p95 >= originalFrame.p95 || forgeFrame.drawCalls >= originalRender.drawCalls || forgeFrame.errors || originalRender.errors || consoleErrors.length) process.exitCode = 1;
}

try {
  await main();
} finally {
  await cleanup();
}
