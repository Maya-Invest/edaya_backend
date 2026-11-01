import type { AppBindings } from "@/http/bindings";
import { afterAll, expect, test } from "bun:test";
import { Hono } from "hono";
import createApp from "@/http/create-app";
import { parseRuntimeEnv } from "@/runtime/shared/env";
import { composeIdentity } from "../composition";
import { createAccountDirectory } from "../directory";
import { parseEnv } from "../env";
import { runIndependentJobs } from "../jobs";
import { ensureIdentitySigningKeys, signIdentityAccessToken } from "../jwt-keys";
import { createIdentityRuntime } from "../runtime";
import { verifyIdentityToken } from "../server";
import { verifyFixture } from "./register-fixture";

const origin = "https://api.edayaplus.test";
const web = "https://app.edayaplus.test";
const env = parseRuntimeEnv({ ALLOW_PUBLIC_ACCOUNT_REGISTRATION: true, API_ORIGIN: origin, RUNTIME: "local", NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: "pglite:memory", AUTH_DATABASE_URL: "pglite:memory", TRUSTED_ORIGINS: web });
const captured = new Map<string, string>();
const identity = await createIdentityRuntime(parseEnv({ ...env, RUNTIME: "test", BETTER_AUTH_URL: origin, FIRST_PARTY_API_ORIGINS: origin, BETTER_AUTH_SECRET: "disposable-secret-at-least-32-characters" }, "test"), { delivery: { async send(message) {
  captured.set(message.destination, message.code);
} } });
let schoolCalls = 0;
const app = new Hono<AppBindings>();
app.use(async (c, next) => {
  c.set("apiRuntime", { env, getIdentityRuntime: async () => identity, getIdentityClient: () => ({ directory: createAccountDirectory(async () => identity), verifyAccessToken: token => verifyIdentityToken(token, { issuer: origin, audience: origin, jwks: identity.keys.jwks }) }), async getSchoolApplication() {
    schoolCalls++;
    throw new Error("School database must not be initialized for authentication");
  }, close: async () => {} });
  await next();
});
app.route("/", createApp());
afterAll(() => identity.close());
const send = (path: string, body: object = {}, headers: Record<string, string> = {}) => app.request(`${origin}${path}`, { method: "POST", headers: { "origin": web, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }, env);

test("unified router issues host cookies and native credentials without school context", async () => {
  for (const native of [false, true]) {
    const email = `${crypto.randomUUID()}@example.test`;
    const start = await send("/auth/edaya/otp/start", { kind: "email", value: email });
    const { challenge } = await start.json() as { challenge: string };
    const offerResponse = await send("/auth/edaya/otp/verify", { challenge, code: captured.get(email) }, native ? { "x-edaya-client": "native" } : {});
    expect(offerResponse.headers.get("set-cookie")).toBeNull();
    const offer = await offerResponse.json() as { proof: string; state: string };
    expect(offer.state).toBe("registration_required");
    const verified = await send("/auth/edaya/registration/complete", { challenge, proof: offer.proof }, native ? { "x-edaya-client": "native" } : {});
    expect(verified.status).toBe(200);
    expect(verified.headers.get("set-cookie")).toContain("__Host-edaya_session=");
    expect(verified.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Lax");
    expect(verified.headers.get("set-cookie")).toContain("Secure");
    expect(verified.headers.get("set-cookie")).not.toContain("Domain=");
    const result = await verified.json() as { token?: string; user: { id: string } };
    const headers: Record<string, string> = native ? { authorization: `Bearer ${result.token}` } : { cookie: verified.headers.get("set-cookie")!.split(";")[0] };
    const exchange = await send("/auth/edaya/access-token", { resource: origin }, headers);
    expect(exchange.status).toBe(200);
    const { accessToken } = await exchange.json() as { accessToken: string };
    expect((await verifyIdentityToken(accessToken, { issuer: origin, audience: origin, jwks: identity.keys.jwks })).sub).toBe(result.user.id);
    const directory = createAccountDirectory(async () => identity);
    expect(await directory.lookupByContact("email", email.toUpperCase())).toEqual({ exists: true, id: result.user.id });
    expect((await directory.resolveBySubjectId(result.user.id))?.email).toBe(email);
    expect(await directory.resolveBySubjectId("unknown")).toBeUndefined();
  }
  expect(schoolCalls).toBe(0);
});
test("unknown auth and removed private routes fail before database and actor initialization", async () => {
  for (const path of ["/auth", "/internal", "/auth/sign-in/email", "/auth/edaya/unknown", "/internal/directory/by-contact", "/internal/account-policy/account"]) expect((await send(path)).status).toBe(404);
  expect(schoolCalls).toBe(0);
});
test("auth CORS, native header, origins, content types and body limits survive composition", async () => {
  const preflight = await app.request(`${origin}/auth/edaya/otp/start`, { method: "OPTIONS", headers: { "origin": web, "access-control-request-method": "POST", "access-control-request-headers": "x-edaya-client" } }, env);
  expect(preflight.headers.get("access-control-allow-origin")).toBe(web);
  expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");
  expect(preflight.headers.get("access-control-allow-headers")).toContain("x-edaya-client");
  expect((await send("/auth/edaya/session", {}, { origin: "https://foreign.test" })).status).toBe(403);
  expect((await send("/auth/edaya/session", {}, { "content-type": "text/plain" })).status).toBe(415);
  expect((await send("/auth/edaya/otp/start", { kind: "email", value: "x".repeat(1024 * 1024) })).status).toBe(413);
  expect((await app.request(`${origin}/.well-known/jwks.json`, {}, env)).status).toBe(200);
  expect(schoolCalls).toBe(0);
});
test("old/foreign issuer and audience fail while persistent signing keys survive", async () => {
  const retained = await ensureIdentitySigningKeys(identity.db);
  expect(retained.kid).toBe(identity.keys.kid);
  const claims = { sub: "account", auth_time: Math.floor(Date.now() / 1000), amr: ["email_otp"], iss: origin, aud: origin };
  for (const fields of [{ iss: "https://identity.api.edayaplus.com" }, { aud: "https://school.api.edayaplus.com" }, { iss: "https://foreign.test" }, { aud: "https://foreign.test" }]) {
    const { accessToken } = await signIdentityAccessToken(retained, { ...claims, ...fields });
    await expect(verifyIdentityToken(accessToken, { issuer: origin, audience: origin, jwks: retained.jwks })).rejects.toThrow();
  }
});
test("both scheduled jobs run and either failure is reported after both settle", async () => {
  for (const failed of [0, 1]) {
    const ran: number[] = [];
    await expect(runIndependentJobs([0, 1].map(id => async () => {
      ran.push(id);
      if (id === failed)
        throw new Error(`job ${id}`);
    }))).rejects.toThrow("Scheduled API tasks failed");
    expect(ran).toEqual([0, 1]);
  }
  await expect(runIndependentJobs([async () => {}, async () => {}])).resolves.toBeUndefined();
});

test("privileged MFA policy uses school repositories directly and remains lazy", async () => {
  let policies = 0;
  let code = "";
  const combined = composeIdentity({ ...env, REQUIRE_PRIVILEGED_TOTP: true }, async () => {
    policies++;
    return { repositories: { platformUsers: { findBySubjectId: async () => ({ isActive: true }) } } } as never;
  }, { delivery: { async send(message) { code = message.code; } } });
  try {
    const accountRuntime = await combined.resolve();
    const start = await accountRuntime.accounts.begin({ kind: "email", value: "privileged@example.test", ip: "test" });
    expect(policies).toBe(0);
    const verified = await verifyFixture(accountRuntime.accounts, start.challenge, code);
    expect(verified.state).toBe("enrollment_required");
    expect(policies).toBe(1);
  }
  finally { await combined.close(); }
});

test("unexpected authentication failures are sanitized and Worker cleanup is retained", async () => {
  let closed = 0;
  const work: Promise<unknown>[] = [];
  const failing = new Hono<AppBindings>();
  failing.use(async (c, next) => {
    c.set("apiRuntime", {
      env,
      getIdentityRuntime: async () => { throw new Error("private connection string"); },
      getIdentityClient: () => { throw new Error("School must not be reached"); },
      getSchoolApplication: async () => { throw new Error("School must not be reached"); },
      close: async () => { closed++; },
    });
    await next();
  });
  failing.route("/", createApp());
  const response = await failing.fetch(new Request(`${origin}/auth/edaya/methods`), { ...env, RUNTIME: "worker" }, { props: {}, waitUntil: work.push.bind(work), passThroughOnException() {} });
  expect(response.status).toBe(503);
  expect(await response.json() as unknown).toEqual({ code: "authentication_unavailable" });
  await Promise.all(work);
  expect(closed).toBe(1);
});
