import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { staging } from "./staging-target.mjs";

// Execute the actual coordinator body with all external effects replaced.
const source = readFileSync(new URL("./staging-deploy.mjs", import.meta.url), "utf8");
const controlSource = source.slice(source.indexOf("const setWorkerControls ="), source.indexOf("const waitHttp ="));
const coordinator = source.slice(source.indexOf("let enteredMaintenance = false;"));
async function release({ failAt, reset = true } = {}) {
  const events = [];
  const process = { env: { CLOUDFLARE_API_TOKEN: "private" }, exitCode: 0 };
  const record = (kind, value) => {
    events.push({ kind, value });
    if (failAt === kind) throw new Error("simulated failure");
  };
  const scope = {
    process, staging, resolve, backend: "/backend", web: "/web", mobile: "/mobile", root: "/root", output: "/output", privateDir: "/private",
    options: { reset, identity: { hostname: "db.example", password: "credential" } },
    apiSecrets: { BETTER_AUTH_SECRET: "private" }, testEnv: {},
    workerTarget: () => "edaya-api-staging",
    updateWorkerVariables: async options => record("controls", options.values),
    wrangler: (_repo, app, args) => record(args[0] === "deploy" ? "deploy" : "secrets", { app, args }),
    waitHttp: async (_url, status) => record("http", status),
    mark: stage => record("stage", stage),
    assertHyperdrive: () => {},
    command: (_program, args) => record(args[0].includes("staging-release.ts") ? "migration" : "command", args),
    spawnSync: (_program, args) => { record("subprocess", args); return { status: failAt === "smoke" && args.includes("smoke-test") ? 1 : 0 }; },
    readConfig: () => ({}), writeFileSync: () => {},
    observeStaging: async () => record("observe", true),
    setTimeout: callback => { record("drain", true); callback(); },
    console: { log() {}, error() {} },
    cloud: async (path, method, body) => {
      record("cloud", { path, method, body });
      if (path === "/queues?per_page=100") return [{ queue_name: staging.queue, queue_id: "queue-id", settings: {} }];
      if (path.includes("/keys?")) return [];
      return { origin: { database: staging.identityDatabase } };
    },
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(...Object.keys(scope), controlSource + coordinator)(...Object.values(scope));
  return { events, exitCode: process.exitCode };
}
const paused = { PAUSE_API: "true", PAUSE_SCHEDULER: "true", PAUSE_JOBS: "true" };

test("staging deploys API once, confirms maintenance before mutations, resumes handlers separately", async () => {
  const { events, exitCode } = await release();
  expect(exitCode).toBe(0);
  expect(events.filter(e => e.kind === "controls").map(e => e.value)).toEqual([
    paused,
    { PAUSE_API: "false", PAUSE_SCHEDULER: "true", PAUSE_JOBS: "true" },
    { PAUSE_API: "false", PAUSE_SCHEDULER: "false", PAUSE_JOBS: "false" },
  ]);
  expect(events.filter(e => e.kind === "deploy" && e.value.app === "api")).toHaveLength(1);
  const index = predicate => events.findIndex(predicate);
  const maintenance = index(e => e.kind === "http" && e.value === 503);
  expect(maintenance).toBeGreaterThan(index(e => e.kind === "deploy" && e.value.app === "api"));
  expect(index(e => e.kind === "cloud" && e.value.body?.settings?.delivery_paused === true)).toBeGreaterThan(maintenance);
  expect(index(e => e.kind === "migration")).toBeGreaterThan(index(e => e.kind === "drain"));
  expect(index(e => e.kind === "cloud" && e.value.path.endsWith("/purge"))).toBeGreaterThan(index(e => e.kind === "drain"));
  expect(index(e => e.kind === "subprocess" && e.value.includes("seed"))).toBeGreaterThan(index(e => e.kind === "http" && e.value === 200));
  expect(index(e => e.kind === "observe")).toBeGreaterThan(index(e => e.kind === "cloud" && e.value.body?.settings?.delivery_paused === false));
});

for (const failAt of ["http", "migration", "smoke", "observe"]) test(`release failure at ${failAt} restores all controls and queue pause without redeploying`, async () => {
  const { events, exitCode } = await release({ failAt });
  expect(exitCode).toBe(1);
  expect(events.filter(e => e.kind === "controls").at(-1).value).toEqual(paused);
  expect(events.filter(e => e.kind === "cloud" && e.value.body?.settings).at(-1).value.body.settings.delivery_paused).toBe(true);
  expect(events.filter(e => e.kind === "deploy" && e.value.app === "api")).toHaveLength(1);
  if (failAt === "http") {
    expect(events.some(e => e.kind === "migration")).toBe(false);
    expect(events.some(e => e.kind === "secrets")).toBe(false);
  }
});

test("non-reset staging release keeps migrations but skips purge and seed", async () => {
  const { events, exitCode } = await release({ reset: false });
  expect(exitCode).toBe(0);
  expect(events.filter(e => e.kind === "migration")).toHaveLength(2);
  expect(events.some(e => e.kind === "cloud" && e.value.path.endsWith("/purge"))).toBe(false);
  expect(events.some(e => e.kind === "subprocess" && e.value.includes("seed"))).toBe(false);
});
