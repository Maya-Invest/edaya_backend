import { expect, test } from "bun:test";
import { smsMessageReference } from "@edaya/core";
import { createSmsRouter } from "../src";

const message = { to: "+2250712345678", body: "test", attemptId: "attempt" };

test("longest prefix wins independently of route ordering; no broadcast or fallback", async () => {
  const calls: string[] = [];
  const provider = (id: string) => ({ async send() {
    calls.push(id);
    return { status: "accepted" as const, messageId: "same-id" };
  } });
  const router = createSmsRouter([{ prefix: "+225", provider: "general" }, { prefix: "+22507", provider: "specific" }, { prefix: "+1", provider: "north" }], { general: provider("general"), specific: provider("specific"), north: provider("north") });
  expect(await router.send(message)).toEqual({ status: "accepted", messageId: "same-id", providerId: "specific" });
  expect(await router.send({ ...message, to: "+15145550123" })).toMatchObject({ providerId: "north" });
  expect(calls).toEqual(["specific", "north"]);
  expect(smsMessageReference("specific", "same-id")).not.toBe(smsMessageReference("north", "same-id"));
});

test("unmatched or noncanonical numbers never call a provider", async () => {
  let calls = 0;
  const router = createSmsRouter([{ prefix: "+225", provider: "provider" }], { provider: { async send() {
    calls++;
    return { status: "uncertain" };
  } } });
  for (const to of ["+15145550123", "2250712345678", "+225 07 12345678", "+0225", "+225071234567890123"]) {
    expect(router.supports(to)).toBe(false);
    expect(await router.send({ ...message, to })).toMatchObject({ status: "rejected", retryable: false });
  }
  expect(calls).toBe(0);
});

test("timeouts remain uncertain without retrying another route", async () => {
  let calls = 0;
  const provider = { async send(): Promise<never> {
    calls++;
    throw new Error("private provider payload");
  } };
  const router = createSmsRouter([{ prefix: "+225", provider: "first" }, { prefix: "+22507", provider: "second" }], { first: provider, second: provider });
  expect(await router.send(message)).toEqual({ status: "uncertain", providerId: "second" });
  expect(calls).toBe(1);
});

test("invalid routes and missing providers fail at construction", () => {
  const route = { prefix: "+225", provider: "provider" };
  const providers = { provider: { async send() {
    return { status: "uncertain" as const };
  } } };
  expect(() => createSmsRouter([route, route], providers)).toThrow(/duplicate/);
  expect(() => createSmsRouter([route], {})).toThrow(/unregistered/);
  expect(() => createSmsRouter([{ ...route, prefix: "225" }], providers)).toThrow(/Invalid/);
});
