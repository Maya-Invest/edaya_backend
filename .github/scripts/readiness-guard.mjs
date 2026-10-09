import { execFileSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readConfig } from "../../apps/api/configuration/index.mjs";
import { assertStagingConfiguration } from "./staging-target.mjs";

export function assertReadinessEnvironment(env) {
  if (env.VALIDATE_ONLY !== "true" || env.REPOSITORY_READINESS !== "true" || env.RESET_DATA !== "false")
    throw new Error("Repository readiness requires validation only and no reset");
  for (const key of Object.keys(env)) {
    if (/^(?:CLOUDFLARE_(?:API_TOKEN|API_KEY|EMAIL)|(?:STAGING_|PRODUCTION_)?(?:AUTH_)?DATABASE_URL|STAGING_(?:API|IDENTITY)_SECRETS|PG(?:HOST|SERVICE|DATABASE|PASSWORD)|SEED_.*|EDAYA_TEST_.*|ANDROID_SIGNING_BUNDLE)$/.test(key) && env[key])
      throw new Error(`Repository readiness must not inherit ${key}`);
  }
}

export function assertCleanCandidate(root) {
  for (const repo of ["edaya_backend", "edaya_frontend", "edaya_mobile"]) {
    const cwd = resolve(root, repo);
    const status = execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd, encoding: "utf8" });
    if (status.trim()) throw new Error(`${repo}: readiness requires a clean committed candidate`);
    // Bun and local test entrypoints can implicitly load ignored dotenv files.
    for (const path of [cwd, ...readdirSync(resolve(cwd, "apps")).map(app => resolve(cwd, "apps", app))]) {
      for (const name of readdirSync(path)) {
        if (/^(?:\.env|\.dev\.vars)(?:\.|$)/.test(name) && !name.endsWith(".example"))
          throw new Error(`${repo}: use a clean checkout without local environment files`);
      }
    }
  }
}

export function assertLintDependencies(repo) {
  const version = directory => {
    const require = createRequire(resolve(directory, "package.json"));
    return JSON.parse(readFileSync(require.resolve("@antfu/eslint-config/package.json"), "utf8")).version;
  };
  const expected = version(repo);
  for (const app of readdirSync(resolve(repo, "apps"))) {
    const directory = resolve(repo, "apps", app);
    if (existsSync(resolve(directory, "eslint.config.mjs")) && version(directory) !== expected)
      throw new Error(`${app}: stale nested lint dependencies; qualify a fresh frozen install`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv[2] === "--lint-dependencies") {
    assertLintDependencies(resolve(process.argv[3]));
    process.exit(0);
  }
  assertReadinessEnvironment(process.env);
  if (!process.version.startsWith("v22.")) throw new Error("Node 22 is required");
  assertCleanCandidate(process.env.RELEASE_ROOT);
  assertStagingConfiguration(readConfig("staging"));
  console.log("Clean readiness candidate and non-live environment verified");
}
