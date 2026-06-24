import { describe, expect, test } from "bun:test";
import {
  groupNovuMessagesByDeliveryId,
  mapNovuApiMessageToDeliveryStatus,
} from "../src/delivery-status";

describe("mapNovuApiMessageToDeliveryStatus", () => {
  test("maps sent messages", () => {
    const lookup = mapNovuApiMessageToDeliveryStatus({
      id: "msg-1",
      transactionId: "delivery:ann-1:sub-1",
      status: "sent",
      deliveredAt: ["2026-06-24T00:00:00.000Z"],
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(lookup).toEqual({
      status: "sent",
      providerMessageId: "msg-1",
      occurredAt: new Date("2026-06-24T00:00:00.000Z"),
    });
  });

  test("maps error messages to failed", () => {
    const lookup = mapNovuApiMessageToDeliveryStatus({
      id: "msg-2",
      transactionId: "delivery:ann-1:sub-2",
      status: "error",
      errorText: "SMTP bounce",
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(lookup).toEqual({
      status: "failed",
      providerMessageId: "msg-2",
      failureReason: "SMTP bounce",
      occurredAt: new Date("2026-06-24T00:00:00.000Z"),
    });
  });

  test("maps read and seen messages to read", () => {
    expect(mapNovuApiMessageToDeliveryStatus({
      id: "msg-3",
      transactionId: "delivery:ann-1:sub-3",
      status: "sent",
      read: true,
      lastReadDate: "2026-06-24T01:00:00.000Z",
      createdAt: "2026-06-24T00:00:00.000Z",
    })?.status).toBe("read");

    expect(mapNovuApiMessageToDeliveryStatus({
      id: "msg-4",
      transactionId: "delivery:ann-1:sub-4",
      status: "sent",
      seen: true,
      lastSeenDate: "2026-06-24T01:00:00.000Z",
      createdAt: "2026-06-24T00:00:00.000Z",
    })?.status).toBe("read");
  });

  test("returns null for in-flight messages", () => {
    expect(mapNovuApiMessageToDeliveryStatus({
      transactionId: "delivery:ann-1:sub-5",
      createdAt: "2026-06-24T00:00:00.000Z",
    })).toBeNull();
  });
});

describe("groupNovuMessagesByDeliveryId", () => {
  test("prefers read over sent for multi-channel deliveries", () => {
    const grouped = groupNovuMessagesByDeliveryId([
      {
        id: "msg-email",
        transactionId: "delivery:ann-1:sub-1",
        status: "sent",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
      {
        id: "msg-in-app",
        transactionId: "delivery:ann-1:sub-1",
        status: "sent",
        read: true,
        lastReadDate: "2026-06-24T01:00:00.000Z",
        createdAt: "2026-06-24T00:00:00.000Z",
      },
    ]);

    expect(grouped.get("delivery:ann-1:sub-1")).toEqual({
      status: "read",
      providerMessageId: "msg-in-app",
      occurredAt: new Date("2026-06-24T01:00:00.000Z"),
    });
  });
});
