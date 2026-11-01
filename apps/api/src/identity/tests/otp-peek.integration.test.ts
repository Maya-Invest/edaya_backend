import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createIdentityApp } from "../app";
import { parseEnv } from "../env";
import { assertTestingEnvironment, createTestingIdentity } from "../testing/composition";

const issuer = "http://127.0.0.1:9999";
const origin = "http://localhost:5173";
const env = parseEnv({ ALLOW_PUBLIC_ACCOUNT_REGISTRATION: true, NODE_ENV: "test", AUTH_DATABASE_URL: "pglite:memory", LOG_LEVEL: "silent", BETTER_AUTH_SECRET: "test-secret-at-least-32-characters", BETTER_AUTH_URL: issuer, FIRST_PARTY_API_ORIGINS: "http://localhost:9999", TRUSTED_ORIGINS: origin }, "test");
const directory = mkdtempSync(join(tmpdir(), "edaya-otp-access-"));
const mailbox = join(directory, "mailbox.jsonl");
const deliveryCount = () => readFileSync(mailbox, "utf8").trim().split("\n").filter(Boolean).length;
let now = Date.now();
let fixture: Awaited<ReturnType<typeof createTestingIdentity>>;
beforeAll(async () => {
  fixture = await createTestingIdentity(env, { now: () => now, mailbox });
});
afterAll(async () => {
  await fixture.close();
  rmSync(directory, { recursive: true, force: true });
});
const request = (path: string, body?: unknown, credential?: string, extra: Record<string, string> = {}) => fixture.app.request(`${issuer}/auth/edaya/${path}`, { method: body === undefined ? "GET" : "POST", headers: { origin, "content-type": "application/json", ...(credential ? { authorization: `Bearer ${credential}` } : {}), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, env);
const reveal = (challenge: string, credential?: string) => request("testing/otp", { challenge }, credential);
async function begin(value: string, credential?: string) {
  const response = await request(credential ? "identifiers/start" : "otp/start", { kind: value.startsWith("+") ? "phone" : "email", value }, credential);
  expect(response.status).toBe(200);
  return (await response.json() as { challenge: string }).challenge;
}
async function login(value: string) {
  const challenge = await begin(value);
  const code = (await (await reveal(challenge)).json() as { otp: string }).otp;
  const response = await request("otp/verify", { challenge, code }, undefined, { "x-edaya-client": "native" });
  expect(response.status).toBe(200);
  const offer = await response.json() as { state: string; proof: string; token: string };
  if (offer.state === "complete")
    return offer.token;
  expect(offer.state).toBe("registration_required");
  const registered = await request("registration/complete", { challenge, proof: offer.proof }, undefined, { "x-edaya-client": "native" });
  expect(registered.status).toBe(200);
  return (await registered.json() as { token: string }).token;
}

describe("test-only OTP access", () => {
  test("normal app never mounts new or legacy endpoints, including when NODE_ENV=test", async () => {
    const app = createIdentityApp();
    // Even a broken/offline production runtime cannot expose unknown auth routes.
    const offline = { ...env, NODE_ENV: "production", AUTH_DATABASE_URL: "postgres://unreachable.invalid/offline" };
    for (const path of ["testing/capabilities", "testing/otp", "dev/last-otp?email=x@example.com"]) {
      const body = path === "testing/otp" ? { challenge: "x" } : undefined;
      const result = await app.request(`${issuer}/auth/edaya/${path}`, { method: body ? "POST" : "GET", ...(body ? { body: JSON.stringify(body) } : {}) }, offline);
      expect(result.status).toBe(404);
    }
  });
  test("captures email, WhatsApp and SMS with no additional send, guess or session", async () => {
    expect(await (await request("testing/capabilities")).json() as unknown).toEqual({ otpAccess: true });
    for (const value of ["reveal@example.com", "+2250700000031"]) {
      const challenge = await begin(value);
      const db = fixture.runtime.db as { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: { data: Record<string, number> }[] }> };
      const sessionCount = async () => (await db.execute(sql`SELECT jsonb_build_object('sessions', count(*)) AS data FROM identity.session`)).rows[0].data.sessions;
      const sessions = await sessionCount();
      const before = await fixture.runtime.accounts.status(challenge);
      const deliveries = deliveryCount();
      const response = await reveal(challenge);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("set-cookie")).toBeNull();
      const data = await response.json() as { challenge: string; otp: string; channel: string };
      expect(data).toMatchObject({ challenge, channel: value.startsWith("+") ? "whatsapp" : "email" });
      expect(data.otp).toMatch(/^\d{6}$/);
      expect(await fixture.runtime.accounts.status(challenge)).toEqual(before);
      expect((await reveal(challenge)).status).toBe(200);
      expect(deliveryCount()).toBe(deliveries);
      expect(await sessionCount()).toBe(sessions);
      const record = await db.execute(sql`SELECT data FROM identity.challenge WHERE id=${challenge}`);
      expect(record.rows[0].data.attempts).toBe(0);
      if (value.startsWith("+")) {
        now += 60000;
        const next = await request("otp/resend", { challenge, action: "sms", requestId: crypto.randomUUID() });
        const replacement = (await next.json() as { challenge: string }).challenge;
        expect((await reveal(challenge)).status).toBe(404);
        const sms = await (await reveal(replacement)).json() as { otp: string; channel: string };
        expect(sms.channel).toBe("sms");
        expect((await request("otp/verify", { challenge: replacement, code: sms.otp })).status).toBe(200);
        expect((await reveal(replacement)).status).toBe(404);
      }
      else {
        expect((await request("otp/verify", { challenge, code: data.otp })).status).toBe(200);
        expect((await reveal(challenge)).status).toBe(404);
      }
    }
  });
  test("requires the original recent linking session", async () => {
    const owner = await login("link-owner@example.com");
    const other = await login("link-other@example.com");
    for (const value of ["linked-reveal@example.com", "+2250500000032", "+2250100000033"]) {
      const challenge = await begin(value, owner);
      expect((await reveal(challenge, other)).status).toBe(403);
      expect((await reveal(challenge)).status).toBe(401);
      let current = challenge;
      if (value.endsWith("33")) {
        now += 60000;
        const replacement = await request("otp/resend", { challenge, action: "sms", requestId: crypto.randomUUID() }, owner);
        current = (await replacement.json() as { challenge: string }).challenge;
        expect((await reveal(challenge, owner)).status).toBe(404);
      }
      const code = (await (await reveal(current, owner)).json() as { otp: string }).otp;
      expect((await request("otp/verify", { challenge: current, code }, owner)).status).toBe(200);
      expect((await reveal(current, owner)).status).toBe(404);
    }
    const sameAccountDifferentSession = await login("link-owner@example.com");
    const recent = await begin("stale-session@example.com", owner);
    expect((await reveal(recent, sameAccountDifferentSession)).status).toBe(403);
    expect((await reveal(recent, owner)).status).toBe(200);
    now += 300001;
    expect((await reveal(recent, owner)).status).toBe(401);
  });
  test("rejects invalid bodies, origins, expired and exhausted challenges", async () => {
    expect((await request("testing/otp", { email: "no@example.com" })).status).toBe(400);
    expect((await request("testing/otp", { challenge: "unknown" })).status).toBe(404);
    expect((await request("testing/otp", { challenge: "unknown" }, undefined, { origin: "https://evil.example" })).status).toBe(403);
    expect((await request("testing/otp", { challenge: "unknown" }, undefined, { "content-type": "text/plain" })).status).toBe(415);
    const exhausted = await begin("exhausted@example.com");
    for (let i = 0; i < 5; i++) await request("otp/verify", { challenge: exhausted, code: "bad" });
    expect((await reveal(exhausted)).status).toBe(404);
    const expired = await begin("expired@example.com");
    now += 300000;
    expect((await reveal(expired)).status).toBe(404);
  });
  test("testing composition rejects production, Workers and remote databases", () => {
    for (const override of [{ NODE_ENV: "production" }, { RUNTIME: "worker" as const }, { BETTER_AUTH_URL: "https://identity.example.com" }, { AUTH_DATABASE_URL: "postgres://user:pass@example.com/db" }])
      expect(() => assertTestingEnvironment({ ...env, ...override })).toThrow();
  });
});
