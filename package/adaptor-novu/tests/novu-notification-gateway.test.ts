import { describe, expect, mock, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import { createNovuNotificationGateway } from "../src/novu-notification-gateway";

function baseGatewayOptions(overrides: Record<string, unknown> = {}) {
  return {
    client: {
      trigger: mock(async () => {}),
      triggerBulk: mock(async () => {}),
      cancel: mock(async () => {}),
    },
    ...overrides,
  };
}

describe("createNovuNotificationGateway", () => {
  test("enqueue triggers Novu and cancel uses idempotency key as transaction id", async () => {
    const trigger = mock(async () => {});
    const triggerBulk = mock(async () => {});
    const cancel = mock(async () => {});

    const gateway = createNovuNotificationGateway({
      client: { trigger, triggerBulk, cancel },
    });

    const input = {
      idempotencyKey: "assessment.due_soon:a1",
      schoolId: "school-1",
      kind: "job" as const,
      eventKey: "assessment.due_soon",
      title: "Due soon",
      body: "Tomorrow",
      recipients: [{ kind: MessageDeliveryRecipientKind.Student, id: "s1", subjectId: "auth-s1" }],
    };

    await gateway.enqueue(input);
    await gateway.cancel(input.idempotencyKey);

    expect(trigger).toHaveBeenCalledTimes(1);
    expect(triggerBulk).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith("assessment.due_soon:a1");
  });

  test("enqueue uses triggerBulk when recipient chunks exceed Novu limits", async () => {
    const trigger = mock(async () => {});
    const triggerBulk = mock(async () => {});
    const recipients = Array.from({ length: 101 }, (_, index) => ({
      kind: MessageDeliveryRecipientKind.Student,
      id: `s${index}`,
      subjectId: `auth-s${index}`,
    }));

    const gateway = createNovuNotificationGateway({
      client: { trigger, triggerBulk, cancel: mock(async () => {}) },
    });

    await gateway.enqueue({
      idempotencyKey: "announcement:bulk",
      schoolId: "school-1",
      kind: "event",
      eventKey: "announcement.published",
      title: "School news",
      body: "Read more",
      recipients,
    });

    expect(trigger).not.toHaveBeenCalled();
    expect(triggerBulk).toHaveBeenCalledTimes(1);
  });

  test("swallows client errors and reports via onError", async () => {
    const onError = mock(() => {});
    const gateway = createNovuNotificationGateway({
      client: {
        trigger: async () => {
          throw new Error("novu unavailable");
        },
        triggerBulk: async () => {},
        cancel: async () => {},
      },
      onError,
    });

    await expect(gateway.enqueue({
      idempotencyKey: "test:1",
      schoolId: "school-1",
      kind: "event",
      eventKey: "test.event",
      title: "Title",
      body: "Body",
      recipients: [{ kind: MessageDeliveryRecipientKind.Guardian, id: "g1", subjectId: "auth-g1" }],
    })).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("reports cancel failures through onError", async () => {
    const onError = mock(() => {});
    const gateway = createNovuNotificationGateway({
      client: {
        trigger: async () => {},
        triggerBulk: async () => {},
        cancel: async () => {
          throw new Error("cancel failed");
        },
      },
      onError,
    });

    await gateway.cancel("delivery:1");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("upsertRecipient and removeRecipient delegate to subscriber client", async () => {
    const upsert = mock(async () => {});
    const remove = mock(async () => {});

    const gateway = createNovuNotificationGateway({
      ...baseGatewayOptions({
        subscriberClient: {
          upsert,
          remove,
          registerPushDevice: mock(async () => {}),
          unregisterPushDevice: mock(async () => {}),
        },
      }),
    });

    const profile = {
      schoolId: "school-1",
      recipient: {
        kind: MessageDeliveryRecipientKind.Guardian,
        id: "g1",
        subjectId: "auth-g1",
      },
      displayName: "Grace Hopper",
      email: "grace@mail.com",
      preferences: {},
    };

    await gateway.upsertRecipient(profile);
    await gateway.removeRecipient("school-1", profile.recipient);

    expect(upsert).toHaveBeenCalledWith("auth-g1", "school-1", profile);
    expect(remove).toHaveBeenCalledWith("auth-g1");
  });

  test("skips subscriber sync when subjectId is missing", async () => {
    const upsert = mock(async () => {});
    const gateway = createNovuNotificationGateway({
      ...baseGatewayOptions({
        subscriberClient: {
          upsert,
          remove: mock(async () => {}),
          registerPushDevice: mock(async () => {}),
          unregisterPushDevice: mock(async () => {}),
        },
      }),
    });

    await gateway.upsertRecipient({
      schoolId: "school-1",
      recipient: {
        kind: MessageDeliveryRecipientKind.Guardian,
        id: "g1",
      },
      displayName: "Grace Hopper",
      preferences: {},
    });

    expect(upsert).not.toHaveBeenCalled();
  });

  test("registers and unregisters push devices when subscriber client is configured", async () => {
    const registerPushDevice = mock(async () => {});
    const unregisterPushDevice = mock(async () => {});

    const gateway = createNovuNotificationGateway({
      ...baseGatewayOptions({
        subscriberClient: {
          upsert: mock(async () => {}),
          remove: mock(async () => {}),
          registerPushDevice,
          unregisterPushDevice,
        },
      }),
    });

    await gateway.registerPushDevice?.({
      schoolId: "school-1",
      subjectId: "auth-s1",
      provider: "fcm",
      token: "device-token",
    });
    await gateway.unregisterPushDevice?.({
      subjectId: "auth-s1",
      provider: "fcm",
    });

    expect(registerPushDevice).toHaveBeenCalledWith("auth-s1", "fcm", "device-token");
    expect(unregisterPushDevice).toHaveBeenCalledWith("auth-s1", "fcm");
  });

  test("rethrows registerPushDevice failures after reporting onError", async () => {
    const onError = mock(() => {});
    const gateway = createNovuNotificationGateway({
      ...baseGatewayOptions({
        onError,
        subscriberClient: {
          upsert: mock(async () => {}),
          remove: mock(async () => {}),
          registerPushDevice: async () => {
            throw new Error("device registration failed");
          },
          unregisterPushDevice: mock(async () => {}),
        },
      }),
    });

    await expect(gateway.registerPushDevice?.({
      schoolId: "school-1",
      subjectId: "auth-s1",
      provider: "apns",
      token: "device-token",
    })).rejects.toThrow("device registration failed");
    expect(onError).toHaveBeenCalledTimes(1);
  });

  test("lookupDeliveryStatuses delegates to messages client", async () => {
    const statuses = new Map([["delivery-1", { status: "sent" as const, read: false, seen: false }]]);
    const lookupDeliveryStatuses = mock(async () => statuses);

    const gateway = createNovuNotificationGateway({
      ...baseGatewayOptions({
        messagesClient: { lookupDeliveryStatuses },
      }),
    });

    const result = await gateway.lookupDeliveryStatuses?.([
      { deliveryId: "delivery-1", subjectId: "auth-s1" },
    ]);

    expect(lookupDeliveryStatuses).toHaveBeenCalledTimes(1);
    expect(result).toBe(statuses);
  });

  test("does not expose lookupDeliveryStatuses when messages client is absent", async () => {
    const gateway = createNovuNotificationGateway(baseGatewayOptions());
    expect(gateway.lookupDeliveryStatuses).toBeUndefined();
  });
});
