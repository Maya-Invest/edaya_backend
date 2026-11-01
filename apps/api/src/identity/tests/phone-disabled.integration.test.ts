import type { OtpDeliveryPort } from "@edaya/account";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { createIdentityApp } from "../app";
import { parseEnv } from "../env";
import { attachIdentityRuntime, createIdentityRuntime } from "../runtime";
import { verifyFixture } from "./register-fixture";

const issuer = "http://127.0.0.1:9999";
const env = parseEnv({ ALLOW_PUBLIC_ACCOUNT_REGISTRATION: true, NODE_ENV: "test", AUTH_DATABASE_URL: "pglite:memory", LOG_LEVEL: "silent", BETTER_AUTH_SECRET: "test-secret-at-least-32-characters", BETTER_AUTH_URL: issuer, FIRST_PARTY_API_ORIGINS: "http://localhost:9999", PHONE_AUTH_MODE: "disabled" }, "test");
const messages: { channel: string; code: string }[] = [];
const delivery: OtpDeliveryPort = { async send(input) {
  messages.push(input);
  return { status: "accepted" };
} };
let runtime: Awaited<ReturnType<typeof createIdentityRuntime>>;
const app = createIdentityApp();
beforeAll(async () => {
  runtime = await createIdentityRuntime(env, { delivery });
  attachIdentityRuntime(env, runtime);
});
afterAll(async () => {
  await runtime.close();
});
const request = (path: string, body?: unknown, credential?: string) => app.request(`${issuer}/auth/edaya/${path}`, { method: body ? "POST" : "GET", headers: { "x-edaya-client": "native", "content-type": "application/json", ...(credential ? { authorization: `Bearer ${credential}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }, env);
test("disabled mode advertises email and rejects login and linking with no phone provider calls", async () => {
  const methods = await (await request("methods")).json() as { methods: { kind: string; available: boolean }[] };
  expect(methods.methods.find(method => method.kind === "phone")?.available).toBe(false);
  expect(methods.methods.some(method => method.kind === "email")).toBe(true);
  for (const channel of [undefined, "sms", "whatsapp"]) {
    const response = await request("otp/start", { kind: "phone", value: "+2250700000041", ...(channel ? { channel } : {}) });
    expect(response.status).toBe(channel === "sms" ? 400 : 503);
    if (channel !== "sms")
      expect(await response.json()).toMatchObject({ code: "phone_auth_unavailable" });
  }
  const started = await runtime.accounts.begin({ kind: "email", value: "disabled-owner@example.com", ip: "local" });
  const signedIn = await verifyFixture(runtime.accounts, started.challenge, messages.at(-1)!.code);
  if (signedIn.state !== "complete")
    throw new Error("Expected email login");
  const linked = await request("identifiers/start", { kind: "phone", value: "+2250700000042" }, signedIn.credential);
  expect(linked.status).toBe(503);
  expect(await linked.json()).toMatchObject({ code: "phone_auth_unavailable" });
  expect(messages.map(message => message.channel)).toEqual(["email"]);
});
