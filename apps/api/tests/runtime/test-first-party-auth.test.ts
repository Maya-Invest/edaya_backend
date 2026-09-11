import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createAccessTokenStore, createDelegationGrantStore, createOAuthClientRegistry, runMigrations } from "@edaya/adaptor-auth";
import { createBetterAuth } from "@/runtime/shared/adapters/better-auth";

const database = new PGlite();
const db = drizzle(database);
const store = createAccessTokenStore(db);
const origin = "http://localhost:5173";
const env = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent" as const,
  BETTER_AUTH_URL: "http://localhost:9999",
  BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  TRUSTED_ORIGINS: origin,
  REQUIRE_EMAIL_VERIFICATION: false,
};
const auth = createBetterAuth(db, env);
const password = "A-synthetic-password-42";

beforeAll(() => runMigrations(db, { driver: "pglite" }));
afterAll(() => database.close());

async function request(path: string, body: unknown = {}, headers: Record<string, string> = {}) {
  return auth.handler(new Request(`http://localhost:9999/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
  }));
}

async function signup(email: string) {
  const response = await request("/sign-up/email", { email, password, name: "Synthetic account" });
  expect(response.status).toBe(200);
  expect(response.headers.has("set-auth-token")).toBe(false);
  expect((await response.json() as { token?: string }).token).toBeUndefined();
  const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
  return cookie;
}

async function exchange(cookie: string) {
  const response = await request("/edaya/access-token", {}, { cookie });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  return await response.json() as { accessToken: string; expiresAt: string };
}

describe("first-party Bearer boundary", () => {
  it("keeps the Worker auth quota enforced even with a test-labelled environment", async () => {
    const worker = createBetterAuth(db, { ...env, RUNTIME: "worker" });
    for (let i = 0; i < 120; i++) {
      await store.takeQuota("auth:synthetic-quota-ip", 120);
    }
    const response = await worker.handler(new Request("http://localhost:9999/auth/edaya/access-token", {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "synthetic-quota-ip", origin },
      body: "{}",
    }));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
  });
  it("exchanges a browser cookie for hashed, short-lived API authority", async () => {
    const cookie = await signup("browser@example.test");
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeNull();
    const token = await exchange(cookie);
    expect(token.accessToken).toMatch(/^edaya_at_[\w-]{43}$/);
    const active = await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token.accessToken}` }) }) as { user: { email: string } };
    expect(active.user.email).toBe("browser@example.test");
    const persisted = await database.query<{ digest: string }>("SELECT digest FROM auth.edaya_access_tokens");
    expect(persisted.rows.some(row => row.digest === token.accessToken)).toBe(false);
    expect(persisted.rows.every(row => /^[a-f0-9]{64}$/.test(row.digest))).toBe(true);
    expect(await store.resolve(token.accessToken, new Date(Date.now() + 6 * 60 * 1000))).toBeNull();
    const sessionResponse = await auth.handler(new Request("http://localhost:9999/auth/get-session", { headers: { cookie } }));
    const body = await sessionResponse.json() as { session: { token?: string } };
    expect(body.session.token).toBeUndefined();
  });

  it("rejects cross-origin exchange and never falls back after invalid Bearer", async () => {
    const cookie = await signup("origin@example.test");
    expect((await request("/edaya/access-token", {}, { cookie, origin: "https://untrusted.example" })).status).toBe(401);
    expect((await request("/edaya/access-token", {}, { cookie, authorization: "Bearer invalid" })).status).toBe(401);
    const legacy = createBetterAuth(db, { ...env, ALLOW_LEGACY_COOKIE_BUSINESS_AUTH: true });
    expect(await legacy.api.getSession({ headers: new Headers({ cookie }) })).not.toBeNull();
    expect(await legacy.api.getSession({ headers: new Headers({ cookie, authorization: "Bearer invalid" }) })).toBeNull();
  });

  it("requires login proof for native renewal and rejects unsigned session credentials", async () => {
    const email = "native@example.test";
    const cookie = await signup(email);
    const noProof = await request("/edaya/native/sign-in/email", { native: true }, { cookie });
    expect(noProof.status).toBeGreaterThanOrEqual(400);
    const login = await request("/edaya/native/sign-in/email", { email, password });
    expect(login.status).toBe(200);
    expect(login.headers.has("set-cookie")).toBe(false);
    const native = await login.json() as { renewalCredential: string };
    expect(native.renewalCredential).toContain(".");
    expect(await auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${native.renewalCredential}` }) })).toBeNull();
    expect((await request("/edaya/access-token", {}, { authorization: `Bearer ${native.renewalCredential}` })).status).toBe(200);
    const unsigned = decodeURIComponent(native.renewalCredential).split(".")[0];
    expect((await request("/edaya/access-token", {}, { cookie, authorization: `Bearer ${unsigned}` })).status).toBe(401);
  });

  it("logs out the Bearer session without revoking an ambient cookie's account", async () => {
    const first = await exchange(await signup("logout-a@example.test"));
    const otherCookie = await signup("logout-b@example.test");
    const other = await exchange(otherCookie);
    const response = await request("/edaya/sign-out", {}, { authorization: `Bearer ${first.accessToken}`, cookie: otherCookie });
    expect(response.status).toBe(200);
    expect(await store.resolve(first.accessToken)).toBeNull();
    expect((await store.resolve(other.accessToken))?.user.email).toBe("logout-b@example.test");
  });
  it("lists only owned grants and revokes without cookie or external-token fallback", async () => {
    const cookie = await signup("connected-owner@example.test");
    const owner = await exchange(cookie);
    const other = await exchange(await signup("connected-other@example.test"));
    const subject = (await store.resolve(owner.accessToken))!.user.id;
    const grants = createDelegationGrantStore(db);
    const client = await createOAuthClientRegistry(db).register({
      clientId: "synthetic-study-app",
      name: "Study app",
      purpose: "Study support",
      redirectUris: ["http://localhost:7777/callback"],
      scopes: ["students.profile:read"],
      confidential: true,
    });
    const grant = await db.transaction(async tx => createDelegationGrantStore(tx).create({
      subjectId: subject,
      clientId: client.clientId,
      guardianId: "synthetic-guardian",
      schoolId: "synthetic-school",
      studentIds: ["selected-child"],
      scopes: ["students.profile:read"],
    }));
    const list = (headers: Record<string, string>) => auth.handler(new Request("http://localhost:9999/auth/edaya/connected-apps", { headers }));
    expect((await list({ cookie })).status).toBe(401);
    expect((await list({ cookie, authorization: "Bearer edaya_oat_invalid" })).status).toBe(401);
    const response = await list({ authorization: `Bearer ${owner.accessToken}` });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as { items: Array<{ id: string; clientName: string; studentIds: string[] }>; nextCursor: null };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: grant.id, clientName: "Study app", studentIds: ["selected-child"] });
    expect(JSON.stringify(body)).not.toContain(client.clientSecret!);
    expect(await (await list({ authorization: `Bearer ${other.accessToken}` })).json() as unknown).toEqual({ items: [], nextCursor: null });
    expect((await request(`/edaya/connected-apps/${grant.id}/revoke`, {}, { authorization: `Bearer ${other.accessToken}`, cookie })).status).toBe(404);
    expect(await grants.findActive(grant.id)).not.toBeNull();
    expect((await request(`/edaya/connected-apps/${grant.id}/revoke`, {}, { cookie })).status).toBe(401);
    expect((await request(`/edaya/connected-apps/${grant.id}/revoke`, {}, { authorization: `Bearer ${owner.accessToken}` })).status).toBe(200);
    expect(await grants.findActive(grant.id)).toBeNull();
    expect((await request(`/edaya/connected-apps/${grant.id}/revoke`, {}, { authorization: `Bearer ${owner.accessToken}` })).status).toBe(200);
    expect(await (await list({ authorization: `Bearer ${owner.accessToken}` })).json() as unknown).toEqual({ items: [], nextCursor: null });
  });
});
