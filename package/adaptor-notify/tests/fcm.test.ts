import { describe, expect, test } from "bun:test";
import { createFcmHttpV1Transport, createLogFcmTransport } from "../src/push/fcm";

describe("FCM transports", () => {
  test("log transport does not call the network", async () => {
    const result = await createLogFcmTransport(() => {}).send({
      token: "abcdef123456",
      title: "Hello",
      body: "World",
      data: { deliveryId: "d1", eventKey: "announcement.published", title: "Hello", body: "World" },
    });
    expect(result.providerMessageId).toContain("log-fcm");
  });

  test("HTTP v1 transport requires project_id", () => {
    expect(() => createFcmHttpV1Transport(JSON.stringify({
      client_email: "sa@example.com",
      private_key: "-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----",
    }))).toThrow(/project_id/);
  });
});
