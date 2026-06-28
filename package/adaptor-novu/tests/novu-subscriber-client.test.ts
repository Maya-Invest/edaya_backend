import { describe, expect, mock, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";
import { createNovuNotificationGateway } from "../src/novu-notification-gateway";

describe("createNovuNotificationGateway subscriber sync", () => {
  test("upsertRecipient delegates to subscriber client", async () => {
    const upsert = mock(async () => {});
    const remove = mock(async () => {});

    const gateway = createNovuNotificationGateway({
      client: {
        trigger: async () => {},
        triggerBulk: async () => {},
        cancel: async () => {},
      },
      subscriberClient: {
        upsert,
        remove,
        registerPushDevice: mock(async () => {}),
        unregisterPushDevice: mock(async () => {}),
      },
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
});
