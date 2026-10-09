import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { candidateRepositories, repositoryNames } from "./staging-candidate.mjs";
import { staging } from "./staging-target.mjs";
import { candidatePublicationRecord } from "./client-publication.mjs";

const root = resolve(process.env.RELEASE_ROOT || "..");
const output = resolve(root, "release");
mkdirSync(output, { recursive: true });
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
const repositories = candidateRepositories(root);
const digest = path => existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null;
const packageVersion = path => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).version : null;
const apkDir = resolve(root, "edaya_mobile/release-apks");
const apks = existsSync(apkDir) ? readdirSync(apkDir).filter(name => name.endsWith(".apk")).map(name => ({
  file: name, sha256: createHash("sha256").update(readFileSync(resolve(apkDir, name))).digest("hex"),
})) : [];
const readiness = process.env.REPOSITORY_READINESS === "true";
const evidence = name => JSON.parse(readFileSync(resolve(output, name), "utf8"));
if (readiness && process.env.RELEASE_STATUS === "qualified") {
  if (process.env.VALIDATE_ONLY !== "true" || process.env.RESET_DATA !== "false") throw new Error("Invalid readiness boundary");
  readFileSync(resolve(output, "qualification-passed.txt"));
  if (evidence("bootstrap-rehearsal.json").passed !== true || evidence("mobile-staging-runner/summary.json").ok !== true)
    throw new Error("Readiness rehearsal or runner validation is incomplete");
  for (const [file, role] of [["browser-integration.json", "frontend"], ["mobile-integration.json", "mobile"]]) {
    const record = evidence(file);
    if (record.commit !== repositories[role].sha || record.backendCommit !== repositories.backend.sha || !Object.keys(record.suites).length || Object.values(record.suites).some(suite => suite.passed !== true))
      throw new Error("Integration evidence does not qualify the current candidate");
  }
  const provenance = JSON.parse(readFileSync(resolve(apkDir, "apk-source.json"), "utf8"));
  for (const [name, repo] of Object.entries(repositories)) {
    if (provenance.candidate.repositories[name] !== repo.sha) throw new Error("APK candidate differs from readiness candidate");
  }
  const signatures = JSON.parse(readFileSync(resolve(apkDir, "signatures.json"), "utf8"));
  for (const app of ["guardian", "teacher"]) {
    const sha = digest(resolve(apkDir, `edaya-${app}-staging.apk`));
    if (!sha || provenance.apks[app] !== sha || signatures.find(record => record.app === app)?.sha256 !== sha)
      throw new Error("Signed APK evidence is incomplete");
  }
  for (const app of ["webapp", "webadmin"]) if (!digest(resolve(output, `builds/${app}.tar.gz`))) throw new Error("Web build is missing");
  if (!existsSync(resolve(output, "builds/api/worker.js"))) throw new Error("API Worker build is missing");
}
const manifest = {
  schemaVersion: 4, validateOnly: process.env.VALIDATE_ONLY === "true", createdAt: new Date().toISOString(), target: "staging",
  status: process.env.RELEASE_STATUS || "candidate", resetData: process.env.RESET_DATA === "true",
  workflowRun: process.env.GITHUB_RUN_ID ? `https://github.com/Maya-Invest/edaya_backend/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  repositories,
  clients: { api: `0.0.0-staging.${repositories.backend.sha}` },
  clientPublication: candidatePublicationRecord(existsSync(resolve(output, "client-publication.json")) ? JSON.parse(readFileSync(resolve(output, "client-publication.json"), "utf8")) : undefined, repositories.backend.sha),
  toolchains: { bun: run("bun", ["--version"]), node: process.version, flutter: JSON.parse(run("flutter", ["--version", "--machine"])) },
  dependencies: {
    lockSha256: Object.fromEntries(repositoryNames.map(name => [name, digest(resolve(root, `edaya_${name}`, name === "mobile" ? "pubspec.lock" : "bun.lock"))])),
    openapiSha256: digest(resolve(root, "edaya_backend/tooling/repo/fixtures/openapi.json")),
    wrangler: Object.fromEntries([["backend", "api"], ["frontend", "webapp"], ["frontend", "webadmin"]].map(([repo, app]) => [app, packageVersion(resolve(root, `edaya_${repo}/apps/${app}/node_modules/wrangler/package.json`))])),
  },
  backendWorker: { configurationSha256: digest(resolve(root, "edaya_backend/apps/api/wrangler.jsonc")), name: "edaya-api-staging" },
  urls: staging.urls, apks,
  androidSignatures: existsSync(resolve(apkDir, "signatures.json")) ? JSON.parse(readFileSync(resolve(apkDir, "signatures.json"), "utf8")) : null,
  workers: existsSync(resolve(output, "worker-versions.json")) ? JSON.parse(readFileSync(resolve(output, "worker-versions.json"), "utf8")) : null,
  ...(readiness ? { readiness: {
    repositoriesAndBuilds: process.env.RELEASE_STATUS === "qualified" ? "passed" : "not-qualified",
    liveInfrastructure: "not-evaluated", deployedAcceptance: "not-evaluated", ios: "not-evaluated",
    builds: Object.fromEntries(["webapp.tar.gz", "webadmin.tar.gz", "api/worker.js"].map(file => [file, digest(resolve(output, "builds", file))])),
  } } : {}),
};
writeFileSync(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest: ${output}/manifest.json`);
