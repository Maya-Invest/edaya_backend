import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const qualificationPhases = ["backend-verification", "frontend-verification", "generated-contract", "backend-integration", "seed-integration", "native-integration", "bootstrap-rehearsal", "mobile-verification", "mobile-runner", "browser-integration", "mobile-integration", "worker-build"];
export function assertQualification(report) {
  if (Object.keys(report.phases).length !== qualificationPhases.length || qualificationPhases.some(name => report.phases[name]?.exitCode !== 0))
    throw new Error("Required qualification phases are missing or failed");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = resolve(process.env.RELEASE_ROOT, "release");
  const path = resolve(output, "qualification.json");
  const name = process.argv[2];
  mkdirSync(output, { recursive: true });
  const report = name === "start" ? { startedAt: new Date().toISOString(), phases: {} } : JSON.parse(readFileSync(path, "utf8"));
  if (name !== "start") {
    if (!qualificationPhases.includes(name) || !/^\d+$/.test(process.argv[3] ?? "")) throw new Error("Invalid qualification result");
    report.phases[name] = { exitCode: Number(process.argv[3]), completedAt: new Date().toISOString() };
  }
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
}
