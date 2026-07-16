import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

const retrieve = mock(async () => ({
  result: {
    data: [{
      id: "message-1",
      transactionId: "delivery-1",
      subscriberId: "auth-s1",
      status: "sent",
      read: false,
      seen: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    }],
    hasMore: false,
  },
}));

beforeAll(async () => {
  mock.module("@novu/api", () => ({
    Novu: class MockNovu {
      messages = { retrieve };
    },
  }));
});

afterAll(async () => {
  mock.restore();
});

describe("createNovuMessagesClient", () => {
  test("looks up delivery statuses by transaction id", async () => {
    const { createNovuMessagesClient } = await import("../src/novu-messages-client");
    const client = createNovuMessagesClient({ secretKey: "test-secret" });

    const statuses = await client.lookupDeliveryStatuses([
      { deliveryId: "delivery-1", subjectId: "auth-s1" },
    ]);

    expect(retrieve).toHaveBeenCalled();
    expect(statuses.get("delivery-1")?.status).toBe("sent");
  });

  test("returns an empty map when no deliveries are requested", async () => {
    const { createNovuMessagesClient } = await import("../src/novu-messages-client");
    const client = createNovuMessagesClient({ secretKey: "test-secret" });

    await expect(client.lookupDeliveryStatuses([])).resolves.toEqual(new Map());
  });
});
