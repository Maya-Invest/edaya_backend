// Copy only a defined, credential-free subset of integration evidence.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.RELEASE_ROOT || "..");
const output = resolve(root, "release");
mkdirSync(output, { recursive: true });
if (process.argv[2] !== "browser") throw new Error("Expected browser evidence mode");
const source = resolve(root, "edaya_frontend/apps/webapp/.integration-run/summary.json");
if (!existsSync(source)) throw new Error("Provisioned browser summary is missing");
const summary = JSON.parse(readFileSync(source, "utf8"));
const evidence = {
  generatedAt: summary.generatedAt,
  provisioningMode: summary.provisioningMode,
  matrix: summary.matrix,
  excludedModules: [...new Set(summary.excludedModules || [])],
  blockers: (summary.blockers || []).map(({ module, action, status, source }) => ({ module, action, status, source })),
};
writeFileSync(resolve(output, "browser-integration.json"), `${JSON.stringify(evidence, null, 2)}\n`);
console.log("Recorded browser counts and blocker categories without tenant credentials");
