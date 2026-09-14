import { describe, expect, it } from "bun:test";
import { resolveEmailTransport } from "@/runtime/shared/adapters/email-transport";
import { resolveSmsTransport } from "@/runtime/shared/adapters/sms-transport";
import { createPgliteTestEnv } from "../support/pglite-env";

describe("resolveEmailTransport", () => {
  it("uses the log transport on local runtimes", async () => {
    const transport = resolveEmailTransport(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:ephemeral-email-test",
    }), () => {});
    const result = await transport.send({
      to: "a@b.c",
      from: { email: "noreply@edayaplus.com" },
      subject: "Hi",
      html: "<p>Hi</p>",
      idempotencyKey: "k1",
    });
    expect(result.providerMessageId).toBe("log:k1");
  });

  it("throws when SMTP is selected", () => {
    expect(() => resolveEmailTransport(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:ephemeral-email-smtp",
      EMAIL_TRANSPORT: "smtp",
    }), () => {})).toThrow(/not implemented/);
  });

  it("requires the EMAIL binding on the worker runtime", () => {
    expect(() => resolveEmailTransport(createPgliteTestEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://worker/edaya",
      EMAIL_TRANSPORT: "cloudflare",
    }), () => {})).toThrow(/EMAIL send_email binding/);
  });
});

describe("resolveSmsTransport", () => {
  it("uses the log transport on local runtimes", async () => {
    const transport = resolveSmsTransport(createPgliteTestEnv({
      RUNTIME: "local",
      DATABASE_URL: "pglite:ephemeral-sms-test",
    }), () => {});
    expect(transport.implemented).toBe(true);
    const result = await transport.send({
      to: "+15145550123",
      body: "Hi",
      idempotencyKey: "s1",
    });
    expect(result.providerMessageId).toBe("log-sms:s1");
  });

  it("is unimplemented on the worker runtime", async () => {
    const transport = resolveSmsTransport(createPgliteTestEnv({
      RUNTIME: "worker",
      DATABASE_URL: "postgres://worker/edaya",
    }), () => {});
    expect(transport.implemented).toBe(false);
    await expect(transport.send({
      to: "+15145550123",
      body: "Hi",
      idempotencyKey: "s2",
    })).rejects.toThrow(/not implemented/);
  });
});
