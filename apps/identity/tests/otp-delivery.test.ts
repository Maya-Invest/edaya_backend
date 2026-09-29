import { expect, test } from "bun:test";
import { parseEnv } from "../src/env";
import { createOtpDelivery } from "../src/otp-delivery";

const env = parseEnv({ RUNTIME: "local", NODE_ENV: "test", LOG_LEVEL: "silent", AUTH_DATABASE_URL: "pglite:memory", BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters", BETTER_AUTH_URL: "http://localhost:9900", FIRST_PARTY_API_ORIGINS: "http://localhost:9999", IDENTITY_DIRECTORY_SECRET: "test-directory-secret", TELEGRAM_GATEWAY_TOKEN: "test-telegram", WHATSAPP_ACCESS_TOKEN: "test-whatsapp", WHATSAPP_PHONE_NUMBER_ID: "1234", WHATSAPP_AUTH_TEMPLATE: "edaya_login", WHATSAPP_API_VERSION: "v23.0" }, "local");
test("Telegram supplies our bounded OTP without trusting delivery as authentication", async () => {
  const requests: Request[] = [];
  const delivery = createOtpDelivery(env, async (url, init) => {
    requests.push(new Request(url, init));
    return Response.json({ ok: true });
  });
  await delivery.send({ channel: "telegram", destination: "+14165551234", code: "123456" });
  expect(requests[0]!.url).toBe("https://gatewayapi.telegram.org/sendVerificationMessage");
  expect(await requests[0]!.json() as unknown).toEqual({ phone_number: "+14165551234", code: "123456", ttl: 300 });
});
test("WhatsApp uses the configured authentication template and identical copy-button code", async () => {
  let request: Request | undefined;
  const delivery = createOtpDelivery(env, async (url, init) => {
    request = new Request(url, init);
    return Response.json({ messages: [{ id: "test" }] });
  });
  await delivery.send({ channel: "whatsapp", destination: "+14165551234", code: "654321" });
  expect(request!.url).toBe("https://graph.facebook.com/v23.0/1234/messages");
  expect(await request!.json() as unknown).toMatchObject({ to: "14165551234", template: { name: "edaya_login", components: [{ type: "body", parameters: [{ text: "654321" }] }, { type: "button", parameters: [{ text: "654321" }] }] } });
});
test("delivery failures are not retried or silently redirected to another channel", async () => {
  let calls = 0;
  const delivery = createOtpDelivery(env, async () => {
    calls++;
    return Response.json({ ok: false }, { status: 429 });
  });
  await expect(delivery.send({ channel: "telegram", destination: "+14165551234", code: "123456" })).rejects.toThrow();
  expect(calls).toBe(1);
  await expect(createOtpDelivery({ ...env, NODE_ENV: "production", EMAIL: undefined, EMAIL_TRANSPORT: "log" }).send({ channel: "email", destination: "test@example.test", code: "123456" })).rejects.toThrow();
});
