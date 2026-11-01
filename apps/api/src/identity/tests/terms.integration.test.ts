import type { TermsAcceptanceInput, TermsPolicyPort, TermsResponse } from "@edaya/account";
import { Buffer } from "node:buffer";
import { AccountService } from "@edaya/account";
import { createAccountRepository, createAccountSecurity, runAccountMigrations, totpCode } from "@edaya/adaptor-account";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { createAccountAuthHandler, isAccountAuthRoute } from "../account-auth";
import { parseEnv } from "../env";
import { ensureIdentitySigningKeys } from "../jwt-keys";
import { createTermsPolicy } from "../terms-policy";

const database = new PGlite();
const db = drizzle(database);
const { repository } = createAccountRepository(db);
const security = createAccountSecurity({ v1: Buffer.alloc(32, 7).toString("base64") }, "v1");
let now = Date.now();
let version = "v1";
let sends = 0;
const policy: TermsPolicyPort = { current: locale => ({ enforced: true, document: { version, locale, documentHash: `${version}-${locale}-hash`, title: "Test terms", status: "published", sections: [{ heading: "Use", paragraphs: ["Test terms content"] }] } }) };
const provider = { generation: "test-terms", sendOtp: async () => {
  sends++;
}, preparePhoneOtp: async () => "123456", verifyOtp: async (input: { value: string; kind: "email" | "phone"; code: string }) => input.code === "123456" ? { provider: "test-terms", subject: input.value, kind: input.kind, value: input.value } : null };
const phone = { mode: "whatsapp_first" as const, supports: () => true, delivery: { send: async () => {
  sends++;
} } };
const service = new AccountService(repository, provider, security, { requiresTotp: async () => false }, () => now, true, phone, policy);
const consent = (locale: "fr" | "en" = "en"): TermsAcceptanceInput => ({ version, locale, accepted: true });
const start = (value: string, termsAcceptance = consent()) => service.begin({ kind: "email", value, ip: value, termsAcceptance });
const receipts = async (accountId: string) => (await db.execute(sql`SELECT * FROM identity.terms_acceptance WHERE account_id=${accountId} ORDER BY version`)).rows;
beforeAll(async () => {
  await runAccountMigrations(db, "pglite");
});
afterAll(async () => {
  await database.close();
});

test("missing and outdated acceptance fail before delivery, even for repeat sign-ins", async () => {
  const before = sends;
  await expect(service.begin({ kind: "email", value: "missing@example.com", ip: "missing" })).rejects.toMatchObject({ code: "terms_acceptance_required" });
  await expect(start("stale@example.com", { ...consent(), version: "old" })).rejects.toMatchObject({ code: "terms_version_changed" });
  expect(sends).toBe(before);
  const challenge = await start("repeat@example.com");
  const result = await service.verify(challenge.challenge, "123456");
  expect(result.state).toBe("complete");
  await expect(service.begin({ kind: "email", value: "repeat@example.com", ip: "repeat" })).rejects.toMatchObject({ code: "terms_acceptance_required" });
});

test("an unavailable live policy blocks authentication before sending a code", async () => {
  const unavailable = createTermsPolicy({ NODE_ENV: "test", AUTH_TERMS_MODE: "live" }, { fetch: async () => new Response(null, { status: 503 }) });
  const accounts = new AccountService(repository, provider, security, { requiresTotp: async () => false }, () => now, true, phone, unavailable);
  const before = sends;
  await expect(accounts.begin({ kind: "email", value: "unavailable@example.com", ip: "unavailable", termsAcceptance: consent() })).rejects.toMatchObject({ code: "terms_unavailable", status: 503 });
  expect(sends).toBe(before);
});

test("failed verification writes no receipt; completed login stores server-owned evidence once", async () => {
  const challenge = await start("receipt@example.com");
  await expect(service.verify(challenge.challenge, "654321")).rejects.toMatchObject({ code: "invalid_code" });
  expect(await repository.find("email", "receipt@example.com")).toBeNull();
  const result = await service.verify(challenge.challenge, "123456");
  if (result.state !== "complete")
    throw new Error("Expected login");
  const first = await receipts(result.account.id);
  expect(first).toEqual([{ account_id: result.account.id, version, locale: "en", document_hash: `${version}-en-hash`, accepted_at: now }]);
  now += 61000;
  const second = await start("receipt@example.com", consent("fr"));
  await service.verify(second.challenge, "123456");
  expect(await receipts(result.account.id)).toEqual(first);
});

test("new versions preserve history and existing sessions; email resend pins the original version", async () => {
  version = "email-v1";
  const first = await start("history@example.com");
  const signedIn = await service.verify(first.challenge, "123456");
  if (signedIn.state !== "complete")
    throw new Error("Expected login");
  const pending = await start("pinned@example.com");
  version = "email-v2";
  const replacement = await service.resend({ challenge: pending.challenge, action: "resend", ip: "resend", requestId: crypto.randomUUID() });
  const completed = await service.verify(replacement.challenge, "123456");
  if (completed.state !== "complete")
    throw new Error("Expected login");
  expect((await receipts(completed.account.id))[0]?.version).toBe("email-v1");
  expect((await service.getSession(signedIn.credential)).account.id).toBe(signedIn.account.id);
  const next = await start("history@example.com");
  await service.verify(next.challenge, "123456");
  expect((await receipts(signedIn.account.id)).map(row => row.version)).toEqual(["email-v1", "email-v2"]);
});

test("phone resend and SMS fallback retain acceptance and reject conflicting retries", async () => {
  version = "phone-v1";
  const requestId = crypto.randomUUID();
  const input = { kind: "phone" as const, value: "+2250712345678", ip: "phone", requestId, termsAcceptance: consent() };
  const initial = await service.begin(input);
  expect((await service.begin(input)).challenge).toBe(initial.challenge);
  await expect(service.begin({ ...input, termsAcceptance: consent("fr") })).rejects.toMatchObject({ code: "idempotency_conflict" });
  version = "phone-v2";
  now += 61000;
  const resent = await service.resend({ challenge: initial.challenge, action: "resend", ip: "phone", requestId: crypto.randomUUID() });
  now += 121000;
  const fallback = await service.resend({ challenge: resent.challenge, action: "sms", ip: "phone", requestId: crypto.randomUUID() });
  const completed = await service.verify(fallback.challenge, "123456");
  if (completed.state !== "complete")
    throw new Error("Expected login");
  expect((await receipts(completed.account.id))[0]?.version).toBe("phone-v1");
});

test("enrollment, second factor and recovery preserve the pinned document", async () => {
  version = "mfa-v1";
  const mfa = new AccountService(repository, provider, security, { requiresTotp: async () => true }, () => now, true, phone, policy);
  const initial = await mfa.begin({ kind: "email", value: "mfa@example.com", ip: "mfa", termsAcceptance: consent() });
  const pending = await mfa.verify(initial.challenge, "123456");
  if (pending.state !== "enrollment_required")
    throw new Error("Expected enrollment");
  const account = (await repository.find("email", "mfa@example.com"))!;
  expect(await receipts(account.id)).toHaveLength(0);
  const setup = await mfa.beginEnrollment({ challenge: pending.challenge });
  await expect(mfa.confirmEnrollment(setup.challenge, "invalid")).rejects.toMatchObject({ code: "invalid_code" });
  expect(await receipts(account.id)).toHaveLength(0);
  version = "mfa-v2";
  const enrolled = await mfa.confirmEnrollment(setup.challenge, totpCode(setup.secret, Math.floor(now / 30000)));
  expect((await receipts(account.id))[0]?.version).toBe("mfa-v1");
  now += 61000;
  const next = await mfa.begin({ kind: "email", value: "mfa@example.com", ip: "mfa", termsAcceptance: consent() });
  const factor = await mfa.verify(next.challenge, "123456");
  if (factor.state !== "totp_required")
    throw new Error("Expected second factor");
  await mfa.verifySecondFactor(factor.challenge, totpCode(setup.secret, Math.floor(now / 30000)));
  expect((await receipts(account.id)).map(row => row.version)).toEqual(["mfa-v1", "mfa-v2"]);
  version = "mfa-v3";
  const third = await mfa.begin({ kind: "email", value: "mfa@example.com", ip: "mfa", termsAcceptance: consent() });
  const recoverable = await mfa.verify(third.challenge, "123456");
  if (recoverable.state !== "totp_required")
    throw new Error("Expected second factor");
  const recovered = await mfa.recover(recoverable.challenge, enrolled.recoveryCodes[0]!);
  const reenroll = await mfa.beginEnrollment({ challenge: recovered.challenge });
  version = "mfa-v4";
  await mfa.confirmEnrollment(reenroll.challenge, totpCode(reenroll.secret, Math.floor(now / 30000)));
  expect((await receipts(account.id)).map(row => row.version)).toEqual(["mfa-v1", "mfa-v2", "mfa-v3"]);
});

test("acceptance and session writes roll back together on infrastructure failure", async () => {
  const failing = new AccountService({ ...repository, saveSession: async () => {
    throw new Error("database unavailable");
  } }, provider, security, { requiresTotp: async () => false }, () => now, true, phone, policy);
  const initial = await failing.begin({ kind: "email", value: "atomic@example.com", ip: "atomic", termsAcceptance: consent() });
  await expect(failing.verify(initial.challenge, "123456")).rejects.toThrow("database unavailable");
  expect(await repository.find("email", "atomic@example.com")).toBeNull();
  expect((await repository.challenge(initial.challenge))?.consumed).toBe(false);
});

test("concurrent consent inserts preserve the original acceptance timestamp", async () => {
  const initial = await start("concurrent@example.com");
  const result = await service.verify(initial.challenge, "123456");
  if (result.state !== "complete")
    throw new Error("Expected login");
  const before = await receipts(result.account.id);
  await Promise.all([1, 2, 3].map(offset => repository.saveTermsAcceptance({ accountId: result.account.id, version, locale: "fr", documentHash: "ignored", acceptedAt: now + offset })));
  expect(await receipts(result.account.id)).toEqual(before);
});

test("authenticated linking and enrollment do not request or invent acceptance", async () => {
  const off = new AccountService(repository, provider, security, { requiresTotp: async () => false }, () => now, true);
  const initial = await off.begin({ kind: "email", value: "existing@example.com", ip: "existing" });
  const result = await off.verify(initial.challenge, "123456");
  if (result.state !== "complete")
    throw new Error("Expected login");
  const alias = await service.begin({ kind: "email", value: "alias-terms@example.com", ip: "alias", credential: result.credential });
  expect((await service.verify(alias.challenge, "123456", result.credential)).state).toBe("linked");
  const setup = await service.beginEnrollment({ credential: result.credential });
  await service.confirmEnrollment(setup.challenge, totpCode(setup.secret, Math.floor(now / 30000)));
  expect(await receipts(result.account.id)).toHaveLength(0);
});

test("public terms HTTP endpoint validates locale and serializes published content without session", async () => {
  const env = parseEnv({ NODE_ENV: "test", AUTH_DATABASE_URL: "pglite:memory://", BETTER_AUTH_SECRET: "test-only-key-with-more-than-32-characters", BETTER_AUTH_URL: "http://localhost:9999", FIRST_PARTY_API_ORIGINS: "http://localhost:9999" }, "test");
  const handler = createAccountAuthHandler(service, env, await ensureIdentitySigningKeys(db));
  const request = new Request("http://localhost:9999/auth/edaya/terms?locale=en");
  expect(isAccountAuthRoute(request)).toBe(true);
  const response = await handler(request);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json() as TermsResponse).toEqual(await service.getTerms("en"));
  expect((await handler(new Request("http://localhost:9999/auth/edaya/terms?locale=invalid"))).status).toBe(400);
});
