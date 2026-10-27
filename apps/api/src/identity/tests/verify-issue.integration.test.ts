import { afterAll, expect, test } from "bun:test";
import { verifyIdentityToken } from "../server/index";
import { totpCode } from "@edaya/adaptor-account";
import { createIdentityApp } from "../app";
import { parseEnv } from "../env";
import { attachIdentityRuntime, createIdentityRuntime } from "../runtime";

const issuer = "http://localhost:9999";
const origin = "http://localhost:5173";
const audience = "http://localhost:9999";
const env = parseEnv({ NODE_ENV: "test", LOG_LEVEL: "silent", AUTH_DATABASE_URL: "pglite:memory", BETTER_AUTH_SECRET: "test-secret-placeholder-key-32chars", BETTER_AUTH_URL: issuer, FIRST_PARTY_API_ORIGINS: audience, TRUSTED_ORIGINS: origin }, "test");
const delivered = new Map<string, string>();
const runtimePromise = createIdentityRuntime(env, { delivery: { async send(message) {
  delivered.set(message.destination, message.code);
} } }).then((runtime) => {
  attachIdentityRuntime(env, runtime);
  return runtime;
});
const app = createIdentityApp();
afterAll(async () => (await runtimePromise).close());
async function request(path: string, body: object = {}, headers: Record<string, string> = {}) {
  await runtimePromise;
  return app.request(`${issuer}${path}`, { method: "POST", headers: { "content-type": "application/json", origin, ...headers }, body: JSON.stringify(body) }, env);
}
async function login(native = false) {
  const email = `${crypto.randomUUID()}@example.com`;
  const started = await request("/auth/edaya/otp/start", { kind: "email", value: email, channel: "email" });
  expect(started.status).toBe(200);
  const { challenge } = await started.json() as {
    challenge: string;
  };
  return request("/auth/edaya/otp/verify", { challenge, code: delivered.get(email) }, native ? { "x-edaya-client": "native" } : {});
}
test("browser cookies and native opaque credentials have the same Account contract", async () => {
  const browser = await login();
  expect(browser.status).toBe(200);
  const body = await browser.json() as {
    state: string;
    token?: string;
    user: {
      id: string;
    };
  };
  expect(body.state).toBe("complete");
  expect(body.token).toBeUndefined();
  const cookie = browser.headers.get("set-cookie")!.split(";")[0]!;
  const issued = await request("/auth/edaya/access-token", { resource: audience }, { cookie });
  expect(issued.status).toBe(200);
  const token = (await issued.json() as {
    accessToken: string;
  }).accessToken;
  const claims = await verifyIdentityToken(token, { issuer, audience, jwks: (await runtimePromise).keys.jwks });
  expect(claims.sub).toBe(body.user.id);
  expect(claims.amr).toEqual(["email_otp"]);
  expect(claims.auth_time).toBeGreaterThan(0);
  const native = await login(true);
  const nativeBody = await native.json() as {
    token: string;
  };
  expect(nativeBody.token.includes(".")).toBe(false);
  expect((await request("/auth/edaya/session", {}, { authorization: `Bearer ${nativeBody.token}` })).status).toBe(200);
  expect((await request("/auth/edaya/session", {}, { authorization: `Bearer ${token}` })).status).toBe(401);
});
test("unsupported provider/password routes are unreachable", async () => {
  for (const path of ["/auth/sign-in/email", "/auth/sign-up/email", "/auth/sign-in/email-otp", "/auth/two-factor/disable", "/auth/get-session"]) {
    expect((await request(path)).status).toBe(404);
  }
});
test("rejects untrusted origins and audiences and revokes renewal sessions", async () => {
  const response = await login(true);
  const { token } = await response.json() as {
    token: string;
  };
  expect((await request("/auth/edaya/access-token", { resource: "https://evil.example" }, { authorization: `Bearer ${token}` })).status).toBe(400);
  expect((await request("/auth/edaya/session", {}, { origin: "https://evil.example", authorization: `Bearer ${token}` })).status).toBe(403);
  expect((await request("/auth/edaya/sign-out", {}, { authorization: `Bearer ${token}` })).status).toBe(200);
  expect((await request("/auth/edaya/access-token", { resource: audience }, { authorization: `Bearer ${token}` })).status).toBe(401);
});
test("enrollment replaces the session only after proof and never exposes stored secrets", async () => {
  const response = await login(true);
  const { token } = await response.json() as {
    token: string;
  };
  const setup = await request("/auth/edaya/totp/enroll", {}, { authorization: `Bearer ${token}` });
  const { challenge, secret } = await setup.json() as {
    challenge: string;
    secret: string;
  };
  expect((await request("/auth/edaya/access-token", { resource: audience }, { authorization: `Bearer ${challenge}` })).status).toBe(401);
  const confirm = await request("/auth/edaya/totp/confirm", { challenge, code: totpCode(secret, Math.floor(Date.now() / 30000)) }, { "x-edaya-client": "native" });
  expect(confirm.status).toBe(200);
  const completed = await confirm.json() as {
    token: string;
    recoveryCodes: string[];
  };
  expect(completed.recoveryCodes).toHaveLength(10);
  expect((await request("/auth/edaya/session", {}, { authorization: `Bearer ${token}` })).status).toBe(401);
  const issued = await request("/auth/edaya/access-token", { resource: audience }, { authorization: `Bearer ${completed.token}` });
  const claims = await verifyIdentityToken((await issued.json() as {
    accessToken: string;
  }).accessToken, { issuer, audience, jwks: (await runtimePromise).keys.jwks });
  expect(claims.amr).toContain("totp");
  expect(claims.mfa_time).toBeGreaterThanOrEqual(claims.auth_time!);
});
