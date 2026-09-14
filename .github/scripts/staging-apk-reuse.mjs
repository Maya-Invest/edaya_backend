import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.RELEASE_ROOT || "..");
const mobile = resolve(root, "edaya_mobile");
const destination = resolve(mobile, "release-apks");
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const apps = ["guardian", "teacher"];
const candidate = {
  repositories: Object.fromEntries(["backend", "identity", "frontend", "mobile"].map(name => [name, execFileSync("git", ["rev-parse", "HEAD"], { cwd: resolve(root, `edaya_${name}`), encoding: "utf8" }).trim()])),
  flutter: "3.44.8",
  authUrl: "https://staging.identity.api.edayaplus.com",
  apiUrl: "https://staging.school.api.edayaplus.com",
  firebase: Object.fromEntries(apps.map(app => [app, hash(resolve(mobile, `apps/${app}/android/app/google-services.json`))])),
};
if (process.argv[2] === "record") {
  const apks = Object.fromEntries(apps.map(app => [app, hash(resolve(destination, `edaya-${app}-staging.apk`))]));
  writeFileSync(resolve(destination, "apk-source.json"), `${JSON.stringify({ candidate, apks }, null, 2)}\n`);
} else if (process.argv[2] === "restore") {
  const previous = resolve(root, ".release-private/retry-apks");
  let hit = false;
  if (existsSync(resolve(previous, "apk-source.json"))) {
    const saved = JSON.parse(readFileSync(resolve(previous, "apk-source.json"), "utf8"));
    if (JSON.stringify(saved.candidate) === JSON.stringify(candidate)) {
      for (const app of apps) {
        if (hash(resolve(previous, `edaya-${app}-staging.apk`)) !== saved.apks[app]) throw new Error("Previous APK artifact checksum mismatch");
      }
      mkdirSync(destination, { recursive: true });
      for (const name of [...apps.map(app => `edaya-${app}-staging.apk`), "apk-source.json", "SHA256SUMS"]) copyFileSync(resolve(previous, name), resolve(destination, name));
      hit = true;
    }
  }
  // The next workflow step independently verifies signatures against the current keystore.
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `hit=${hit}\n`);
  console.log(hit ? "Reusing matching signed APK artifacts from the earlier attempt" : "No matching prepared APK artifacts; a fresh build is required");
} else throw new Error("Expected record or restore");
