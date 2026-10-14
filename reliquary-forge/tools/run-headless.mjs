import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(toolDir, "..");
const headless = resolve(projectDir, "../reliquary/tools/headless.js");

export function runHeadless(url, outputName, stepsName) {
  const output = resolve(toolDir, "out", outputName);
  const steps = resolve(toolDir, stepsName);
  mkdirSync(output, { recursive: true });
  const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const run = spawnSync(process.execPath, [headless, url, output, steps], {
    cwd: projectDir,
    env: { ...process.env, CHROME_PATH: chrome },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (run.status !== 0) throw new Error(`headless failed: ${run.stderr || run.stdout}`);
  return { report: JSON.parse(run.stdout), output };
}

export function probes(report) {
  const map = new Map();
  for (const result of report.results || []) {
    if (result.value && result.value.probe) map.set(result.value.probe, result.value);
  }
  return map;
}
