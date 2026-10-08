import { expect, test } from "bun:test";
import { parseEnv } from "../env";
import { phoneTestEnv } from "./support/phone-env";
import { createOtpDelivery } from "../otp-delivery";
import { phoneSmsPrefixes } from "../phone-config";

const env = phoneTestEnv;

test("WhatsApp defaults to French and uses identical body/button codes and attempt correlation", async () => {
  let request: Request | undefined;
  const delivery = createOtpDelivery(env, async (url, init) => {
    request = new Request(url, init);
    return Response.json({ messages: [{ id: "message" }] });
  });
  expect(await delivery.send({ channel: "whatsapp", destination: "+2250712345678", code: "654321", attemptId: "attempt" })).toEqual({ status: "accepted", messageId: "message" });
  expect(request!.url).toBe("https://graph.facebook.com/v23.0/1234/messages");
  expect(await request!.json() as unknown).toMatchObject({ to: "2250712345678", biz_opaque_callback_data: "attempt", template: { name: "edaya_fr", language: { code: "fr" }, components: [{ type: "body", parameters: [{ text: "654321" }] }, { type: "button", parameters: [{ text: "654321" }] }] } });
});
test("SMS validates the exact recipient and acceptance status, not HTTP success alone", async () => {
  let request: Request | undefined;
  const delivery = createOtpDelivery(env, async (url, init) => {
    request = new Request(url, init);
    return Response.json({ SMSMessageData: { Recipients: [{ number: "+2250712345678", statusCode: 101, messageId: "AT-id" }] } });
  });
  expect(await delivery.send({ channel: "sms", destination: "+2250712345678", code: "123456" })).toEqual({ status: "accepted", messageId: "sms:v1:[\"africas_talking\",\"AT-id\"]" });
  expect(request!.url).toBe("https://api.africastalking.com/version1/messaging");
  const form = new URLSearchParams(await request!.text());
  expect(form.get("to")).toBe("+2250712345678");
  expect(form.get("from")).toBe("EDAYA");
  expect(form.get("message")).toContain("123456");
  const failed = createOtpDelivery(env, async () => Response.json({ SMSMessageData: { Recipients: [{ number: "+2250712345678", statusCode: 403 }] } }));
  expect(await failed.send({ channel: "sms", destination: "+2250712345678", code: "123456" })).toEqual({ status: "failed" });
});
test("timeouts, malformed success and server errors remain uncertain without retries", async () => {
  for (const response of [async () => {
    throw new Error("timeout");
  }, async () => Response.json({}, { status: 503 }), async () => Response.json({})]) {
    let calls = 0;
    const delivery = createOtpDelivery(env, async () => {
      calls++;
      return response();
    });
    expect(await delivery.send({ channel: "whatsapp", destination: "+2250712345678", code: "123456" })).toEqual({ status: "uncertain" });
    expect(calls).toBe(1);
  }
});
test("SMS routes do not expand CI phone availability and invalid config fails closed", () => {
  expect(phoneSmsPrefixes([{ prefix: "+1", provider: "africas_talking" }])).toEqual([]);
  expect(phoneSmsPrefixes([{ prefix: "+225", provider: "africas_talking" }])).toEqual(["+225"]);
  expect(phoneSmsPrefixes([{ prefix: "+22599", provider: "africas_talking" }])).toEqual([]);
  expect(phoneSmsPrefixes([{ prefix: "+2", provider: "africas_talking" }])).toEqual(["+225"]);
  expect(() => parseEnv({ ...env, SMS_ROUTES: [{ prefix: "+225", provider: "unknown" }] }, "local")).toThrow();
  expect(() => parseEnv({ ...env, PHONE_SMS_ROUTES: [] }, "local")).toThrow(/removed/);
  expect(() => parseEnv({ ...env, WHATSAPP_APP_SECRET: undefined }, "local")).toThrow();
});
