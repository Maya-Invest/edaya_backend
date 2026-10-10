import { updateWorkerVariables, workerTarget } from "../../tooling/repo/operations/worker-vars.mjs";
import { readConfig } from "../../apps/api/configuration/index.mjs";
import { candidateCommits, candidateRepositories, assertReleaseMutationAllowed } from "./staging-candidate.mjs";
import { runPreflight, validateConfiguration } from "./staging-preflight.mjs";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { observeStaging } from "./observe-staging.mjs";
import { releaseOptions, staging } from "./staging-target.mjs";

import { createHash } from "node:crypto";

export function releaseState(stateFile, identity) {
  const fingerprint = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  const readState = () => {
    if (!existsSync(stateFile)) throw new Error("Staging maintenance preparation is required");
    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    if (state.fingerprint !== fingerprint) throw new Error("Staging phase belongs to another candidate, configuration, or attempt");
    return state;
  };
  const requirePhase = phase => { if (readState().phase !== phase) throw new Error(`Staging requires the ${phase} phase`); };
  const setPhase = phase => writeFileSync(stateFile, JSON.stringify({ fingerprint, phase, at: new Date().toISOString() }, null, 2));
  return { requirePhase, setPhase, readState, hasState: () => existsSync(stateFile) };
}

export async function assertPausedMaintenance(cloud, getQueue, waitHttp) {
  const settings = await cloud(`/workers/scripts/${staging.apiWorker}/settings`);
  for (const name of ["PAUSE_API", "PAUSE_SCHEDULER", "PAUSE_JOBS"]) {
    const bindings = (settings.bindings || []).filter(binding => binding.name === name);
    if (bindings.length !== 1 || bindings[0].type !== "plain_text" || bindings[0].text !== "true") throw new Error("Staging maintenance controls are not paused");
  }
  if ((await getQueue()).settings?.delivery_paused !== true) throw new Error("Staging queue must remain paused for migrations");
  await waitHttp(`${staging.urls.api}/reference`, 503);
}

export async function createReleaseContext() {
  assertReleaseMutationAllowed();
  const root = resolve(process.env.RELEASE_ROOT || "..");
  const output = resolve(root, "release");
  const privateDir = resolve(root, ".release-private");
  const backend = resolve(root, "edaya_backend");
  const mobile = resolve(root, "edaya_mobile");
  const web = resolve(root, "edaya_frontend");
  const options = releaseOptions(process.env);
  const staging = options.target;
  if (!existsSync(resolve(output, "qualification-passed.txt"))) throw new Error("Candidate qualification is required");
  const manifest = JSON.parse(readFileSync(resolve(output, "manifest.json"), "utf8"));
  if (manifest.apks.length !== 2) throw new Error("Both signed APKs must be prepared before staging changes");
  const { combined: apiSecrets } = validateConfiguration(process.env);
  if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("Missing Cloudflare staging deployment token");
  mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const historyFile = resolve(output, "deployment-progress.json");
  const history = existsSync(historyFile) ? JSON.parse(readFileSync(historyFile, "utf8")) : [];
  const mark = stage => { history.push({ stage, at: new Date().toISOString() }); writeFileSync(resolve(output, "deployment-progress.json"), JSON.stringify(history, null, 2)); console.log(stage); };
  const env = { ...process.env, STAGING_DATABASE_HOST: staging.databaseHost, STAGING_SCHOOL_DATABASE: staging.schoolDatabase, STAGING_IDENTITY_DATABASE: staging.identityDatabase, STAGING_IDENTITY_ROLE: staging.identityRole, STAGING_MAINTENANCE_CONFIRMED: "true" };
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
  const setWorkerControls = async (api, scheduler, jobs, applyConfiguration = false) => {
    await updateWorkerVariables({
      accountId: staging.account, token: process.env.CLOUDFLARE_API_TOKEN,
      worker: workerTarget("staging", resolve(backend, "apps/api")),
      values: { ...(applyConfiguration ? readConfig("staging") : {}), PAUSE_API: String(api), PAUSE_SCHEDULER: String(scheduler), PAUSE_JOBS: String(jobs) },
    });
  };
  const waitHttp = async (url, expected) => {
    for (let attempt = 0; attempt < 36; attempt++) {
      try { const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "manual" }); if (response.status === expected) return; } catch {}
      await new Promise(done => setTimeout(done, 5000));
    }
    throw new Error(`Expected HTTP ${expected} at ${url}`);
  };

  const candidate = candidateCommits(candidateRepositories(root));
  if (JSON.stringify(candidate) !== JSON.stringify(candidateCommits(manifest.repositories))) throw new Error("Release manifest does not match the candidate checkouts");
  const identity = { candidate, target: staging, application: readConfig("staging"), reset: options.reset,
    run: process.env.GITHUB_RUN_ID || "local", attempt: process.env.GITHUB_RUN_ATTEMPT || "1" };
  const state = releaseState(resolve(output, "deployment-state.json"), identity);
  const getQueue = async () => {
    const queue = (await cloud("/queues?per_page=100")).find(value => value.queue_name === staging.queue);
    if (!queue) throw new Error("Staging cron queue is missing");
    return queue;
  };
  return { target: staging, root, output, privateDir, backend, mobile, web, options, apiSecrets, testEnv, command, wrangler, cloud, setWorkerControls, waitHttp, mark,
    getQueue, assertMaintenance: () => assertPausedMaintenance(cloud, getQueue, waitHttp), ...state, validate: () => runPreflight(process.env),
    sleep: ms => new Promise(done => setTimeout(done, ms)), spawnSync, writeFileSync, observeStaging };
}
