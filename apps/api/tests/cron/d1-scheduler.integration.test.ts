import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import type { SchedulerMessage, SchedulerPort } from "@edaya/service";
import { sqliteSchedulerAdmin } from "@/runtime/shared/adapters/sqlite-scheduler-admin";
import { SqliteScheduler } from "@/runtime/shared/adapters/sqlite-scheduler";
import { schedulerLeaseMs } from "@edaya/service";
import { dispatchScheduler } from "@/cron/scheduler/dispatch";
import { openLocalScheduler } from "@/runtime/local/scheduler-database";
import { consumeScheduler, tickScheduler } from "@/cron/scheduler/runtime";
import type { ApiRuntime } from "@/runtime/types";

const ref = "79b270c2-d710-4ca8-84a8-c56254bb78af";

async function verifyFencing(store: SchedulerPort) {
  await store.project(ref, "notification", 1, 1000);
  await store.project(ref, "notification", 3, null);
  await store.project(ref, "notification", 2, 1000);
  expect(await store.claim(1000)).toEqual([]);
  await store.project(ref, "notification", 4, 1500);
  const claims = (await Promise.all([store.claim(1500), store.claim(1500)])).flat();
  expect(claims).toHaveLength(1);
  const first = { version: 1 as const, ref, lease: claims[0]!.lease! };
  const redelivery = (await store.claim(1500 + schedulerLeaseMs))[0]!;
  expect(await store.begin(first, 1500 + schedulerLeaseMs)).toBeUndefined();
  const message = { ...first, lease: redelivery.lease! };
  const item = await store.begin(message, 1501 + schedulerLeaseMs);
  expect(await store.begin(message, 1501 + schedulerLeaseMs)).toBeUndefined();
  await store.finish(item!, null);
  expect(await store.begin(message, 1502 + schedulerLeaseMs)).toBeUndefined();
}

test("D1 fences duplicate deliveries, expired leases, cancellations and stale publications", async () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      cf: false,
      workers: [
        {
          name: "scheduler-test",
          modules: true,
          script: "export default {fetch(){return new Response(\"ok\")}}",
          d1Databases: ["SCHEDULER_DB"],
          compatibilityDate: "2026-03-24",
        },
      ],
    }),
  );
  try {
    const db = await mf.getD1Database("SCHEDULER_DB");
    const migrations = resolve(import.meta.dir, "../../scheduler-migrations");
    for (const name of readdirSync(migrations).filter(name => name.endsWith(".sql")).sort()) {
      const sql = readFileSync(resolve(migrations, name), "utf8");
      for (const statement of sql.split(/;[ \t]*(?:\n|$)/).map(s => s.trim()).filter(Boolean))
        await db.prepare(statement).run();
    }
    const store = new SqliteScheduler(db);
    await verifyFencing(store);
    const worker = (await import("@/entries/worker")).default;
    const day = Date.UTC(2030, 0, 1);
    const due = day + 2 * 3600_000;
    await store.query(
      "UPDATE scheduler_work SET due_at=?,available_at=? WHERE ref IN ('school-recovery','identity-cleanup')",
      due,
      due,
    );
    const queue: SchedulerMessage[] = [];
    let reads = 0;
    const binding = {
      prepare: (sql: string) => {
        reads++;
        return db.prepare(sql);
      },
    };
    const scheduled: number[] = [];
    for (let tick = 0; tick < 288; tick++) {
      const at = day + tick * 300_000;
      const previousReads = reads;
      let done: Promise<unknown> | undefined;
      await worker.scheduled(
        { scheduledTime: at, cron: "*/5 * * * *" } as ScheduledController,
        {
          SCHEDULER_DB: binding,
          SCHEDULER_MODE: "active",
          CRON_JOBS: {
            send: async (m: SchedulerMessage) => {
              queue.push(m);
            },
          },
          LOG_LEVEL: "silent",
          API_ORIGIN: "https://test.example",
          DATABASE_URL: "postgresql://127.0.0.1:1/school",
          AUTH_DATABASE_URL: "postgresql://127.0.0.1:1/identity",
        },
        {
          waitUntil: (promise: Promise<unknown>) => {
            done = promise;
          },
        } as ExecutionContext,
      );
      await done;
      expect(reads - previousReads).toBe(1);
      for (const message of queue.splice(0)) {
        scheduled.push(at);
        const work = await store.begin(message, at);
        await store.finish(work!, at + 86400_000);
      }
    }
    expect(scheduled).toEqual([due, due]);
  }
  finally {
    await mf.dispose();
  }
}, 30000);

test("288 empty-day ticks only call the two maintenance handlers once, including a delayed tick", async () => {
  const local = openLocalScheduler(":memory:");
  try {
    const store = new SqliteScheduler(local.binding);
    const day = Date.UTC(2028, 0, 1);
    const deadline = day + 2 * 3600000;
    await store.query("UPDATE scheduler_work SET due_at=?,available_at=?", deadline, deadline);
    const queue: SchedulerMessage[] = [];
    let school = 0;
    let identity = 0;
    const runtime = {
      scheduler: store,
      sendSchedulerMessage: async (m: SchedulerMessage) => {
        queue.push(m);
      },
      env: {
        SCHEDULER_MODE: "active",
        SCHEDULER_DB: local.binding,
        CRON_JOBS: {
          send: async (m: SchedulerMessage) => {
            queue.push(m);
          },
        },
        API_ORIGIN: "test",
      },
      schedulerSignals: async () => ({
        rebuild: async () => {
          school++;
        },
        pending: async () => [],
        definitions: async () => [],
      }),
      getIdentityRuntime: async () => ({
        auth: {
          purgeExpiredCredentials: async () => {
            identity++;
          },
        },
      }),
      getSchoolApplication: async () => ({
        atomicExecution: { execute: (work: () => Promise<unknown>) => work() },
        importPersistence: { exhaustedBatches: async () => [] },
      }),
    } as unknown as ApiRuntime;
    for (let tick = 0; tick < 288; tick++) {
      const at = day + tick * 300000;
      if (at === deadline)
        runtime.env.PAUSE_SCHEDULER = true;
      else runtime.env.PAUSE_SCHEDULER = false;
      await tickScheduler(runtime, at);
      for (const message of queue.splice(0)) {
        // Maintenance uses the execution clock for lease validation and the next deadline.
        await consumeScheduler(runtime, message, () => at);
        await consumeScheduler(runtime, message, () => at);
      }
    }
    expect({ school, identity }).toEqual({ school: 1, identity: 1 });
    await verifyFencing(store);
  }
  finally {
    local.close();
  }
});

test("independent maintenance settings fence old deliveries and rearm on their UTC schedules", async () => {
  const local = openLocalScheduler(":memory:");
  try {
    const store = new SqliteScheduler(local.binding);
    const admin = sqliteSchedulerAdmin(sql => store.query(sql));
    const start = Date.UTC(2025, 0, 1);
    const hour = 3600_000;
    const ref = "identity-cleanup";
    await admin.configureMaintenance("school-recovery", "0 0 1 2 *", start);
    await admin.configureMaintenance(ref, "0 */4 * * *", start);
    expect((await store.get(ref))?.dueAt).toBe(start + 4 * hour);
    const [first] = await store.claim(start + 4 * hour);
    await admin.configureMaintenance(ref, "0 */3 * * *", start + 4 * hour);
    expect(await store.begin({ version: 1, ref, lease: first!.lease! }, start + 4 * hour)).toBeUndefined();
    expect((await store.get(ref))?.dueAt).toBe(start + 4 * hour);
    const [missed] = await store.claim(start + 13 * hour);
    let purges = 0;
    const runtime = { scheduler: store, getIdentityRuntime: async () => ({ auth: {
      purgeExpiredCredentials: async () => {
        purges++;
        await admin.configureMaintenance(ref, "30 */2 * * *", start + 13 * hour);
        expect(await store.claim(start + 13 * hour)).toEqual([]);
      },
    } }) } as unknown as ApiRuntime;
    const msg = { ref, version: 1 as const, lease: missed!.lease! };
    await consumeScheduler(runtime, msg, () => start + 13 * hour);
    await consumeScheduler(runtime, msg, () => start + 13 * hour);
    expect(purges).toBe(1);
    expect((await store.get(ref))?.dueAt).toBe(start + 14.5 * hour);
    expect((await store.get("school-recovery"))?.availableAt).toBe(Date.UTC(2025, 1, 1));
    expect(await admin.settings()).toEqual([
      { kind: "identity-cleanup", schedule: "30 */2 * * *" },
      { kind: "school-recovery", schedule: "0 0 1 2 *" },
    ]);
    await expect(admin.configureMaintenance(ref, "off", start)).rejects.toThrow();
    await expect(admin.configureMaintenance(ref, "not a cron", start)).rejects.toThrow();
    expect((await store.get(ref))?.cronExpression).toBe("30 */2 * * *");
  }
  finally { local.close(); }
});

test("upgrading releases held event work at its original deadline and preserves its retry budget", async () => {
  const directory = mkdtempSync(resolve(tmpdir(), "scheduler-upgrade-"));
  const file = resolve(directory, "scheduler.sqlite");
  try {
    const old = new Database(file, { create: true });
    try {
      old.exec("CREATE TABLE d1_migrations(name TEXT PRIMARY KEY)");
      for (const name of ["0001_scheduler.sql", "0002_job_schedules.sql"]) {
        old.exec(readFileSync(resolve(import.meta.dir, "../../scheduler-migrations", name), "utf8"));
        old.query("INSERT INTO d1_migrations(name) VALUES (?)").run(name);
      }
      old.query("INSERT INTO scheduler_work(ref,kind,revision,due_at,available_at,attempts) VALUES (?,'document.render',3,500,1000,2)").run(ref);
      old.exec("UPDATE scheduler_dispatch_windows SET expression='off' WHERE kind='document.render'");
      old.exec("UPDATE scheduler_work SET cron_expression='0 */6 * * *' WHERE ref='school-recovery'");
    }
    finally { old.close(); }

    const local = openLocalScheduler(file);
    try {
      const store = new SqliteScheduler(local.binding);
      expect(await store.query("SELECT name FROM sqlite_schema WHERE name='scheduler_dispatch_windows'")).toEqual([]);
      expect((await store.get("school-recovery"))?.cronExpression).toBe("0 */6 * * *");
      expect(await store.claim(999)).toEqual([]);
      expect(await store.dueBusiness(1000)).toEqual([{ ref, kind: "document.render" }]);
      const [job] = await store.claim(1000);
      expect(job).toMatchObject({ ref, revision: 3, dueAt: 500, attempts: 3 });
      expect(await store.claim(1000)).toEqual([]);
    }
    finally { local.close(); }
  }
  finally { rmSync(directory, { recursive: true, force: true }); }
});

test("failed handoffs remain retryable and bounded", async () => {
  const local = openLocalScheduler(":memory:");
  try {
    const store = new SqliteScheduler(local.binding);
    await store.project(ref, "outbox", 1, 0);
    for (let attempt = 0; attempt < 8; attempt++) {
      await dispatchScheduler(
        store,
        async () => {
          throw new Error("unavailable");
        },
        attempt * 1000000,
        "test",
      );
    }
    const [dead] = await store.query<{ dead: number; attempts: number }>(
      "SELECT dead,attempts FROM scheduler_work WHERE ref=?",
      ref,
    );
    expect(dead).toEqual({ dead: 1, attempts: 8 });
    expect(await store.claim(8e6)).toEqual([]);
  }
  finally {
    local.close();
  }
});
