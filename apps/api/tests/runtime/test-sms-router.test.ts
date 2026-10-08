import { expect, test } from "bun:test";
import { resolveSmsRouter } from "@/runtime/shared/adapters/sms-router";
import { resolveSmsTransport } from "@/runtime/shared/adapters/sms-transport";
import { parseEnv } from "@/runtime/shared/env/schema";

const configured = {
  NODE_ENV: "development",
  PHONE_AUTH_MODE: "disabled",
  SMS_TRANSPORT: "router",
  DATABASE_URL: "pglite:memory",
  SMS_ROUTES: "[{\"prefix\":\"+225\",\"provider\":\"africas_talking\"}]",
  AFRICAS_TALKING_USERNAME: "sandbox",
  AFRICAS_TALKING_API_KEY: "test-key",
  AFRICAS_TALKING_SENDER_ID: "EDAYA",
  AFRICAS_TALKING_SANDBOX: "true",
};

test("disabled consumers need no provider credentials, enabled consumers fail closed", () => {
  expect(resolveSmsRouter({}).supports("+2250712345678")).toBe(false);
  for (const config of [{ SMS_TRANSPORT: "router" }, { PHONE_AUTH_MODE: "sms_only" }]) {
    expect(() => resolveSmsRouter(config)).toThrow();
  }
  for (const key of ["AFRICAS_TALKING_API_KEY", "AFRICAS_TALKING_USERNAME", "AFRICAS_TALKING_SENDER_ID"]) {
    expect(() => resolveSmsRouter({ ...configured, [key]: undefined })).toThrow();
  }
  expect(() => resolveSmsRouter({ ...configured, SMS_ROUTES: "[]" })).toThrow();
  expect(() => resolveSmsRouter({ ...configured, NODE_ENV: "production" })).toThrow(/sandbox/);
  expect(() => resolveSmsRouter({ ...configured, AFRICAS_TALKING_USERNAME: "live-app" })).toThrow(/Sandbox username/);
  expect(() => resolveSmsRouter({ PHONE_SMS_ROUTES: "[]" })).toThrow(/removed/);
});

test("notification composition uses the injected router and preserves provider identity", async () => {
  let calls = 0;
  const router = resolveSmsRouter(configured, async () => {
    calls++;
    return Response.json({ SMSMessageData: { Recipients: [{ number: "+2250712345678", statusCode: 102, messageId: "message" }] } });
  });
  const transport = resolveSmsTransport(parseEnv(configured), () => {}, router);
  expect(await transport.send({ to: "+2250712345678", body: "test", idempotencyKey: "attempt" })).toEqual({ status: "accepted", providerMessageId: "sms:v1:[\"africas_talking\",\"message\"]" });
  expect(calls).toBe(1);
});
