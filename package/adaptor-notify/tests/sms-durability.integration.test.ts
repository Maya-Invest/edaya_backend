import type { SmsTransportResult } from "@edaya/core";
import type { TestNotifyHarness } from "./harness";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import { expect, test } from "bun:test";
import { drainPendingSchoolNotifications } from "../src/jobs/drain-jobs";
import { createNotifyNotificationGateway } from "../src/notification-gateway";
import { buildNotifyJobId } from "../src/ids";
import { upsertJobRecipient } from "../src/store/queries";
import { createTestNotifyRuntime } from "./harness";

const recipient = { kind: MessageDeliveryRecipientKind.Guardian, id: "guardian", subjectId: "login" };
const jobId = buildNotifyJobId("school", "school", "delivery");
async function enqueue(harness: TestNotifyHarness, email = false) {
  harness.runtime.resolveSchoolRecipient = async () => ({ schoolId: "school", recipient, phone: "+2250712345678", email: "fixture@example.test", preferences: { channels: { sms: true, email } } });
  const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
  await gateway.enqueue({ idempotencyKey: "delivery", schoolId: "school", kind: "event", eventKey: "announcement.published", title: "Title", body: "Body", recipients: [recipient], enableSms: true, enableEmail: email, enablePush: false });
  return gateway;
}

test("marker is durable before sending; timeout is held across repeated drains", async () => {
  let calls = 0;
  const h = await createTestNotifyRuntime({ sms: { implemented: true, async send() {
    calls++;
    expect(await h.runtime.sql.query("SELECT status FROM notify.job_recipients WHERE channel = 'sms'")).toEqual([{ status: "sending" }]);
    const statuses = await createNotifyNotificationGateway({ runtime: h.runtime }).lookupDeliveryStatuses!([{ schoolId: "school", deliveryId: "delivery", subjectId: "login" }]);
    expect(statuses.size).toBe(0);
    throw new Error("network timeout after acceptance");
  } } });
  try {
    const gateway = await enqueue(h);
    await drainPendingSchoolNotifications(h.runtime);
    await drainPendingSchoolNotifications(h.runtime);
    expect(calls).toBe(1);
    expect(await h.runtime.sql.query("SELECT status, failure_reason FROM notify.jobs")).toEqual([{ status: "dead", failure_reason: "SMS_DELIVERY_UNCERTAIN" }]);
    expect((await gateway.lookupDeliveryStatuses!([{ schoolId: "school", deliveryId: "delivery", subjectId: "login" }])).get("delivery")).toMatchObject({ status: "failed", failureReason: "SMS_DELIVERY_UNCERTAIN" });
  }
  finally {
    await h.close();
  }
});

test("interrupted markers recover even when the job exhausted its last attempt", async () => {
  for (const attempts of [1, 5]) {
    const h = await createTestNotifyRuntime();
    try {
      const gateway = await enqueue(h);
      await upsertJobRecipient(h.runtime.sql, { idempotency_key: jobId, subject_id: "login", channel: "sms", status: "sending", provider_message_id: null, failure_reason: null });
      await h.runtime.sql.execute("UPDATE notify.jobs SET status = 'sending', attempts = $1, lease_id = 'expired', lease_expires_at = NOW() - INTERVAL '1 minute'", [attempts]);
      await drainPendingSchoolNotifications(h.runtime);
      expect(h.sentSms).toHaveLength(0);
      expect(await h.runtime.sql.query("SELECT status FROM notify.job_recipients WHERE channel = 'sms'")).toEqual([{ status: "uncertain" }]);
      expect(await h.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "dead" }]);
      expect((await gateway.lookupDeliveryStatuses!([{ schoolId: "school", deliveryId: "delivery", subjectId: "login" }])).get("delivery")?.failureReason).toBe("SMS_DELIVERY_UNCERTAIN");
    }
    finally {
      await h.close();
    }
  }
});

test("temporary rejection retries, permanent rejection does not", async () => {
  for (const retryable of [true, false]) {
    let calls = 0;
    const h = await createTestNotifyRuntime({ sms: { implemented: true, async send(): Promise<SmsTransportResult> {
      calls++;
      return calls === 1 ? { status: "rejected", reason: "PROVIDER_REJECTED", retryable } : { status: "accepted", providerMessageId: "accepted" };
    } } });
    try {
      await enqueue(h);
      await drainPendingSchoolNotifications(h.runtime);
      await h.runtime.sql.execute("UPDATE notify.jobs SET next_attempt_at = NULL");
      await drainPendingSchoolNotifications(h.runtime);
      expect(calls).toBe(retryable ? 2 : 1);
      expect(await h.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: retryable ? "sent" : "dead" }]);
    }
    finally {
      await h.close();
    }
  }
});

test("held SMS is skipped while email retries successfully", async () => {
  let emails = 0;
  let messages = 0;
  const h = await createTestNotifyRuntime({
    email: { async send() {
      if (++emails === 1)
        throw new Error("temporary email failure");
      return { providerMessageId: "email" };
    } },
    sms: { implemented: true, async send() {
      messages++;
      return { status: "uncertain" };
    } },
  });
  try {
    await enqueue(h, true);
    await drainPendingSchoolNotifications(h.runtime);
    await h.runtime.sql.execute("UPDATE notify.jobs SET next_attempt_at = NULL");
    await drainPendingSchoolNotifications(h.runtime);
    await drainPendingSchoolNotifications(h.runtime);
    expect(emails).toBe(2);
    expect(messages).toBe(1);
    expect(await h.runtime.sql.query("SELECT channel, status FROM notify.job_recipients WHERE channel IN ('email', 'sms') ORDER BY channel")).toEqual([{ channel: "email", status: "sent" }, { channel: "sms", status: "uncertain" }]);
    expect(await h.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "dead" }]);
  }
  finally {
    await h.close();
  }
});

test("parallel drains send once and expired completion cannot erase the marker", async () => {
  let calls = 0;
  const h = await createTestNotifyRuntime({ sms: { implemented: true, async send() {
    calls++;
    await h.runtime.sql.execute("UPDATE notify.jobs SET lease_expires_at = NOW() - INTERVAL '1 minute'");
    return { status: "accepted", providerMessageId: "unacknowledged" };
  } } });
  try {
    await enqueue(h);
    await Promise.all([drainPendingSchoolNotifications(h.runtime), drainPendingSchoolNotifications(h.runtime)]);
    await drainPendingSchoolNotifications(h.runtime);
    expect(calls).toBe(1);
    expect(await h.runtime.sql.query("SELECT status FROM notify.job_recipients WHERE channel = 'sms'")).toEqual([{ status: "uncertain" }]);
  }
  finally {
    await h.close();
  }
});

test("accepted and permanently rejected SMS stay suppressed during email retries", async () => {
  for (const accepted of [true, false]) {
    let emails = 0;
    let messages = 0;
    const h = await createTestNotifyRuntime({
      email: { async send() {
        if (++emails === 1)
          throw new Error("temporary email failure");
        return { providerMessageId: "email" };
      } },
      sms: { implemented: true, async send(): Promise<SmsTransportResult> {
        messages++;
        return accepted ? { status: "accepted", providerMessageId: "sms:v1:[\"fake\",\"message\"]" } : { status: "rejected", reason: "SMS_REJECTED", retryable: false };
      } },
    });
    try {
      await enqueue(h, true);
      await drainPendingSchoolNotifications(h.runtime);
      await h.runtime.sql.execute("UPDATE notify.jobs SET next_attempt_at = NULL");
      await drainPendingSchoolNotifications(h.runtime);
      expect(emails).toBe(2);
      expect(messages).toBe(1);
      expect(await h.runtime.sql.query("SELECT status FROM notify.job_recipients WHERE channel = 'sms'")).toEqual([{ status: accepted ? "sent" : "rejected" }]);
      expect(await h.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: accepted ? "sent" : "dead" }]);
    }
    finally {
      await h.close();
    }
  }
});

test("failed marker persistence prevents any provider call", async () => {
  const h = await createTestNotifyRuntime();
  try {
    await enqueue(h);
    const original = h.runtime.deliverySql!;
    h.runtime.deliverySql = { ...original, async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      if (sql.includes("INSERT INTO notify.job_recipients") && params?.[3] === "sending")
        return [];
      return original.query<T>(sql, params);
    } };
    await drainPendingSchoolNotifications(h.runtime);
    expect(h.sentSms).toHaveLength(0);
  }
  finally {
    await h.close();
  }
});
