import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readConfig } from "../../apps/api/configuration/index.mjs";
import { assertHyperdrive, assertInitialIdentityHyperdrive, staging } from "./staging-target.mjs";
import { assertReleaseMutationAllowed } from "./staging-candidate.mjs";
import { createReleaseContext } from "./staging-runtime.mjs";

export async function prepareDeployment(ctx) {
  const { mark, cloud, options, command, backend, getQueue, setPhase, setWorkerControls, wrangler, waitHttp, sleep, apiSecrets } = ctx;
  const staging = ctx.target;
  await ctx.validate();
  mark("Checking existing staging infrastructure");
  assertHyperdrive(await cloud(`/hyperdrive/configs/${staging.schoolHyperdrive}`), staging.schoolDatabase, staging.schoolRole, staging);
  const authDrive = await cloud(`/hyperdrive/configs/${staging.identityHyperdrive}`);
  assertInitialIdentityHyperdrive(authDrive, decodeURIComponent(options.school.username), staging);
  await cloud(`/storage/kv/namespaces/${staging.authKv}/keys?limit=1`);
  await cloud(`/r2/buckets/${staging.bucket}`);
  const queue = await getQueue();
  // Validate both direct connections without schema writes.
  command("bun", ["tooling/repo/db/school/staging-preflight.ts"], backend);
  mark("Entering staging maintenance");
  setPhase("preparing");
  await setWorkerControls(true, true, true, true);
  // First rollout: old code ignores the new flags. Deploy before checking 503.
  wrangler(backend, "api", ["deploy", "--env", "staging"]);
  await waitHttp(`${staging.urls.api}/reference`, 503);
  await cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: true } });
  // Let requests already running against the previous Worker version finish.
  await sleep(60000);
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
    origin: { host: options.identity.hostname, port: 5432, scheme: "postgres", database: staging.identityDatabase, user: staging.identityRole, password: decodeURIComponent(options.identity.password) },
    caching: { disabled: true },
  });
  assertHyperdrive(await cloud(`/hyperdrive/configs/${staging.identityHyperdrive}`), staging.identityDatabase, staging.identityRole, staging);
  setPhase("prepared");
}

export async function finishDeployment(ctx) {
  const { mark, command, backend, privateDir, apiSecrets, testEnv, setWorkerControls, waitHttp, options, spawnSync, mobile, web, wrangler, cloud, output, writeFileSync, observeStaging, root } = ctx;
  ctx.requirePhase("migrated");
  await ctx.assertMaintenance();
  const queue = await ctx.getQueue();
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
  for (const worker of [staging.apiWorker, ...staging.webWorkers]) versions[worker] = await cloud(`/workers/scripts/${worker}/deployments`);
  writeFileSync(resolve(output, "worker-versions.json"), JSON.stringify(versions, null, 2));
  mark("Observing staging availability for 65 minutes");
  await observeStaging(root);
  mark("Automated staging release completed; installed-device and designated notification-delivery checks remain acceptance gates");
  ctx.setPhase("completed");
}

export async function recoverDeployment(ctx) {
  if (!ctx.hasState()) return;
  ctx.readState(); // Never act on another candidate's maintenance receipt.
  ctx.mark("Release stopped; restoring staging maintenance");
  const results = await Promise.allSettled([
    ctx.setWorkerControls(true, true, true),
    (async () => {
      const queue = await ctx.getQueue();
      await ctx.cloud(`/queues/${queue.queue_id}`, "PUT", { queue_name: staging.queue, settings: { ...queue.settings, delivery_paused: true } });
    })(),
  ]);
  ctx.setPhase("blocked");
  if (results.some(result => result.status === "rejected")) throw new Error("Could not restore all staging maintenance controls; operator intervention required");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let ctx;
  try {
    assertReleaseMutationAllowed();
    const action = process.argv[2];
    if (!["prepare", "finish", "recover"].includes(action)) throw new Error("Usage: staging-deploy.mjs prepare|finish|recover (migrations run separately)");
    ctx = await createReleaseContext();
    if (action === "prepare") await prepareDeployment(ctx);
    else if (action === "finish") await finishDeployment(ctx);
    else await recoverDeployment(ctx);
  } catch (error) {
    if (ctx && process.argv[2] !== "recover") {
      try { await recoverDeployment(ctx); } catch (recovery) { console.error(recovery.message); }
    }
    console.error(error.message);
    process.exitCode = 1;
  }
}
