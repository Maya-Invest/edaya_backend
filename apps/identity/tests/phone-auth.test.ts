import type { DeliveryResult, OtpDeliveryPort } from "@edaya/account";
import { Buffer } from "node:buffer";
import { createHmac } from "node:crypto";
import { AccountService } from "@edaya/account";
import { createAccountRepository, createAccountSecurity, runAccountMigrations } from "@edaya/adaptor-account";
import { runMigrations } from "@edaya/adaptor-auth";
import { createBetterAuthAdapter } from "@edaya/adaptor-auth-better-auth";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { createWhatsAppWebhook } from "../src/whatsapp-webhook";
import { phoneTestEnv } from "./support/phone-env";

const database = new PGlite();
const db = drizzle(database);
const { repository, db: providerDb } = createAccountRepository(db);
const security = createAccountSecurity({ v1: Buffer.alloc(32, 7).toString("base64") }, "v1");
const sends: { channel: string; destination: string; code: string; attemptId?: string }[] = [];
let deliveryResult: DeliveryResult = { status: "accepted", messageId: "message" };
let insideTransaction = false;
const transactional = { ...repository, async transaction<T>(work: () => Promise<T>) {
  return repository.transaction(async () => {
    insideTransaction = true;
    try {
      return await work();
    }
    finally { insideTransaction = false; }
  });
} };
const delivery: OtpDeliveryPort = { async send(input) {
  expect(insideTransaction).toBe(false);
  sends.push(input);
  return { ...deliveryResult, messageId: `${deliveryResult.messageId ?? "message"}-${input.attemptId}` };
} };
const provider = createBetterAuthAdapter(providerDb, { generation: "phone-test", secret: "test-secret-with-at-least-32-characters", baseUrl: "http://localhost:9900", delivery });
let now = Date.now();
const service = new AccountService(transactional, provider, security, { requiresTotp: async () => false }, () => now, false, { mode: "whatsapp_first", supports: phone => phone.startsWith("+225"), delivery });
const begin = (value: string, requestId = security.token()) => service.begin({ kind: "phone", value, ip: value, requestId });
const resend = (challenge: string, action: "resend" | "sms" = "resend", requestId = security.token()) => service.resend({ challenge, action, ip: "resend", requestId });
beforeAll(async () => {
  await runMigrations(db, { driver: "pglite" });
  await runAccountMigrations(db, "pglite");
});
afterAll(() => database.close());

test("simultaneous retries reserve one challenge and send once", async () => {
  let sendCount = 0;
  const concurrent = new AccountService(repository, provider, security, { requiresTotp: async () => false }, () => now, false, {
    mode: "whatsapp_first",
    supports: () => true,
    delivery: { async send() {
      sendCount++;
      return { status: "accepted" };
    } },
  });
  const input = { kind: "phone" as const, value: "+2250700000020", ip: "concurrent", requestId: security.token() };
  const [first, second] = await Promise.all([concurrent.begin(input), concurrent.begin(input)]);
  expect(first.challenge).toBe(second.challenge);
  expect(sendCount).toBe(1);
});

test("linking shares login cooldown and retains its session and recovery context on SMS replacement", async () => {
  const signIn = async (phone: string) => {
    const started = await begin(phone);
    const outcome = await service.verify(started.challenge, sends.at(-1)!.code);
    if (outcome.state !== "complete")
      throw new Error("Expected login");
    return outcome;
  };
  const owner = await signIn("+2250700000021");
  const other = await signIn("+2250500000021");
  const phone = "+2250100000021";
  const linked = await service.begin({ kind: "phone", value: phone, ip: "link", credential: owner.credential, recoveryEligible: true, locale: "en" });
  await expect(begin(phone)).rejects.toMatchObject({ code: "rate_limited" });
  await expect(service.status(linked.challenge, other.credential)).rejects.toMatchObject({ code: "invalid_challenge" });
  await expect(service.resend({ challenge: linked.challenge, action: "sms", requestId: security.token(), ip: "link", credential: other.credential })).rejects.toMatchObject({ code: "invalid_challenge" });
  now += 60000;
  const next = await service.resend({ challenge: linked.challenge, action: "sms", requestId: security.token(), ip: "link", credential: owner.credential });
  const code = sends.at(-1)!.code;
  await expect(service.verify(next.challenge, code, other.credential)).rejects.toMatchObject({ code: "invalid_challenge" });
  expect(await repository.challenge(next.challenge)).toMatchObject({ purpose: "link", accountId: owner.account.id, recoveryEligible: true, locale: "en" });
  const outcome = await service.verify(next.challenge, code, owner.credential);
  expect(outcome.state).toBe("linked");
  expect("account" in outcome && outcome.account.id).toBe(owner.account.id);
  now += 600000;
  await expect(service.status(next.challenge, owner.credential)).rejects.toMatchObject({ code: "reauthentication_required" });
});

test("a receipt arriving before the send response is reconciled without another message", async () => {
  let sendCount = 0;
  const early: AccountService = new AccountService(repository, provider, security, { requiresTotp: async () => false }, () => now, false, {
    mode: "whatsapp_first",
    supports: () => true,
    delivery: { async send(input) {
      sendCount++;
      await early.recordReceipt({ id: "early:delivered", messageId: "early", destination: input.destination, status: "delivered", timestamp: now });
      return { status: "accepted", messageId: "early" };
    } },
  });
  const result = await early.begin({ kind: "phone", value: "+2250500000022", ip: "early", requestId: security.token() });
  expect(result.delivery).toBe("delivered");
  expect(sendCount).toBe(1);
});

test("replay sends once, requests are bound to context, and cooldown rejection spends no send quota", async () => {
  const phone = "+2250700000001";
  const requestId = security.token();
  const first = await begin(phone, requestId);
  const count = sends.length;
  const replay = await begin(phone, requestId);
  expect(replay.challenge).toBe(first.challenge);
  expect(sends.length).toBe(count);
  await expect(begin("+2250700000002", requestId)).rejects.toMatchObject({ code: "idempotency_conflict" });
  for (let index = 0;
    index < 7;
    index++) await expect(resend(first.challenge, "sms")).rejects.toMatchObject({ code: "rate_limited", details: { nextResendAt: now + 60000 } });
  const quota = await db.execute(sql`SELECT count FROM identity.quota WHERE key=${`send:recipient:phone:${phone}`}`);
  expect(quota.rows[0]?.count).toBe(1);
  now += 60000;
  const second = await resend(first.challenge, "sms");
  expect(second.channel).toBe("sms");
  expect(second.nextResendAt - now).toBe(120000);
  const code = sends.at(-1)!.code;
  await expect(service.verify(first.challenge, code)).rejects.toMatchObject({ code: "challenge_expired" });
  await expect(resend(first.challenge)).rejects.toMatchObject({ code: "challenge_expired" });
  now += 120000;
  const third = await resend(second.challenge);
  expect(third.channel).toBe("sms");
  expect(third.nextResendAt - now).toBe(300000);
  await expect(resend(third.challenge, "sms")).rejects.toMatchObject({ code: "unsupported_channel" });
  now += 300000;
  expect((await service.status(third.challenge)).lifecycle).toBe("expired");
  const fourth = await resend(third.challenge);
  expect(fourth.challenge).not.toBe(third.challenge);
  expect(fourth.nextResendAt - now).toBe(300000);
  now += 3600000;
  const reset = await begin(phone);
  expect(reset.nextResendAt - now).toBe(60000);
});

test("uncertain and failed sends retain verification and explicit resend actions", async () => {
  for (const status of ["uncertain", "failed"] as const) {
    deliveryResult = { status };
    const first = await begin(status === "failed" ? "+2250500000001" : "+2250500000002");
    expect(first.delivery).toBe(status);
    expect(first.actions.sms).toBe(true);
    const code = sends.at(-1)!.code;
    expect((await service.verify(first.challenge, code)).state).toBe("complete");
  }
  deliveryResult = { status: "accepted", messageId: "message" };
});

test("unsupported destinations and Telegram fail before creating or sending an OTP", async () => {
  const count = sends.length;
  await expect(begin("+15145550123")).rejects.toMatchObject({ code: "phone_country_unsupported" });
  await expect(begin("+2252700000000")).rejects.toMatchObject({ code: "invalid_identifier" });
  await expect(service.begin({ kind: "phone", value: "+2250700000009", channel: "telegram", ip: "test" })).rejects.toMatchObject({ code: "unsupported_channel" });
  expect(sends.length).toBe(count);
});

test("failure budget survives resend and old proofs cannot authenticate the replacement", async () => {
  const first = await begin("+2250100000001");
  const firstCode = sends.at(-1)!.code;
  for (let index = 0;
    index < 4;
    index++) await expect(service.verify(first.challenge, "bad")).rejects.toMatchObject({ code: "invalid_code" });
  now += 60000;
  const next = await resend(first.challenge);
  await expect(service.verify(first.challenge, firstCode)).rejects.toMatchObject({ code: "challenge_expired" });
  await expect(service.verify(next.challenge, "bad")).rejects.toMatchObject({ code: "invalid_code" });
  now += 120000;
  await expect(resend(next.challenge)).rejects.toMatchObject({ code: "attempts_exhausted" });
});

test("signed callbacks deduplicate, isolate senders and never regress delivered status or send SMS", async () => {
  const first = await begin("+2250700000008");
  const webhook = createWhatsAppWebhook(service, phoneTestEnv);
  const messageId = `message-${first.challenge}`;
  const count = sends.length;
  const post = async (status: string, sender = "1234", signature = true, attemptId = first.challenge) => {
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "5678", changes: [{ field: "messages", value: { metadata: { phone_number_id: sender }, statuses: [{ id: messageId, recipient_id: "2250700000008", status, timestamp: "1790899200", biz_opaque_callback_data: attemptId }] } }] }] });
    const digest = createHmac("sha256", phoneTestEnv.WHATSAPP_APP_SECRET!).update(body).digest("hex");
    return webhook(new Request("http://localhost/auth/edaya/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": `sha256=${signature ? digest : "0".repeat(64)}` }, body }));
  };
  expect((await post("delivered", "1234", false)).status).toBe(403);
  await post("delivered", "999");
  expect((await service.status(first.challenge)).delivery).toBe("accepted");
  await post("delivered");
  await post("delivered");
  await post("sent");
  await post("failed");
  expect((await service.status(first.challenge)).delivery).toBe("delivered");
  expect(sends.length).toBe(count);
  expect((await repository.receipts(messageId)).length).toBe(3);
  now += 60000;
  const next = await resend(first.challenge, "sms");
  await post("read");
  expect((await service.status(next.challenge)).delivery).toBe("accepted");
  expect((await service.status(first.challenge)).lifecycle).toBe("superseded");
});
