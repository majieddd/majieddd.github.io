import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { runHeadless, probes } from "./run-headless.mjs";

const project = resolve(import.meta.dirname, "..");
const url = process.argv[2] || process.env.FORGE_URL || "http://127.0.0.1:8752/";
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });

function sourceFiles(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === "dist" || entry === "out") continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, output);
    else if (/\.(ts|css|html|md|py|cjs|mjs)$/.test(entry)) output.push(path);
  }
  return output;
}

const manifest = JSON.parse(readFileSync(join(project, "public/assets/models/asset-manifest.json"), "utf8"));
const assets = Object.values(manifest.assets);
check("eight Blender GLB assets", assets.length === 8, `${assets.length} assets`);
check("authored geometry floor", assets.every((asset) => asset.triangles >= 3800), assets.map((asset) => asset.triangles).join(","));
const meshNodeBudget = (asset) => asset.file.includes("enemy-warden") ? 8 : 7;
// The Warden keeps an eighth mesh group because the cape is a separately animated silhouette, not unmerged static detail.
check("mesh consolidation", assets.every((asset) => asset.meshNodes <= meshNodeBudget(asset)), assets.map((asset) => asset.meshNodes).join(","));

const files = sourceFiles(project);
const dashCharacter = String.fromCodePoint(0x2014);
let emDash = 0;
let entityDash = 0;
let pure = 0;
let transitionAll = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  emDash += text.split(dashCharacter).length - 1;
  entityDash += (text.match(new RegExp("&" + "mdash;", "gi")) || []).length;
  if (file.endsWith(".css")) {
    pure += (text.match(/#(?:000|000000|fff|ffffff)\b/gi) || []).length;
    transitionAll += (text.match(/transition(?:-property)?\s*:[^;]*\ball\b/gi) || []).length;
  }
}
check("no em dash", emDash + entityDash === 0, `${emDash + entityDash} occurrences`);
check("no pure black or white CSS", pure === 0, `${pure} occurrences`);
check("no transition all", transitionAll === 0, `${transitionAll} occurrences`);

const { report, output } = runHeadless(url, "verify", "verify.steps.cjs");
const p = probes(report);
const boot = p.get("boot");
const animation = p.get("animation");
const build = p.get("build-rules");
const shadow = p.get("shadow-anchor");
const physical = p.get("physical");
const planet = p.get("planet-geometry");
const ui = p.get("ui");
const benchmark = p.get("benchmark");
const temporalAim = p.get("temporal-aim");
const mobile = p.get("mobile");
check("runtime boot", boot?.lineup?.length === 5 && boot?.towers === 3, JSON.stringify(boot));
check("semantic animation moves", animation?.parts >= 4 && animation?.maxDelta > 0.001, JSON.stringify(animation));
const grounding = physical?.grounding || [];
const facing = physical?.facing || [];
const towerFloor = grounding.filter((entry) => entry.type === "tower");
const groundEnemies = grounding.filter((entry) => entry.type === "enemy" && !["manta", "choir"].includes(entry.kind));
const flyingEnemies = grounding.filter((entry) => entry.type === "enemy" && ["manta", "choir"].includes(entry.kind));
check(
  "models are planted or deliberately airborne",
  towerFloor.length === 3 && towerFloor.every((entry) => Math.abs(entry.minY - entry.groundY - 0.42) <= 0.035)
    && groundEnemies.length >= 3 && groundEnemies.every((entry) => entry.minY - entry.groundY >= 0.145 && entry.minY - entry.groundY <= 0.26)
    && flyingEnemies.length >= 2 && flyingEnemies.every((entry) => entry.minY - entry.groundY >= 0.72),
  JSON.stringify(grounding),
);
check(
  "battlefield is a visible spherical cap",
  planet?.surfaceBounds?.[1] <= -5.2 && Math.abs(planet?.surfaceBounds?.[4] || 0) <= 0.01
    && planet?.worldBounds?.[1] <= -11.7 && planet?.worldBounds?.[4] >= 0.5
    && Math.abs(planet?.originNdc?.[0] || 0) <= 0.02 && Math.abs(planet?.originNdc?.[1] || 0) <= 0.05
    && planet?.frustumMeshes >= 90,
  JSON.stringify(planet),
);
check(
  "path and targeting facing are coherent",
  facing.filter((entry) => entry.type === "enemy").every((entry) => entry.dot >= 0.985)
    && facing.filter((entry) => entry.type === "tower").every((entry) => entry.dot >= 0.94),
  JSON.stringify(facing),
);
const aimFrames = temporalAim?.frames || [];
const stableAim = new Map();
for (const frame of aimFrames) {
  for (const target of frame.targets || []) {
    const matching = (frame.facing || []).find((entry) => entry.id === target[0]);
    if (!matching) continue;
    const entry = stableAim.get(target[0]) || { kind: target[1], targetId: target[2], frames: [] };
    if (entry.targetId === target[2]) entry.frames.push(matching);
    stableAim.set(target[0], entry);
  }
}
const stableWeapons = [...stableAim.values()].filter((entry) => entry.frames.length >= 30);
check(
  "weapons stay socket-aligned over time",
  stableWeapons.filter((entry) => entry.kind === "helios").length >= 2
    && stableWeapons.filter((entry) => entry.kind === "rime").length >= 2
    && stableWeapons.every((entry) => entry.frames.every((sample) => sample.dot >= 0.98 && Math.abs(sample.cross || 0) <= 0.1)),
  JSON.stringify([...stableAim.entries()]),
);
check("build occupancy rules", build?.duplicate === false && build?.badSlot === false && build?.wave === true, JSON.stringify(build));
check("camera-independent shadow matrix", shadow?.matrixDelta < 1e-8, JSON.stringify(shadow));
check("desktop UI geometry", ui?.pageOverflow <= 0 && ui?.buttonOverflow === 0 && ui?.focusMissing?.length === 0 && ui?.focusRule === true && ui?.reduced === true && ui?.navHeight <= 80, JSON.stringify(ui));
check("headless benchmark diagnostic is valid", Number.isFinite(benchmark?.p95) && benchmark?.drawCalls < 190 && benchmark?.errors === 0, JSON.stringify(benchmark));
check("mobile UI geometry", mobile?.pageOverflow <= 0 && mobile?.rail <= mobile?.viewport && mobile?.errors?.length === 0, JSON.stringify(mobile));
check("browser console clean", (report.consoleErrors || []).length === 0, JSON.stringify(report.consoleErrors || []));

const result = { url, pass: checks.filter((entry) => entry.pass).length, fail: checks.filter((entry) => !entry.pass).length, checks };
writeFileSync(join(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(`FORGE VERIFY ${result.pass}/${checks.length}`);
for (const entry of checks.filter((item) => !item.pass)) console.log(`FAIL ${entry.name}: ${entry.detail}`);
if (result.fail) process.exit(1);
