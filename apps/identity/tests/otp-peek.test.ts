import { afterAll, describe, expect, test } from "bun:test";
import { createIdentityApp } from "../src/app";
import { parseEnv } from "../src/env";
import { attachIdentityRuntime, createIdentityRuntime } from "../src/runtime";

const issuer = "http://localhost:9900";
const browserOrigin = "http://localhost:5173";
describe("AUTH_DEV_OTP_PEEK", () => {
  const env = parseEnv({
    RUNTIME: "test",
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    AUTH_DATABASE_URL: "pglite:memory",
    BETTER_AUTH_SECRET: "test-secret-placeholder-key-32chars",
    BETTER_AUTH_URL: issuer,
    FIRST_PARTY_API_ORIGINS: "http://localhost:9999",
    TRUSTED_ORIGINS: browserOrigin,
    IDENTITY_DIRECTORY_SECRET: "test-directory-secret",
    REQUIRE_EMAIL_VERIFICATION: false,
    AUTH_DEV_OTP_PEEK: true,
  }, "test");
  const runtimePromise = createIdentityRuntime(env).then((runtime) => {
    attachIdentityRuntime(env, runtime);
    return runtime;
  });
  const app = createIdentityApp();
  afterAll(async () => {
    await (await runtimePromise).close();
  });
  async function request(path: string, init: RequestInit = {}) {
    await runtimePromise;
    return app.request(`${issuer}${path}`, init, env);
  }
  test("returns the last OTP for an email after send", async () => {
    const email = `peek-${crypto.randomUUID()}@school.edu`;
    const missing = await request(`/auth/edaya/dev/last-otp?email=${encodeURIComponent(email)}`);
    expect(missing.status).toBe(404);
    const send = await request("/auth/edaya/otp/start", {
      method: "POST",
      headers: {
        "origin": browserOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ value: email, kind: "email", channel: "email" }),
    });
    expect(send.ok).toBe(true);
    const peeked = await request(`/auth/edaya/dev/last-otp?email=${encodeURIComponent(email)}`);
    expect(peeked.status).toBe(200);
    const body = await peeked.json() as {
      otp: string;
    };
    expect(body.otp).toMatch(/^\d{6}$/);
    const challenge = (await send.json() as {
      challenge: string;
    }).challenge;
    const signedIn = await request("/auth/edaya/otp/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challenge, code: body.otp }),
    });
    expect(signedIn.ok).toBe(true);
  });
  test("requires an email query parameter", async () => {
    const response = await request("/auth/edaya/dev/last-otp");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "Email is required" });
  });
});
