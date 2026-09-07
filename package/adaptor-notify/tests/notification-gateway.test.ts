import { MessageDeliveryRecipientKind } from "@edaya/core";
import { describe, expect, test } from "bun:test";
import { createNotifyNotificationGateway } from "../src/notification-gateway";
import type { NotifySql } from "../src/store/types";
import { createNotifyRuntime } from "../src/runtime";
import { createTestNotifyRuntime } from "./harness";

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
  test("swallows enqueue failures", async () => {
    const errors: unknown[] = [];
    const gateway = createNotifyNotificationGateway({
      runtime: createNotifyRuntime({
        sql: throwingSql("down"),
        env: { EMAIL_TRANSPORT: "log" },
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
    })).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });

  test("rethrows registerPushDevice failures", async () => {
    const gateway = createNotifyNotificationGateway({
      runtime: createNotifyRuntime({
        sql: throwingSql("fcm"),
        env: { EMAIL_TRANSPORT: "log" },
        log: () => {},
      }),
    });

    await expect(gateway.registerPushDevice?.({
      subjectId: "s1",
      schoolId: "sch",
      token: "tok",
      provider: "fcm",
    })).rejects.toThrow("fcm");
  });

  test("enqueues and sends email when prefs allow", async () => {
    const harness = await createTestNotifyRuntime();
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    await gateway.upsertRecipient({
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
    expect(harness.sent).toEqual([{ to: "g@school.edu", subject: "Hello" }]);
    await harness.close();
  });

  test("does not resend a duplicate enqueue", async () => {
    const harness = await createTestNotifyRuntime();
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    await gateway.upsertRecipient({
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
    expect(harness.sent).toHaveLength(1);
    await harness.close();
  });

  test("sends FCM when a device is registered", async () => {
    const harness = await createTestNotifyRuntime();
    const gateway = createNotifyNotificationGateway({ runtime: harness.runtime });
    await gateway.upsertRecipient({
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
});
