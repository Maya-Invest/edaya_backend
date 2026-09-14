import type { NotifySql } from "../src/store/types";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import { describe, expect, test } from "bun:test";
import { drainPendingSchoolNotifications } from "../src/jobs/drain-jobs";
import { createNotifyNotificationGateway } from "../src/notification-gateway";
import { createNotifyRuntime } from "../src/runtime";
import { createTestNotifyRuntime, unimplementedTestSms } from "./harness";

const noopEmail = { send: async () => ({}) };
const noopSms = unimplementedTestSms;

function throwingSql(message: string): NotifySql {
  const fail = async () => {
    throw new Error(message);
  };
  return {
    query: fail as NotifySql["query"],
    execute: fail,
    close: async () => {},
  };
}

describe("createNotifyNotificationGateway", () => {
  test("propagates enqueue failures so the transaction can roll back", async () => {
    const errors: unknown[] = [];
    const gateway = createNotifyNotificationGateway({
      runtime: createNotifyRuntime({
        sql: throwingSql("down"),
        env: {},
        email: noopEmail,
        sms: noopSms,
        log: () => {},
      }),
      onError: error => errors.push(error),
    });

    await expect(gateway.enqueue({
      idempotencyKey: "d1",
      schoolId: "sch",
      kind: "event",
      eventKey: "announcement.published",
      title: "t",
      body: "b",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "s1" }],
    })).rejects.toThrow("NOTIFY_STORAGE_FAILED");
    expect(errors).toHaveLength(1);
  });

  test("rethrows registerPushDevice failures", async () => {
    const gateway = createNotifyNotificationGateway({
      runtime: createNotifyRuntime({
        sql: throwingSql("fcm"),
        env: {},
        email: noopEmail,
        sms: noopSms,
        log: () => {},
      }),
    });

    await expect(gateway.registerPushDevice?.({
      subjectId: "s1",
      schoolId: "sch",
      token: "tok",
      provider: "fcm",
    })).rejects.toThrow("NOTIFY_STORAGE_FAILED");
  });

  test("enqueues and sends email when prefs allow", async () => {
    const harness = await createTestNotifyRuntime();
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    harness.runtime.resolveSchoolRecipient = async () => ({
      schoolId: "sch_1",
      recipient: { kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "sub_1" },
      email: "g@school.edu",
      preferences: { allowsNotifications: true, channels: { email: true, push: false } },
    });
    await gateway.enqueue({
      idempotencyKey: "delivery-1",
      schoolId: "sch_1",
      kind: "event",
      eventKey: "announcement.published",
      title: "Hello",
      body: "<p>Hi</p>",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "sub_1" }],
    });
    expect(harness.sent).toHaveLength(0);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent).toEqual([{ to: "g@school.edu", subject: "Hello" }]);
    await harness.close();
  });

  test("does not resend a duplicate enqueue", async () => {
    const harness = await createTestNotifyRuntime();
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    harness.runtime.resolveSchoolRecipient = async () => ({
      schoolId: "sch_1",
      recipient: { kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "sub_1" },
      email: "g@school.edu",
      preferences: { allowsNotifications: true, channels: { email: true, push: false } },
    });
    const input = {
      idempotencyKey: "delivery-dup",
      schoolId: "sch_1",
      kind: "event" as const,
      eventKey: "announcement.published",
      title: "Hello",
      body: "<p>Hi</p>",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "sub_1" }],
    };
    await gateway.enqueue(input);
    await gateway.enqueue(input);
    expect(harness.sent).toHaveLength(0);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent).toHaveLength(1);
    await harness.close();
  });

  test("sends FCM when a device is registered", async () => {
    const harness = await createTestNotifyRuntime();
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    harness.runtime.resolveSchoolRecipient = async () => ({
      schoolId: "sch_1",
      recipient: { kind: MessageDeliveryRecipientKind.Guardian, id: "g2", subjectId: "sub_push" },
      email: "g2@school.edu",
      preferences: { allowsNotifications: true, channels: { email: false, push: true } },
    });
    await gateway.registerPushDevice?.({
      subjectId: "sub_push",
      schoolId: "sch_1",
      provider: "fcm",
      token: "fcm-token-1",
    });
    await gateway.enqueue({
      idempotencyKey: "delivery-push",
      schoolId: "sch_1",
      kind: "event",
      eventKey: "announcement.published",
      title: "Hello",
      body: "Hi",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g2", subjectId: "sub_push" }],
    });
    expect(harness.pushes).toHaveLength(0);
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.pushes).toEqual([{
      token: "fcm-token-1",
      title: "Hello",
      data: {
        deliveryId: "delivery-push",
        eventKey: "announcement.published",
        title: "Hello",
        body: "Hi",
      },
    }]);
    await harness.close();
  });

  test("skips unimplemented SMS on school jobs without failing email", async () => {
    const harness = await createTestNotifyRuntime({ sms: unimplementedTestSms });
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    harness.runtime.resolveSchoolRecipient = async () => ({
      schoolId: "sch_1",
      recipient: { kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "sub_1" },
      email: "g@school.edu",
      phone: "+15145550123",
      preferences: { allowsNotifications: true, channels: { email: true, sms: true } },
    });
    await gateway.enqueue({
      idempotencyKey: "delivery-sms-skip",
      schoolId: "sch_1",
      kind: "event",
      eventKey: "announcement.published",
      title: "Hello",
      body: "Hi",
      smsBody: "Hi SMS",
      enableEmail: true,
      enablePush: false,
      enableSms: true,
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "sub_1" }],
    });
    await drainPendingSchoolNotifications(harness.runtime);
    expect(harness.sent).toEqual([{ to: "g@school.edu", subject: "Hello" }]);
    expect(harness.sentSms).toHaveLength(0);
    expect(await harness.runtime.sql.query("SELECT status FROM notify.jobs")).toEqual([{ status: "sent" }]);
    await harness.close();
  });
});
