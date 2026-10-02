import { Buffer } from "node:buffer";
import { AccountService } from "@edaya/account";
import { createAccountRepository, createAccountSecurity, runAccountMigrations, totpCode } from "@edaya/adaptor-account";
import { runMigrations } from "@edaya/adaptor-auth";
import { createBetterAuthAdapter } from "@edaya/adaptor-auth-better-auth";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

const database = new PGlite();
const db = drizzle(database);
const { repository, db: transactionalDb } = createAccountRepository(db);
const security = createAccountSecurity({ v1: Buffer.alloc(32, 7).toString("base64") }, "v1");
const delivered = new Map<string, string>();
const delivery = { async send(input: { destination: string; code: string }) {
  delivered.set(input.destination, input.code);
} };
const adapter = createBetterAuthAdapter(transactionalDb, { secret: "test-only-secret-with-at-least-32-characters", baseUrl: "http://localhost:9900", generation: "better-auth:test", delivery });
let now = Date.now();
const service = new AccountService(repository, adapter, security, { requiresTotp: async () => false }, () => now, false, { mode: "whatsapp_first", supports: phone => phone.startsWith("+225"), delivery });
beforeAll(async () => {
  await runMigrations(db, { driver: "pglite" });
  await runAccountMigrations(db, "pglite");
});
afterAll(async () => {
  await database.close();
});
async function login(value: string) {
  const challenge = await service.begin({ kind: "email", value, channel: "email", ip: value });
  return service.verify(challenge.challenge, delivered.get(value)!);
}
test("real provider aliases belong to one Account; another Account cannot claim them", async () => {
  const first = await login("one@example.com");
  if (first.state !== "complete")
    throw new Error("Expected complete login");
  const challenge = await service.begin({ kind: "email", value: "alias@example.com", channel: "email", ip: "alias", credential: first.credential, recoveryEligible: true });
  const linked = await service.verify(challenge.challenge, delivered.get("alias@example.com")!, first.credential);
  expect(linked.state).toBe("linked");
  expect("account" in linked && linked.account.id).toBe(first.account.id);
  expect((await repository.get(first.account.id))?.identifiers).toHaveLength(2);
  const other = await login("other@example.com");
  if (other.state !== "complete")
    throw new Error("Expected complete login");
  now += 61000;
  const conflict = await service.begin({ kind: "email", value: "alias@example.com", channel: "email", ip: "conflict", credential: other.credential });
  await expect(service.verify(conflict.challenge, delivered.get("alias@example.com")!, other.credential)).rejects.toMatchObject({ code: "identifier_unavailable" });
});
test("real phone OTP verifies only the normalized phone identifier", async () => {
  const challenge = await service.begin({ kind: "phone", value: "+225 (07) 1234-5678", channel: "whatsapp", ip: "phone" });
  const stored = await db.execute(sql`SELECT value FROM auth.verification WHERE identifier='+2250712345678'`);
  expect(stored.rows[0]?.value).toMatch(/^[a-f0-9]{64}:0$/);
  const result = await service.verify(challenge.challenge, delivered.get("+2250712345678")!);
  if (result.state !== "complete")
    throw new Error("Expected complete login");
  expect(result.account.identifiers.map(i => i.kind)).toEqual(["phone"]);
});
test("concurrent OTP consumption succeeds once", async () => {
  const challenge = await service.begin({ kind: "email", value: "race@example.com", channel: "email", ip: "race" });
  const results = await Promise.allSettled([service.verify(challenge.challenge, delivered.get("race@example.com")!), service.verify(challenge.challenge, delivered.get("race@example.com")!)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
});
test("failed verification attempts persist", async () => {
  const challenge = await service.begin({ kind: "email", value: "wrong@example.com", channel: "email", ip: "wrong" });
  for (let i = 0;
    i < 5;
    i++)
    await expect(service.verify(challenge.challenge, "abcdef")).rejects.toMatchObject({ code: "invalid_code" });
  await expect(service.verify(challenge.challenge, delivered.get("wrong@example.com")!)).rejects.toMatchObject({ code: "attempts_exhausted" });
});
test("successful OTP proofs reset attempts, while resends preserve failed attempts", async () => {
  const repeated = new AccountService(repository, adapter, security, { requiresTotp: async () => false }, () => now, true);
  const value = "repeated-proof@example.com";
  for (let index = 0;
    index < 7;
    index++) {
    const challenge = await repeated.begin({ kind: "email", value, channel: "email", ip: value });
    const complete = await repeated.verify(challenge.challenge, delivered.get(value)!);
    expect(complete.state).toBe("complete");
  }
  const valueWithFailures = "resend-budget@example.com";
  const first = await repeated.begin({ kind: "email", value: valueWithFailures, channel: "email", ip: valueWithFailures });
  for (let index = 0;
    index < 4;
    index++)
    await expect(repeated.verify(first.challenge, "abcdef")).rejects.toMatchObject({ code: "invalid_code" });
  const resend = await repeated.begin({ kind: "email", value: valueWithFailures, channel: "email", ip: valueWithFailures });
  await expect(repeated.verify(first.challenge, delivered.get(valueWithFailures)!)).rejects.toMatchObject({ code: "challenge_expired" });
  await expect(repeated.verify(resend.challenge, "abcdef")).rejects.toMatchObject({ code: "invalid_code" });
  await expect(repeated.begin({ kind: "email", value: valueWithFailures, channel: "email", ip: valueWithFailures })).rejects.toMatchObject({ code: "attempts_exhausted" });
});
test("MFA, recovery and provider replacement preserve Account and authenticator", async () => {
  const first = await login("secure@example.com");
  if (first.state !== "complete")
    throw new Error("Expected complete login");
  const enrollment = await service.beginEnrollment({ credential: first.credential });
  const confirmed = await service.confirmEnrollment(enrollment.challenge, totpCode(enrollment.secret, Math.floor(now / 30000)));
  expect(confirmed.recoveryCodes).toHaveLength(10);
  await expect(service.getSession(first.credential)).rejects.toMatchObject({ status: 401 });
  now += 61000;
  const pending = await login("secure@example.com");
  if (pending.state !== "totp_required")
    throw new Error("Expected TOTP");
  await expect(service.getSession(pending.challenge)).rejects.toMatchObject({ status: 401 });
  const complete = await service.verifySecondFactor(pending.challenge, totpCode(enrollment.secret, Math.floor(now / 30000)));
  if (complete.state !== "complete")
    throw new Error("Expected complete login");
  const replacement = new AccountService(repository, { generation: "replacement", sendOtp: async () => { }, verifyOtp: async input => ({ provider: "replacement", subject: "new-subject", kind: input.kind, value: input.value }) }, security, { requiresTotp: async () => false }, () => now);
  now += 61000;
  const next = await replacement.begin({ kind: "email", value: "secure@example.com", channel: "email", ip: "replacement" });
  const nextPending = await replacement.verify(next.challenge, "123456");
  if (nextPending.state !== "totp_required")
    throw new Error("Expected TOTP");
  await expect(replacement.getSession(complete.credential)).rejects.toMatchObject({ status: 401 });
  const replaced = await replacement.verifySecondFactor(nextPending.challenge, totpCode(enrollment.secret, Math.floor(now / 30000)));
  expect("account" in replaced && replaced.account.id).toBe(first.account.id);
  now += 61000;
  const recoveryStart = await replacement.begin({ kind: "email", value: "secure@example.com", channel: "email", ip: "recovery" });
  const recoveryPending = await replacement.verify(recoveryStart.challenge, "123456");
  if (recoveryPending.state !== "totp_required")
    throw new Error("Expected TOTP");
  const recovery = await replacement.recover(recoveryPending.challenge, confirmed.recoveryCodes[0]!);
  await expect(replacement.getSession(recovery.challenge)).rejects.toMatchObject({ status: 401 });
  await expect(replacement.recover(recoveryPending.challenge, confirmed.recoveryCodes[0]!)).rejects.toMatchObject({ code: "challenge_expired" });
});

test("mandatory enrollment cannot issue a session or disable MFA", async () => {
  const required = new AccountService(repository, adapter, security, { requiresTotp: async () => true }, () => now);
  const challenge = await required.begin({ kind: "email", value: "owner@example.com", channel: "email", ip: "owner" });
  const pending = await required.verify(challenge.challenge, delivered.get("owner@example.com")!);
  if (pending.state !== "enrollment_required") {
    throw new Error("Enrollment required");
  }
  await expect(required.getSession(pending.challenge)).rejects.toMatchObject({ status: 401 });
  const enrollment = await required.beginEnrollment({ challenge: pending.challenge });
  const result = await required.confirmEnrollment(enrollment.challenge, totpCode(enrollment.secret, Math.floor(now / 30000)));
  if (result.state !== "complete") {
    throw new Error("Completion required");
  }
  await expect(required.disableTotp(result.credential)).rejects.toMatchObject({ code: "totp_required" });
  await expect(required.confirmEnrollment(enrollment.challenge, "123456")).rejects.toMatchObject({ code: "challenge_expired" });
});

test("unlink preserves a recovery contact and revokes sessions", async () => {
  const first = await login("unlink@example.com");
  if (first.state !== "complete") {
    throw new Error("Completion required");
  }
  await expect(service.unlink(first.credential, first.account.identifiers[0]!.id)).rejects.toMatchObject({ code: "recovery_identifier_required" });
  const challenge = await service.begin({ kind: "email", value: "unlink-alias@example.com", channel: "email", ip: "unlink", credential: first.credential, recoveryEligible: true });
  const linked = await service.verify(challenge.challenge, delivered.get("unlink-alias@example.com")!, first.credential);
  if (linked.state !== "linked") {
    throw new Error("Link required");
  }
  await service.unlink(first.credential, first.account.identifiers[0]!.id);
  await expect(service.getSession(first.credential)).rejects.toMatchObject({ status: 401 });
  const remaining = await repository.get(first.account.id);
  expect(remaining!.identifiers.map(i => i.value)).toEqual(["unlink-alias@example.com"]);
});
