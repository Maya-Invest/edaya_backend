import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { observeStaging } from "./observe-staging.mjs";
import { assertHyperdrive, releaseOptions, staging } from "./staging-target.mjs";

const root = resolve(process.env.RELEASE_ROOT || "..");
const output = resolve(root, "release");
const privateDir = resolve(root, ".release-private");
const backend = resolve(root, "edaya_backend");
const identity = resolve(root, "edaya_backend");
const mobile = resolve(root, "edaya_mobile");
const web = resolve(root, "edaya_frontend");
const options = releaseOptions(process.env);
if (process.env.STAGING_NEON_TARGET_CONFIRMED !== staging.databaseHost) throw new Error("Confirm the live Neon project/branch and set STAGING_NEON_TARGET_CONFIRMED to its recorded endpoint before release");
if (!existsSync(resolve(output, "qualification-passed.txt"))) throw new Error("Candidate qualification is required");
const manifest = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
if (manifest.apks.length !== 2) throw new Error("Both signed APKs must be prepared before staging changes");
const parseSecrets = name => {
  try { return JSON.parse(process.env[name] || "null"); }
  catch { throw new Error(`Invalid JSON in ${name}; credential contents are omitted`); }
};
const apiSecrets = parseSecrets("STAGING_API_SECRETS");
const identitySecrets = parseSecrets("STAGING_IDENTITY_SECRETS");
for (const key of ["IDENTITY_DIRECTORY_SECRET", "R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "FCM_SERVICE_ACCOUNT_JSON"]) {
  if (!apiSecrets?.[key]) throw new Error(`Missing API secret ${key}`);
}
if (!identitySecrets?.ACCOUNT_SECURITY_KEYS) throw new Error("Durable Account encryption keys are required");
if (!identitySecrets?.BETTER_AUTH_SECRET || identitySecrets.BETTER_AUTH_SECRET.length < 32
  || identitySecrets.IDENTITY_DIRECTORY_SECRET !== apiSecrets.IDENTITY_DIRECTORY_SECRET) throw new Error("Identity signing and shared directory secrets are required and must match");
if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("Missing Cloudflare staging deployment token");
mkdirSync(privateDir, { recursive: true, mode: 0o700 });
const history = [];
const mark = stage => { history.push({ stage, at: new Date().toISOString() }); writeFileSync(resolve(output, "deployment-progress.json"), JSON.stringify(history, null, 2)); console.log(stage); };
const env = { ...process.env, STAGING_DATABASE_HOST: staging.databaseHost, STAGING_MAINTENANCE_CONFIRMED: "true" };
// Never expose deployment credentials to seed/test subprocesses or their logs.
const testEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/SECRET|TOKEN|PASSWORD|DATABASE_URL|SIGNING_BUNDLE/.test(key)));
const command = (program, args, cwd, extra = {}, input) => {
  const result = spawnSync(program, args, { cwd, env: { ...env, ...extra }, encoding: "utf8", input, stdio: input === undefined ? "inherit" : ["pipe", "inherit", "inherit"] });
  if (result.status !== 0) throw new Error(`Release command failed: ${program} ${args[0]} (exit ${result.status})`);
};
const wrangler = (repo, app, args, input) => command(resolve(repo, `apps/${app}/node_modules/.bin/wrangler`), args, resolve(repo, `apps/${app}`), {}, input);
const cloud = async (path, method = "GET", body) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${staging.account}${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(`Cloudflare ${method} ${path.split("?")[0]} failed (${response.status}); error codes ${(json.errors || []).map(error => error.code).join(",")}`);
  return json.result;
};
const deployWorker = (repo, app, maintenance, pause = true) => wrangler(repo, app, ["deploy", "--env", "staging", "--var", `STAGING_MAINTENANCE:${maintenance}`, "--var", `STAGING_PAUSE_JOBS:${pause}`]);
const waitHttp = async (url, expected) => {
  for (let attempt = 0; attempt < 36; attempt++) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "manual" }); if (response.status === expected) return; } catch {}
    await new Promise(done => setTimeout(done, 5000));
  }
  throw new Error(`Expected HTTP ${expected} at ${url}`);
};
let enteredMaintenance = false;
let queue;
try {
  mark("Checking existing staging infrastructure");
  assertHyperdrive(await cloud(`/hyperdrive/configs/${staging.schoolHyperdrive}`), staging.schoolDatabase);
  const authDrive = await cloud(`/hyperdrive/configs/${staging.identityHyperdrive}`);
  if (![staging.schoolDatabase, staging.identityDatabase].includes(authDrive.origin.database)) throw new Error("Unexpected identity Hyperdrive database");
  assertHyperdrive(authDrive, authDrive.origin.database);
  await cloud(`/storage/kv/namespaces/${staging.authKv}/keys?limit=1`);
  await cloud(`/r2/buckets/${staging.bucket}`);
  const queues = await cloud("/queues?per_page=100");
  queue = queues.find(value => value.queue_name === staging.queue);
  if (!queue) throw new Error("Staging cron queue is missing");
  // Validate both direct connections without schema writes.
  command("bun", ["tooling/db-migrate/scripts/staging-preflight.ts"], backend);
  mark("Entering staging maintenance");
  enteredMaintenance = true;
  deployWorker(identity, "identity", true);
  deployWorker(backend, "api", true);
  await waitHttp(`${staging.urls.identity}/`, 503);
  await waitHttp(`${staging.urls.api}/reference`, 503);
  await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: true } });
  // Let requests already running against the previous Worker version finish.
  await new Promise(done => setTimeout(done, 60000));
  wrangler(identity, "identity", ["secret", "bulk", "--env", "staging"], JSON.stringify(identitySecrets));
  wrangler(backend, "api", ["secret", "bulk", "--env", "staging"], JSON.stringify(apiSecrets));
  if (options.reset) {
    await cloud(`/queues/${queue.queue_id}/purge`, "POST", { delete_messages_permanently: true });
    // Pagination restarts at the beginning after every deletion batch.
    for (;;) {
      const keys = await cloud(`/storage/kv/namespaces/${staging.authKv}/keys?limit=1000`);
      if (!keys.length) break;
      await cloud(`/storage/kv/namespaces/${staging.authKv}/bulk`, "DELETE", keys.map(key => key.name));
    }
  }
  await cloud(`/hyperdrive/configs/${staging.identityHyperdrive}`, "PATCH", {
    origin: { host: options.identity.hostname, port: 5432, scheme: "postgres", database: staging.identityDatabase, user: "edaya_identity", password: decodeURIComponent(options.identity.password) },
    caching: { disabled: true },
  });
  assertHyperdrive(await cloud(`/hyperdrive/configs/${staging.identityHyperdrive}`), staging.identityDatabase, "edaya_identity");
  mark(options.reset ? "Resetting and migrating staging schemas" : "Migrating staging without resetting data");
  command("bun", ["tooling/identity-migrate/scripts/staging-release.ts"], identity);
  command("bun", ["tooling/db-migrate/scripts/staging-release.ts"], backend);
  mark("Enabling identity and provisioning verified fixture accounts");
  deployWorker(identity, "identity", false);
  await waitHttp(`${staging.urls.identity}/`, 200);
  const accounts = resolve(privateDir, "accounts.json");
  command("bun", ["tooling/seeding/scripts/export-identity-fixtures.ts", accounts], backend);
  command("bun", ["apps/identity/src/entries/staging-fixtures.ts", "staging", accounts, `${accounts}.sessions.json`], identity, { ...identitySecrets });
  testEnv.SEED_AUTH_SESSIONS_FILE = `${accounts}.sessions.json`;
  deployWorker(backend, "api", false);
  await waitHttp(`${staging.urls.api}/reference`, 200);
  if (options.reset) {
    mark("Bootstrapping school data, private attachments, and document fixtures");
    const result = spawnSync("bun", ["repo", "seed", "--staging"], { cwd: backend, env: { ...testEnv, SEED_DATASET: "demo-ci" }, stdio: "inherit" });
    if (result.status !== 0) throw new Error("Staging school bootstrap failed");
  }
  mark("Checking staging API and native client integration");
  const smoke = spawnSync("bun", ["repo", "smoke-test", "staging"], { cwd: backend, env: testEnv, stdio: "inherit" });
  if (smoke.status !== 0) throw new Error("Staging API smoke checks failed");
  const live = spawnSync("dart", ["run", "melos", "run", "test:integration"], { cwd: mobile, env: { ...testEnv, EDAYA_INTEGRATION_TESTS: "1", EDAYA_AUTH_URL: staging.urls.identity, EDAYA_API_URL: staging.urls.api }, stdio: "inherit" });
  if (live.status !== 0) throw new Error("Staging mobile integration failed");
  mark("Deploying prepared staff and admin web assets");
  for (const app of ["webapp", "webadmin"]) { wrangler(web, app, ["deploy", "--env", "staging"]); await waitHttp(`${staging.urls[app]}/login`, 200); }
  mark("Resuming scheduled work and queue delivery");
  deployWorker(identity, "identity", false, false);
  deployWorker(backend, "api", false, false);
  await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: false } });
  const versions = {};
  for (const worker of ["edaya-identity-staging", "edaya-api-staging", "edaya-webapp-staging", "edaya-webadmin-staging"]) versions[worker] = await cloud(`/workers/scripts/${worker}/deployments`);
  writeFileSync(resolve(output, "worker-versions.json"), JSON.stringify(versions, null, 2));
  mark("Observing staging availability for 30 minutes");
  await observeStaging(root);
  mark("Automated staging release completed; installed-device and designated notification-delivery checks remain acceptance gates");
} catch (error) {
  mark("Release stopped before advancing");
  if (enteredMaintenance) {
    for (const [repo, app] of [[identity, "identity"], [backend, "api"]]) {
      try { deployWorker(repo, app, true); } catch { console.error(`Could not restore ${app} maintenance; operator intervention required`); }
    }
    if (queue) { try { await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: true } }); } catch { console.error("Could not pause staging queue; operator intervention required"); } }
  }
  console.error(error instanceof Error ? error.message : "Staging release failed");
  process.exitCode = 1;
}
