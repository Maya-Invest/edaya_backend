import { updateWorkerVariables, workerTarget } from "../../tooling/repo/operations/worker-vars.mjs";
import { readConfig } from "../../apps/api/configuration/index.mjs";
import { assertReleaseMutationAllowed } from "./staging-candidate.mjs";
import { runPreflight, validateConfiguration } from "./staging-preflight.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { observeStaging } from "./observe-staging.mjs";
import { assertHyperdrive, assertInitialIdentityHyperdrive, releaseOptions, staging } from "./staging-target.mjs";

assertReleaseMutationAllowed();
await runPreflight(process.env);
const root = resolve(process.env.RELEASE_ROOT || "..");
const output = resolve(root, "release");
const privateDir = resolve(root, ".release-private");
const backend = resolve(root, "edaya_backend");
const mobile = resolve(root, "edaya_mobile");
const web = resolve(root, "edaya_frontend");
const options = releaseOptions(process.env);
if (process.env.STAGING_NEON_TARGET_CONFIRMED !== staging.databaseHost) throw new Error("Confirm the live Neon project/branch and set STAGING_NEON_TARGET_CONFIRMED to its recorded endpoint before release");
if (!existsSync(resolve(output, "qualification-passed.txt"))) throw new Error("Candidate qualification is required");
const manifest = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
if (manifest.apks.length !== 2) throw new Error("Both signed APKs must be prepared before staging changes");
const { combined: apiSecrets } = validateConfiguration(process.env);
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
const setWorkerControls = async (api, scheduler, jobs) => {
  await updateWorkerVariables({
    accountId: staging.account, token: process.env.CLOUDFLARE_API_TOKEN,
    worker: workerTarget("staging", resolve(backend, "apps/api")),
    values: { ...readConfig("staging"), PAUSE_API: String(api), PAUSE_SCHEDULER: String(scheduler), PAUSE_JOBS: String(jobs) },
  });
};
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
  assertInitialIdentityHyperdrive(authDrive, decodeURIComponent(options.school.username));
  await cloud(`/storage/kv/namespaces/${staging.authKv}/keys?limit=1`);
  await cloud(`/r2/buckets/${staging.bucket}`);
  const queues = await cloud("/queues?per_page=100");
  queue = queues.find(value => value.queue_name === staging.queue);
  if (!queue) throw new Error("Staging cron queue is missing");
  // Validate both direct connections without schema writes.
  command("bun", ["tooling/repo/db/school/staging-preflight.ts"], backend);
  mark("Entering staging maintenance");
  enteredMaintenance = true;
  await setWorkerControls(true, true, true);
  // First rollout: old code ignores the new flags. Deploy before checking 503.
  wrangler(backend, "api", ["deploy", "--env", "staging"]);
  await waitHttp(`${staging.urls.api}/reference`, 503);
  await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: true } });
  // Let requests already running against the previous Worker version finish.
  await new Promise(done => setTimeout(done, 60000));
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
  command("bun", ["tooling/repo/db/identity/staging-release.ts"], backend);
  command("bun", ["tooling/repo/db/school/staging-release.ts"], backend);
  mark("Provisioning verified Account fixtures and enabling the unified API");
  const accounts = resolve(privateDir, "accounts.json");
  command("bun", ["tooling/seeding/scripts/export-identity-fixtures.ts", accounts], backend);
  command("bun", ["apps/api/src/identity/entries/staging-fixtures.ts", "staging", accounts, `${accounts}.sessions.json`], backend, { ...readConfig("staging"), ...apiSecrets });
  testEnv.SEED_AUTH_SESSIONS_FILE = `${accounts}.sessions.json`;
  await setWorkerControls(false, true, true);
  await waitHttp(`${staging.urls.api}/reference`, 200);
  if (options.reset) {
    mark("Bootstrapping school data, private attachments, and document fixtures");
    const result = spawnSync("bun", ["--no-env-file", "tooling/seeding/scripts/seed.ts", "--staging"], { cwd: backend, env: { ...testEnv, SEED_DATASET: "demo-ci" }, stdio: "inherit" });
    if (result.status !== 0) throw new Error("Staging school bootstrap failed");
  }
  mark("Checking staging API and native client integration");
  const smoke = spawnSync("bun", ["repo", "smoke", "api", "staging"], { cwd: backend, env: testEnv, stdio: "inherit" });
  if (smoke.status !== 0) throw new Error("Staging API smoke checks failed");
  const live = spawnSync("python3", ["scripts/staging-smoke.py"], { cwd: mobile, env: { ...testEnv, EDAYA_INTEGRATION_TESTS: "1", EDAYA_API_URL: staging.urls.api }, stdio: "inherit" });
  if (live.status !== 0) throw new Error("Staging native mobile smoke failed");
  mark("Deploying prepared staff and admin web assets");
  for (const app of ["webapp", "webadmin"]) { wrangler(web, app, ["deploy", "--env", "staging"]); await waitHttp(`${staging.urls[app]}/login`, 200); }
  mark("Resuming scheduled work and queue delivery");
  await setWorkerControls(false, false, false);
  await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: false } });
  const versions = {};
  for (const worker of ["edaya-api-staging", "edaya-webapp-staging", "edaya-webadmin-staging"]) versions[worker] = await cloud(`/workers/scripts/${worker}/deployments`);
  writeFileSync(resolve(output, "worker-versions.json"), JSON.stringify(versions, null, 2));
  mark("Observing staging availability for 65 minutes");
  await observeStaging(root);
  mark("Automated staging release completed; installed-device and designated notification-delivery checks remain acceptance gates");
} catch (error) {
  mark("Release stopped before advancing");
  if (enteredMaintenance) {
    try { await setWorkerControls(true, true, true); } catch { console.error("Could not restore API pause controls; operator intervention required"); }
    if (queue) { try { await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: true } }); } catch { console.error("Could not pause staging queue; operator intervention required"); } }
  }
  console.error(error instanceof Error ? error.message : "Staging release failed");
  process.exitCode = 1;
}
