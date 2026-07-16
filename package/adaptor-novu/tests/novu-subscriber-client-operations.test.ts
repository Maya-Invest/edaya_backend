import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { MessageDeliveryRecipientKind } from "@edaya/core";

const subscribersCreate = mock(async () => {});
const subscribersDelete = mock(async () => {});
const preferencesUpdate = mock(async () => {});
const preferencesBulkUpdate = mock(async () => {});
const credentialsUpdate = mock(async () => {});
const credentialsDelete = mock(async () => {});

beforeAll(async () => {
  mock.module("@novu/api", () => ({
    Novu: class MockNovu {
      subscribers = {
        create: subscribersCreate,
        delete: subscribersDelete,
        preferences: {
          update: preferencesUpdate,
          bulkUpdate: preferencesBulkUpdate,
        },
        credentials: {
          update: credentialsUpdate,
          delete: credentialsDelete,
        },
      };
    },
    ChatOrPushProviderEnum: {
      Apns: "apns",
      Fcm: "fcm",
    },
  }));
});

afterAll(async () => {
  mock.restore();
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
  preferences: {
    allowsNotifications: true,
    channels: { email: true, sms: false, push: true, inApp: true },
  },
};

describe("createNovuSubscriberClient", () => {
  beforeEach(() => {
    subscribersCreate.mockClear();
    subscribersDelete.mockClear();
    preferencesUpdate.mockClear();
    preferencesBulkUpdate.mockClear();
    credentialsUpdate.mockClear();
    credentialsDelete.mockClear();
  });

  test("upserts subscriber profile, global preferences, and workflow preferences", async () => {
    const { createNovuSubscriberClient } = await import("../src/novu-subscriber-client");
    const client = createNovuSubscriberClient({ secretKey: "test-secret" });

    await client.upsert("auth-g1", "school-1", profile);

    expect(subscribersCreate).toHaveBeenCalledTimes(1);
    expect(preferencesUpdate).toHaveBeenCalledTimes(1);
    expect(preferencesBulkUpdate).toHaveBeenCalledTimes(1);
  });

  test("skips workflow preference sync when requested", async () => {
    const { createNovuSubscriberClient } = await import("../src/novu-subscriber-client");
    const client = createNovuSubscriberClient({ secretKey: "test-secret" });

    await client.upsert("auth-g1", "school-1", profile, { skipWorkflowPreferences: true });

    expect(preferencesBulkUpdate).not.toHaveBeenCalled();
  });

  test("swallows delete errors when the subscriber is already missing", async () => {
    subscribersDelete.mockImplementationOnce(async () => {
      throw Object.assign(new Error("Subscriber was not found"), { statusCode: 404 });
    });

    const { createNovuSubscriberClient } = await import("../src/novu-subscriber-client");
    const client = createNovuSubscriberClient({ secretKey: "test-secret" });

    await expect(client.remove("auth-g1")).resolves.toBeUndefined();
  });

  test("registers and unregisters push device credentials", async () => {
    const { createNovuSubscriberClient } = await import("../src/novu-subscriber-client");
    const client = createNovuSubscriberClient({ secretKey: "test-secret" });

    await client.registerPushDevice("auth-g1", "fcm", "device-token");
    await client.unregisterPushDevice("auth-g1", "apns");

    expect(credentialsUpdate).toHaveBeenCalledTimes(1);
    expect(credentialsDelete).toHaveBeenCalledTimes(1);
  });
});
