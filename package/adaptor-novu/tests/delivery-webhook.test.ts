import { describe, expect, test } from "bun:test";
import { Webhook } from "svix";
import { createNovuDeliveryWebhookAdapter } from "../src/delivery-webhook";

const WEBHOOK_SECRET = "whsec_dGVzdC1kZWxpdmVyeS13ZWJob29rLXNlY3JldC1rZXkhIQ==";

function buildSignedRequest(body: string): Request {
  const wh = new Webhook(WEBHOOK_SECRET);
  const messageId = "msg_test_123";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = wh.sign(messageId, new Date(Number(timestamp) * 1000), body);

  return new Request("https://api.example.com/webhooks/notification-delivery", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": messageId,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    },
    body,
  });
}

describe("createNovuDeliveryWebhookAdapter", () => {
  const adapter = createNovuDeliveryWebhookAdapter({ webhookSecret: WEBHOOK_SECRET });

  test("parseEvents maps message.delivered to sent using transactionId", async () => {
    const body = JSON.stringify({
      type: "message.delivered",
      timestamp: "2026-06-23T12:00:00.000Z",
      data: {
        object: {
          _id: "novu-msg-1",
          transactionId: "delivery:ann1:subject:stu1",
          channel: "in_app",
          subscriberId: "subject:stu1",
          updatedAt: "2026-06-23T12:00:01.000Z",
        },
      },
    });

    const events = await adapter.parseEvents(body);

    expect(events).toEqual([{
      deliveryId: "delivery:ann1:subject:stu1",
      status: "sent",
      providerMessageId: "novu-msg-1",
      channel: "in_app",
      failureReason: undefined,
      occurredAt: new Date("2026-06-23T12:00:00.000Z"),
      subjectId: "subject:stu1",
    }]);
  });

  test("parseEvents maps message.failed with failure reason", async () => {
    const body = JSON.stringify({
      type: "message.failed",
      data: {
        transactionId: "delivery:ann1:subject:g1",
        _id: "novu-msg-2",
        error: { message: "SMTP bounce" },
      },
    });

    const events = await adapter.parseEvents(body);

    expect(events[0]).toMatchObject({
      deliveryId: "delivery:ann1:subject:g1",
      status: "failed",
      failureReason: "SMTP bounce",
    });
  });

  test("parseEvents ignores message.sent lifecycle events", async () => {
    const body = JSON.stringify({
      type: "message.sent",
      data: {
        transactionId: "delivery:ann1:subject:g1",
        _id: "novu-msg-3",
      },
    });

    expect(await adapter.parseEvents(body)).toEqual([]);
  });

  test("verifyRequest accepts Svix-signed payloads", async () => {
    const body = JSON.stringify({
      type: "message.read",
      data: {
        transactionId: "delivery:ann1:subject:g1",
        _id: "novu-msg-4",
        subscriber: { subscriberId: "subject:g1" },
      },
    });
    const request = buildSignedRequest(body);

    await expect(adapter.verifyRequest(request, body)).resolves.toBe(true);
  });

  test("verifyRequest rejects tampered payloads", async () => {
    const body = JSON.stringify({
      type: "message.delivered",
      data: { transactionId: "delivery:ann1:subject:g1" },
    });
    const request = buildSignedRequest(body);

    await expect(adapter.verifyRequest(request, `${body} `)).resolves.toBe(false);
  });
});
