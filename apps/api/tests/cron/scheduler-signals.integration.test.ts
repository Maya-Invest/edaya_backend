import type { LoggerPort } from "@edaya/core";
import { compareShadow } from "@/cron/scheduler/shadow";
import { MessageDeliveryStatus } from "@edaya/core";
import { seedAuthorizationRelationships } from "../../../../package/adaptor-postgres/tests/support/authorization-database";
import type { ApiRuntime } from "@/runtime/types";
import type { SchedulerMessage } from "@edaya/service";
import { SchoolSchedulerSignals } from "@edaya/adaptor-postgres";
import { expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { consumeScheduler, publishSchoolChanges, tickScheduler } from "@/cron/scheduler/runtime";
import { SqliteScheduler } from "@/runtime/shared/adapters/sqlite-scheduler";
import { schedulerLeaseMs } from "@edaya/service";
import { openLocalScheduler } from "@/runtime/local/scheduler-database";
import { useNativePolicyApps } from "../support/native-policy-app";
import { sqliteSchedulerAdmin } from "@/runtime/shared/adapters/sqlite-scheduler-admin";

const fixture = useNativePolicyApps();
test("committed deadlines, lost publication, cancellation and replay use the migrated School database", async () => {
  const { db, school } = await fixture();
  const signals = new SchoolSchedulerSignals(drizzle(db));
  const local = openLocalScheduler(":memory:");
  const store = new SqliteScheduler(local.binding);
  const admin = sqliteSchedulerAdmin(sql => store.query(sql));
  const queue: SchedulerMessage[] = [];
  const runtime = {
    scheduler: store,
    sendSchedulerMessage: async (m: SchedulerMessage) => {
      queue.push(m);
    },
    env: {
      SCHEDULER_MODE: "active",
      SCHEDULER_DB: local.binding,
      API_ORIGIN: "test",
      CRON_JOBS: {
        send: async (m: SchedulerMessage) => {
          queue.push(m);
        },
      },
    },
    schoolOpened: () => true,
    schedulerSignals: async () => signals,
    getSchoolApplication: async () => school,
  } as unknown as ApiRuntime;
  try {
    const hour = 3600_000;
    const floor = Math.floor(Date.now() / 60000) * 60000;
    const soon = new Date(floor + hour);
    await db.exec(
      `UPDATE cron_job_schedules SET cron_expression='* * * * *',enabled=false WHERE job_key='expireAccountInvitations'`,
    );
    const insert = `INSERT INTO account_invitations (id,school_id,kind,target_id,contact_channel,contact_value,token_hash,status,expires_at,created_by_staff_id,created_at)
      VALUES ('scheduler-invite','school-a','staff','staff-a','email','private@example.com','opaque','pending',$1,'staff-a',now())`;
    await db.query(insert, [soon]);
    const [{ ref }] = (
      await db.query<{ ref: string }>(
        `SELECT ref FROM scheduler_signals WHERE source_id='school-a' AND kind='expireAccountInvitations'`,
      )
    ).rows;
    const entry = async () => (await store.get(ref!))!;
    // The first maintenance tick bootstraps definitions and missing work.
    await tickScheduler(runtime, Date.now());
    for (const msg of queue.splice(0)) await consumeScheduler(runtime, msg);
    expect((await store.query("SELECT * FROM schedules")).length).toBe(5);
    expect((await entry()).dueAt).toBeNull();
    await db.exec("UPDATE cron_job_schedules SET enabled=true WHERE job_key='expireAccountInvitations'");
    await publishSchoolChanges(runtime);
    expect((await entry()).dueAt).toBe(soon.getTime());
    const prior = (await signals.read(ref!))!;
    await db.transaction(async (tx) => {
      await tx.query("UPDATE account_invitations SET status='revoked' WHERE id='scheduler-invite'");
      await tx.rollback();
    });
    expect((await signals.read(ref!))!.revision).toBe(prior.revision);
    const later = new Date(floor + 2 * hour);
    await db.query("UPDATE account_invitations SET expires_at=$1 WHERE id='scheduler-invite'", [later]);
    const publish = store.project.bind(store);
    store.project = async () => {
      throw new Error("simulated failure publishing committed change");
    };
    await publishSchoolChanges(runtime);
    store.project = publish;
    const deferred = queue.splice(0).find(m => m.ref === ref);
    expect(deferred).toBeDefined();
    await consumeScheduler(runtime, deferred!);
    expect((await entry()).dueAt).toBe(later.getTime());
    await db.exec("UPDATE account_invitations SET status='revoked' WHERE id='scheduler-invite'");
    await publishSchoolChanges(runtime);
    await store.project(ref!, prior.kind, prior.revision, soon.getTime());
    expect((await entry()).dueAt).toBeNull();
    // Commit an immediately eligible invitation but deliberately lose its post-commit signal.
    await db.query("UPDATE account_invitations SET status='pending',expires_at=$1 WHERE id='scheduler-invite'", [
      new Date(floor - hour),
    ]);
    await db.query("UPDATE scheduler_signals SET changed_at=$1 WHERE ref=$2", [new Date(floor - 60_000), ref!]);
    expect((await entry()).dueAt).toBeNull();
    await admin.reconcile();
    await tickScheduler(runtime, Date.now());
    await consumeScheduler(runtime, queue.shift()!);
    expect((await entry()).dueAt).toBeLessThanOrEqual(Date.now());
    await tickScheduler(runtime, Date.now());
    const message = queue.find(m => m.ref === ref)!;
    expect(message).toBeDefined();
    // Fail the first handoff after the Postgres business transaction commits.
    const persist = store.project.bind(store);
    let fail = true;
    store.project = async (...args) => {
      if (fail) {
        fail = false;
        throw new Error("simulated disconnect after commit");
      }
      await persist(...args);
    };
    await consumeScheduler(runtime, message);
    expect((await entry()).failure).toBe("SCHEDULER_EXECUTION_FAILED");
    const retry = (await store.claim(Date.now() + schedulerLeaseMs))[0]!;
    await consumeScheduler(runtime, { version: 1, ref: retry.ref, lease: retry.lease! });
    await consumeScheduler(runtime, message);
    expect((await db.query("SELECT status FROM account_invitations WHERE id='scheduler-invite'")).rows).toEqual([
      { status: "expired" },
    ]);
    expect(
      (await db.query("SELECT id FROM cron_occurrences WHERE job_key='expireAccountInvitations'")).rows,
    ).toHaveLength(1);
    expect((await entry()).dueAt).toBeNull();
    expect(await admin.replay(ref!)).toEqual([]);
    expect(await store.claim(Date.now() + schedulerLeaseMs)).toEqual([]);
  }
  finally {
    local.close();
  }
}, 30000);

test("publication continues across pages and operator replay preserves uncertain SMS", async () => {
  const { db, school } = await fixture();
  const signals = new SchoolSchedulerSignals(drizzle(db));
  const local = openLocalScheduler(":memory:");
  const store = new SqliteScheduler(local.binding);
  const admin = sqliteSchedulerAdmin(sql => store.query(sql));
  const queue: SchedulerMessage[] = [];
  const sent: string[] = [];
  const runtime = {
    env: { SCHEDULER_MODE: "active", API_ORIGIN: "test" },
    scheduler: store,
    schoolOpened: () => true,
    schedulerSignals: async () => signals,
    getSchoolApplication: async () => school,
    sendSchedulerMessage: async (msg: SchedulerMessage) => {
      queue.push(msg);
    },
    sendNotificationJob: async (id: string) => {
      await db.query("UPDATE notify.jobs SET status='sent' WHERE idempotency_key=$1 AND status='pending'", [id]);
      sent.push(id);
    },
  } as unknown as ApiRuntime;
  try {
    await db.exec(`INSERT INTO notify.jobs(idempotency_key,tenant,job_kind,delivery_id,event_key,title,body,status,attempts,next_attempt_at)
      SELECT 'notification-'||n,'school-a','school','delivery-'||n,'test','private title','private content',
        CASE WHEN n<3 THEN 'dead' ELSE 'pending' END,CASE WHEN n<3 THEN 5 ELSE 0 END,now()+interval '1 day' FROM generate_series(1,55) n;
      INSERT INTO notify.job_recipients(idempotency_key,subject_id,channel,status) VALUES('notification-1','subject','sms','uncertain')`);
    await tickScheduler(runtime, Date.now());
    for (let i = 0; queue.length && i < 10; i++) {
      for (const msg of queue.splice(0)) await consumeScheduler(runtime, msg);
      await tickScheduler(runtime, Date.now());
    }
    expect(await signals.pending()).toEqual([]);
    expect(await store.query("SELECT ref FROM scheduler_work WHERE kind='notification.school'")).toHaveLength(55);
    const refs = (
      await db.query<{ ref: string }>(
        "SELECT ref FROM scheduler_signals WHERE kind='notification' AND source_id IN ('notification-1','notification-2') ORDER BY source_id",
      )
    ).rows;
    for (const { ref } of refs) {
      expect((await store.get(ref))?.exhausted).toBe(true);
      expect(await admin.replay(ref)).toHaveLength(1);
      // A transient queue outage must retain the operator's replay request.
      const claimed = (await store.claim(Date.now()))[0]!;
      await store.fail(claimed, Date.now(), "QUEUE_HANDOFF_FAILED");
      const next = (await store.claim(Date.now() + schedulerLeaseMs))[0]!;
      const message = { version: 1 as const, ref: next.ref, lease: next.lease! };
      await consumeScheduler(runtime, message);
      await consumeScheduler(runtime, message);
    }
    expect(sent).toEqual(["notification-2"]);
    runtime.runSchedulerTick = async () => undefined;
    await db.exec("UPDATE notify.jobs SET next_attempt_at=now() WHERE idempotency_key='notification-3'");
    await publishSchoolChanges(runtime);
    expect(queue).toHaveLength(0);
    expect(await signals.pending()).toEqual([]);
    runtime.runSchedulerTick = work => work();
    await tickScheduler(runtime, Date.now());
    await consumeScheduler(runtime, queue.shift()!);
    expect(sent).toEqual(["notification-2", "notification-3"]);
    expect((await store.get(refs[0]!.ref))?.exhausted).toBe(true);
    expect((await store.get(refs[1]!.ref))?.dueAt).toBeNull();
    expect((await db.query("SELECT status FROM notify.job_recipients WHERE channel='sms'")).rows).toEqual([
      { status: "uncertain" },
    ]);
    expect(JSON.stringify(await admin.inspect())).not.toContain("private content");

    await db.exec(`INSERT INTO notify.jobs(idempotency_key,tenant,job_kind,delivery_id,event_key,title,body,status)
      VALUES('notification-recovered','school-a','school','delivery-window','test','private title','private body','pending')`);
    const project = store.project.bind(store);
    store.project = async () => {
      throw new Error("scheduled publication failure");
    };
    await publishSchoolChanges(runtime);
    store.project = project;
    for (const message of queue.splice(0)) await consumeScheduler(runtime, message);
    expect(sent).toEqual(["notification-2", "notification-3"]);
    expect(await tickScheduler(runtime, Date.now())).toBe(1);
    await consumeScheduler(runtime, queue.shift()!);
    expect(sent).toEqual(["notification-2", "notification-3", "notification-recovered"]);
  }
  finally {
    local.close();
  }
}, 30000);

test("eligibility follows recipient changes and wakes a sent delivery only for a new read receipt", async () => {
  const { db } = await fixture();
  await seedAuthorizationRelationships(db);
  const school = new SchoolSchedulerSignals(drizzle(db));
  const read = async (kind: string) => {
    const [{ ref }] = (
      await db.query<{ ref: string }>("SELECT ref FROM scheduler_signals WHERE kind=$1 AND source_id='school-a'", [
        kind,
      ])
    ).rows;
    return (await school.read(ref!))!;
  };
  const now = Date.now();
  await db.query("UPDATE assessments SET due_at=$1 WHERE id='assessment-math'", [new Date(now + 3600_000)]);
  const before = await read("processDueNotifications");
  expect(await school.eligible(before, now)).toBe(false);
  await db.exec("UPDATE students SET subject_id='student-subject' WHERE id='student-a'");
  const after = await read("processDueNotifications");
  expect(after.revision).toBeGreaterThan(before.revision);
  expect(await school.eligible(after, now)).toBe(true);
  await db.exec("UPDATE student_class_enrollments SET status='transferred' WHERE student_id='student-a'");
  expect(await school.eligible(await read("processDueNotifications"), now)).toBe(false);
  await db.exec(`INSERT INTO message_deliveries (id,school_id,subject_id,title,body,status,sent_at,created_at,updated_at)
    VALUES('sent-delivery','school-a','recipient','title','body','sent',now(),now(),now());
    INSERT INTO notify.jobs (idempotency_key,delivery_id,tenant,job_kind,event_key,title,body,status)
    VALUES('receipt-key','sent-delivery','school-a','school','test','title','body','sent');
    INSERT INTO notify.job_recipients(idempotency_key,subject_id,channel,status) VALUES ('receipt-key','recipient','email','sent')`);
  expect(await school.mismatches("school-a")).toEqual([]);
  await db.exec("UPDATE notify.job_recipients SET status='read' WHERE idempotency_key='receipt-key'");
  expect(await school.mismatches("school-a")).toEqual([
    { id: "sent-delivery", subjectId: "recipient", status: MessageDeliveryStatus.Sent },
  ]);
  await db.exec("UPDATE message_deliveries SET status='read',read_at=now() WHERE id='sent-delivery'");
  expect(await school.mismatches("school-a")).toEqual([]);
}, 30000);

test("shadow compares ready sources and leaves delivery to the legacy owner", async () => {
  const { db, school } = await fixture();
  const signals = new SchoolSchedulerSignals(drizzle(db));
  const local = openLocalScheduler(":memory:");
  const store = new SqliteScheduler(local.binding);
  const sent: SchedulerMessage[] = [];
  const runtime = {
    env: { SCHEDULER_MODE: "shadow", API_ORIGIN: "test" },
    scheduler: store,
    schoolOpened: () => true,
    schedulerSignals: async () => signals,
    getSchoolApplication: async () => school,
    sendSchedulerMessage: async (m: SchedulerMessage) => {
      sent.push(m);
    },
  } as unknown as ApiRuntime;
  try {
    await db.exec(`INSERT INTO notify.jobs(idempotency_key,tenant,job_kind,delivery_id,event_key,title,body)
      VALUES('shadow-source','school-a','school','delivery','test','title','body')`);
    const decisions: unknown[] = [];
    const advance = await compareShadow(runtime, new Date(), {
      info: (entry: unknown) => {
        decisions.push(entry);
      },
    } as LoggerPort);
    expect(decisions[0]).toMatchObject({ legacy: 1, d1: 1, legacyOnly: 0, d1Only: 0 });
    expect(sent).toEqual([]);
    const [{ ref }] = (
      await db.query<{ ref: string }>(
        "SELECT ref FROM scheduler_signals WHERE kind='notification' AND source_id='shadow-source'",
      )
    ).rows;
    expect((await store.get(ref!))?.lease).toBeNull();
    await db.exec("UPDATE notify.jobs SET status='sent' WHERE idempotency_key='shadow-source'");
    await advance();
    expect((await store.get(ref!))?.dueAt).toBeNull();
  }
  finally {
    local.close();
  }
}, 30000);
