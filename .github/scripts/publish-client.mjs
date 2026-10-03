import { assertReleaseMutationAllowed, candidateRepositories } from "./staging-candidate.mjs";
import { clientName, publicationStatus } from "./client-publication.mjs";
import { recordClient } from "./record-client.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

assertReleaseMutationAllowed();
const [directory, channel = "staging"] = process.argv.slice(2);
if (!directory || !/^[a-z0-9][a-z0-9._-]*$/.test(channel)) throw new Error("Expected package directory and channel");
const cwd = resolve(directory);
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd, encoding: "utf8" }).trim();
const pkgPath = resolve(cwd, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const name = clientName(pkg.name);
if (process.env.RELEASE_ROOT && sha !== candidateRepositories(resolve(process.env.RELEASE_ROOT)).backend.sha) throw new Error("Client source must match the backend candidate commit");
const version = `0.0.0-${channel}.${sha}`;
pkg.version = version;
pkg.edayaSourceCommit = sha;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
let published;
try {
  published = JSON.parse(execFileSync("npm", ["view", `${pkg.name}@${version}`, "edayaSourceCommit", "--json"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
} catch (error) {
  const diagnostic = String(error.stderr || "");
  if (!diagnostic.includes("E404")) throw new Error("Registry lookup failed; publication has not been attempted");
}
const status = publicationStatus(published, sha);
if (status === "reused") {
  console.log(`Reusing ${pkg.name}@${version}`);
} else {
  execFileSync("npm", ["publish", "--tag", channel], { cwd, stdio: "inherit" });
}
recordClient(name, version, sha, status);
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
}
