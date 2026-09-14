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

  test("parseEvents maps message.delivered to sent using explicit delivery correlation", async () => {
    const body = JSON.stringify({
      type: "message.delivered",
      timestamp: "2026-06-23T12:00:00.000Z",
      data: {
        object: {
          _id: "novu-msg-1",
          transactionId: "delivery:ann1:subject:stu1:subject:stu1:email",
          payload: { deliveryId: "delivery:ann1:subject:stu1", subjectId: "subject:stu1" },
          channel: "email",
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
      channel: "email",
      failureReason: undefined,
      occurredAt: new Date("2026-06-23T12:00:00.000Z"),
      subjectId: "subject:stu1",
    }]);
  });

  test("parseEvents maps message.failed with failure reason", async () => {
    const body = JSON.stringify({
      type: "message.failed",
      data: {
        transactionId: "delivery:ann1:subject:g1:subject:g1:email",
        payload: { deliveryId: "delivery:ann1:subject:g1", subjectId: "subject:g1" },
        channel: "email",
        _id: "novu-msg-2",
        error: { message: "SMTP bounce" },
      },
    });

    const events = await adapter.parseEvents(body);

    expect(events[0]).toMatchObject({
      deliveryId: "delivery:ann1:subject:g1",
      status: "failed",
      failureReason: "NOTIFY_PROVIDER_DELIVERY_FAILED",
    });
  });

  test("parseEvents ignores message.sent lifecycle events", async () => {
    const body = JSON.stringify({
      type: "message.sent",
      data: {
        transactionId: "delivery:ann1:subject:g1:subject:g1:email",
        payload: { deliveryId: "delivery:ann1:subject:g1", subjectId: "subject:g1" },
        channel: "email",
        _id: "novu-msg-3",
      },
    });

    expect(await adapter.parseEvents(body)).toEqual([]);
  });

  test.each([
    { transactionId: "invitation:123:email" },
    { transactionId: "delivery:person:email", payload: { deliveryId: "delivery" } },
    { transactionId: "different:person:email", payload: { deliveryId: "delivery", subjectId: "person" } },
    { transactionId: "delivery:person:email", payload: { deliveryId: "delivery", subjectId: "other" } },
    { transactionId: "delivery:person:email", payload: { deliveryId: "delivery", subjectId: "person" }, channel: "push" },
  ])("ignores unrelated or mismatched receipt correlation: %j", async (message) => {
    expect(await adapter.parseEvents(JSON.stringify({ type: "message.delivered", data: { channel: "email", subscriberId: "person", ...message } }))).toEqual([]);
  });

  test("verifyRequest accepts Svix-signed payloads", async () => {
    const body = JSON.stringify({
      type: "message.read",
      data: {
        transactionId: "delivery:ann1:subject:g1:subject:g1:email",
        payload: { deliveryId: "delivery:ann1:subject:g1", subjectId: "subject:g1" },
        channel: "email",
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

test("accepts actual tenant-bound transport correlation and rejects school substitution", async () => {
  const { buildNotifyChannelId, buildNotifyJobId } = await import("@edaya/adaptor-notify");
  const { createNovuEmailTransport } = await import("../src/email-transport");
  const requests: import("../src/email-transport").NovuEmailRequest[] = [];
  const transport = createNovuEmailTransport({ trigger: async (request) => {
    requests.push(request);
  } });
  const correlation = { schoolId: "school-a", deliveryId: "delivery:v2:opaque", subjectId: "login" };
  await transport.send({
    to: "synthetic@example.test",
    from: { email: "sender@example.test" },
    subject: "Synthetic",
    html: "Fixture",
    correlation,
    idempotencyKey: buildNotifyChannelId(buildNotifyJobId("school", correlation.schoolId, correlation.deliveryId), correlation.subjectId, "email"),
  });
  const request = requests[0]!;
  expect(request.transactionId).toHaveLength(64);
  const adapter = createNovuDeliveryWebhookAdapter({ webhookSecret: WEBHOOK_SECRET });
  const envelope = (payload: Record<string, unknown>, transactionId = request.transactionId) => JSON.stringify({
    type: "message.delivered",
    data: { channel: "email", transactionId, payload },
  });
  expect(await adapter.parseEvents(envelope(request.payload))).toMatchObject([{ deliveryId: correlation.deliveryId, subjectId: "login", status: "sent" }]);
  expect(await adapter.parseEvents(envelope({ ...request.payload, schoolId: "school-b" }))).toEqual([]);
  expect(await adapter.parseEvents(envelope({ ...request.payload, schoolId: undefined }))).toEqual([]);
  expect(await adapter.parseEvents(envelope(request.payload, `${correlation.deliveryId}:${correlation.subjectId}:email`))).toEqual([]);
});
