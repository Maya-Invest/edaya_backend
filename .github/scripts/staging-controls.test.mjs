import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { staging as resources } from "./staging-target.mjs";
const staging = { ...resources, account: "a".repeat(32), zoneName: "edayaplus.com", databaseHost: "stage.example", schoolDatabase: "neondb", identityDatabase: "edaya_identity", schoolRole: "school", identityRole: "edaya_identity" };

import { prepareDeployment, finishDeployment, recoverDeployment } from "./staging-deploy.mjs";
import { migrateStaging } from "./staging-migrate.mjs";

const source = readFileSync(new URL("./staging-runtime.mjs", import.meta.url), "utf8");
const controlSource = source.slice(source.indexOf("const setWorkerControls ="), source.indexOf("const waitHttp ="));
function fixture({ failAt, reset = true } = {}) {
  const events = [];
  let phase;
  const record = (kind, value) => {
    events.push({ kind, value });
    if (failAt === kind) throw new Error("simulated failure");
  };
  const ctx = {
    target: staging,
    root: "/root", output: "/output", privateDir: "/private", backend: "/backend", mobile: "/mobile", web: "/web",
    options: { reset, school: { username: "school" }, identity: { hostname: staging.databaseHost, password: "credential" } },
    apiSecrets: { BETTER_AUTH_SECRET: "private" }, testEnv: {},
    validate: async () => record("preflight", true),
    getQueue: async () => ({ queue_name: staging.queue, queue_id: "queue-id", settings: {} }),
    requirePhase: expected => { if (phase !== expected) throw new Error(`Requires ${expected}`); },
    setPhase: value => { phase = value; record("phase", value); },
    hasState: () => phase !== undefined, readState: () => ({ phase }),
    assertMaintenance: async () => record("maintenance-check", true),
    wrangler: (_repo, app, args) => record(args[0] === "deploy" ? "deploy" : "secrets", { app, args }),
    waitHttp: async (_url, status) => record("http", status),
    mark: stage => record("stage", stage),
    command: (_program, args) => record(args[0].includes("staging-release.ts") ? "migration" : "command", args),
    spawnSync: (_program, args) => { record("subprocess", args); return { status: (failAt === "smoke" && args.includes("smoke")) || (failAt === "mobile-smoke" && args.includes("scripts/staging-smoke.py")) ? 1 : 0 }; },
    writeFileSync: () => {}, observeStaging: async () => record("observe", true),
    sleep: async () => record("drain", true),
    cloud: async (path, method, body) => {
      record("cloud", { path, method, body });
      if (path.includes("/keys?")) return [];
      return { origin: { host: staging.databaseHost, database: path.includes(staging.schoolHyperdrive) ? staging.schoolDatabase : staging.identityDatabase, user: path.includes(staging.schoolHyperdrive) ? staging.schoolRole : staging.identityRole }, caching: { disabled: true } };
    },
  };
  const scope = {
    process: { env: { CLOUDFLARE_API_TOKEN: "private" } }, staging, resolve, backend: ctx.backend,
    workerTarget: () => staging.apiWorker,
    readConfig: () => ({ API_ORIGIN: staging.urls.api, R2_BUCKET_NAME: staging.bucket, PAUSE_API: "false", PAUSE_JOBS: "false", PAUSE_SCHEDULER: "false" }),
    updateWorkerVariables: async options => {
      record("controls", options.values);
      if (failAt === "configuration" && options.values.API_ORIGIN) throw new Error("Configuration collision");
    },
  };
  ctx.setWorkerControls = new Function(...Object.keys(scope), controlSource + "return setWorkerControls;")(...Object.values(scope));
  return { ctx, events };
}
async function release(options) {
  const { ctx, events } = fixture(options);
  let exitCode = 0;
  try { await prepareDeployment(ctx); await migrateStaging(ctx); await finishDeployment(ctx); }
  catch { exitCode = 1; await recoverDeployment(ctx); }
  return { events, exitCode };
}
const settings = { API_ORIGIN: staging.urls.api, R2_BUCKET_NAME: staging.bucket };
const paused = { PAUSE_API: "true", PAUSE_SCHEDULER: "true", PAUSE_JOBS: "true" };

test("staging deploys API once, confirms maintenance before mutations, resumes handlers separately", async () => {
  const { events, exitCode } = await release();
  expect(exitCode).toBe(0);
  expect(events.filter(e => e.kind === "controls").map(e => e.value)).toEqual([
    { ...settings, ...paused },
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
  expect(index(e => e.kind === "subprocess" && e.value.includes("tooling/seeding/scripts/seed.ts"))).toBeGreaterThan(index(e => e.kind === "http" && e.value === 200));
  expect(index(e => e.kind === "observe")).toBeGreaterThan(index(e => e.kind === "cloud" && e.value.body?.settings?.delivery_paused === false));
});

for (const failAt of ["configuration", "http", "migration", "smoke", "mobile-smoke", "observe"]) test(`release failure at ${failAt} restores all controls and queue pause without redeploying`, async () => {
  const { events, exitCode } = await release({ failAt });
  expect(exitCode).toBe(1);
  expect(events.filter(e => e.kind === "controls").at(-1).value).toEqual(paused);
  expect(events.filter(e => e.kind === "cloud" && e.value.body?.settings).at(-1).value.body.settings.delivery_paused).toBe(true);
  expect(events.filter(e => e.kind === "deploy" && e.value.app === "api")).toHaveLength(failAt === "configuration" ? 0 : 1);
  if (failAt === "mobile-smoke") {
    expect(events.some(e => e.kind === "deploy" && e.value.app !== "api")).toBe(false);
    expect(events.some(e => e.kind === "observe")).toBe(false);
  }
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
  expect(events.some(e => e.kind === "subprocess" && e.value.includes("tooling/seeding/scripts/seed.ts"))).toBe(false);
});


test("deployment cannot run migrations or finish before the separate migration succeeds", async () => {
  const { ctx, events } = fixture();
  await prepareDeployment(ctx);
  expect(events.some(event => event.kind === "migration")).toBe(false);
  await expect(finishDeployment(ctx)).rejects.toThrow("Requires migrated");
  await migrateStaging(ctx);
  const before = events.filter(event => event.kind === "migration").length;
  await finishDeployment(ctx);
  expect(events.filter(event => event.kind === "migration")).toHaveLength(before);
});
test("migration requires preparation and cannot deploy, resume traffic, or run twice", async () => {
  const { ctx, events } = fixture();
  await expect(migrateStaging(ctx)).rejects.toThrow("Requires prepared");
  ctx.setPhase("prepared");
  await migrateStaging(ctx);
  expect(events.filter(event => event.kind === "migration")).toHaveLength(2);
  expect(events.some(event => ["deploy", "controls", "cloud", "subprocess"].includes(event.kind))).toBe(false);
  await expect(migrateStaging(ctx)).rejects.toThrow("Requires prepared");
});
test("maintenance loss prevents migrations", async () => {
  const { ctx, events } = fixture({ failAt: "maintenance-check" });
  ctx.setPhase("prepared");
  await expect(migrateStaging(ctx)).rejects.toThrow();
  expect(events.some(event => event.kind === "migration")).toBe(false);
});
