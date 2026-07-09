import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

beforeAll(async () => {
  mock.module("@novu/api", () => ({
    Novu: class MockNovu {
      trigger = mock(async () => {});

      triggerBulk = mock(async () => {});

      cancel = mock(async () => {});

      messages = {
        retrieve: mock(async () => ({ result: { data: [], hasMore: false } })),
      };

      subscribers = {
        create: mock(async () => {}),
        delete: mock(async () => {}),
        preferences: {
          update: mock(async () => {}),
          bulkUpdate: mock(async () => {}),
        },
        credentials: {
          update: mock(async () => {}),
          delete: mock(async () => {}),
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

describe("createNovuNotificationGatewayFromSecretKey", () => {
  test("wires trigger, subscriber, and messages clients into a gateway port", async () => {
    const { createNovuNotificationGatewayFromSecretKey } = await import("../src/create-from-secret-key");
    const gateway = createNovuNotificationGatewayFromSecretKey({ secretKey: "test-secret" });

    expect(typeof gateway.enqueue).toBe("function");
    expect(typeof gateway.cancel).toBe("function");
    expect(typeof gateway.upsertRecipient).toBe("function");
    expect(typeof gateway.lookupDeliveryStatuses).toBe("function");
    expect(typeof gateway.registerPushDevice).toBe("function");
  });
});
