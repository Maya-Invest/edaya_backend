import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { staging } from "./staging-target.mjs";

const root = resolve(process.env.RELEASE_ROOT || "..");
const output = resolve(root, "release");
mkdirSync(output, { recursive: true });
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, encoding: "utf8" }).trim();
const repositories = Object.fromEntries(["backend", "identity", "frontend", "mobile"].map(name => {
  const directory = resolve(root, `edaya_${name}`);
  return [name, { sha: run("git", ["rev-parse", "HEAD"], directory), repository: run("git", ["config", "--get", "remote.origin.url"], directory).replace(/https:\/\/[^/]*@/, "https://") }];
}));
const digest = path => existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null;
const packageVersion = path => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).version : null;
const apkDir = resolve(root, "edaya_mobile/release-apks");
const apks = existsSync(apkDir) ? readdirSync(apkDir).filter(name => name.endsWith(".apk")).map(name => ({
  file: name, sha256: createHash("sha256").update(readFileSync(resolve(apkDir, name))).digest("hex"),
})) : [];
const manifest = {
  schemaVersion: 2, createdAt: new Date().toISOString(), target: "staging",
  status: process.env.RELEASE_STATUS || "candidate", resetData: process.env.RESET_DATA === "true",
  workflowRun: process.env.GITHUB_RUN_ID ? `https://github.com/Maya-Invest/edaya_backend/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  repositories,
  clients: { api: `0.0.0-staging.${repositories.backend.sha}`, identity: `0.0.0-staging.${repositories.identity.sha}` },
  clientPublication: existsSync(resolve(output, "client-publication.json")) ? JSON.parse(readFileSync(resolve(output, "client-publication.json"), "utf8")) : { api: "unverified", identity: "unverified" },
  toolchains: { bun: run("bun", ["--version"]), node: process.version, flutter: JSON.parse(run("flutter", ["--version", "--machine"])) },
  dependencies: {
    lockSha256: Object.fromEntries(["backend", "identity", "frontend", "mobile"].map(name => [name, digest(resolve(root, `edaya_${name}`, name === "mobile" ? "pubspec.lock" : "bun.lock"))])),
    openapiSha256: Object.fromEntries(["backend", "identity"].map(name => [name, digest(resolve(root, `edaya_${name}/tooling/repo/fixtures/openapi.json`))])),
    wrangler: Object.fromEntries([["backend", "api"], ["identity", "identity"], ["frontend", "webapp"], ["frontend", "webadmin"]].map(([repo, app]) => [app, packageVersion(resolve(root, `edaya_${repo}/apps/${app}/node_modules/wrangler/package.json`))])),
  },
  urls: staging.urls, apks,
  androidSignatures: existsSync(resolve(apkDir, "signatures.json")) ? JSON.parse(readFileSync(resolve(apkDir, "signatures.json"), "utf8")) : null,
  workers: existsSync(resolve(output, "worker-versions.json")) ? JSON.parse(readFileSync(resolve(output, "worker-versions.json"), "utf8")) : null,
};
writeFileSync(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Release manifest: ${output}/manifest.json`);
