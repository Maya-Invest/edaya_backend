import { MessageDeliveryRecipientKind } from "@edaya/core";
import { expect, test } from "bun:test";
import { buildNotifyJobId } from "../src/ids";
import { drainPendingSchoolNotifications } from "../src/jobs/drain-jobs";
import { createNotifyNotificationGateway } from "../src/notification-gateway";
import { createTestNotifyRuntime } from "./harness";

const recipient = { kind: MessageDeliveryRecipientKind.Guardian, id: "guardian", subjectId: "shared-login" };
const input = { idempotencyKey: "same-delivery", kind: "event" as const, eventKey: "announcement.published", title: "Title", body: "Body", recipients: [recipient] };

test("same logical delivery and login are independent across schools, including devices and status lookups", async () => {
  const fixture = await createTestNotifyRuntime();
  try {
    const gateway = createNotifyNotificationGateway({ runtime: fixture.runtime });
    fixture.runtime.resolveSchoolRecipient = async request => ({
      schoolId: request.schoolId,
      recipient,
      email: `${request.schoolId}@example.test`,
      preferences: { channels: { email: true, push: true } },
    });
    for (const schoolId of ["a", "b"]) {
      await gateway.registerPushDevice!({ appId: "guardian", installationId: "device-1", profileKind: "guardian", profileId: "guardian", schoolId, subjectId: recipient.subjectId, provider: "fcm", token: `device-${schoolId}` });
      await gateway.enqueue({ ...input, schoolId });
    }
    await gateway.unregisterPushDevice!({ appId: "guardian", installationId: "device-1", schoolId: "a", subjectId: recipient.subjectId, provider: "fcm" });
    await drainPendingSchoolNotifications(fixture.runtime);
    expect(fixture.sent.map(message => message.to).sort()).toEqual(["a@example.test", "b@example.test"]);
    expect(fixture.pushes.map(message => message.token)).toEqual(["device-b"]);
    expect(fixture.pushes[0]!.data).toMatchObject({ deliveryId: input.idempotencyKey });
    for (const schoolId of ["a", "b"])
      expect((await gateway.lookupDeliveryStatuses!([{ schoolId, deliveryId: input.idempotencyKey, subjectId: recipient.subjectId }])).get(input.idempotencyKey)?.status).toBe("sent");
    expect((await gateway.lookupDeliveryStatuses!([{ schoolId: "foreign", deliveryId: input.idempotencyKey, subjectId: recipient.subjectId }])).size).toBe(0);
    expect(await fixture.runtime.sql.query("SELECT idempotency_key FROM notify.jobs ORDER BY tenant")).toEqual([
      { idempotency_key: buildNotifyJobId("school", "a", input.idempotencyKey) },
      { idempotency_key: buildNotifyJobId("school", "b", input.idempotencyKey) },
    ]);
  }
  finally { await fixture.close(); }
});

test("cancellation applies only to the admitted school's matching occurrence", async () => {
  const fixture = await createTestNotifyRuntime();
  try {
    const gateway = createNotifyNotificationGateway({ runtime: fixture.runtime });
    fixture.runtime.resolveSchoolRecipient = async request => ({ schoolId: request.schoolId, recipient, email: "current@example.test", preferences: { channels: { email: true } } });
    await gateway.enqueue({ ...input, schoolId: "a" });
    await gateway.enqueue({ ...input, schoolId: "b" });
    await gateway.cancel(input.idempotencyKey, "a");
    await drainPendingSchoolNotifications(fixture.runtime);
    expect(fixture.sent).toHaveLength(1);
    expect(await fixture.runtime.sql.query("SELECT tenant, status FROM notify.jobs ORDER BY tenant")).toEqual([{ tenant: "a", status: "cancelled" }, { tenant: "b", status: "sent" }]);
  }
  finally { await fixture.close(); }
});

test("failed delivery stores stable codes and exhausted or unsupported jobs become terminal", async () => {
  const fixture = await createTestNotifyRuntime({ email: { send: async () => {
    throw new Error("credential=PRIVATE");
  } } });
  try {
    const logs: unknown[] = [];
    fixture.runtime.log = (...args) => {
      logs.push(args);
    };
    fixture.runtime.resolveSchoolRecipient = async request => ({ schoolId: request.schoolId, recipient, email: "current@example.test", preferences: { channels: { email: true } } });
    await createNotifyNotificationGateway({ runtime: fixture.runtime }).enqueue({ ...input, schoolId: "a" });
    await drainPendingSchoolNotifications(fixture.runtime);
    expect(JSON.stringify(await fixture.runtime.sql.query("SELECT * FROM notify.jobs"))).not.toContain("PRIVATE");
    expect(JSON.stringify(logs)).not.toContain("PRIVATE");
    expect(await fixture.runtime.sql.query("SELECT failure_reason FROM notify.jobs")).toEqual([{ failure_reason: "NOTIFY_DELIVERY_FAILED" }]);
    await fixture.runtime.sql.execute("UPDATE notify.jobs SET status = 'sending', attempts = 5, lease_expires_at = NOW() - INTERVAL '1 minute'");
    await drainPendingSchoolNotifications(fixture.runtime);
    expect(await fixture.runtime.sql.query("SELECT status, failure_reason FROM notify.jobs")).toEqual([{ status: "dead", failure_reason: "NOTIFY_ATTEMPTS_EXHAUSTED" }]);
    await createNotifyNotificationGateway({ runtime: fixture.runtime }).enqueue({ ...input, schoolId: "b" });
    await fixture.runtime.sql.execute("UPDATE notify.jobs SET payload_version = 2 WHERE tenant = 'b'");
    await drainPendingSchoolNotifications(fixture.runtime);
    expect(await fixture.runtime.sql.query("SELECT status, failure_reason FROM notify.jobs WHERE tenant = 'b'")).toEqual([{ status: "dead", failure_reason: "NOTIFY_VERSION_UNSUPPORTED" }]);
  }
  finally { await fixture.close(); }
});

test("an expired lease cannot persist provider completion or publish delivery events", async () => {
  const fixture = await createTestNotifyRuntime();
  try {
    fixture.runtime.resolveSchoolRecipient = async request => ({ schoolId: request.schoolId, recipient, email: "current@example.test", preferences: { channels: { email: true } } });
    fixture.runtime.email = { send: async () => {
      await fixture.runtime.sql.execute("UPDATE notify.jobs SET lease_expires_at = NOW() - INTERVAL '1 minute'");
      return { providerMessageId: "uncertain-provider-result" };
    } };
    const events: unknown[] = [];
    fixture.runtime.onDeliveryEvent = async (event) => {
      events.push(event);
    };
    await createNotifyNotificationGateway({ runtime: fixture.runtime }).enqueue({ ...input, schoolId: "a" });
    await drainPendingSchoolNotifications(fixture.runtime);
    expect(await fixture.runtime.sql.query("SELECT status FROM notify.job_recipients WHERE channel = 'email'")).toEqual([]);
    expect(events).toEqual([]);
    expect(await fixture.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "sending" }]);
  }
  finally { await fixture.close(); }
});
