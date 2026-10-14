import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runHeadless, probes } from "./run-headless.mjs";

const url = process.argv[2] || process.env.FORGE_URL || "http://127.0.0.1:8752/";
const checks = [];
const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
const { report, output } = runHeadless(url, "adversarial", "adversarial.steps.cjs");
const p = probes(report);
const setup = p.get("stress-setup");
const benchmark = p.get("stress-benchmark");
const state = p.get("state-invariants");
const shadow = p.get("stress-shadow");
const ultra = p.get("ultra");
const mobile = p.get("mobile-stress");

check("hostile combat load", setup?.enemies >= 44 && setup?.towers === 12, JSON.stringify(setup));
check("stress benchmark diagnostic is valid", Number.isFinite(benchmark?.p95) && benchmark?.drawCalls < 180 && benchmark?.errors === 0, JSON.stringify(benchmark));
check("state remains finite and unique", state?.finite === true && state?.unique === true && state?.gold >= 0 && state?.lives >= 0 && state?.errors?.length === 0, JSON.stringify(state));
check("shadow volume survives extreme orbit", shadow?.matrixDelta < 1e-8, JSON.stringify(shadow));
check("explicit ultra profile and boss articulation", ultra?.stats?.quality === "ultra" && ultra?.animationParts >= 4 && ultra?.errors?.length === 0, JSON.stringify(ultra));
check("mobile stress has no page overflow", mobile?.overflow <= 0 && mobile?.errors?.length === 0, JSON.stringify(mobile));
check("console remains clean", (report.consoleErrors || []).length === 0, JSON.stringify(report.consoleErrors || []));

const result = { url, pass: checks.filter((entry) => entry.pass).length, fail: checks.filter((entry) => !entry.pass).length, checks };
writeFileSync(join(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(`FORGE ADVERSARIAL ${result.pass}/${checks.length}`);
for (const entry of checks.filter((item) => !item.pass)) console.log(`FAIL ${entry.name}: ${entry.detail}`);
if (result.fail) process.exit(1);
