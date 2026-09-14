import { describe, expect, test } from "bun:test";
import { createLogEmailTransport } from "../src/email/log";
import { createLogSmsTransport } from "../src/sms/log";
import { createUnimplementedSmsTransport } from "../src/sms/unimplemented";

describe("email and sms transports", () => {
  test("log email transport records a send", async () => {
    const calls: string[] = [];
    const transport = createLogEmailTransport(message => calls.push(message));
    const result = await transport.send({
      to: "a@b.c",
      from: { email: "noreply@edayaplus.com" },
      subject: "Hi",
      html: "<p>Hi</p>",
      idempotencyKey: "k1",
    });
    expect(result.providerMessageId).toBe("log:k1");
    expect(calls.length).toBe(1);
  });

  test("log SMS transport records a send", async () => {
    const calls: string[] = [];
    const transport = createLogSmsTransport(message => calls.push(message));
    const result = await transport.send({
      to: "+15145550123",
      body: "Hi",
      idempotencyKey: "s1",
    });
    expect(transport.implemented).toBe(true);
    expect(result.providerMessageId).toBe("log-sms:s1");
    expect(calls.length).toBe(1);
  });

  test("unimplemented SMS transport refuses to send", async () => {
    const transport = createUnimplementedSmsTransport();
    expect(transport.implemented).toBe(false);
    await expect(transport.send({ to: "+15145550123", body: "Hi", idempotencyKey: "s2" })).rejects.toThrow(/not implemented/);
  });
});
